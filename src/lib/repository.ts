import * as LocalDB from '@/src/db/localDB';
import { uploadImage, deleteImage } from '@/src/services/imageUpload';
import { Platform } from 'react-native';
import { supabase } from '@/src/lib/supabase';

// Simple UUID v4 generator
function generateUUID(): string {
  const chars = '0123456789abcdef';
  let uuid = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-';
    } else if (i === 14) {
      uuid += '4';
    } else if (i === 19) {
      uuid += chars[Math.floor(Math.random() * 16)];
    } else {
      uuid += chars[Math.floor(Math.random() * 16)];
    }
  }
  return uuid;
}

// Types
export interface WeekStat {
  id: string;
  name: string;
  color?: string;
  category?: string | null;
  weekly_sets: number;
  exerciseCount: number;
  progress: number; // 0-1 percentage of target
  targetSetsPerWeek: number;
}

export interface ExerciseHistoryItem {
  id: string;
  sets: number;
  reps: number | null;
  weight: number | null;
  note: string | null;
  logged_at: string;
}

export interface ExerciseWorkoutInsight {
  exerciseId: string;
  totalSets: number;
  bestSetLoad: number;
  bestWeight: number;
  history: ExerciseHistoryItem[];
}

export interface BodyMeasurementInput {
  metricKey: string;
  value: number;
  unit: string;
  note?: string | null;
  source?: string | null;
  measuredAt?: string;
}

export interface BodyMeasurementUpdateInput {
  value?: number;
  unit?: string;
  note?: string | null;
  source?: string | null;
  measuredAt?: string;
}

function flattenWebBodyMeasurementRows(rows: any[]): any[] {
  const result: any[] = [];

  for (const row of rows) {
    const isJsonInBody = row.metrics_json && typeof row.metrics_json === 'object';

    if (!isJsonInBody) {
      continue;
    }

    const metrics = row.metrics_json as Record<string, { value?: number; unit?: string }>;
    for (const [metricKey, metricValue] of Object.entries(metrics)) {
      if (!metricValue || typeof metricValue !== 'object') continue;

      result.push({
        id: `${row.id}::${metricKey}`,
        metric_key: metricKey,
        value: Number(metricValue.value ?? 0),
        unit: metricValue.unit || '',
        note: row.note || null,
        source: 'manual_inbody',
        measured_at: row.measured_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deleted_at: row.deleted_at,
        sync_status: row.sync_status,
        user_id: row.user_id,
      });
    }
  }

  return result;
}

export interface MuscleGoalInput {
  muscleGroupId: string;
  metricKey?: string;
  currentValue?: number | null;
  targetValue: number;
  unit: string;
  targetDate?: string | null;
  note?: string | null;
}

export interface MuscleGoalUpdateInput {
  metricKey?: string;
  currentValue?: number | null;
  targetValue?: number;
  unit?: string;
  targetDate?: string | null;
  note?: string | null;
}

async function getWebUserIdOrThrow() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error('Bạn cần đăng nhập để thao tác dữ liệu web');
  }
  return userId;
}

// Muscle Groups
export async function getMuscleGroupsWithWeeklyStats(startDate: string, endDate: string) {
  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    const [groupsRes, logsRes, exercisesRes] = await Promise.all([
      supabase
        .from('muscle_groups')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null),
      supabase
        .from('workout_logs')
        .select('muscle_group_id, sets')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .gte('logged_at', startDate)
        .lte('logged_at', endDate),
      supabase
        .from('exercises')
        .select('muscle_group_id')
        .eq('user_id', userId)
        .is('deleted_at', null),
    ]);

    if (groupsRes.error) throw groupsRes.error;
    if (logsRes.error) throw logsRes.error;
    if (exercisesRes.error) throw exercisesRes.error;

    const groups = groupsRes.data || [];
    const logs = logsRes.data || [];
    const exercises = exercisesRes.data || [];

    const exerciseCountByGroup = exercises.reduce<Record<string, number>>((acc, row: any) => {
      const key = row.muscle_group_id;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return groups.map((group: any) => {
      const weeklySets = logs
        .filter((log: any) => log.muscle_group_id === group.id)
        .reduce((sum: number, log: any) => sum + (log.sets || 0), 0);

      const targetSets = group.target_sets_per_week || 10;
      return {
        id: group.id,
        name: group.name,
        color: group.color,
        category: group.category,
        weekly_sets: weeklySets,
        exerciseCount: exerciseCountByGroup[group.id] || 0,
        progress: targetSets > 0 ? weeklySets / targetSets : 0,
        targetSetsPerWeek: targetSets,
      } as WeekStat;
    });
  }

  const localGroups = await LocalDB.getMuscleGroups();
  const workoutLogs = await LocalDB.getWorkoutLogs(startDate, endDate);

  const groupOrder = new Map(localGroups.map((group, index) => [group.id, index]));

  const stats: WeekStat[] = localGroups.map((group) => {
    const weeklySets = workoutLogs
      .filter((log) => log.muscle_group_id === group.id)
      .reduce((sum, log) => sum + (log.sets || 0), 0);
    const targetSets = group.target_sets_per_week || 10;
    const progress = targetSets > 0 ? weeklySets / targetSets : 0;
    const exerciseCount = Number((group as any).exercise_count || 0);

    return {
      id: group.id,
      name: group.name,
      color: group.color,
      category: group.category,
      weekly_sets: weeklySets,
      exerciseCount,
      progress,
      targetSetsPerWeek: targetSets,
    };
  });

  // Preserve the localDB order which is already sorted by last_logged_at DESC
  return stats.sort((a, b) => {
    return (groupOrder.get(a.id) ?? 0) - (groupOrder.get(b.id) ?? 0);
  });
}

export async function getMuscleGroupsByWeek(weekStart: string, weekEnd: string) {
  const localGroups = await LocalDB.getMuscleGroups();
  const workoutLogs = await LocalDB.getWorkoutLogs(weekStart, weekEnd);

  return localGroups.map((group) => ({
    ...group,
    weeklySets: workoutLogs
      .filter((log) => log.muscle_group_id === group.id)
      .reduce((sum, log) => sum + (log.sets || 0), 0),
  }));
}

export async function getMuscleGroups() {
  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    const { data, error } = await supabase
      .from('muscle_groups')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []) as any[];
  }

  return LocalDB.getMuscleGroups();
}

export async function getMuscleGroupById(id: string) {
  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    const { data, error } = await supabase
      .from('muscle_groups')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    return data as any;
  }

  return LocalDB.getMuscleGroupById(id);
}

export async function createMuscleGroup(data: {
  name: string;
  color?: string;
  targetSetsPerWeek?: number;
  targetSetsPerMonth?: number;
  category?: string;
}) {
  const id = generateUUID();
  const now = new Date().toISOString();

  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    const payload = {
      id,
      user_id: userId,
      name: data.name,
      color: data.color,
      target_sets_per_week: data.targetSetsPerWeek || 10,
      target_sets_per_month: data.targetSetsPerMonth || 40,
      category: data.category || null,
      created_at: now,
      updated_at: now,
      image_uri: null,
      deleted_at: null,
    };
    const { error } = await supabase.from('muscle_groups').insert(payload as any);
    if (error) throw error;
    return payload as any;
  }

  const group: any = {
    id,
    name: data.name,
    color: data.color,
    target_sets_per_week: data.targetSetsPerWeek || 10,
    target_sets_per_month: data.targetSetsPerMonth || 40,
    category: data.category || null,
    created_at: now,
    updated_at: now,
    image_uri: null,
    dirty: 1,
    deleted: 0,
  };

  await LocalDB.upsertMuscleGroup(group);
  return group;
}

export async function insertMuscleGroup(data: {
  name: string;
  color?: string;
  target_sets_per_week?: number;
  target_sets_per_month?: number;
  image_uri?: string | null;
}) {
  return createMuscleGroup({
    name: data.name,
    color: data.color,
    targetSetsPerWeek: data.target_sets_per_week,
    targetSetsPerMonth: data.target_sets_per_month,
  });
}

export async function updateMuscleGroup(id: string, data: Partial<any>) {
  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    const payload = {
      ...data,
      updated_at: new Date().toISOString(),
    } as any;

    const { error } = await supabase
      .from('muscle_groups')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) throw error;
    return;
  }

  const existing = await LocalDB.getMuscleGroupById(id);
  if (!existing) {
    throw new Error(`Muscle group ${id} not found`);
  }

  const updated: any = {
    ...existing,
    ...data,
    id,
    updated_at: new Date().toISOString(),
    dirty: 1,
  };

  await LocalDB.upsertMuscleGroup(updated);
  return updated;
}

export async function getMuscleGroup(id: string) {
  return getMuscleGroupById(id);
}

export async function softDeleteMuscleGroup(id: string) {
  return deleteMuscleGroup(id);
}

export async function deleteMuscleGroup(id: string) {
  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    const deletedAt = new Date().toISOString();

    const groupRes = await supabase
      .from('muscle_groups')
      .update({ deleted_at: deletedAt, updated_at: deletedAt } as any)
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select('id');
    if (groupRes.error) throw groupRes.error;
    if (!groupRes.data || groupRes.data.length === 0) {
      throw new Error('Không tìm thấy nhóm cơ để xoá hoặc bạn không có quyền');
    }

    // Keep deletion resilient on web: group deletion should not be blocked
    // by partial failures when cascading soft-delete to related rows.
    const [exRes, logRes] = await Promise.allSettled([
      supabase
        .from('exercises')
        .update({ deleted_at: deletedAt, updated_at: deletedAt } as any)
        .eq('user_id', userId)
        .eq('muscle_group_id', id)
        .is('deleted_at', null),
      supabase
        .from('workout_logs')
        .update({ deleted_at: deletedAt, updated_at: deletedAt } as any)
        .eq('user_id', userId)
        .eq('muscle_group_id', id)
        .is('deleted_at', null),
    ]);

    if (exRes.status === 'rejected') {
      console.warn('Failed to soft-delete related exercises:', exRes.reason);
    } else if (exRes.value.error) {
      console.warn('Failed to soft-delete related exercises:', exRes.value.error);
    }

    if (logRes.status === 'rejected') {
      console.warn('Failed to soft-delete related workout logs:', logRes.reason);
    } else if (logRes.value.error) {
      console.warn('Failed to soft-delete related workout logs:', logRes.value.error);
    }

    return;
  }

  // Soft delete
  const existing = await LocalDB.getMuscleGroupById(id);
  if (existing) {
    const toDelete: any = {
      ...existing,
      deleted: 1,
      dirty: 1,
    };
    await LocalDB.upsertMuscleGroup(toDelete);
  }
}

// Exercises
export async function getExercises(muscleGroupId?: string) {
  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    let query = supabase
      .from('exercises')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (muscleGroupId) {
      query = query.eq('muscle_group_id', muscleGroupId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as any[];
  }

  return LocalDB.getExercises(muscleGroupId);
}

export async function getExerciseById(id: string) {
  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    return data as any;
  }

  return LocalDB.getExerciseById(id);
}

export async function createExercise(data: {
  muscleGroupId: string;
  name: string;
  notes?: string;
  image_uri?: string | null;
}) {
  const id = generateUUID();
  const now = new Date().toISOString();

  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    const row = {
      id,
      user_id: userId,
      muscle_group_id: data.muscleGroupId,
      name: data.name,
      notes: data.notes,
      image_uri: data.image_uri ?? null,
      is_active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    const { error } = await supabase.from('exercises').insert(row as any);
    if (error) throw error;
    return row as any;
  }

  const exercise: any = {
    id,
    muscle_group_id: data.muscleGroupId,
    name: data.name,
    notes: data.notes,
    image_uri: data.image_uri ?? null,
    is_active: 1,
    created_at: now,
    updated_at: now,
    dirty: 1,
    deleted: 0,
  };

  await LocalDB.upsertExercise(exercise);
  return exercise;
}

export async function insertExercise(data: {
  muscle_group_id?: string;
  muscleGroupId?: string;
  name: string;
  notes?: string | null;
  image_uri?: string | null;
  is_active?: boolean;
}) {
  return createExercise({
    muscleGroupId: data.muscleGroupId || data.muscle_group_id || '',
    name: data.name,
    notes: data.notes || undefined,
    image_uri: data.image_uri ?? null,
  });
}

export async function getActiveExercises(muscleGroupId: string) {
  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .eq('user_id', userId)
      .eq('muscle_group_id', muscleGroupId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []) as any[];
  }

  return LocalDB.getActiveExercises(muscleGroupId);
}

export async function getExercisesWithStats(muscleGroupId: string, weekStart: string) {
  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    const [exerciseRes, logRes] = await Promise.all([
      supabase
        .from('exercises')
        .select('*')
        .eq('user_id', userId)
        .eq('muscle_group_id', muscleGroupId)
        .is('deleted_at', null)
        .order('is_active', { ascending: false })
        .order('updated_at', { ascending: false }),
      supabase
        .from('workout_logs')
        .select('exercise_id, sets, logged_at')
        .eq('user_id', userId)
        .eq('muscle_group_id', muscleGroupId)
        .is('deleted_at', null)
        .gte('logged_at', weekStart)
        .order('logged_at', { ascending: false }),
    ]);

    if (exerciseRes.error) throw exerciseRes.error;
    if (logRes.error) throw logRes.error;

    const logs = logRes.data || [];
    return (exerciseRes.data || []).map((exercise: any) => {
      const exerciseLogs = logs.filter((log: any) => log.exercise_id === exercise.id);
      return {
        ...exercise,
        last_logged_at: exerciseLogs[0]?.logged_at ?? null,
        weekly_sets: exerciseLogs.reduce((sum: number, log: any) => sum + (log.sets || 0), 0),
      };
    });
  }

  return LocalDB.getExercisesWithStats(muscleGroupId, weekStart);
}

export async function setExerciseActive(id: string, isActive: boolean) {
  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    const { error } = await supabase
      .from('exercises')
      .update({ is_active: isActive, updated_at: new Date().toISOString() } as any)
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) throw error;
    return;
  }

  await LocalDB.setExerciseActive(id, isActive);
}

export async function getLogCountsByMuscleGroup(): Promise<Record<string, number>> {
  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    const { data, error } = await supabase
      .from('workout_logs')
      .select('muscle_group_id')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) throw error;

    return (data || []).reduce<Record<string, number>>((acc, row: any) => {
      const key = row.muscle_group_id;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  return LocalDB.getLogCountsByMuscleGroup();
}

export async function softDeleteExercise(id: string) {
  return deleteExercise(id);
}

export async function updateExercise(id: string, data: Partial<any>) {
  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    const payload = {
      ...data,
      updated_at: new Date().toISOString(),
    } as any;

    const { error } = await supabase
      .from('exercises')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) throw error;
    return;
  }

  const existing = await LocalDB.getExerciseById(id);
  if (!existing) {
    throw new Error(`Exercise ${id} not found`);
  }

  const updated: any = {
    ...existing,
    ...data,
    id,
    updated_at: new Date().toISOString(),
    dirty: 1,
  };

  await LocalDB.upsertExercise(updated);
  return updated;
}

export async function deleteExercise(id: string) {
  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    const deletedAt = new Date().toISOString();

    const { data: deletedRows, error } = await supabase
      .from('exercises')
      .update({ deleted_at: deletedAt, updated_at: deletedAt } as any)
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select('id');

    if (error) throw error;
    if (!deletedRows || deletedRows.length === 0) {
      throw new Error('Không tìm thấy bài tập để xoá hoặc bạn không có quyền');
    }
    return;
  }

  // Soft delete
  const existing = await LocalDB.getExerciseById(id);
  if (existing) {
    const toDelete: any = {
      ...existing,
      deleted: 1,
      dirty: 1,
    };
    await LocalDB.upsertExercise(toDelete);
  }
}

// Workout Logs
export async function getWorkoutLogs(startDate?: string, endDate?: string, exerciseId?: string) {
  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    let query = supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('logged_at', { ascending: false });

    if (startDate) {
      query = query.gte('logged_at', startDate);
    }
    if (endDate) {
      query = query.lte('logged_at', endDate);
    }
    if (exerciseId) {
      query = query.eq('exercise_id', exerciseId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as any[];
  }

  return LocalDB.getWorkoutLogs(startDate, endDate, exerciseId);
}

export async function getWorkoutLogById(id: string) {
  return LocalDB.getWorkoutLogById(id);
}

export async function createWorkoutLog(data: any) {
  const id = generateUUID();
  const now = new Date().toISOString();

  // Accept both camelCase and snake_case keys
  const exerciseId = data.exerciseId || data.exercise_id;
  const muscleGroupId = data.muscleGroupId || data.muscle_group_id;

  if (!exerciseId || !muscleGroupId) {
    console.warn('Workout log missing exerciseId or muscleGroupId', { data });
    throw new Error('Workout log must have exerciseId and muscleGroupId');
  }

  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    const row = {
      id,
      user_id: userId,
      exercise_id: exerciseId,
      muscle_group_id: muscleGroupId,
      sets: data.sets,
      reps: data.reps,
      weight: data.weight,
      note: data.note,
      logged_at: data.loggedAt || data.logged_at || now,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    const { error } = await supabase.from('workout_logs').insert(row as any);
    if (error) throw error;
    return row as any;
  }

  const log: any = {
    id,
    exercise_id: exerciseId,
    muscle_group_id: muscleGroupId,
    sets: data.sets,
    reps: data.reps,
    weight: data.weight,
    note: data.note,
    logged_at: data.loggedAt || data.logged_at || now,
    created_at: now,
    updated_at: now,
    dirty: 1,
    deleted: 0,
  };

  await LocalDB.upsertWorkoutLog(log);
  return log;
}

export async function insertWorkoutLog(data: any) {
  return createWorkoutLog(data);
}

export async function getSetCounts(
  muscleGroupId: string,
  startDate: string,
  endDate: string
) {
  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    const { data, error } = await supabase
      .from('workout_logs')
      .select('sets')
      .eq('user_id', userId)
      .eq('muscle_group_id', muscleGroupId)
      .is('deleted_at', null)
      .gte('logged_at', startDate)
      .lte('logged_at', endDate);

    if (error) throw error;

    return (data || []).reduce((acc: number, row: any) => acc + (row.sets || 0), 0);
  }

  const logs = await LocalDB.getWorkoutLogs(startDate, endDate);
  return logs
    .filter((log) => log.muscle_group_id === muscleGroupId && !log.deleted)
    .reduce((acc, log) => acc + (log.sets || 0), 0);
}

export async function softDeleteWorkoutLog(id: string) {
  return deleteWorkoutLog(id);
}

export async function getMonthlyVolume(startDate: string, endDate: string): Promise<number> {
  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    const { data, error } = await supabase
      .from('workout_logs')
      .select('sets, reps, weight')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('logged_at', startDate)
      .lte('logged_at', endDate);

    if (error) throw error;

    return (data || []).reduce((sum: number, row: any) => {
      const sets = Number(row.sets || 0);
      const reps = Number(row.reps || 0);
      const weight = Number(row.weight || 0);
      return sum + sets * reps * weight;
    }, 0);
  }

  return LocalDB.getMonthlyVolume(startDate, endDate);
}

export async function getBodyMeasurements(metricKey?: string, limit?: number) {
  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    let query = supabase
      .from('body_measurements')
      .select('id,user_id,measured_at,note,metrics_json,created_at,updated_at,deleted_at,sync_status')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('measured_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    let flattened = flattenWebBodyMeasurementRows(data || []);
    if (metricKey) {
      flattened = flattened.filter((row) => row.metric_key === metricKey);
    }
    if (typeof limit === 'number') {
      flattened = flattened.slice(0, limit);
    }

    return flattened;
  }

  return LocalDB.getBodyMeasurements(metricKey, limit);
}

export async function createBodyMeasurement(data: BodyMeasurementInput) {
  const now = new Date().toISOString();

  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    const measuredAt = data.measuredAt || now;
    const { data: existingRow, error: findError } = await supabase
      .from('body_measurements')
      .select('id,user_id,measured_at,note,metrics_json,created_at,updated_at,deleted_at,sync_status')
      .eq('user_id', userId)
      .eq('measured_at', measuredAt)
      .is('deleted_at', null)
      .maybeSingle();

    if (findError) throw findError;

    if (existingRow) {
      const currentJson = ((existingRow as any).metrics_json || {}) as Record<string, { value: number; unit: string }>;
      const nextJson = {
        ...currentJson,
        [data.metricKey]: {
          value: data.value,
          unit: data.unit,
        },
      };

      const { error: updateError } = await supabase
        .from('body_measurements')
        .update({
          metrics_json: nextJson,
          note: data.note ?? existingRow.note ?? null,
          updated_at: now,
        } as any)
        .eq('id', existingRow.id)
        .eq('user_id', userId);

      if (updateError) throw updateError;

      return {
        id: `${existingRow.id}::${data.metricKey}`,
        metric_key: data.metricKey,
        value: data.value,
        unit: data.unit,
        note: data.note ?? existingRow.note ?? null,
        source: 'manual_inbody',
        measured_at: measuredAt,
        created_at: existingRow.created_at,
        updated_at: now,
        deleted_at: null,
        sync_status: existingRow.sync_status,
        user_id: userId,
      } as any;
    }

    const insertedRow = {
      id: generateUUID(),
      user_id: userId,
      measured_at: measuredAt,
      note: data.note ?? null,
      metrics_json: {
        [data.metricKey]: {
          value: data.value,
          unit: data.unit,
        },
      },
      created_at: now,
      updated_at: now,
      deleted_at: null,
      sync_status: 'pending',
    };

    const { error: insertError } = await supabase.from('body_measurements').insert(insertedRow as any);
    if (insertError) throw insertError;

    return {
      id: `${insertedRow.id}::${data.metricKey}`,
      metric_key: data.metricKey,
      value: data.value,
      unit: data.unit,
      note: insertedRow.note,
      source: 'manual_inbody',
      measured_at: measuredAt,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      sync_status: 'pending',
      user_id: userId,
    } as any;
  }

  const measurement: any = {
    id: generateUUID(),
    metric_key: data.metricKey,
    value: data.value,
    unit: data.unit,
    note: data.note ?? null,
    source: data.source ?? 'manual',
    measured_at: data.measuredAt || now,
    created_at: now,
    updated_at: now,
    dirty: 1,
    deleted: 0,
  };

  await LocalDB.upsertBodyMeasurement(measurement);
  return measurement;
}

export async function updateBodyMeasurement(id: string, data: BodyMeasurementUpdateInput) {
  const now = new Date().toISOString();

  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();

    if (id.includes('::')) {
      const [parentId, metricKey] = id.split('::');
      const { data: parentRow, error: findError } = await supabase
        .from('body_measurements')
        .select('*')
        .eq('id', parentId)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .maybeSingle();

      if (findError) throw findError;
      if (!parentRow) throw new Error('InBody record not found');

      const currentJson = ((parentRow as any).metrics_json || {}) as Record<string, { value: number; unit: string }>;
      const previousMetric = currentJson[metricKey] || { value: 0, unit: '' };
      const nextJson = {
        ...currentJson,
        [metricKey]: {
          value: data.value ?? previousMetric.value,
          unit: data.unit ?? previousMetric.unit,
        },
      };

      const { error: updateError } = await supabase
        .from('body_measurements')
        .update({
          metrics_json: nextJson,
          note: data.note ?? parentRow.note,
          source: data.source ?? parentRow.source,
          measured_at: data.measuredAt ?? parentRow.measured_at,
          updated_at: now,
        } as any)
        .eq('id', parentId)
        .eq('user_id', userId);

      if (updateError) throw updateError;
      return;
    }

    const payload = {
      note: data.note,
      measured_at: data.measuredAt,
      updated_at: now,
    } as any;

    const { error } = await supabase
      .from('body_measurements')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
    return;
  }

  const existing = await LocalDB.getBodyMeasurementById(id);
  if (!existing) {
    throw new Error(`Body measurement ${id} not found`);
  }

  const updated: any = {
    ...existing,
    id,
    value: data.value ?? existing.value,
    unit: data.unit ?? existing.unit,
    note: data.note ?? existing.note,
    source: data.source ?? existing.source,
    measured_at: data.measuredAt ?? existing.measured_at,
    updated_at: now,
    dirty: 1,
  };

  await LocalDB.upsertBodyMeasurement(updated);
}

export async function deleteInBodyRecord(measuredAt: string) {
  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    const deletedAt = new Date().toISOString();
    const { data: deletedRows, error } = await supabase
      .from('body_measurements')
      .update({ deleted_at: deletedAt, updated_at: deletedAt } as any)
      .eq('user_id', userId)
      .eq('measured_at', measuredAt)
      .is('deleted_at', null)
      .select('id');

    if (error) throw error;
    if (!deletedRows || deletedRows.length === 0) {
      throw new Error('Không tìm thấy bản InBody để xoá hoặc bạn không có quyền');
    }
    return;
  }

  await LocalDB.softDeleteBodyMeasurementsByMeasuredAt(measuredAt);
}

export async function getMuscleGoals() {
  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    const { data, error } = await supabase
      .from('muscle_goals')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('target_date', { ascending: true, nullsFirst: false });

    if (error) throw error;
    return (data || []) as any[];
  }

  return LocalDB.getMuscleGoals();
}

export async function createMuscleGoal(data: MuscleGoalInput) {
  const now = new Date().toISOString();

  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    const row = {
      id: generateUUID(),
      user_id: userId,
      muscle_group_id: data.muscleGroupId,
      metric_key: data.metricKey || 'muscle_mass',
      current_value: data.currentValue ?? null,
      target_value: data.targetValue,
      unit: data.unit,
      target_date: data.targetDate ?? null,
      note: data.note ?? null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    const { error } = await supabase.from('muscle_goals').insert(row as any);
    if (error) throw error;
    return row as any;
  }

  const goal: any = {
    id: generateUUID(),
    muscle_group_id: data.muscleGroupId,
    metric_key: data.metricKey || 'muscle_mass',
    current_value: data.currentValue ?? null,
    target_value: data.targetValue,
    unit: data.unit,
    target_date: data.targetDate ?? null,
    note: data.note ?? null,
    created_at: now,
    updated_at: now,
    dirty: 1,
    deleted: 0,
  };

  await LocalDB.upsertMuscleGoal(goal);
  return goal;
}

export async function updateMuscleGoal(id: string, data: MuscleGoalUpdateInput) {
  const now = new Date().toISOString();

  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    const payload = {
      metric_key: data.metricKey,
      current_value: data.currentValue,
      target_value: data.targetValue,
      unit: data.unit,
      target_date: data.targetDate,
      note: data.note,
      updated_at: now,
    } as any;

    const { error } = await supabase
      .from('muscle_goals')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) throw error;
    return;
  }

  const existing = await LocalDB.getMuscleGoalById(id);
  if (!existing) {
    throw new Error(`Muscle goal ${id} not found`);
  }

  const updated: any = {
    ...existing,
    id,
    metric_key: data.metricKey ?? existing.metric_key,
    current_value: data.currentValue ?? existing.current_value,
    target_value: data.targetValue ?? existing.target_value,
    unit: data.unit ?? existing.unit,
    target_date: data.targetDate ?? existing.target_date,
    note: data.note ?? existing.note,
    updated_at: now,
    dirty: 1,
  };

  await LocalDB.upsertMuscleGoal(updated);
}

export async function deleteMuscleGoal(id: string) {
  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    const deletedAt = new Date().toISOString();

    const { data: deletedRows, error } = await supabase
      .from('muscle_goals')
      .update({ deleted_at: deletedAt, updated_at: deletedAt } as any)
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select('id');

    if (error) throw error;
    if (!deletedRows || deletedRows.length === 0) {
      throw new Error('Không tìm thấy goal để xoá hoặc bạn không có quyền');
    }
    return;
  }

  await LocalDB.softDeleteMuscleGoal(id);
}

export async function getRecentLogs(limit = 20) {
  const logs = await LocalDB.getWorkoutLogs();
  return logs.slice(0, limit).map((log) => {
    // Get exercise name from repository
    return {
      id: log.id,
      exercise_id: log.exercise_id,
      muscleGroupId: log.muscle_group_id,
      sets: log.sets,
      reps: log.reps || undefined,
      weight: log.weight || undefined,
      note: log.note || undefined,
      logged_at: log.logged_at,
    };
  });
}

export async function getRecentLogsWithNames(limit?: number): Promise<RecentLog[]> {
  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    let query = supabase
      .from('workout_logs')
      .select('id, exercise_id, muscle_group_id, sets, reps, weight, note, logged_at, exercises(name)')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('logged_at', { ascending: false });

    if (typeof limit === 'number') {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      exercise_id: row.exercise_id,
      muscleGroupId: row.muscle_group_id,
      sets: row.sets || undefined,
      reps: row.reps || undefined,
      weight: row.weight || undefined,
      note: row.note || undefined,
      logged_at: row.logged_at,
      exerciseName: row.exercises?.name || undefined,
    }));
  }

  const rows = await LocalDB.getRecentLogsWithExerciseNames(limit);
  return rows.map((row) => ({
    id: row.id,
    exercise_id: row.exercise_id,
    muscleGroupId: row.muscle_group_id,
    sets: row.sets,
    reps: row.reps || undefined,
    weight: row.weight || undefined,
    note: row.note || undefined,
    logged_at: row.logged_at,
    exerciseName: row.exercise_name,
  }));
}

export async function getExerciseWorkoutInsights(
  muscleGroupId: string,
  historyLimit = 5,
): Promise<Record<string, ExerciseWorkoutInsight>> {
  const [exercises, logs] = await Promise.all([
    LocalDB.getExercises(muscleGroupId),
    LocalDB.getWorkoutLogs(),
  ]);

  const insights: Record<string, ExerciseWorkoutInsight> = {};

  for (const exercise of exercises) {
    const exLogs = logs.filter((log) => log.exercise_id === exercise.id && !log.deleted);

    const totalSets = exLogs.reduce((sum, log) => sum + (log.sets || 0), 0);
    const bestSetLoad = exLogs.reduce((max, log) => {
      const reps = Math.max(log.reps || 1, 1);
      const weight = log.weight || 0;
      return Math.max(max, reps * weight);
    }, 0);
    const bestWeight = exLogs.reduce((max, log) => Math.max(max, log.weight || 0), 0);

    const history: ExerciseHistoryItem[] = exLogs.slice(0, historyLimit).map((log) => ({
      id: log.id,
      sets: log.sets || 0,
      reps: log.reps || null,
      weight: log.weight || null,
      note: log.note || null,
      logged_at: log.logged_at,
    }));

    insights[exercise.id] = {
      exerciseId: exercise.id,
      totalSets,
      bestSetLoad,
      bestWeight,
      history,
    };
  }

  return insights;
}

export interface RecentLog {
  id: string;
  exercise_id: string;
  muscleGroupId: string;
  sets?: number;
  reps?: number;
  weight?: number;
  note?: string;
  logged_at: string;
  exerciseName?: string;
}

export async function updateWorkoutLog(id: string, data: Partial<any>) {
  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    const payload = {
      ...data,
      updated_at: new Date().toISOString(),
    } as any;

    const { data: updatedRows, error } = await supabase
      .from('workout_logs')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select('id');

    if (error) throw error;
    if (!updatedRows || updatedRows.length === 0) {
      throw new Error('Không tìm thấy log để cập nhật hoặc bạn không có quyền');
    }
    return;
  }

  const existing = await LocalDB.getWorkoutLogById(id);
  if (!existing) {
    throw new Error(`Workout log ${id} not found`);
  }

  const updated: any = {
    ...existing,
    ...data,
    id,
    updated_at: new Date().toISOString(),
    dirty: 1,
  };

  await LocalDB.upsertWorkoutLog(updated);
  return updated;
}

export async function deleteWorkoutLog(id: string) {
  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    const deletedAt = new Date().toISOString();

    const { data: deletedRows, error } = await supabase
      .from('workout_logs')
      .update({ deleted_at: deletedAt, updated_at: deletedAt } as any)
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select('id');

    if (error) throw error;
    if (!deletedRows || deletedRows.length === 0) {
      throw new Error('Không tìm thấy log để xoá hoặc bạn không có quyền');
    }
    return;
  }

  // Soft delete
  const existing = await LocalDB.getWorkoutLogById(id);
  if (existing) {
    const toDelete: any = {
      ...existing,
      deleted: 1,
      dirty: 1,
    };
    await LocalDB.upsertWorkoutLog(toDelete);
  }
}

// Image Upload
export async function uploadMuscleGroupImage(
  fileUri: string,
  fileName: string,
  muscleGroupId: string,
  mimeType?: string
) {
  try {
    const result = await uploadImage(fileUri, fileName, mimeType || 'image/jpeg');
    
    if (result.success && result.url) {
      // Update muscle group with new image URL
      await updateMuscleGroup(muscleGroupId, {
        image_uri: result.url,
      });
      return result;
    }
    
    return result;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to upload muscle group image',
    };
  }
}

export async function uploadExerciseImage(
  fileUri: string,
  fileName: string,
  exerciseId: string,
  mimeType?: string
) {
  try {
    const result = await uploadImage(fileUri, fileName, mimeType || 'image/jpeg');
    
    if (result.success && result.url) {
      // Update exercise with new image URL
      await updateExercise(exerciseId, {
        image_uri: result.url,
      });
      return result;
    }
    
    return result;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to upload exercise image',
    };
  }
}

export async function deleteImageFromStorage(imageUrl: string): Promise<boolean> {
  try {
    // Extract key from URL if needed
    const keyMatch = imageUrl.match(/\/muscle-manager\/(.+)$/);
    if (keyMatch && keyMatch[1]) {
      return await deleteImage(decodeURIComponent(keyMatch[1]));
    }
    return false;
  } catch (err: any) {
    console.error('Error deleting image:', err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────
// CARDIO LOGS
// ─────────────────────────────────────────────────────────────────

export interface CardioLog {
  id: string;
  name: string;
  duration_minutes: number;
  note: string | null;
  logged_at: string;
}

export async function insertCardioLog(data: {
  name: string;
  duration_minutes: number;
  note: string | null;
  logged_at: string;
}): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      const userId = await getWebUserIdOrThrow();
      const now = new Date().toISOString();
      const row = {
        id: generateUUID(),
        user_id: userId,
        name: data.name,
        duration_minutes: data.duration_minutes,
        note: data.note,
        logged_at: data.logged_at,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      const { error } = await supabase.from('cardio_logs').insert(row as any);
      if (error) throw error;
    } catch (err: any) {
      const message = String(err?.message || err || 'Unknown error');
      if (message.includes('relation') && message.includes('cardio_logs')) {
        throw new Error('Web chưa có bảng cardio_logs. Hãy chạy Supabase migration rồi thử lại.');
      }
      if (message.toLowerCase().includes('row-level security')) {
        throw new Error('Không có quyền ghi cardio log. Kiểm tra đăng nhập và RLS policy của cardio_logs.');
      }
      throw err;
    }
    return;
  }

  await LocalDB.insertCardioLog(data);
}

export async function getRecentCardioLogs(limit = 100): Promise<CardioLog[]> {
  if (Platform.OS === 'web') {
    try {
      const userId = await getWebUserIdOrThrow();
      const { data, error } = await supabase
        .from('cardio_logs')
        .select('id, name, duration_minutes, note, logged_at')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('logged_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as CardioLog[];
    } catch (err: any) {
      const message = String(err?.message || err || 'Unknown error');
      if (message.includes('relation') && message.includes('cardio_logs')) {
        throw new Error('Web chưa có bảng cardio_logs. Hãy chạy Supabase migration rồi thử lại.');
      }
      throw err;
    }
  }

  return LocalDB.getRecentCardioLogs(limit);
}

export async function softDeleteCardioLog(id: string): Promise<void> {
  if (Platform.OS === 'web') {
    const userId = await getWebUserIdOrThrow();
    const deletedAt = new Date().toISOString();
    const { error } = await supabase
      .from('cardio_logs')
      .update({ deleted_at: deletedAt, updated_at: deletedAt } as any)
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) throw error;
    return;
  }

  await LocalDB.softDeleteCardioLog(id);
}