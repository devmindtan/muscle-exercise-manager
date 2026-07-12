import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as LocalDB from '@/src/db/localDB';
import { supabase } from '@/src/lib/supabase';

export const WEEK_DAYS = [
  { key: 'mon', label: 'Thứ 2', order: 1 },
  { key: 'tue', label: 'Thứ 3', order: 2 },
  { key: 'wed', label: 'Thứ 4', order: 3 },
  { key: 'thu', label: 'Thứ 5', order: 4 },
  { key: 'fri', label: 'Thứ 6', order: 5 },
  { key: 'sat', label: 'Thứ 7', order: 6 },
  { key: 'sun', label: 'Chủ nhật', order: 7 },
] as const;

export type WeekDayKey = (typeof WEEK_DAYS)[number]['key'];

export type WeeklyPlanEntry = {
  id: string;
  dayKey: WeekDayKey;
  muscleGroupId: string;
  exerciseId: string | null;
  sets: number;
  reps: number | null;
  sortOrder: number | null;
  note: string | null;
  planId: string | null;
  createdAt: string;
  updatedAt: string;
};

// Thứ tự phẳng xuyên suốt cả ngày, không phân biệt nhóm cơ — người dùng chủ
// động sắp qua FocusOrderSheet (đánh số lại sortOrder 0..N-1 trên toàn bộ
// ngày mỗi lần đổi). Entry chưa từng được sắp (sortOrder null) rơi xuống
// cuối, fallback createdAt để có thứ tự ổn định. Dùng chung cho cả sheet sắp
// xếp và Focus Mode chạy thật, để 2 nơi luôn hiển thị đúng cùng 1 thứ tự.
export function sortWeeklyPlanEntriesForFocus(entries: WeeklyPlanEntry[]): WeeklyPlanEntry[] {
  return [...entries].sort((a, b) => {
    const aHas = a.sortOrder != null;
    const bHas = b.sortOrder != null;
    if (aHas && bHas) return (a.sortOrder as number) - (b.sortOrder as number);
    if (aHas !== bHas) return aHas ? -1 : 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export type WeeklyPlanEntryInput = {
  id?: string;
  dayKey: WeekDayKey;
  muscleGroupId: string;
  exerciseId?: string | null;
  sets: number;
  reps?: number | null;
  sortOrder?: number | null;
  note?: string | null;
};

export type WorkoutPlan = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getWebStorageKey(userId?: string | null) {
  return `weekly_plan_entries_v1_${userId || 'guest'}`;
}

function getWebPlansStorageKey(userId?: string | null) {
  return `workout_plans_v1_${userId || 'guest'}`;
}

async function getWebUserId() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

function normalizeEntries(value: unknown): WeeklyPlanEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const entry = item as Partial<WeeklyPlanEntry>;
      if (!entry.id || !entry.dayKey || !entry.muscleGroupId) return null;

      const numericSets = Number(entry.sets);
      if (!Number.isFinite(numericSets) || numericSets <= 0) return null;

      const numericReps = Number(entry.reps);
      const numericSortOrder = Number(entry.sortOrder);

      return {
        id: String(entry.id),
        dayKey: entry.dayKey as WeekDayKey,
        muscleGroupId: String(entry.muscleGroupId),
        exerciseId: entry.exerciseId ? String(entry.exerciseId) : null,
        sets: Math.round(numericSets),
        reps: Number.isFinite(numericReps) && numericReps > 0 ? Math.round(numericReps) : null,
        sortOrder: Number.isFinite(numericSortOrder) ? Math.round(numericSortOrder) : null,
        note: entry.note ? String(entry.note) : null,
        planId: entry.planId ? String(entry.planId) : null,
        createdAt: entry.createdAt || new Date().toISOString(),
        updatedAt: entry.updatedAt || new Date().toISOString(),
      };
    })
    .filter((entry): entry is WeeklyPlanEntry => Boolean(entry));
}

function normalizePlans(value: unknown): WorkoutPlan[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const plan = item as Partial<WorkoutPlan>;
      if (!plan.id || !plan.name) return null;
      return {
        id: String(plan.id),
        name: String(plan.name),
        isActive: !!plan.isActive,
        createdAt: plan.createdAt || new Date().toISOString(),
        updatedAt: plan.updatedAt || new Date().toISOString(),
      };
    })
    .filter((plan): plan is WorkoutPlan => Boolean(plan));
}

// ─── Web (guest, AsyncStorage-backed) plan storage ─────────────────────────────

async function getWebGuestPlans(userId?: string | null): Promise<WorkoutPlan[]> {
  const raw = await AsyncStorage.getItem(getWebPlansStorageKey(userId));
  if (!raw) return [];
  try {
    return normalizePlans(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function saveWebGuestPlans(plans: WorkoutPlan[], userId?: string | null) {
  await AsyncStorage.setItem(getWebPlansStorageKey(userId), JSON.stringify(normalizePlans(plans)));
}

async function ensureWebGuestDefaultPlan(userId?: string | null): Promise<WorkoutPlan> {
  const plans = await getWebGuestPlans(userId);
  const active = plans.find((p) => p.isActive) || plans[0];
  if (active) return active;

  const now = new Date().toISOString();
  const defaultPlan: WorkoutPlan = {
    id: generateId(),
    name: 'Kế hoạch của tôi',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  await saveWebGuestPlans([defaultPlan], userId);
  return defaultPlan;
}

// ─── Web (logged-in, Supabase-backed) plan storage ─────────────────────────────

async function ensureWebRemoteDefaultPlan(resolvedUserId: string): Promise<WorkoutPlan> {
  const { data, error } = await (supabase as any)
    .from('workout_plans')
    .select('*')
    .eq('user_id', resolvedUserId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const rows = (data || []) as any[];
  if (rows.length > 0) {
    const activeRow = rows.find((r) => r.is_active) || rows[0];
    return {
      id: activeRow.id,
      name: activeRow.name,
      isActive: !!activeRow.is_active,
      createdAt: activeRow.created_at,
      updatedAt: activeRow.updated_at,
    };
  }

  const now = new Date().toISOString();
  const id = generateId();
  const { error: insertError } = await (supabase as any).from('workout_plans').insert({
    id,
    user_id: resolvedUserId,
    name: 'Kế hoạch của tôi',
    is_active: true,
    created_at: now,
    updated_at: now,
  });
  if (insertError) throw insertError;

  return { id, name: 'Kế hoạch của tôi', isActive: true, createdAt: now, updatedAt: now };
}

// ─── Plans: public API ──────────────────────────────────────────────────────────

export async function getWorkoutPlans(userId?: string | null): Promise<WorkoutPlan[]> {
  if (Platform.OS === 'web') {
    const resolvedUserId = userId || (await getWebUserId());
    if (resolvedUserId) {
      await ensureWebRemoteDefaultPlan(resolvedUserId);
      const { data, error } = await (supabase as any)
        .from('workout_plans')
        .select('*')
        .eq('user_id', resolvedUserId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id, name: r.name, isActive: !!r.is_active, createdAt: r.created_at, updatedAt: r.updated_at,
      }));
    }

    await ensureWebGuestDefaultPlan(userId);
    return getWebGuestPlans(userId);
  }

  const rows = await LocalDB.getWorkoutPlans();
  return rows.map((r) => ({
    id: r.id, name: r.name, isActive: !!r.is_active, createdAt: r.created_at, updatedAt: r.updated_at,
  }));
}

export async function getActiveWorkoutPlanId(userId?: string | null): Promise<string | null> {
  if (Platform.OS === 'web') {
    const resolvedUserId = userId || (await getWebUserId());
    if (resolvedUserId) {
      const plan = await ensureWebRemoteDefaultPlan(resolvedUserId);
      return plan.id;
    }
    const plan = await ensureWebGuestDefaultPlan(userId);
    return plan.id;
  }

  const plan = await LocalDB.getActiveWorkoutPlan();
  return plan?.id ?? null;
}

export async function createWorkoutPlan(name: string, userId?: string | null): Promise<WorkoutPlan[]> {
  const trimmed = name.trim() || 'Kế hoạch mới';

  if (Platform.OS === 'web') {
    const resolvedUserId = userId || (await getWebUserId());
    const now = new Date().toISOString();

    if (resolvedUserId) {
      const id = generateId();
      const { error } = await (supabase as any).from('workout_plans').insert({
        id, user_id: resolvedUserId, name: trimmed, is_active: false, created_at: now, updated_at: now,
      });
      if (error) throw error;
      return getWorkoutPlans(resolvedUserId);
    }

    const plans = await getWebGuestPlans(userId);
    plans.push({ id: generateId(), name: trimmed, isActive: plans.length === 0, createdAt: now, updatedAt: now });
    await saveWebGuestPlans(plans, userId);
    return plans;
  }

  await LocalDB.createWorkoutPlan(trimmed);
  return getWorkoutPlans(userId);
}

export async function renameWorkoutPlan(id: string, name: string, userId?: string | null): Promise<WorkoutPlan[]> {
  const trimmed = name.trim();
  if (!trimmed) return getWorkoutPlans(userId);

  if (Platform.OS === 'web') {
    const resolvedUserId = userId || (await getWebUserId());

    if (resolvedUserId) {
      const { error } = await (supabase as any)
        .from('workout_plans')
        .update({ name: trimmed, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', resolvedUserId);
      if (error) throw error;
      return getWorkoutPlans(resolvedUserId);
    }

    const plans = await getWebGuestPlans(userId);
    const next = plans.map((p) => (p.id === id ? { ...p, name: trimmed, updatedAt: new Date().toISOString() } : p));
    await saveWebGuestPlans(next, userId);
    return next;
  }

  await LocalDB.renameWorkoutPlan(id, trimmed);
  return getWorkoutPlans(userId);
}

export async function setActiveWorkoutPlan(id: string, userId?: string | null): Promise<WorkoutPlan[]> {
  if (Platform.OS === 'web') {
    const resolvedUserId = userId || (await getWebUserId());
    const now = new Date().toISOString();

    if (resolvedUserId) {
      const { error: clearError } = await (supabase as any)
        .from('workout_plans')
        .update({ is_active: false, updated_at: now })
        .eq('user_id', resolvedUserId)
        .neq('id', id);
      if (clearError) throw clearError;

      const { error } = await (supabase as any)
        .from('workout_plans')
        .update({ is_active: true, updated_at: now })
        .eq('id', id)
        .eq('user_id', resolvedUserId);
      if (error) throw error;
      return getWorkoutPlans(resolvedUserId);
    }

    const plans = await getWebGuestPlans(userId);
    const next = plans.map((p) => ({ ...p, isActive: p.id === id, updatedAt: p.id === id ? now : p.updatedAt }));
    await saveWebGuestPlans(next, userId);
    return next;
  }

  await LocalDB.setActiveWorkoutPlan(id);
  return getWorkoutPlans(userId);
}

export async function deleteWorkoutPlan(id: string, userId?: string | null): Promise<WorkoutPlan[]> {
  const existingPlans = await getWorkoutPlans(userId);
  if (existingPlans.length <= 1) {
    // Always keep at least one plan so entries never end up orphaned with no home.
    return existingPlans;
  }

  const wasActive = existingPlans.find((p) => p.id === id)?.isActive;

  if (Platform.OS === 'web') {
    const resolvedUserId = userId || (await getWebUserId());
    const now = new Date().toISOString();

    if (resolvedUserId) {
      const { error } = await (supabase as any)
        .from('workout_plans')
        .update({ deleted_at: now, updated_at: now })
        .eq('id', id)
        .eq('user_id', resolvedUserId);
      if (error) throw error;

      await (supabase as any)
        .from('weekly_plan_entries')
        .update({ deleted_at: now, updated_at: now })
        .eq('plan_id', id)
        .eq('user_id', resolvedUserId);

      const remaining = await getWorkoutPlans(resolvedUserId);
      if (wasActive && remaining[0]) {
        return setActiveWorkoutPlan(remaining[0].id, resolvedUserId);
      }
      return remaining;
    }

    const plans = await getWebGuestPlans(userId);
    const remaining = plans.filter((p) => p.id !== id);
    if (wasActive && remaining[0]) remaining[0] = { ...remaining[0], isActive: true };
    await saveWebGuestPlans(remaining, userId);

    const entries = await getWebWeeklyPlanEntries(userId);
    await saveWebWeeklyPlanEntries(entries.filter((e) => e.planId !== id), userId);
    return remaining;
  }

  await LocalDB.softDeleteWorkoutPlan(id);
  const remaining = await getWorkoutPlans(userId);
  if (wasActive && remaining[0]) {
    return setActiveWorkoutPlan(remaining[0].id, userId);
  }
  return remaining;
}

// ─── Weekly plan entries ────────────────────────────────────────────────────────

async function getWebWeeklyPlanEntries(userId?: string | null, planId?: string | null) {
  const resolvedUserId = userId || (await getWebUserId());

  if (resolvedUserId) {
    let query = supabase
      .from('weekly_plan_entries')
      .select('*')
      .eq('user_id', resolvedUserId)
      .is('deleted_at', null);

    if (planId) {
      query = (query as any).eq('plan_id', planId);
    }

    const { data, error } = await query.order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    return normalizeEntries((data || []).map((row: any) => ({
      id: row.id,
      dayKey: row.day_key,
      muscleGroupId: row.muscle_group_id,
      exerciseId: row.exercise_id ?? null,
      sets: row.sets,
      reps: row.reps ?? null,
      sortOrder: row.sort_order ?? null,
      note: row.note,
      planId: row.plan_id ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })));
  }

  const raw = await AsyncStorage.getItem(getWebStorageKey(userId));
  if (!raw) return [];

  try {
    const all = normalizeEntries(JSON.parse(raw));
    return planId ? all.filter((e) => e.planId === planId) : all;
  } catch {
    return [];
  }
}

async function saveWebWeeklyPlanEntries(
  entries: WeeklyPlanEntry[],
  userId?: string | null,
) {
  await AsyncStorage.setItem(
    getWebStorageKey(userId),
    JSON.stringify(normalizeEntries(entries)),
  );
}

export async function getWeeklyPlanEntries(userId?: string | null, planId?: string | null) {
  if (Platform.OS === 'web') {
    return getWebWeeklyPlanEntries(userId, planId);
  }

  const rows = await LocalDB.getWeeklyPlanEntries(planId ?? undefined);
  return rows.map((row) => ({
    id: row.id,
    dayKey: row.day_key as WeekDayKey,
    muscleGroupId: row.muscle_group_id,
    exerciseId: row.exercise_id || null,
    sets: Number(row.sets) || 0,
    reps: row.reps != null ? Number(row.reps) : null,
    sortOrder: row.sort_order != null ? Number(row.sort_order) : null,
    note: row.note || null,
    planId: row.plan_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function upsertWeeklyPlanEntry(
  input: WeeklyPlanEntryInput,
  userId?: string | null,
  planId?: string | null,
) {
  const now = new Date().toISOString();
  const resolvedPlanId = planId ?? (await getActiveWorkoutPlanId(userId));
  const nextEntry: WeeklyPlanEntry = {
    id: input.id || generateId(),
    dayKey: input.dayKey,
    muscleGroupId: input.muscleGroupId,
    exerciseId: input.exerciseId ?? null,
    sets: Math.max(1, Math.round(input.sets)),
    reps: input.reps != null && input.reps > 0 ? Math.round(input.reps) : null,
    sortOrder: input.sortOrder ?? null,
    note: input.note?.trim() || null,
    planId: resolvedPlanId,
    createdAt: now,
    updatedAt: now,
  };

  if (Platform.OS === 'web') {
    const resolvedUserId = userId || (await getWebUserId());

    if (resolvedUserId) {
      const { error } = await (supabase.from('weekly_plan_entries').upsert({
        id: nextEntry.id,
        user_id: resolvedUserId,
        day_key: nextEntry.dayKey,
        muscle_group_id: nextEntry.muscleGroupId,
        exercise_id: nextEntry.exerciseId,
        sets: nextEntry.sets,
        reps: nextEntry.reps,
        sort_order: nextEntry.sortOrder,
        note: nextEntry.note,
        plan_id: nextEntry.planId,
        created_at: nextEntry.createdAt,
        updated_at: now,
        deleted_at: null,
      }) as any);

      if (error) throw error;
      return getWebWeeklyPlanEntries(resolvedUserId, resolvedPlanId);
    }

    const entries = await getWebWeeklyPlanEntries(userId);
    const existingIndex = entries.findIndex((entry) => entry.id === nextEntry.id);

    if (existingIndex >= 0) {
      const existing = entries[existingIndex];
      entries[existingIndex] = {
        ...nextEntry,
        createdAt: existing.createdAt,
        updatedAt: now,
      };
    } else {
      entries.push(nextEntry);
    }

    await saveWebWeeklyPlanEntries(entries, userId);
    return resolvedPlanId ? entries.filter((e) => e.planId === resolvedPlanId) : entries;
  }

  const existingEntries = await getWeeklyPlanEntries(userId, resolvedPlanId);
  const existing = existingEntries.find((entry) => entry.id === nextEntry.id);

  await LocalDB.upsertWeeklyPlanEntry({
    id: nextEntry.id,
    day_key: nextEntry.dayKey,
    muscle_group_id: nextEntry.muscleGroupId,
    exercise_id: nextEntry.exerciseId,
    sets: nextEntry.sets,
    reps: nextEntry.reps,
    sort_order: nextEntry.sortOrder,
    note: nextEntry.note,
    plan_id: resolvedPlanId,
    created_at: existing?.createdAt || now,
    updated_at: now,
    dirty: 1,
    deleted: 0,
  });

  return getWeeklyPlanEntries(userId, resolvedPlanId);
}

export async function upsertWeeklyPlanEntries(
  inputs: WeeklyPlanEntryInput[],
  userId?: string | null,
  planId?: string | null,
) {
  const resolvedPlanId = planId ?? (await getActiveWorkoutPlanId(userId));

  if (inputs.length === 0) {
    return getWeeklyPlanEntries(userId, resolvedPlanId);
  }

  const now = new Date().toISOString();
  const nextEntries = inputs.map<WeeklyPlanEntry>((input) => ({
    id: input.id || generateId(),
    dayKey: input.dayKey,
    muscleGroupId: input.muscleGroupId,
    exerciseId: input.exerciseId ?? null,
    sets: Math.max(1, Math.round(input.sets)),
    reps: input.reps != null && input.reps > 0 ? Math.round(input.reps) : null,
    sortOrder: input.sortOrder ?? null,
    note: input.note?.trim() || null,
    planId: resolvedPlanId,
    createdAt: now,
    updatedAt: now,
  }));

  if (Platform.OS === 'web') {
    const resolvedUserId = userId || (await getWebUserId());

    if (resolvedUserId) {
      const payload = nextEntries.map((nextEntry) => ({
        id: nextEntry.id,
        user_id: resolvedUserId,
        day_key: nextEntry.dayKey,
        muscle_group_id: nextEntry.muscleGroupId,
        exercise_id: nextEntry.exerciseId,
        sets: nextEntry.sets,
        reps: nextEntry.reps,
        sort_order: nextEntry.sortOrder,
        note: nextEntry.note,
        plan_id: nextEntry.planId,
        created_at: nextEntry.createdAt,
        updated_at: now,
        deleted_at: null,
      }));

      const { error } = await (supabase.from('weekly_plan_entries').upsert(payload as any) as any);
      if (error) throw error;
      return getWebWeeklyPlanEntries(resolvedUserId, resolvedPlanId);
    }

    const entries = await getWebWeeklyPlanEntries(userId);

    for (const nextEntry of nextEntries) {
      const existingIndex = entries.findIndex((entry) => entry.id === nextEntry.id);

      if (existingIndex >= 0) {
        const existing = entries[existingIndex];
        entries[existingIndex] = {
          ...nextEntry,
          createdAt: existing.createdAt,
          updatedAt: now,
        };
      } else {
        entries.push(nextEntry);
      }
    }

    await saveWebWeeklyPlanEntries(entries, userId);
    return resolvedPlanId ? entries.filter((e) => e.planId === resolvedPlanId) : entries;
  }

  const existingEntries = await getWeeklyPlanEntries(userId, resolvedPlanId);
  const existingById = new Map(existingEntries.map((entry) => [entry.id, entry]));

  for (const nextEntry of nextEntries) {
    const existing = existingById.get(nextEntry.id);

    await LocalDB.upsertWeeklyPlanEntry({
      id: nextEntry.id,
      day_key: nextEntry.dayKey,
      muscle_group_id: nextEntry.muscleGroupId,
      exercise_id: nextEntry.exerciseId,
      sets: nextEntry.sets,
      reps: nextEntry.reps,
      sort_order: nextEntry.sortOrder,
      note: nextEntry.note,
      plan_id: resolvedPlanId,
      created_at: existing?.createdAt || now,
      updated_at: now,
      dirty: 1,
      deleted: 0,
    });
  }

  return getWeeklyPlanEntries(userId, resolvedPlanId);
}

export async function deleteWeeklyPlanEntry(id: string, userId?: string | null, planId?: string | null) {
  if (Platform.OS === 'web') {
    const resolvedUserId = userId || (await getWebUserId());

    if (resolvedUserId) {
      const { error } = await (supabase
        .from('weekly_plan_entries')
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any)
        .eq('id', id)
        .eq('user_id', resolvedUserId)
        .is('deleted_at', null) as any);

      if (error) throw error;
      return getWebWeeklyPlanEntries(resolvedUserId, planId);
    }

    const entries = await getWebWeeklyPlanEntries(userId);
    const filtered = entries.filter((entry) => entry.id !== id);
    await saveWebWeeklyPlanEntries(filtered, userId);
    return planId ? filtered.filter((e) => e.planId === planId) : filtered;
  }

  await LocalDB.deleteWeeklyPlanEntry(id);
  return getWeeklyPlanEntries(userId, planId);
}
