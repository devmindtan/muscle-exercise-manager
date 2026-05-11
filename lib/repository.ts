import { getDB } from './db';
import { MuscleGroup, Exercise, WorkoutLog } from '@/types/database';

// ── Extra types ──────────────────────────────────────────────────────────────
export type RecentLog = WorkoutLog & {
  exercise_name: string;
  muscle_group_name: string;
  muscle_group_color: string;
};

export type WeekStat = MuscleGroup & {
  weekly_sets: number;
  progress: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────
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

function mapExercise(row: Record<string, unknown>): Exercise {
  return {
    ...(row as Exercise),
    is_active: row.is_active === 1 || row.is_active === true,
  };
}

// ── Muscle Groups ─────────────────────────────────────────────────────────────
export async function getMuscleGroups(): Promise<MuscleGroup[]> {
  const db = await getDB();
  return db.getAllAsync<MuscleGroup>(
    `SELECT * FROM muscle_groups WHERE deleted_at IS NULL ORDER BY created_at ASC`,
  );
}

export async function getMuscleGroup(id: string): Promise<MuscleGroup | null> {
  const db = await getDB();
  return db.getFirstAsync<MuscleGroup>(
    `SELECT * FROM muscle_groups WHERE id = ? AND deleted_at IS NULL`,
    [id],
  );
}

export async function insertMuscleGroup(data: {
  name: string;
  color: string;
  target_sets_per_week: number;
  target_sets_per_month: number;
  image_uri?: string | null;
}): Promise<MuscleGroup> {
  const db = await getDB();
  const id = genId();
  const ts = now();
  await db.runAsync(
    `INSERT INTO muscle_groups
       (id, name, color, target_sets_per_week, target_sets_per_month,
        image_uri, created_at, updated_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      id,
      data.name,
      data.color,
      data.target_sets_per_week,
      data.target_sets_per_month,
      data.image_uri ?? null,
      ts,
      ts,
    ],
  );
  return (await getMuscleGroup(id))!;
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
  const db = await getDB();
  const ts = now();
  const fields: string[] = ['updated_at = ?', "sync_status = 'pending'"];
  const values: (string | number | null)[] = [ts];
  if (data.name !== undefined) {
    fields.push('name = ?');
    values.push(data.name);
  }
  if (data.color !== undefined) {
    fields.push('color = ?');
    values.push(data.color);
  }
  if (data.target_sets_per_week !== undefined) {
    fields.push('target_sets_per_week = ?');
    values.push(data.target_sets_per_week);
  }
  if (data.target_sets_per_month !== undefined) {
    fields.push('target_sets_per_month = ?');
    values.push(data.target_sets_per_month);
  }
  if ('image_uri' in data) {
    fields.push('image_uri = ?');
    values.push(data.image_uri ?? null);
  }
  values.push(id);
  await db.runAsync(
    `UPDATE muscle_groups SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export async function softDeleteMuscleGroup(id: string): Promise<void> {
  const db = await getDB();
  const ts = now();
  await db.runAsync(
    `UPDATE muscle_groups
     SET deleted_at = ?, updated_at = ?, sync_status = 'pending'
     WHERE id = ?`,
    [ts, ts, id],
  );
}

export async function getMuscleGroupsWithWeeklyStats(
  start: string,
  end: string,
): Promise<WeekStat[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<MuscleGroup & { weekly_sets: number }>(
    `SELECT mg.*, COALESCE(SUM(wl.sets), 0) AS weekly_sets
     FROM muscle_groups mg
     LEFT JOIN workout_logs wl
       ON  wl.muscle_group_id = mg.id
       AND wl.logged_at  >= ?
       AND wl.logged_at  <= ?
       AND wl.deleted_at IS NULL
     WHERE mg.deleted_at IS NULL
     GROUP BY mg.id
     ORDER BY mg.created_at ASC`,
    [start, end],
  );
  return rows.map((r) => ({
    ...r,
    progress:
      r.target_sets_per_week > 0 ? r.weekly_sets / r.target_sets_per_week : 0,
  }));
}

// ── Exercises ─────────────────────────────────────────────────────────────────
export async function getExercises(muscleGroupId: string): Promise<Exercise[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM exercises
     WHERE muscle_group_id = ? AND deleted_at IS NULL
     ORDER BY is_active DESC, created_at ASC`,
    [muscleGroupId],
  );
  return rows.map(mapExercise);
}

export async function getActiveExercises(
  muscleGroupId: string,
): Promise<Exercise[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM exercises
     WHERE muscle_group_id = ? AND is_active = 1 AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [muscleGroupId],
  );
  return rows.map(mapExercise);
}

export async function insertExercise(data: {
  muscle_group_id: string;
  name: string;
  notes?: string | null;
  image_uri?: string | null;
}): Promise<Exercise> {
  const db = await getDB();
  const id = genId();
  const ts = now();
  await db.runAsync(
    `INSERT INTO exercises
       (id, muscle_group_id, name, notes, image_uri,
        is_active, created_at, updated_at, sync_status)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, 'pending')`,
    [
      id,
      data.muscle_group_id,
      data.name,
      data.notes ?? null,
      data.image_uri ?? null,
      ts,
      ts,
    ],
  );
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM exercises WHERE id = ?',
    [id],
  );
  return mapExercise(row!);
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
  const db = await getDB();
  const ts = now();
  const fields: string[] = ['updated_at = ?', "sync_status = 'pending'"];
  const values: (string | number | null)[] = [ts];
  if (data.name !== undefined) {
    fields.push('name = ?');
    values.push(data.name);
  }
  if ('notes' in data) {
    fields.push('notes = ?');
    values.push(data.notes ?? null);
  }
  if ('image_uri' in data) {
    fields.push('image_uri = ?');
    values.push(data.image_uri ?? null);
  }
  if (data.is_active !== undefined) {
    fields.push('is_active = ?');
    values.push(data.is_active ? 1 : 0);
  }
  values.push(id);
  await db.runAsync(
    `UPDATE exercises SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

// ── Workout Logs ──────────────────────────────────────────────────────────────
export async function getRecentLogs(limit = 50): Promise<RecentLog[]> {
  const db = await getDB();
  return db.getAllAsync<RecentLog>(
    `SELECT wl.*,
            e.name  AS exercise_name,
            mg.name AS muscle_group_name,
            mg.color AS muscle_group_color
     FROM workout_logs wl
     LEFT JOIN exercises    e  ON e.id  = wl.exercise_id
     LEFT JOIN muscle_groups mg ON mg.id = wl.muscle_group_id
     WHERE wl.deleted_at IS NULL
     ORDER BY wl.logged_at DESC
     LIMIT ?`,
    [limit],
  );
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
  const db = await getDB();
  const id = genId();
  const ts = now();
  await db.runAsync(
    `INSERT INTO workout_logs
       (id, muscle_group_id, exercise_id, sets, reps, weight,
        note, logged_at, created_at, updated_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      id,
      data.muscle_group_id,
      data.exercise_id,
      data.sets,
      data.reps ?? null,
      data.weight ?? null,
      data.note ?? null,
      data.logged_at,
      ts,
      ts,
    ],
  );
}

export async function softDeleteWorkoutLog(id: string): Promise<void> {
  const db = await getDB();
  const ts = now();
  await db.runAsync(
    `UPDATE workout_logs
     SET deleted_at = ?, updated_at = ?, sync_status = 'pending'
     WHERE id = ?`,
    [ts, ts, id],
  );
}

export async function getSetCounts(
  muscleGroupId: string,
  start: string,
  end: string,
): Promise<number> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(sets), 0) AS total
     FROM workout_logs
     WHERE muscle_group_id = ?
       AND logged_at >= ? AND logged_at <= ?
       AND deleted_at IS NULL`,
    [muscleGroupId, start, end],
  );
  return row?.total ?? 0;
}
