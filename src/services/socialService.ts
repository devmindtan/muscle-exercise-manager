import { Platform } from 'react-native';
import * as LocalDB from '@/src/db/localDB';
import { supabase } from '@/src/lib/supabase';
import { createMuscleGroup, getMuscleGroups, createExercise, getExercises } from '@/src/lib/repository';
import { createWorkoutPlan, upsertWeeklyPlanEntries, WeekDayKey } from '@/src/services/weeklyPlanService';

export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

export interface FriendshipItem {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PublicProfile {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isPrivate: boolean;
}

export type PlanShareVisibility = 'link' | 'friends';

export interface PlanShareItem {
  id: string;
  planId: string;
  ownerId: string;
  shareCode: string;
  visibility: PlanShareVisibility;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SharedPlanEntryRow {
  plan_name: string;
  day_key: string;
  muscle_group_name: string;
  muscle_group_category: string | null;
  muscle_group_color: string | null;
  sets: number;
  note: string | null;
  exercise_name: string | null;
  exercise_notes: string | null;
  exercise_image_uri: string | null;
  parent_exercise_name: string | null;
  owner_display_name: string | null;
}

export interface PublicPlanShareItem {
  shareCode: string;
  planName: string;
  ownerDisplayName: string | null;
  createdAt: string;
}

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function generateShareCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function getCurrentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) throw new Error('Cần đăng nhập để dùng tính năng Cộng đồng');
  return userId;
}

// Display names alone aren't unique (many "Tan Nguyen"s), so every profile
// gets a short, stable tag derived from its userId (already globally unique)
// to tell people apart in search/friends lists — no schema change needed.
export function getUserTag(userId: string): string {
  const hex = userId.replace(/-/g, '');
  return hex.slice(-4).toUpperCase();
}

function mapLocalFriendship(row: LocalDB.LocalFriendship): FriendshipItem {
  return {
    id: row.id, requesterId: row.requester_id, addresseeId: row.addressee_id,
    status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapRemoteFriendship(row: any): FriendshipItem {
  return {
    id: row.id, requesterId: row.requester_id, addresseeId: row.addressee_id,
    status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapRemoteProfile(row: any): PublicProfile {
  return {
    userId: row.user_id, displayName: row.display_name, avatarUrl: row.avatar_url,
    bio: row.bio, isPrivate: !!row.is_private,
  };
}

function mapLocalShare(row: LocalDB.LocalPlanShare): PlanShareItem {
  return {
    id: row.id, planId: row.plan_id, ownerId: row.owner_id, shareCode: row.share_code,
    visibility: row.visibility, isPublic: !!row.is_public,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapRemoteShare(row: any): PlanShareItem {
  return {
    id: row.id, planId: row.plan_id, ownerId: row.owner_id, shareCode: row.share_code,
    visibility: row.visibility, isPublic: !!row.is_public,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

// ─── Friendships ────────────────────────────────────────────────────────────

export async function getMyFriendships(): Promise<FriendshipItem[]> {
  const userId = await getCurrentUserId();

  if (Platform.OS === 'web') {
    const { data, error } = await (supabase as any)
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .is('deleted_at', null);
    if (error) throw error;
    return (data || []).map(mapRemoteFriendship);
  }

  const rows = await LocalDB.getFriendships();
  return rows.map(mapLocalFriendship);
}

export async function sendFriendRequest(addresseeUserId: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (addresseeUserId === userId) {
    throw new Error('Không thể tự kết bạn với chính mình');
  }

  const now = new Date().toISOString();
  const id = generateId();

  if (Platform.OS === 'web') {
    const { error } = await (supabase as any).from('friendships').insert({
      id, requester_id: userId, addressee_id: addresseeUserId, status: 'pending',
      created_at: now, updated_at: now,
    });
    if (error) throw error;
    return;
  }

  await LocalDB.upsertFriendship({
    id, requester_id: userId, addressee_id: addresseeUserId, status: 'pending',
    created_at: now, updated_at: now, deleted_at: null, sync_status: 'pending', user_id: userId,
  });
}

export async function respondToFriendRequest(id: string, status: 'accepted' | 'declined'): Promise<void> {
  const now = new Date().toISOString();

  if (Platform.OS === 'web') {
    const { error } = await (supabase as any).from('friendships')
      .update({ status, updated_at: now }).eq('id', id);
    if (error) throw error;
    return;
  }

  const rows = await LocalDB.getFriendships();
  const existing = rows.find((r) => r.id === id);
  if (!existing) return;
  await LocalDB.upsertFriendship({ ...existing, status, updated_at: now, sync_status: 'pending' });
}

export async function removeFriendship(id: string): Promise<void> {
  const now = new Date().toISOString();

  if (Platform.OS === 'web') {
    const { error } = await (supabase as any).from('friendships')
      .update({ deleted_at: now, updated_at: now }).eq('id', id);
    if (error) throw error;
    return;
  }

  const rows = await LocalDB.getFriendships();
  const existing = rows.find((r) => r.id === id);
  if (!existing) return;
  await LocalDB.upsertFriendship({ ...existing, deleted_at: now, updated_at: now, sync_status: 'pending' });
}

// ─── Discovery ──────────────────────────────────────────────────────────────

// Lists everyone who has joined (including yourself) — no friendship needed
// to see someone. An empty query returns everyone; a non-empty query filters
// by display name.
export async function searchProfiles(query: string = ''): Promise<PublicProfile[]> {
  await getCurrentUserId(); // require login, but don't exclude self from results

  const trimmed = query.trim();
  let request = (supabase as any)
    .from('profiles')
    .select('*')
    .order('display_name', { ascending: true })
    .limit(200);

  if (trimmed) {
    request = request.ilike('display_name', `%${trimmed}%`);
  }

  const { data, error } = await request;
  if (error) throw error;
  return (data || []).map(mapRemoteProfile);
}

export interface FriendActivityDay {
  date: string; // 'YYYY-MM-DD'
  totalSets: number;
}

// Daily training volume for a GitHub-style contribution heatmap — only
// works for an accepted friend whose profile isn't private (RPC enforces it).
export async function getFriendActivityCalendar(friendUserId: string): Promise<FriendActivityDay[]> {
  const { data, error } = await (supabase as any).rpc('get_friend_activity_calendar', {
    p_friend_user_id: friendUserId,
  });
  if (error) throw error;
  return (data || []).map((r: any) => ({
    date: r.activity_date,
    totalSets: Number(r.total_sets) || 0,
  }));
}

// Your own daily training volume, read straight from Supabase (not the local
// SQLite mirror) so it's guaranteed consistent with what friends see via
// get_friend_activity_calendar — workout_logs only fully re-pulls to local
// on first sync, so a local-only read can go stale on a device that's been
// used for a while.
export async function getMyActivityCalendar(): Promise<FriendActivityDay[]> {
  const userId = await getCurrentUserId();
  const since = new Date();
  since.setDate(since.getDate() - 371);

  const { data, error } = await (supabase as any)
    .from('workout_logs')
    .select('sets, logged_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('logged_at', since.toISOString());
  if (error) throw error;

  const byDate = new Map<string, number>();
  for (const row of data || []) {
    const d = new Date(row.logged_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    byDate.set(key, (byDate.get(key) ?? 0) + (Number(row.sets) || 0));
  }
  return Array.from(byDate.entries()).map(([date, totalSets]) => ({ date, totalSets }));
}

export async function getProfileByUserId(userId: string): Promise<PublicProfile | null> {
  const { data, error } = await (supabase as any)
    .from('profiles').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ? mapRemoteProfile(data) : null;
}

// ─── Plan shares ────────────────────────────────────────────────────────────

export async function getMyPlanShares(): Promise<PlanShareItem[]> {
  const userId = await getCurrentUserId();

  if (Platform.OS === 'web') {
    const { data, error } = await (supabase as any)
      .from('plan_shares').select('*').eq('owner_id', userId).is('deleted_at', null);
    if (error) throw error;
    return (data || []).map(mapRemoteShare);
  }

  const rows = await LocalDB.getPlanShares();
  return rows.map(mapLocalShare);
}

export async function createPlanShare(
  planId: string,
  visibility: PlanShareVisibility,
  isPublic: boolean = false,
): Promise<PlanShareItem> {
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();
  const id = generateId();
  const shareCode = generateShareCode();

  if (Platform.OS === 'web') {
    const { error } = await (supabase as any).from('plan_shares').insert({
      id, plan_id: planId, owner_id: userId, share_code: shareCode, visibility, is_public: isPublic,
      created_at: now, updated_at: now,
    });
    if (error) throw error;
  } else {
    await LocalDB.upsertPlanShare({
      id, plan_id: planId, owner_id: userId, share_code: shareCode, visibility, is_public: isPublic ? 1 : 0,
      created_at: now, updated_at: now, deleted_at: null, sync_status: 'pending', user_id: userId,
    });
  }

  return { id, planId, ownerId: userId, shareCode, visibility, isPublic, createdAt: now, updatedAt: now };
}

export async function revokePlanShare(id: string): Promise<void> {
  if (Platform.OS === 'web') {
    const now = new Date().toISOString();
    const { error } = await (supabase as any).from('plan_shares')
      .update({ deleted_at: now, updated_at: now }).eq('id', id);
    if (error) throw error;
    return;
  }

  await LocalDB.softDeletePlanShare(id);
}

// Danh sách chia sẻ công khai — ai cũng xem được mà không cần biết mã
// trước, chỉ trả share_code + tên kế hoạch + tên tác giả (không lộ
// plan_id/owner_id thật). Xem chi tiết đầy đủ vẫn phải qua
// resolveSharedPlan(shareCode) như luồng nhập mã bình thường.
export async function listPublicPlanShares(): Promise<PublicPlanShareItem[]> {
  await getCurrentUserId();
  const { data, error } = await (supabase as any).rpc('list_public_plan_shares');
  if (error) throw error;
  return (data || []).map((r: any) => ({
    shareCode: r.share_code,
    planName: r.plan_name,
    ownerDisplayName: r.owner_display_name,
    createdAt: r.created_at,
  }));
}

// ─── Import a shared plan (one-time copy, not a live sync) ─────────────────

export async function resolveSharedPlan(shareCode: string): Promise<SharedPlanEntryRow[]> {
  const trimmed = shareCode.trim();
  if (!trimmed) return [];
  const { data, error } = await (supabase as any).rpc('get_shared_plan', { p_share_code: trimmed });
  if (error) throw error;
  return (data || []) as SharedPlanEntryRow[];
}

export async function importSharedPlan(shareCode: string): Promise<{
  planId: string;
  planName: string;
  importedEntries: number;
}> {
  const rows = await resolveSharedPlan(shareCode);
  if (rows.length === 0) {
    throw new Error('Không tìm thấy kế hoạch chia sẻ, hoặc bạn không có quyền xem.');
  }

  const userId = await getCurrentUserId();
  const planName = rows[0].plan_name;

  // Muscle groups are per-user data — match the shared entries to the
  // importer's own muscle groups by name, creating new ones when no match
  // exists. Never reuse the owner's muscle_group_id (it belongs to them).
  const myGroups = (await getMuscleGroups()) as any[];
  const nameToId = new Map<string, string>();
  for (const g of myGroups) {
    nameToId.set(String(g.name).trim().toLowerCase(), g.id);
  }

  // Exercises are also per-user data — matched/created by name within the
  // resolved muscle group, same pattern as muscle groups above. Cache per
  // muscle group so repeated rows referencing the same exercise across
  // different days don't create duplicates within one import.
  const exercisesByGroup = new Map<string, Map<string, { id: string; parent_exercise_id: string | null }>>();

  async function loadExerciseMap(muscleGroupId: string) {
    let map = exercisesByGroup.get(muscleGroupId);
    if (map) return map;
    const rowsForGroup = (await getExercises(muscleGroupId)) as any[];
    map = new Map();
    for (const ex of rowsForGroup) {
      map.set(String(ex.name).trim().toLowerCase(), { id: ex.id, parent_exercise_id: ex.parent_exercise_id ?? null });
    }
    exercisesByGroup.set(muscleGroupId, map);
    return map;
  }

  async function resolveOrCreateExercise(
    muscleGroupId: string,
    name: string,
    opts: { notes?: string | null; imageUri?: string | null; parentExerciseId?: string | null } = {},
  ): Promise<string> {
    const map = await loadExerciseMap(muscleGroupId);
    const key = name.trim().toLowerCase();
    const existing = map.get(key);
    if (existing) return existing.id;

    const created = await createExercise({
      muscleGroupId,
      name,
      notes: opts.notes || undefined,
      image_uri: opts.imageUri ?? null,
      parentExerciseId: opts.parentExerciseId ?? null,
    });
    const newId = (created as any).id;
    map.set(key, { id: newId, parent_exercise_id: opts.parentExerciseId ?? null });
    return newId;
  }

  const entryInputs: {
    dayKey: WeekDayKey;
    muscleGroupId: string;
    exerciseId?: string | null;
    sets: number;
    note?: string | null;
  }[] = [];

  for (const row of rows) {
    const key = row.muscle_group_name.trim().toLowerCase();
    let muscleGroupId = nameToId.get(key);
    if (!muscleGroupId) {
      const created = await createMuscleGroup({
        name: row.muscle_group_name,
        color: row.muscle_group_color || undefined,
        category: row.muscle_group_category || undefined,
      });
      muscleGroupId = (created as any).id;
      nameToId.set(key, muscleGroupId!);
    }

    let exerciseId: string | null = null;
    if (row.exercise_name) {
      let parentExerciseId: string | null = null;
      if (row.parent_exercise_name) {
        parentExerciseId = await resolveOrCreateExercise(muscleGroupId!, row.parent_exercise_name);
      }
      exerciseId = await resolveOrCreateExercise(muscleGroupId!, row.exercise_name, {
        notes: row.exercise_notes,
        imageUri: row.exercise_image_uri,
        parentExerciseId,
      });
    }

    entryInputs.push({
      dayKey: row.day_key as WeekDayKey,
      muscleGroupId: muscleGroupId!,
      exerciseId,
      sets: row.sets,
      note: row.note,
    });
  }

  const importedPlanName = `${planName} (đã nhập)`;
  const nextPlans = await createWorkoutPlan(importedPlanName, userId);
  // Plans are always returned ordered by created_at ascending — the plan we
  // just created is the last one.
  const newPlan = nextPlans[nextPlans.length - 1];

  await upsertWeeklyPlanEntries(entryInputs, userId, newPlan.id);

  return { planId: newPlan.id, planName: importedPlanName, importedEntries: entryInputs.length };
}
