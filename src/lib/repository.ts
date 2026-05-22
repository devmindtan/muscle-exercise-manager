import * as LocalDB from '@/src/db/localDB';
import { uploadImage, deleteImage } from '@/src/services/imageUpload';

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

// Muscle Groups
export async function getMuscleGroupsWithWeeklyStats(startDate: string, endDate: string) {
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
  return LocalDB.getMuscleGroups();
}

export async function getMuscleGroupById(id: string) {
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
  return LocalDB.getMuscleGroupById(id);
}

export async function softDeleteMuscleGroup(id: string) {
  return deleteMuscleGroup(id);
}

export async function deleteMuscleGroup(id: string) {
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
  return LocalDB.getExercises(muscleGroupId);
}

export async function getExerciseById(id: string) {
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
  return LocalDB.getActiveExercises(muscleGroupId);
}

export async function getExercisesWithStats(muscleGroupId: string, weekStart: string) {
  return LocalDB.getExercisesWithStats(muscleGroupId, weekStart);
}

export async function setExerciseActive(id: string, isActive: boolean) {
  await LocalDB.setExerciseActive(id, isActive);
}

export async function getLogCountsByMuscleGroup(): Promise<Record<string, number>> {
  return LocalDB.getLogCountsByMuscleGroup();
}

export async function softDeleteExercise(id: string) {
  return deleteExercise(id);
}

export async function updateExercise(id: string, data: Partial<any>) {
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
  const logs = await LocalDB.getWorkoutLogs(startDate, endDate);
  return logs
    .filter((log) => log.muscle_group_id === muscleGroupId && !log.deleted)
    .reduce((acc, log) => acc + (log.sets || 0), 0);
}

export async function softDeleteWorkoutLog(id: string) {
  return deleteWorkoutLog(id);
}

export async function getMonthlyVolume(startDate: string, endDate: string): Promise<number> {
  return LocalDB.getMonthlyVolume(startDate, endDate);
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

export async function getRecentLogsWithNames(limit = 20): Promise<RecentLog[]> {
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
