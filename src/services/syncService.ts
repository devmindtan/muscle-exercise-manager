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
  cardioLogsSynced: number;
  nutritionSynced: number;
}

export async function syncData(deviceId: string): Promise<SyncResult> {
  const errors: string[] = [];
  let muscleGroupsSynced = 0;
  let exercisesSynced = 0;
  let workoutLogsSynced = 0;
  let bodyMeasurementsSynced = 0;
  let muscleGoalsSynced = 0;
  let weeklyPlansSynced = 0;
  let cardioLogsSynced = 0;
  let nutritionSynced = 0;

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
        cardioLogsSynced,
        nutritionSynced,
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

    const pendingCardioLogs = await LocalDB.getPendingCardioLogs();
    for (const cardio of pendingCardioLogs) {
      try {
        const { error } = await (supabase.from('cardio_logs').upsert({
          id: cardio.id,
          user_id: userId,
          name: cardio.name,
          duration_minutes: cardio.duration_minutes,
          note: cardio.note,
          logged_at: cardio.logged_at,
          created_at: cardio.created_at,
          updated_at: new Date().toISOString(),
          deleted_at: cardio.deleted_at,
          sync_status: 'synced',
        }) as any);

        if (error) {
          errors.push(`Failed to sync cardio log ${cardio.id}: ${error.message}`);
        } else {
          await LocalDB.markCardioLogSynced(cardio.id);
          cardioLogsSynced++;
        }
      } catch (e: any) {
        errors.push(`Error syncing cardio log ${cardio.id}: ${e.message}`);
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

    // Cardio logs — luôn pull mỗi lần (cross-device realtime)
    try {
      const { data: remoteCardioLogs, error: cardioError } = await supabase
        .from('cardio_logs')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (cardioError) {
        errors.push(`Failed to fetch cardio logs: ${cardioError.message}`);
      } else if (remoteCardioLogs && Array.isArray(remoteCardioLogs)) {
        for (const row of remoteCardioLogs) {
          const cardioData = row as any;
          await LocalDB.upsertCardioLog({
            ...cardioData,
            sync_status: 'synced',
          });
        }
      }
    } catch (e: any) {
      errors.push(`Error pulling cardio logs: ${e.message}`);
    }

    // ─── NUTRITION PUSH ──────────────────────────────────────────────────────

    // Nutrient configs
    const pendingConfigs = await LocalDB.getPendingNutrientConfigs();
    for (const c of pendingConfigs) {
      try {
        const { error } = await (supabase as any).from('nutrition_nutrient_configs').upsert({
          id: c.id, user_id: userId, key: c.key, label: c.label, unit: c.unit,
          is_enabled: c.is_enabled === 1, display_order: c.display_order,
          created_at: c.created_at, updated_at: c.updated_at,
          deleted_at: c.deleted_at ?? null, sync_status: 'synced',
        }, { onConflict: 'id' });
        if (error) throw error;
        await LocalDB.markNutrientConfigSynced(c.id);
        nutritionSynced++;
      } catch (e: any) {
        errors.push(`Failed to sync nutrient config ${c.key}: ${e.message}`);
      }
    }

    // Foods
    const pendingFoods = await LocalDB.getPendingNutritionFoods();
    for (const f of pendingFoods) {
      try {
        const { error } = await (supabase as any).from('nutrition_foods').upsert({
          id: f.id, user_id: userId, name: f.name, brand: f.brand ?? null,
          serving_size: f.serving_size, serving_unit: f.serving_unit,
          nutrients_json: JSON.parse(f.nutrients_json || '{}'),
          note: f.note ?? null, created_at: f.created_at, updated_at: f.updated_at,
          deleted_at: f.deleted_at ?? null, sync_status: 'synced',
        }, { onConflict: 'id' });
        if (error) throw error;
        await LocalDB.markNutritionFoodSynced(f.id);
        nutritionSynced++;
      } catch (e: any) {
        errors.push(`Failed to sync food ${f.id}: ${e.message}`);
      }
    }

    // Logs
    const pendingLogs = await LocalDB.getPendingNutritionLogs();
    for (const l of pendingLogs) {
      try {
        const { error } = await (supabase as any).from('nutrition_logs').upsert({
          id: l.id, user_id: userId, food_id: l.food_id ?? null, food_name: l.food_name,
          quantity: l.quantity, nutrients_json: JSON.parse(l.nutrients_json || '{}'),
          meal_type: l.meal_type, note: l.note ?? null, logged_at: l.logged_at,
          created_at: l.created_at, updated_at: l.updated_at,
          deleted_at: l.deleted_at ?? null, sync_status: 'synced',
        }, { onConflict: 'id' });
        if (error) throw error;
        await LocalDB.markNutritionLogSynced(l.id);
        nutritionSynced++;
      } catch (e: any) {
        errors.push(`Failed to sync nutrition log ${l.id}: ${e.message}`);
      }
    }

    // Goals
    const pendingGoals = await LocalDB.getPendingNutritionGoals();
    for (const g of pendingGoals) {
      try {
        const { error } = await (supabase as any).from('nutrition_goals').upsert({
          id: g.id, user_id: userId, nutrient_key: g.nutrient_key,
          target_value: g.target_value, unit: g.unit,
          created_at: g.created_at, updated_at: g.updated_at,
          deleted_at: g.deleted_at ?? null, sync_status: 'synced',
        }, { onConflict: 'id' });
        if (error) throw error;
        await LocalDB.markNutritionGoalSynced(g.id);
        nutritionSynced++;
      } catch (e: any) {
        errors.push(`Failed to sync nutrition goal ${g.id}: ${e.message}`);
      }
    }

    // TDEE settings (no sync_status column — detect unsynced by user_id IS NULL)
    const pendingTdee = await LocalDB.getPendingTdeeSettings();
    if (pendingTdee) {
      try {
        const { error } = await (supabase as any).from('nutrition_tdee_settings').upsert({
          id: pendingTdee.id, user_id: userId,
          bmr_method: pendingTdee.bmr_method, custom_bmr: pendingTdee.custom_bmr ?? null,
          bmr_pct: pendingTdee.bmr_pct, neat_pct: pendingTdee.neat_pct,
          tef_pct: pendingTdee.tef_pct, eat_pct: pendingTdee.eat_pct,
          protein_multiplier: pendingTdee.protein_multiplier, goal_type: pendingTdee.goal_type,
          created_at: pendingTdee.created_at, updated_at: pendingTdee.updated_at,
        }, { onConflict: 'id' });
        if (error) throw error;
        await LocalDB.markTdeeSettingsSynced(pendingTdee.id, userId);
        nutritionSynced++;
      } catch (e: any) {
        errors.push(`Failed to sync TDEE settings: ${e.message}`);
      }
    }

    // ─── NUTRITION PULL ──────────────────────────────────────────────────────

    // Configs, goals, TDEE — always pull (small tables, cross-device)
    // Guard: skip any row still 'pending' locally (edited but not yet pushed),
    // otherwise this pull would clobber it with a stale remote copy and mark
    // it 'synced' so it never gets pushed at all.
    try {
      const stillPendingConfigs = new Set((await LocalDB.getPendingNutrientConfigs()).map((c) => c.id));
      const { data: remoteConfigs, error } = await (supabase as any)
        .from('nutrition_nutrient_configs').select('*').eq('user_id', userId);
      if (error) throw error;
      for (const r of (remoteConfigs ?? [])) {
        if (stillPendingConfigs.has(r.id)) continue;
        await LocalDB.upsertNutrientConfig({
          ...r, is_enabled: r.is_enabled ? 1 : 0, sync_status: 'synced',
        });
      }
    } catch (e: any) {
      errors.push(`Failed to pull nutrient configs: ${e.message}`);
    }

    try {
      const stillPendingGoals = new Set((await LocalDB.getPendingNutritionGoals()).map((g) => g.id));
      const { data: remoteGoals, error } = await (supabase as any)
        .from('nutrition_goals').select('*').eq('user_id', userId);
      if (error) throw error;
      for (const r of (remoteGoals ?? [])) {
        if (stillPendingGoals.has(r.id)) continue;
        await LocalDB.upsertNutritionGoal({ ...r, sync_status: 'synced' });
      }
    } catch (e: any) {
      errors.push(`Failed to pull nutrition goals: ${e.message}`);
    }

    try {
      const { data: remoteTdee, error } = await (supabase as any)
        .from('nutrition_tdee_settings').select('*').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      if (remoteTdee) {
        await LocalDB.upsertTdeeSettings({ ...remoteTdee });
      }
    } catch (e: any) {
      errors.push(`Failed to pull TDEE settings: ${e.message}`);
    }

    // Foods & logs — always pull (user needs their library & history cross-device)
    try {
      const stillPendingFoods = new Set((await LocalDB.getPendingNutritionFoods()).map((f) => f.id));
      const { data: remoteFoods, error } = await (supabase as any)
        .from('nutrition_foods').select('*').eq('user_id', userId);
      if (error) throw error;
      for (const r of (remoteFoods ?? [])) {
        if (stillPendingFoods.has(r.id)) continue;
        await LocalDB.upsertNutritionFood({
          ...r,
          nutrients_json: typeof r.nutrients_json === 'string'
            ? r.nutrients_json
            : JSON.stringify(r.nutrients_json ?? {}),
          sync_status: 'synced',
        });
      }
    } catch (e: any) {
      errors.push(`Failed to pull nutrition foods: ${e.message}`);
    }

    try {
      const stillPendingLogs = new Set((await LocalDB.getPendingNutritionLogs()).map((l) => l.id));
      const { data: remoteLogs, error } = await (supabase as any)
        .from('nutrition_logs').select('*').eq('user_id', userId)
        .order('logged_at', { ascending: false }).limit(500);
      if (error) throw error;
      for (const r of (remoteLogs ?? [])) {
        if (stillPendingLogs.has(r.id)) continue;
        await LocalDB.upsertNutritionLog({
          ...r,
          nutrients_json: typeof r.nutrients_json === 'string'
            ? r.nutrients_json
            : JSON.stringify(r.nutrients_json ?? {}),
          sync_status: 'synced',
        });
      }
    } catch (e: any) {
      errors.push(`Failed to pull nutrition logs: ${e.message}`);
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
      cardioLogsSynced,
      nutritionSynced,
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
      cardioLogsSynced,
      nutritionSynced,
    };
  }
}