import { supabase } from './supabase';
import { MuscleGroup, Exercise, WorkoutLog } from '@/types/database';

export type RecentLog = WorkoutLog & {
  exercise_name: string;
  muscle_group_name: string;
  muscle_group_color: string;
};

export type WeekStat = MuscleGroup & {
  weekly_sets: number;
  progress: number;
};

type LocalState = {
  muscle_groups: MuscleGroup[];
  exercises: Exercise[];
  workout_logs: WorkoutLog[];
};

const STATE_KEY = 'muscle-manager:web-state';

function genId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function now(): string {
  return new Date().toISOString();
}

async function getUserId(): Promise<string | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData.session?.user.id ?? null;
}

function loadState(): LocalState {
  if (typeof window === 'undefined') {
    return { muscle_groups: [], exercises: [], workout_logs: [] };
  }
  try {
    const raw = window.localStorage.getItem(STATE_KEY);
    if (!raw) return { muscle_groups: [], exercises: [], workout_logs: [] };
    return JSON.parse(raw) as LocalState;
  } catch {
    return { muscle_groups: [], exercises: [], workout_logs: [] };
  }
}

function saveState(state: LocalState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function touch<T extends { updated_at: string; sync_status: string }>(
  row: T,
): T {
  return { ...row, updated_at: now(), sync_status: 'pending' };
}

function isAlive(row: { deleted_at?: string | null }): boolean {
  return !row.deleted_at;
}

function toExercise(row: Exercise): Exercise {
  return { ...row, is_active: Boolean(row.is_active) };
}

function withLatestLogs(
  logs: WorkoutLog[],
  exercises: Exercise[],
  groups: MuscleGroup[],
): RecentLog[] {
  return logs
    .filter(isAlive)
    .slice()
    .sort((a, b) => b.logged_at.localeCompare(a.logged_at))
    .map((log) => {
      const ex = exercises.find((e) => e.id === log.exercise_id);
      const group = groups.find((g) => g.id === log.muscle_group_id);
      return {
        ...log,
        exercise_name: ex?.name ?? '',
        muscle_group_name: group?.name ?? '',
        muscle_group_color: group?.color ?? '#E8FF5A',
      };
    });
}

export async function getMuscleGroups(): Promise<MuscleGroup[]> {
  const state = loadState();
  return state.muscle_groups
    .filter(isAlive)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function getMuscleGroup(id: string): Promise<MuscleGroup | null> {
  const state = loadState();
  return state.muscle_groups.find((g) => g.id === id && isAlive(g)) ?? null;
}

export async function insertMuscleGroup(data: {
  name: string;
  color: string;
  target_sets_per_week: number;
  target_sets_per_month: number;
  image_uri?: string | null;
}): Promise<MuscleGroup> {
  const state = loadState();
  const userId = await getUserId();
  const row: MuscleGroup = {
    id: genId(),
    name: data.name,
    color: data.color,
    target_sets_per_week: data.target_sets_per_week,
    target_sets_per_month: data.target_sets_per_month,
    image_uri: data.image_uri ?? null,
    created_at: now(),
    updated_at: now(),
    sync_status: 'pending',
    deleted_at: null,
    user_id: userId,
  };
  state.muscle_groups.push(row);
  saveState(state);
  return row;
}

export async function updateMuscleGroup(
  id: string,
  data: {
    name?: string;
    color?: string;
    target_sets_per_week?: number;
    target_sets_per_month?: number;
    image_uri?: string | null;
  },
): Promise<void> {
  const state = loadState();
  const row = state.muscle_groups.find((g) => g.id === id);
  if (!row) return;
  Object.assign(row, data, { sync_status: 'pending' });
  if ('image_uri' in data) row.image_uri = data.image_uri ?? null;
  row.updated_at = now();
  saveState(state);
}

export async function softDeleteMuscleGroup(id: string): Promise<void> {
  const state = loadState();
  const row = state.muscle_groups.find((g) => g.id === id);
  if (!row) return;
  row.deleted_at = now();
  row.updated_at = now();
  row.sync_status = 'pending';
  saveState(state);
}

export async function getMuscleGroupsWithWeeklyStats(
  start: string,
  end: string,
): Promise<WeekStat[]> {
  const state = loadState();
  const groups = state.muscle_groups.filter(isAlive);
  const logs = state.workout_logs.filter(
    (l) => isAlive(l) && l.logged_at >= start && l.logged_at <= end,
  );
  return groups.map((g) => {
    const weekly_sets = logs
      .filter((l) => l.muscle_group_id === g.id)
      .reduce((sum, l) => sum + l.sets, 0);
    return {
      ...g,
      weekly_sets,
      progress:
        g.target_sets_per_week > 0 ? weekly_sets / g.target_sets_per_week : 0,
    };
  });
}

export async function getExercises(muscleGroupId: string): Promise<Exercise[]> {
  const state = loadState();
  return state.exercises
    .filter((e) => e.muscle_group_id === muscleGroupId && isAlive(e))
    .map(toExercise)
    .sort(
      (a, b) =>
        Number(b.is_active) - Number(a.is_active) ||
        a.created_at.localeCompare(b.created_at),
    );
}

export async function getActiveExercises(
  muscleGroupId: string,
): Promise<Exercise[]> {
  const rows = await getExercises(muscleGroupId);
  return rows.filter((e) => e.is_active);
}

export async function insertExercise(data: {
  muscle_group_id: string;
  name: string;
  notes?: string | null;
  image_uri?: string | null;
}): Promise<Exercise> {
  const state = loadState();
  const userId = await getUserId();
  const row: Exercise = {
    id: genId(),
    muscle_group_id: data.muscle_group_id,
    name: data.name,
    notes: data.notes ?? null,
    image_uri: data.image_uri ?? null,
    is_active: true,
    created_at: now(),
    updated_at: now(),
    sync_status: 'pending',
    deleted_at: null,
    user_id: userId,
  };
  state.exercises.push(row);
  saveState(state);
  return row;
}

export async function updateExercise(
  id: string,
  data: {
    name?: string;
    notes?: string | null;
    image_uri?: string | null;
    is_active?: boolean;
  },
): Promise<void> {
  const state = loadState();
  const row = state.exercises.find((e) => e.id === id);
  if (!row) return;
  if (data.name !== undefined) row.name = data.name;
  if ('notes' in data) row.notes = data.notes ?? null;
  if ('image_uri' in data) row.image_uri = data.image_uri ?? null;
  if (data.is_active !== undefined) row.is_active = data.is_active;
  row.updated_at = now();
  row.sync_status = 'pending';
  saveState(state);
}

export async function getRecentLogs(limit = 50): Promise<RecentLog[]> {
  const state = loadState();
  return withLatestLogs(
    state.workout_logs,
    state.exercises,
    state.muscle_groups,
  ).slice(0, limit);
}

export async function insertWorkoutLog(data: {
  exercise_id: string;
  muscle_group_id: string;
  sets: number;
  reps?: number | null;
  weight?: number | null;
  note?: string | null;
  logged_at: string;
}): Promise<void> {
  const state = loadState();
  const userId = await getUserId();
  state.workout_logs.push({
    id: genId(),
    exercise_id: data.exercise_id,
    muscle_group_id: data.muscle_group_id,
    sets: data.sets,
    reps: data.reps ?? null,
    weight: data.weight ?? null,
    note: data.note ?? null,
    logged_at: data.logged_at,
    created_at: now(),
    updated_at: now(),
    sync_status: 'pending',
    deleted_at: null,
    user_id: userId,
  });
  saveState(state);
}

export async function softDeleteWorkoutLog(id: string): Promise<void> {
  const state = loadState();
  const row = state.workout_logs.find((l) => l.id === id);
  if (!row) return;
  row.deleted_at = now();
  row.updated_at = now();
  row.sync_status = 'pending';
  saveState(state);
}

export async function getSetCounts(
  muscleGroupId: string,
  start: string,
  end: string,
): Promise<number> {
  const state = loadState();
  return state.workout_logs
    .filter(
      (l) =>
        isAlive(l) &&
        l.muscle_group_id === muscleGroupId &&
        l.logged_at >= start &&
        l.logged_at <= end,
    )
    .reduce((sum, l) => sum + l.sets, 0);
}
