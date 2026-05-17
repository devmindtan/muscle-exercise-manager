import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/src/lib/supabase';
import * as LocalDB from '@/src/db/localDB';

const LAST_SYNC_KEY = 'last_sync_time';

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
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      const message = userError?.message || 'No authenticated user for sync';
      return {
        success: false,
        syncedAt: new Date().toISOString(),
        errors: [message],
        muscleGroupsSynced,
        exercisesSynced,
        workoutLogsSynced,
      };
    }

    const userId = user.id;

    // FIX: Đọc last_sync_time từ AsyncStorage thay vì dùng hasLocalData
    // Khi logout, AuthContext đã gọi AsyncStorage.removeItem('last_sync_time')
    // → lastSyncTime = null → pull toàn bộ dữ liệu khi đăng nhập lại
    const lastSyncStored = await AsyncStorage.getItem(LAST_SYNC_KEY);
    const lastSyncTime = lastSyncStored || null;

    // 1. PUSH: Send all dirty local data to Supabase
    const dirtyMuscleGroups = await LocalDB.getDirtyMuscleGroups();
    for (const group of dirtyMuscleGroups) {
      try {
        const isDeleted = !!group.deleted;
        const { error } = await (supabase.from('muscle_groups').upsert({
          id: group.id,
          user_id: userId,
          name: group.name,
          color: group.color,
          target_sets_per_week: group.target_sets_per_week,
          target_sets_per_month: group.target_sets_per_month,
          image_uri: group.image_uri,
          category: group.category,
          deleted_at: isDeleted ? new Date().toISOString() : null,
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
        const isDeleted = !!exercise.deleted;
        const { error } = await (supabase.from('exercises').upsert({
          id: exercise.id,
          user_id: userId,
          muscle_group_id: exercise.muscle_group_id,
          name: exercise.name,
          notes: exercise.notes,
          image_uri: exercise.image_uri,
          is_active: typeof exercise.is_active === 'boolean' ? exercise.is_active : !!exercise.is_active,
          deleted_at: isDeleted ? new Date().toISOString() : null,
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
        const isDeleted = !!log.deleted;
        const payload = {
          id: log.id,
          user_id: userId,
          exercise_id: log.exercise_id,
          muscle_group_id: log.muscle_group_id,
          sets: log.sets,
          reps: log.reps,
          weight: log.weight,
          note: log.note,
          logged_at: log.logged_at,
          deleted_at: isDeleted ? new Date().toISOString() : null,
        };
        const { error } = await (supabase.from('workout_logs').upsert(payload) as any);
        if (error) {
          console.error('Failed to sync workout log', { log, payload, error });
          if (error.code === '23503' && error.details && error.details.includes('exercise')) {
            await LocalDB.upsertWorkoutLog({ ...log, deleted: 1, dirty: 0, updated_at: new Date().toISOString() });
            errors.push(`Workout log ${log.id} orphaned (exercise_id not found), auto-deleted local.`);
          } else {
            errors.push(`Failed to sync workout log ${log.id}: ${error.message}`);
          }
        } else {
          await LocalDB.markWorkoutLogClean(log.id);
          workoutLogsSynced++;
        }
      } catch (e: any) {
        console.error('Exception syncing workout log', { log, error: e });
        errors.push(`Error syncing workout log ${log.id}: ${e.message}`);
      }
    }

    // 2. PULL: Fetch remote changes
    // lastSyncTime = null → pull toàn bộ (trường hợp đăng nhập lại sau logout)
    // lastSyncTime = timestamp → chỉ pull những gì thay đổi sau lần sync cuối

    try {
      let groupQuery = supabase.from('muscle_groups').select('*').eq('user_id', userId);
      if (lastSyncTime) {
        groupQuery = groupQuery.gte('updated_at', lastSyncTime);
      }
      const { data: remoteGroups, error: groupError } = await groupQuery.order('updated_at', { ascending: false });

      if (groupError) {
        errors.push(`Failed to fetch muscle groups: ${groupError.message}`);
      } else if (remoteGroups && Array.isArray(remoteGroups)) {
        for (const group of remoteGroups) {
          const groupData = group as any;
          await LocalDB.upsertMuscleGroup({
            ...groupData,
            dirty: 0,
            deleted: groupData.deleted_at ? 1 : 0,
          });
        }
      }
    } catch (e: any) {
      errors.push(`Error pulling muscle groups: ${e.message}`);
    }

    try {
      let exerciseQuery = supabase.from('exercises').select('*').eq('user_id', userId);
      if (lastSyncTime) {
        exerciseQuery = exerciseQuery.gte('updated_at', lastSyncTime);
      }
      const { data: remoteExercises, error: exerciseError } = await exerciseQuery.order('updated_at', { ascending: false });

      if (exerciseError) {
        errors.push(`Failed to fetch exercises: ${exerciseError.message}`);
      } else if (remoteExercises && Array.isArray(remoteExercises)) {
        for (const exercise of remoteExercises) {
          const exerciseData = exercise as any;
          await LocalDB.upsertExercise({
            ...exerciseData,
            dirty: 0,
            deleted: exerciseData.deleted_at ? 1 : 0,
          });
        }
      }
    } catch (e: any) {
      errors.push(`Error pulling exercises: ${e.message}`);
    }

    try {
      let logQuery = supabase.from('workout_logs').select('*').eq('user_id', userId);
      if (lastSyncTime) {
        logQuery = logQuery.gte('updated_at', lastSyncTime);
      }
      const { data: remoteLogs, error: logError } = await logQuery.order('updated_at', { ascending: false });

      if (logError) {
        errors.push(`Failed to fetch workout logs: ${logError.message}`);
      } else if (remoteLogs && Array.isArray(remoteLogs)) {
        for (const log of remoteLogs) {
          const logData = log as any;
          await LocalDB.upsertWorkoutLog({
            ...logData,
            dirty: 0,
            deleted: logData.deleted_at ? 1 : 0,
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