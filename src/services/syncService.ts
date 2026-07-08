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

    // Every signed-in user needs a discoverable `profiles` row for the
    // Cộng đồng tab — auto-provision it here (seeded from Google name) so
    // people show up in "Khám phá" without first having to open account
    // settings and manually hit "Lưu hồ sơ".
    try {
      const { data: existingProfile, error: profileLookupError } = await (supabase as any)
        .from('profiles')
        .select('id, display_name')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileLookupError) throw profileLookupError;

      const fallbackName =
        user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Người dùng';

      if (!existingProfile) {
        const now = new Date().toISOString();
        const { error: profileInsertError } = await (supabase as any).from('profiles').insert({
          id: `${userId}`,
          user_id: userId,
          display_name: fallbackName,
          avatar_url: user.user_metadata?.picture ?? null,
          bio: null,
          is_private: false,
          created_at: now,
          updated_at: now,
        });
        if (profileInsertError) throw profileInsertError;
      } else if (!existingProfile.display_name || !existingProfile.display_name.trim()) {
        // Repair older/blanked-out rows so no profile is ever nameless in
        // friend search/discovery.
        const { error: profileRepairError } = await (supabase as any)
          .from('profiles')
          .update({ display_name: fallbackName, updated_at: new Date().toISOString() })
          .eq('id', existingProfile.id);
        if (profileRepairError) throw profileRepairError;
      }
    } catch (e: any) {
      errors.push(`Failed to auto-provision profile: ${e.message}`);
    }

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
          parent_exercise_id: exercise.parent_exercise_id ?? null,
          exercise_type: exercise.exercise_type ?? null,
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

    // exercise_secondary_muscles — bảng junction đơn giản, không có deleted_at
    // ở Postgres nên xoá cứng khi deleted=1 (thay vì upsert deleted_at).
    const dirtySecondaryMuscles = await LocalDB.getDirtyExerciseSecondaryMuscles();
    for (const row of dirtySecondaryMuscles) {
      try {
        if (row.deleted) {
          const { error } = await supabase.from('exercise_secondary_muscles').delete().eq('id', row.id);
          if (error) throw error;
        } else {
          const { error } = await (supabase.from('exercise_secondary_muscles').upsert({
            id: row.id,
            user_id: userId,
            exercise_id: row.exercise_id,
            muscle_group_id: row.muscle_group_id,
          }) as any);
          if (error) throw error;
        }
        await LocalDB.markExerciseSecondaryMuscleClean(row.id);
      } catch (e: any) {
        errors.push(`Error syncing exercise secondary muscle ${row.id}: ${e.message}`);
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
          exercise_id: plan.exercise_id ?? null,
          sets: plan.sets,
          note: plan.note,
          plan_id: plan.plan_id,
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

    // Workout plans (named plan groups) — guard against pull clobbering pending edits
    const pendingWorkoutPlans = await LocalDB.getPendingWorkoutPlans();
    for (const plan of pendingWorkoutPlans) {
      try {
        const { error } = await (supabase as any).from('workout_plans').upsert({
          id: plan.id, user_id: userId, name: plan.name, is_active: plan.is_active === 1,
          created_at: plan.created_at, updated_at: plan.updated_at,
          deleted_at: plan.deleted_at ?? null, sync_status: 'synced',
        }, { onConflict: 'id' });
        if (error) throw error;
        await LocalDB.markWorkoutPlanSynced(plan.id);
        weeklyPlansSynced++;
      } catch (e: any) {
        errors.push(`Failed to sync workout plan ${plan.id}: ${e.message}`);
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
    // FIX: muscle_groups, exercises, muscle_goals luôn pull toàn bộ mỗi lần
    // sync vì chúng nhỏ và cần đồng bộ cross-device realtime.
    // workout_logs & body_measurements pull toàn bộ ở lần đầu (isFirstSync),
    // các lần sau chỉ pull incremental (updated_at > lastSyncStored) để vừa
    // rẻ vừa vẫn thấy được thay đổi từ thiết bị khác — trước đây các lần
    // sau hoàn toàn không pull, khiến log/InBody ghi ở thiết bị khác không
    // bao giờ về được thiết bị này.

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

    // exercise_secondary_muscles — luôn pull toàn bộ (bảng nhỏ, giống exercises)
    try {
      const { data: remoteSecondaryMuscles, error: secondaryMuscleError } = await supabase
        .from('exercise_secondary_muscles')
        .select('*')
        .eq('user_id', userId);

      if (secondaryMuscleError) {
        errors.push(`Failed to fetch exercise secondary muscles: ${secondaryMuscleError.message}`);
      } else if (remoteSecondaryMuscles && Array.isArray(remoteSecondaryMuscles)) {
        for (const row of remoteSecondaryMuscles) {
          const rowData = row as any;
          await LocalDB.upsertExerciseSecondaryMuscle({
            id: rowData.id,
            exercise_id: rowData.exercise_id,
            muscle_group_id: rowData.muscle_group_id,
            created_at: rowData.created_at,
            user_id: rowData.user_id,
            dirty: 0,
            deleted: 0,
          });
        }
        await LocalDB.markMissingExerciseSecondaryMusclesDeleted(remoteSecondaryMuscles.map((row: any) => row.id));
      }
    } catch (e: any) {
      errors.push(`Error pulling exercise secondary muscles: ${e.message}`);
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

    // Workout logs — pull toàn bộ ở lần đầu, incremental (updated_at > cutoff)
    // ở các lần sau. markMissingWorkoutLogsDeleted chỉ chính xác khi có đủ
    // toàn bộ tập kết quả (full pull) — với incremental, việc xoá đã được
    // truyền qua field deleted_at của chính dòng đó (upsert bên dưới tự set
    // deleted = 1), nên KHÔNG được gọi markMissing* ở nhánh incremental,
    // nếu không sẽ đánh dấu nhầm hàng loạt bản ghi local chưa đổi thành đã xoá.
    try {
      let workoutLogsQuery = supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      if (!isFirstSync && lastSyncStored) {
        workoutLogsQuery = workoutLogsQuery.gt('updated_at', lastSyncStored);
      }
      const { data: remoteLogs, error: logError } = await workoutLogsQuery;

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
        if (isFirstSync) {
          await LocalDB.markMissingWorkoutLogsDeleted(remoteLogs.map((row: any) => row.id));
        }
      }
    } catch (e: any) {
      errors.push(`Error pulling workout logs: ${e.message}`);
    }

    // Body measurements — cùng chiến lược full-then-incremental như trên.
    try {
      let bodyMeasurementsQuery = supabase
        .from('body_measurements')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      if (!isFirstSync && lastSyncStored) {
        bodyMeasurementsQuery = bodyMeasurementsQuery.gt('updated_at', lastSyncStored);
      }
      const { data: remoteMeasurements, error: measurementError } = await bodyMeasurementsQuery;

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
        if (isFirstSync) {
          await LocalDB.markMissingBodyMeasurementsDeleted(expandedRemoteMeasurementIds);
        }
      }
    } catch (e: any) {
      errors.push(`Error pulling body measurements: ${e.message}`);
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

    // Workout plans — luôn pull mỗi lần, guard chống đè lên edit chưa sync
    try {
      const stillPendingPlans = new Set((await LocalDB.getPendingWorkoutPlans()).map((p) => p.id));
      const { data: remotePlans, error: workoutPlanError } = await (supabase as any)
        .from('workout_plans')
        .select('*')
        .eq('user_id', userId);

      if (workoutPlanError) {
        errors.push(`Failed to fetch workout plans: ${workoutPlanError.message}`);
      } else if (remotePlans && Array.isArray(remotePlans)) {
        for (const r of remotePlans) {
          if (stillPendingPlans.has(r.id)) continue;
          await LocalDB.upsertWorkoutPlan({
            ...r,
            is_active: r.is_active ? 1 : 0,
            sync_status: 'synced',
          });
        }
      }
    } catch (e: any) {
      errors.push(`Error pulling workout plans: ${e.message}`);
    }

    // Friendships — pull rows where I'm either requester or addressee
    try {
      const stillPendingFriendships = new Set((await LocalDB.getPendingFriendships()).map((f) => f.id));
      const { data: remoteFriendships, error: friendshipError } = await (supabase as any)
        .from('friendships')
        .select('*')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

      if (friendshipError) {
        errors.push(`Failed to fetch friendships: ${friendshipError.message}`);
      } else if (remoteFriendships && Array.isArray(remoteFriendships)) {
        for (const r of remoteFriendships) {
          if (stillPendingFriendships.has(r.id)) continue;
          await LocalDB.upsertFriendship({ ...r, sync_status: 'synced' });
        }
      }
    } catch (e: any) {
      errors.push(`Error pulling friendships: ${e.message}`);
    }

    // Plan shares — only shares I own (shares by others are resolved on-demand via share code)
    try {
      const stillPendingShares = new Set((await LocalDB.getPendingPlanShares()).map((s) => s.id));
      const { data: remoteShares, error: shareError } = await (supabase as any)
        .from('plan_shares')
        .select('*')
        .eq('owner_id', userId);

      if (shareError) {
        errors.push(`Failed to fetch plan shares: ${shareError.message}`);
      } else if (remoteShares && Array.isArray(remoteShares)) {
        for (const r of remoteShares) {
          if (stillPendingShares.has(r.id)) continue;
          await LocalDB.upsertPlanShare({ ...r, sync_status: 'synced' });
        }
      }
    } catch (e: any) {
      errors.push(`Error pulling plan shares: ${e.message}`);
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

    // Profile (display name, avatar, bio, privacy) — singleton row
    const pendingProfile = await LocalDB.getPendingProfile();
    if (pendingProfile) {
      try {
        const { error } = await (supabase as any).from('profiles').upsert({
          id: pendingProfile.id, user_id: userId,
          display_name: pendingProfile.display_name ?? null,
          avatar_url: pendingProfile.avatar_url ?? null,
          bio: pendingProfile.bio ?? null,
          is_private: pendingProfile.is_private === 1,
          created_at: pendingProfile.created_at, updated_at: pendingProfile.updated_at,
        }, { onConflict: 'id' });
        if (error) throw error;
        await LocalDB.markProfileSynced(pendingProfile.id);
        nutritionSynced++;
      } catch (e: any) {
        errors.push(`Failed to sync profile: ${e.message}`);
      }
    }

    // Friendships (both directions — I may be requester or addressee).
    // Can't use upsert() here: the "friendships" RLS INSERT policy only
    // allows the requester to create a row, but the addressee also needs to
    // push status changes (accept/decline) for a row someone else created.
    // Postgres checks the INSERT policy's WITH CHECK on the proposed row
    // before it even gets to fall back to ON CONFLICT DO UPDATE, so an
    // addressee-initiated upsert() is rejected outright. Try UPDATE first
    // (allowed for either participant); only INSERT when truly new (i.e.
    // the update matched no row), which only ever happens when this device
    // is the requester.
    const pendingFriendships = await LocalDB.getPendingFriendships();
    for (const f of pendingFriendships) {
      try {
        const { data: updatedRows, error: updateError } = await (supabase as any)
          .from('friendships')
          .update({
            status: f.status,
            updated_at: f.updated_at,
            deleted_at: f.deleted_at ?? null,
          })
          .eq('id', f.id)
          .select('id');
        if (updateError) throw updateError;

        if (!updatedRows || updatedRows.length === 0) {
          const { error: insertError } = await (supabase as any).from('friendships').insert({
            id: f.id, requester_id: f.requester_id, addressee_id: f.addressee_id,
            status: f.status, created_at: f.created_at, updated_at: f.updated_at,
            deleted_at: f.deleted_at ?? null,
          });
          if (insertError) throw insertError;
        }

        await LocalDB.markFriendshipSynced(f.id);
        nutritionSynced++;
      } catch (e: any) {
        errors.push(`Failed to sync friendship ${f.id}: ${e.message}`);
      }
    }

    // Plan shares (only shares I own)
    const pendingPlanShares = await LocalDB.getPendingPlanShares();
    for (const s of pendingPlanShares) {
      try {
        const { error } = await (supabase as any).from('plan_shares').upsert({
          id: s.id, plan_id: s.plan_id, owner_id: s.owner_id, share_code: s.share_code,
          visibility: s.visibility, is_public: !!s.is_public,
          created_at: s.created_at, updated_at: s.updated_at,
          deleted_at: s.deleted_at ?? null,
        }, { onConflict: 'id' });
        if (error) throw error;
        await LocalDB.markPlanShareSynced(s.id);
        nutritionSynced++;
      } catch (e: any) {
        errors.push(`Failed to sync plan share ${s.id}: ${e.message}`);
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
        // Remove local duplicates with same key but different id (seeded on another device)
        await LocalDB.deleteNutrientConfigDuplicates(r.key, r.id);
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

    // Profile — guard against pull clobbering a pending (not-yet-pushed) edit
    try {
      const stillPendingProfile = await LocalDB.getPendingProfile();
      if (!stillPendingProfile) {
        const { data: remoteProfile, error } = await (supabase as any)
          .from('profiles').select('*').eq('user_id', userId).maybeSingle();
        if (error) throw error;
        if (remoteProfile) {
          await LocalDB.upsertProfile({
            ...remoteProfile,
            is_private: remoteProfile.is_private ? 1 : 0,
            sync_status: 'synced',
          });
        }
      }
    } catch (e: any) {
      errors.push(`Failed to pull profile: ${e.message}`);
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
      // FIX: bảng này trước đây luôn giới hạn 500 dòng mới nhất theo logged_at
      // mỗi lần sync, nghĩa là dữ liệu cũ hơn 500 dòng không bao giờ đồng bộ
      // được sang thiết bị khác. Đổi sang cùng chiến lược full-lần-đầu +
      // incremental (updated_at > cutoff) như workout_logs/body_measurements.
      let nutritionLogsQuery = (supabase as any)
        .from('nutrition_logs').select('*').eq('user_id', userId)
        .order('logged_at', { ascending: false });
      if (!isFirstSync && lastSyncStored) {
        nutritionLogsQuery = nutritionLogsQuery.gt('updated_at', lastSyncStored);
      }
      const { data: remoteLogs, error } = await nutritionLogsQuery;
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