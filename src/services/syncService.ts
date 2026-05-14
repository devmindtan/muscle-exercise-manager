import { supabase } from '@/src/lib/supabase';
import * as LocalDB from '@/src/db/localDB';

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

export interface SyncResult {
  success: boolean;
  syncedAt: string;
  errors: string[];
  muscleGroupsSynced: number;
  exercisesSynced: number;
  workoutLogsSynced: number;
}

export async function syncData(deviceId: string): Promise<SyncResult> {
  const errors: string[] = [];
  let muscleGroupsSynced = 0;
  let exercisesSynced = 0;
  let workoutLogsSynced = 0;

  try {
    // 1. PUSH: Send all dirty local data to Supabase
    const dirtyMuscleGroups = await LocalDB.getDirtyMuscleGroups();
    for (const group of dirtyMuscleGroups) {
      try {
        const { error } = await (supabase.from('muscle_groups').upsert({
          id: group.id,
          name: group.name,
          color: group.color,
          target_sets_per_week: group.target_sets_per_week,
          target_sets_per_month: group.target_sets_per_month,
          image_uri: group.image_uri,
        }) as any);
        if (error) {
          errors.push(`Failed to sync muscle group ${group.id}: ${error.message}`);
        } else {
          await LocalDB.markMuscleGroupClean(group.id);
          muscleGroupsSynced++;
        }
      } catch (e: any) {
        errors.push(`Error syncing muscle group ${group.id}: ${e.message}`);
      }
    }

    const dirtyExercises = await LocalDB.getDirtyExercises();
    for (const exercise of dirtyExercises) {
      try {
        const { error } = await (supabase.from('exercises').upsert({
          id: exercise.id,
          muscle_group_id: exercise.muscle_group_id,
          name: exercise.name,
          notes: exercise.notes,
          image_uri: exercise.image_uri,
          is_active: exercise.is_active,
        }) as any);
        if (error) {
          errors.push(`Failed to sync exercise ${exercise.id}: ${error.message}`);
        } else {
          await LocalDB.markExerciseClean(exercise.id);
          exercisesSynced++;
        }
      } catch (e: any) {
        errors.push(`Error syncing exercise ${exercise.id}: ${e.message}`);
      }
    }

    const dirtyLogs = await LocalDB.getDirtyWorkoutLogs();
    for (const log of dirtyLogs) {
      try {
        const { error } = await (supabase.from('workout_logs').upsert({
          id: log.id,
          exercise_id: log.exercise_id,
          muscle_group_id: log.muscle_group_id,
          sets: log.sets,
          reps: log.reps,
          weight: log.weight,
          note: log.note,
          logged_at: log.logged_at,
        }) as any);
        if (error) {
          errors.push(`Failed to sync workout log ${log.id}: ${error.message}`);
        } else {
          await LocalDB.markWorkoutLogClean(log.id);
          workoutLogsSynced++;
        }
      } catch (e: any) {
        errors.push(`Error syncing workout log ${log.id}: ${e.message}`);
      }
    }

    // 2. PULL: Fetch recent remote changes (skip own device's changes)
    const now = new Date();
    const lastSyncTime = new Date(now.getTime() - 5 * 60 * 1000).toISOString(); // Last 5 minutes

    try {
      const { data: remoteGroups, error: groupError } = await supabase
        .from('muscle_groups')
        .select('*')
        .gte('updated_at', lastSyncTime)
        .order('updated_at', { ascending: false });

      if (groupError) {
        errors.push(`Failed to fetch muscle groups: ${groupError.message}`);
      } else if (remoteGroups && Array.isArray(remoteGroups)) {
        for (const group of remoteGroups) {
          const groupData = group as any;
          await LocalDB.upsertMuscleGroup({
            ...groupData,
            dirty: 0,
            deleted: groupData.deleted ? 1 : 0,
          });
        }
      }
    } catch (e: any) {
      errors.push(`Error pulling muscle groups: ${e.message}`);
    }

    try {
      const { data: remoteExercises, error: exerciseError } = await supabase
        .from('exercises')
        .select('*')
        .gte('updated_at', lastSyncTime)
        .order('updated_at', { ascending: false });

      if (exerciseError) {
        errors.push(`Failed to fetch exercises: ${exerciseError.message}`);
      } else if (remoteExercises && Array.isArray(remoteExercises)) {
        for (const exercise of remoteExercises) {
          const exerciseData = exercise as any;
          await LocalDB.upsertExercise({
            ...exerciseData,
            dirty: 0,
            deleted: exerciseData.deleted ? 1 : 0,
          });
        }
      }
    } catch (e: any) {
      errors.push(`Error pulling exercises: ${e.message}`);
    }

    try {
      const { data: remoteLogs, error: logError } = await supabase
        .from('workout_logs')
        .select('*')
        .gte('updated_at', lastSyncTime)
        .order('updated_at', { ascending: false });

      if (logError) {
        errors.push(`Failed to fetch workout logs: ${logError.message}`);
      } else if (remoteLogs && Array.isArray(remoteLogs)) {
        for (const log of remoteLogs) {
          const logData = log as any;
          await LocalDB.upsertWorkoutLog({
            ...logData,
            dirty: 0,
            deleted: logData.deleted ? 1 : 0,
          });
        }
      }
    } catch (e: any) {
      errors.push(`Error pulling workout logs: ${e.message}`);
    }

    return {
      success: errors.length === 0,
      syncedAt: new Date().toISOString(),
      errors,
      muscleGroupsSynced,
      exercisesSynced,
      workoutLogsSynced,
    };
  } catch (e: any) {
    errors.push(`Sync failed: ${e.message}`);
    return {
      success: false,
      syncedAt: new Date().toISOString(),
      errors,
      muscleGroupsSynced,
      exercisesSynced,
      workoutLogsSynced,
    };
  }
}
