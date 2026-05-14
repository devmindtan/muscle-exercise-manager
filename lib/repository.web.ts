import { MuscleGroup, Exercise, WorkoutLog } from '@/types/database';
import {
  DEMO_MUSCLE_GROUPS,
  DEMO_EXERCISES,
  DEMO_WORKOUT_LOGS,
} from './demoData';

export type RecentLog = WorkoutLog & {
  exercise_name: string;
  muscle_group_name: string;
  muscle_group_color: string;
};

export type WeekStat = MuscleGroup & {
  weekly_sets: number;
  progress: number;
};

// Web is demo-only: all operations return demo data without persisting

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
  return DEMO_MUSCLE_GROUPS.filter(isAlive).sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
}

export async function getMuscleGroup(id: string): Promise<MuscleGroup | null> {
  return (
    DEMO_MUSCLE_GROUPS.find((g) => g.id === id && isAlive(g)) ?? null
  );
}

export async function insertMuscleGroup(data: {
  name: string;
  color: string;
  target_sets_per_week: number;
  target_sets_per_month: number;
  image_uri?: string | null;
}): Promise<MuscleGroup> {
  // Web demo: no persistence, just return demo data
  const now = new Date().toISOString();
  const row: MuscleGroup = {
    id: `demo-${Date.now()}`,
    name: data.name,
    color: data.color,
    target_sets_per_week: data.target_sets_per_week,
    target_sets_per_month: data.target_sets_per_month,
    image_uri: data.image_uri ?? null,
    created_at: now,
    updated_at: now,
    sync_status: 'synced',
    deleted_at: null,
    user_id: 'demo-user',
  };
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
  // Web demo: no-op
}

export async function softDeleteMuscleGroup(id: string): Promise<void> {
  // Web demo: no-op
}

export async function getMuscleGroupsWithWeeklyStats(
  start: string,
  end: string,
): Promise<WeekStat[]> {
  const groups = DEMO_MUSCLE_GROUPS.filter(isAlive);
  const logs = DEMO_WORKOUT_LOGS.filter(
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
  return DEMO_EXERCISES.filter(
    (e) => e.muscle_group_id === muscleGroupId && isAlive(e),
  )
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
  // Web demo: no persistence, just return demo data
  const now = new Date().toISOString();
  const row: Exercise = {
    id: `demo-${Date.now()}`,
    muscle_group_id: data.muscle_group_id,
    name: data.name,
    notes: data.notes ?? null,
    image_uri: data.image_uri ?? null,
    is_active: true,
    created_at: now,
    updated_at: now,
    sync_status: 'synced',
    deleted_at: null,
    user_id: 'demo-user',
  };
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
  // Web demo: no-op
}

export async function getRecentLogs(limit = 50): Promise<RecentLog[]> {
  return withLatestLogs(
    DEMO_WORKOUT_LOGS,
    DEMO_EXERCISES,
    DEMO_MUSCLE_GROUPS,
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
  // Web demo: no persistence
}

export async function softDeleteWorkoutLog(id: string): Promise<void> {
  // Web demo: no-op
}

export async function getSetCounts(
  muscleGroupId: string,
  start: string,
  end: string,
): Promise<number> {
  return DEMO_WORKOUT_LOGS.filter(
    (l) =>
      isAlive(l) &&
      l.muscle_group_id === muscleGroupId &&
      l.logged_at >= start &&
      l.logged_at <= end,
  ).reduce((sum, l) => sum + l.sets, 0);
}
