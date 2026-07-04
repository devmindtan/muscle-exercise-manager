import { Platform } from 'react-native';
import * as LocalDB from '@/src/db/localDB';
import { supabase } from '@/src/lib/supabase';
import { createMuscleGroup, getMuscleGroups } from '@/src/lib/repository';
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
    visibility: row.visibility, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapRemoteShare(row: any): PlanShareItem {
  return {
    id: row.id, planId: row.plan_id, ownerId: row.owner_id, shareCode: row.share_code,
    visibility: row.visibility, createdAt: row.created_at, updatedAt: row.updated_at,
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

export async function searchProfiles(query: string): Promise<PublicProfile[]> {
  const userId = await getCurrentUserId();
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await (supabase as any)
    .from('profiles')
    .select('*')
    .ilike('display_name', `%${trimmed}%`)
    .neq('user_id', userId)
    .limit(20);
  if (error) throw error;
  return (data || []).map(mapRemoteProfile);
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
): Promise<PlanShareItem> {
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();
  const id = generateId();
  const shareCode = generateShareCode();

  if (Platform.OS === 'web') {
    const { error } = await (supabase as any).from('plan_shares').insert({
      id, plan_id: planId, owner_id: userId, share_code: shareCode, visibility,
      created_at: now, updated_at: now,
    });
    if (error) throw error;
  } else {
    await LocalDB.upsertPlanShare({
      id, plan_id: planId, owner_id: userId, share_code: shareCode, visibility,
      created_at: now, updated_at: now, deleted_at: null, sync_status: 'pending', user_id: userId,
    });
  }

  return { id, planId, ownerId: userId, shareCode, visibility, createdAt: now, updatedAt: now };
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

  const entryInputs: { dayKey: WeekDayKey; muscleGroupId: string; sets: number; note?: string | null }[] = [];

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
    entryInputs.push({
      dayKey: row.day_key as WeekDayKey,
      muscleGroupId: muscleGroupId!,
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
