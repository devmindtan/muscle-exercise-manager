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
  bodyMeasurementsSynced: number;
  muscleGoalsSynced: number;
  weeklyPlansSynced: number;
}

export async function syncData(deviceId: string): Promise<SyncResult> {
  const errors: string[] = [];
  let muscleGroupsSynced = 0;
  let exercisesSynced = 0;
  let workoutLogsSynced = 0;
  let bodyMeasurementsSynced = 0;
  let muscleGoalsSynced = 0;
  let weeklyPlansSynced = 0;

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
        bodyMeasurementsSynced,
        muscleGoalsSynced,
        weeklyPlansSynced,
      };
    }

    const userId = user.id;

    const lastSyncStored = await AsyncStorage.getItem(LAST_SYNC_KEY);
    // FIX: shouldHydrateFromRemote chỉ dùng để quyết định pull toàn bộ
    // history (measurements, logs cũ) hay chỉ pull incremental.
    // Weekly plan & các bảng nhỏ luôn pull mỗi lần.
    const isFirstSync = !lastSyncStored;

    // ─── 1. PUSH: gửi dirty local data lên Supabase ─────────────────────────

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

    const dirtyMeasurements = await LocalDB.getDirtyBodyMeasurements();
    const groupedMeasurements = new Map<
      string,
      {
        measuredAt: string;
        note: string | null;
        metrics: Record<string, { value: number; unit: string }>;
        hasActive: boolean;
        hasDeleted: boolean;
      }
    >();

    for (const measurement of dirtyMeasurements) {
      const key = measurement.measured_at;
      const existing = groupedMeasurements.get(key);
      if (!existing) {
        groupedMeasurements.set(key, {
          measuredAt: measurement.measured_at,
          note: measurement.note || null,
          metrics: {},
          hasActive: false,
          hasDeleted: false,
        });
      }
      const current = groupedMeasurements.get(key)!;
      if (measurement.deleted) {
        current.hasDeleted = true;
        continue;
      }
      current.hasActive = true;
      current.metrics[measurement.metric_key] = {
        value: Number(measurement.value || 0),
        unit: measurement.unit || '',
      };
      if (!current.note && measurement.note) {
        current.note = measurement.note;
      }
    }

    const syncedMeasurementKeys = new Set<string>();

    for (const [, measurementRecord] of groupedMeasurements) {
      try {
        const isDeleteReport = !measurementRecord.hasActive && measurementRecord.hasDeleted;
        const now = new Date().toISOString();
        const { data: existingMeasurement, error: findError } = await supabase
          .from('body_measurements')
          .select('id, created_at')
          .eq('user_id', userId)
          .eq('measured_at', measurementRecord.measuredAt)
          .is('deleted_at', null)
          .maybeSingle();

        if (findError) {
          errors.push(`Failed to find body measurements (${measurementRecord.measuredAt}): ${findError.message}`);
          continue;
        }

        const payload = {
          user_id: userId,
          measured_at: measurementRecord.measuredAt,
          note: measurementRecord.note,
          metrics_json: isDeleteReport ? {} : measurementRecord.metrics,
          updated_at: now,
          deleted_at: isDeleteReport ? now : null,
        };

        const { error } = existingMeasurement
          ? await (supabase
              .from('body_measurements')
              .update(payload as any)
              .eq('id', existingMeasurement.id)
              .eq('user_id', userId) as any)
          : await (supabase.from('body_measurements').insert(payload as any) as any);

        if (error) {
          errors.push(`Failed to sync body measurements (${measurementRecord.measuredAt}): ${error.message}`);
        } else {
          syncedMeasurementKeys.add(measurementRecord.measuredAt);
          bodyMeasurementsSynced += Math.max(Object.keys(measurementRecord.metrics).length, 1);
        }
      } catch (e: any) {
        errors.push(`Error syncing body measurements (${measurementRecord.measuredAt}): ${e.message}`);
      }
    }

    for (const measurement of dirtyMeasurements) {
      if (!syncedMeasurementKeys.has(measurement.measured_at)) continue;
      try {
        await LocalDB.markBodyMeasurementClean(measurement.id);
      } catch (e: any) {
        errors.push(`Failed to mark measurement clean ${measurement.id}: ${e.message}`);
      }
    }

    const dirtyGoals = await LocalDB.getDirtyMuscleGoals();
    for (const goal of dirtyGoals) {
      try {
        const isDeleted = !!goal.deleted;
        const { error } = await (supabase.from('muscle_goals').upsert({
          id: goal.id,
          user_id: userId,
          muscle_group_id: goal.muscle_group_id,
          metric_key: goal.metric_key,
          current_value: goal.current_value,
          target_value: goal.target_value,
          unit: goal.unit,
          target_date: goal.target_date,
          note: goal.note,
          deleted_at: isDeleted ? new Date().toISOString() : null,
        }) as any);
        if (error) {
          errors.push(`Failed to sync muscle goal ${goal.id}: ${error.message}`);
        } else {
          await LocalDB.markMuscleGoalClean(goal.id);
          muscleGoalsSynced++;
        }
      } catch (e: any) {
        errors.push(`Error syncing muscle goal ${goal.id}: ${e.message}`);
      }
    }

    const dirtyWeeklyPlans = await LocalDB.getDirtyWeeklyPlanEntries();
    for (const plan of dirtyWeeklyPlans) {
      try {
        const isDeleted = !!plan.deleted;
        const { error } = await (supabase.from('weekly_plan_entries').upsert({
          id: plan.id,
          user_id: userId,
          day_key: plan.day_key,
          muscle_group_id: plan.muscle_group_id,
          sets: plan.sets,
          note: plan.note,
          created_at: plan.created_at,
          updated_at: new Date().toISOString(),
          deleted_at: isDeleted ? new Date().toISOString() : null,
        }) as any);
        if (error) {
          errors.push(`Failed to sync weekly plan ${plan.id}: ${error.message}`);
        } else {
          await LocalDB.markWeeklyPlanEntryClean(plan.id);
          weeklyPlansSynced++;
        }
      } catch (e: any) {
        errors.push(`Error syncing weekly plan ${plan.id}: ${e.message}`);
      }
    }

    // ─── 2. PULL: kéo dữ liệu về từ remote ─────────────────────────────────
    //
    // FIX: muscle_groups, exercises, muscle_goals luôn pull mỗi lần sync
    // vì chúng nhỏ và cần đồng bộ cross-device realtime.
    // workout_logs & body_measurements chỉ pull lần đầu (isFirstSync) vì
    // lượng data lớn — sau đó dùng push-only để tránh tốn bandwidth.

    // Muscle groups — luôn pull
    try {
      const { data: remoteGroups, error: groupError } = await supabase
        .from('muscle_groups')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

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
        await LocalDB.markMissingMuscleGroupsDeleted(remoteGroups.map((row: any) => row.id));
      }
    } catch (e: any) {
      errors.push(`Error pulling muscle groups: ${e.message}`);
    }

    // Exercises — luôn pull
    try {
      const { data: remoteExercises, error: exerciseError } = await supabase
        .from('exercises')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

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
        await LocalDB.markMissingExercisesDeleted(remoteExercises.map((row: any) => row.id));
      }
    } catch (e: any) {
      errors.push(`Error pulling exercises: ${e.message}`);
    }

    // Muscle goals — luôn pull
    try {
      const { data: remoteGoals, error: goalError } = await supabase
        .from('muscle_goals')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (goalError) {
        errors.push(`Failed to fetch muscle goals: ${goalError.message}`);
      } else if (remoteGoals && Array.isArray(remoteGoals)) {
        for (const goal of remoteGoals) {
          const goalData = goal as any;
          await LocalDB.upsertMuscleGoal({
            ...goalData,
            dirty: 0,
            deleted: goalData.deleted_at ? 1 : 0,
          });
        }
        await LocalDB.markMissingMuscleGoalsDeleted(remoteGoals.map((row: any) => row.id));
      }
    } catch (e: any) {
      errors.push(`Error pulling muscle goals: ${e.message}`);
    }

    // Workout logs & body measurements — chỉ pull lần đầu (isFirstSync)
    if (isFirstSync) {
      try {
        const { data: remoteLogs, error: logError } = await supabase
          .from('workout_logs')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false });

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
          await LocalDB.markMissingWorkoutLogsDeleted(remoteLogs.map((row: any) => row.id));
        }
      } catch (e: any) {
        errors.push(`Error pulling workout logs: ${e.message}`);
      }

      try {
        const { data: remoteMeasurements, error: measurementError } = await supabase
          .from('body_measurements')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false });

        if (measurementError) {
          errors.push(`Failed to fetch body measurements: ${measurementError.message}`);
        } else if (remoteMeasurements && Array.isArray(remoteMeasurements)) {
          const expandedRemoteMeasurementIds: string[] = [];
          for (const measurement of remoteMeasurements) {
            const measurementData = measurement as any;
            const metricsJson = measurementData.metrics_json as Record<string, { value: number; unit: string }> | null;
            if (metricsJson && typeof metricsJson === 'object') {
              for (const [metricKey, metricValue] of Object.entries(metricsJson)) {
                const localId = `${measurementData.id}::${metricKey}`;
                expandedRemoteMeasurementIds.push(localId);
                await LocalDB.upsertBodyMeasurement({
                  id: localId,
                  metric_key: metricKey,
                  value: Number((metricValue as any)?.value ?? 0),
                  unit: (metricValue as any)?.unit || '',
                  note: measurementData.note,
                  source: 'manual_inbody',
                  measured_at: measurementData.measured_at,
                  created_at: measurementData.created_at,
                  updated_at: measurementData.updated_at,
                  dirty: 0,
                  deleted: measurementData.deleted_at ? 1 : 0,
                } as any);
              }
              continue;
            }
            expandedRemoteMeasurementIds.push(measurementData.id);
            await LocalDB.upsertBodyMeasurement({
              ...measurementData,
              dirty: 0,
              deleted: measurementData.deleted_at ? 1 : 0,
            });
          }
          await LocalDB.markMissingBodyMeasurementsDeleted(expandedRemoteMeasurementIds);
        }
      } catch (e: any) {
        errors.push(`Error pulling body measurements: ${e.message}`);
      }
    }

    // Weekly plan — luôn pull mỗi lần (cross-device realtime)
    try {
      const { data: remoteWeeklyPlans, error: weeklyPlanError } = await supabase
        .from('weekly_plan_entries')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (weeklyPlanError) {
        errors.push(`Failed to fetch weekly plans: ${weeklyPlanError.message}`);
      } else if (remoteWeeklyPlans && Array.isArray(remoteWeeklyPlans)) {
        for (const plan of remoteWeeklyPlans) {
          const planData = plan as any;
          await LocalDB.upsertWeeklyPlanEntry({
            ...planData,
            dirty: 0,
            deleted: planData.deleted_at ? 1 : 0,
          });
        }
        await LocalDB.markMissingWeeklyPlanEntriesDeleted(remoteWeeklyPlans.map((row: any) => row.id));
      }
    } catch (e: any) {
      errors.push(`Error pulling weekly plans: ${e.message}`);
    }

    // Lưu thời gian sync
    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

    return {
      success: errors.length === 0,
      syncedAt: new Date().toISOString(),
      errors,
      muscleGroupsSynced,
      exercisesSynced,
      workoutLogsSynced,
      bodyMeasurementsSynced,
      muscleGoalsSynced,
      weeklyPlansSynced,
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
      bodyMeasurementsSynced,
      muscleGoalsSynced,
      weeklyPlansSynced,
    };
  }
}