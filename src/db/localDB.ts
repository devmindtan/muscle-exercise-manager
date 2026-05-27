import * as SQLite from 'expo-sqlite';
import { Database } from '@/src/types/database';

export type LocalMuscleGroup = Database['public']['Tables']['muscle_groups']['Row'] & {
  dirty?: 0 | 1;
  deleted?: 0 | 1;
};

export type LocalExercise = Database['public']['Tables']['exercises']['Row'] & {
  dirty?: 0 | 1;
  deleted?: 0 | 1;
};

export type ExerciseWithStats = LocalExercise & {
  last_logged_at?: string | null;
  weekly_sets?: number;
};

export type LocalWorkoutLog = Database['public']['Tables']['workout_logs']['Row'] & {
  dirty?: 0 | 1;
  deleted?: 0 | 1;
};

export type LocalBodyMeasurement = Database['public']['Tables']['body_measurements']['Row'] & {
  dirty?: 0 | 1;
  deleted?: 0 | 1;
};

export type LocalMuscleGoal = Database['public']['Tables']['muscle_goals']['Row'] & {
  dirty?: 0 | 1;
  deleted?: 0 | 1;
};

export type LocalWeeklyPlanEntry = {
  id: string;
  day_key: string;
  muscle_group_id: string;
  sets: number;
  note: string | null;
  created_at: string;
  updated_at: string;
  dirty?: 0 | 1;
  deleted?: 0 | 1;
};

const DB_NAME = 'muscle-manager.db';

let db: SQLite.SQLiteDatabase | null = null;
// Single promise guards both open + schema creation so every caller waits for a
// fully-initialised database. Setting it to null on failure allows a retry.
let dbReadyPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDatabase() {
  if (db) {
    return db;
  }

  if (!dbReadyPromise) {
    dbReadyPromise = (async () => {
      const database = await SQLite.openDatabaseAsync(DB_NAME);
      await database.execAsync('PRAGMA journal_mode = WAL;');
      await applySchema(database);
      db = database;
      return database;
    })().catch((error) => {
      db = null;
      dbReadyPromise = null;
      throw error;
    });
  }

  return dbReadyPromise;
}

// All CREATE TABLE / index / migration DDL lives here so it runs before any
// query regardless of whether SyncContext has initialised yet.
async function applySchema(database: SQLite.SQLiteDatabase) {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS muscle_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT,
      target_sets_per_week INTEGER DEFAULT 10,
      target_sets_per_month INTEGER DEFAULT 40,
      image_uri TEXT,
      category TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      dirty INTEGER DEFAULT 0,
      deleted INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      muscle_group_id TEXT NOT NULL,
      name TEXT NOT NULL,
      notes TEXT,
      image_uri TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      dirty INTEGER DEFAULT 0,
      deleted INTEGER DEFAULT 0,
      FOREIGN KEY (muscle_group_id) REFERENCES muscle_groups(id)
    );
    CREATE TABLE IF NOT EXISTS workout_logs (
      id TEXT PRIMARY KEY,
      exercise_id TEXT NOT NULL,
      muscle_group_id TEXT NOT NULL,
      sets INTEGER,
      reps INTEGER,
      weight REAL,
      note TEXT,
      logged_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      dirty INTEGER DEFAULT 0,
      deleted INTEGER DEFAULT 0,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id),
      FOREIGN KEY (muscle_group_id) REFERENCES muscle_groups(id)
    );
    CREATE TABLE IF NOT EXISTS body_measurements (
      id TEXT PRIMARY KEY,
      metric_key TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT NOT NULL,
      note TEXT,
      source TEXT,
      measured_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      dirty INTEGER DEFAULT 0,
      deleted INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS muscle_goals (
      id TEXT PRIMARY KEY,
      muscle_group_id TEXT NOT NULL,
      metric_key TEXT NOT NULL DEFAULT 'muscle_mass',
      current_value REAL,
      target_value REAL NOT NULL,
      unit TEXT NOT NULL,
      target_date TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      dirty INTEGER DEFAULT 0,
      deleted INTEGER DEFAULT 0,
      FOREIGN KEY (muscle_group_id) REFERENCES muscle_groups(id)
    );
    CREATE TABLE IF NOT EXISTS weekly_plan_entries (
      id TEXT PRIMARY KEY,
      day_key TEXT NOT NULL,
      muscle_group_id TEXT NOT NULL,
      sets INTEGER NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      dirty INTEGER DEFAULT 0,
      deleted INTEGER DEFAULT 0,
      FOREIGN KEY (muscle_group_id) REFERENCES muscle_groups(id)
    );
    CREATE INDEX IF NOT EXISTS idx_exercises_muscle_group_id ON exercises(muscle_group_id);
    CREATE INDEX IF NOT EXISTS idx_workout_logs_exercise_id ON workout_logs(exercise_id);
    CREATE INDEX IF NOT EXISTS idx_workout_logs_muscle_group_id ON workout_logs(muscle_group_id);
    CREATE INDEX IF NOT EXISTS idx_workout_logs_logged_at ON workout_logs(logged_at);
    CREATE INDEX IF NOT EXISTS idx_body_measurements_metric_key ON body_measurements(metric_key);
    CREATE INDEX IF NOT EXISTS idx_body_measurements_measured_at ON body_measurements(measured_at);
    CREATE INDEX IF NOT EXISTS idx_muscle_goals_muscle_group_id ON muscle_goals(muscle_group_id);
    CREATE INDEX IF NOT EXISTS idx_weekly_plan_day_key ON weekly_plan_entries(day_key);
    CREATE INDEX IF NOT EXISTS idx_weekly_plan_muscle_group_id ON weekly_plan_entries(muscle_group_id);
    CREATE INDEX IF NOT EXISTS idx_dirty_muscle_groups ON muscle_groups(dirty) WHERE dirty = 1;
    CREATE INDEX IF NOT EXISTS idx_dirty_exercises ON exercises(dirty) WHERE dirty = 1;
    CREATE INDEX IF NOT EXISTS idx_dirty_workout_logs ON workout_logs(dirty) WHERE dirty = 1;
    CREATE INDEX IF NOT EXISTS idx_dirty_body_measurements ON body_measurements(dirty) WHERE dirty = 1;
    CREATE INDEX IF NOT EXISTS idx_dirty_muscle_goals ON muscle_goals(dirty) WHERE dirty = 1;
    CREATE INDEX IF NOT EXISTS idx_dirty_weekly_plan_entries ON weekly_plan_entries(dirty) WHERE dirty = 1;
  `);
  await migrateLegacySchema(database);
}

async function ensureColumn(
  database: SQLite.SQLiteDatabase,
  tableName: string,
  columnName: string,
  columnDefinition: string
) {
  const columns = await database.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${tableName})`
  );
  const hasColumn = columns.some((column) => column.name === columnName);
  if (!hasColumn) {
    await database.execAsync(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`
    );
  }
}

async function migrateLegacySchema(database: SQLite.SQLiteDatabase) {
  // Databases created by older app versions may miss these columns.
  // Keep migrations idempotent so initialize can run safely on every launch.
  await ensureColumn(database, 'muscle_groups', 'dirty', 'INTEGER DEFAULT 0');
  await ensureColumn(database, 'muscle_groups', 'deleted', 'INTEGER DEFAULT 0');
  await ensureColumn(database, 'muscle_groups', 'category', 'TEXT');

  await ensureColumn(database, 'exercises', 'dirty', 'INTEGER DEFAULT 0');
  await ensureColumn(database, 'exercises', 'deleted', 'INTEGER DEFAULT 0');
  await ensureColumn(database, 'exercises', 'is_active', 'INTEGER DEFAULT 1');

  await ensureColumn(database, 'workout_logs', 'dirty', 'INTEGER DEFAULT 0');
  await ensureColumn(database, 'workout_logs', 'deleted', 'INTEGER DEFAULT 0');

  await ensureColumn(database, 'body_measurements', 'dirty', 'INTEGER DEFAULT 0');
  await ensureColumn(database, 'body_measurements', 'deleted', 'INTEGER DEFAULT 0');
  await ensureColumn(database, 'body_measurements', 'source', 'TEXT');

  await ensureColumn(database, 'muscle_goals', 'dirty', 'INTEGER DEFAULT 0');
  await ensureColumn(database, 'muscle_goals', 'deleted', 'INTEGER DEFAULT 0');
  await ensureColumn(database, 'muscle_goals', 'metric_key', "TEXT DEFAULT 'muscle_mass'");

  await ensureColumn(database, 'weekly_plan_entries', 'dirty', 'INTEGER DEFAULT 0');
  await ensureColumn(database, 'weekly_plan_entries', 'deleted', 'INTEGER DEFAULT 0');
  await ensureColumn(database, 'weekly_plan_entries', 'note', 'TEXT');
}

// Retained for backward-compat: schema is now applied inside getDatabase(),
// so this is a no-op that just triggers the initialisation if not yet done.
export async function initializeDatabase() {
  await getDatabase();
}

// Muscle Groups
export async function getMuscleGroups() {
  const database = await getDatabase();
  const result = await database.getAllAsync<LocalMuscleGroup>(
    `SELECT mg.*, COALESCE(ec.exercise_count, 0) AS exercise_count
     FROM muscle_groups mg
     LEFT JOIN (
       SELECT muscle_group_id, COUNT(*) AS exercise_count
       FROM exercises
       WHERE deleted = 0
       GROUP BY muscle_group_id
     ) ec ON ec.muscle_group_id = mg.id
     LEFT JOIN (
       SELECT muscle_group_id, MAX(logged_at) AS last_logged_at
       FROM workout_logs
       WHERE deleted = 0
       GROUP BY muscle_group_id
     ) wl ON wl.muscle_group_id = mg.id
     WHERE mg.deleted = 0
     ORDER BY COALESCE(wl.last_logged_at, mg.updated_at, mg.created_at) DESC`
  );
  return result;
}

export async function getMuscleGroupById(id: string) {
  const database = await getDatabase();
  const result = await database.getFirstAsync<LocalMuscleGroup>(
    'SELECT * FROM muscle_groups WHERE id = ? AND deleted = 0',
    [id]
  );
  return result;
}

export async function upsertMuscleGroup(group: LocalMuscleGroup) {
  const database = await getDatabase();
  const dirty = group.dirty ?? 0;
  const deleted = group.deleted ?? 0;
  await database.runAsync(
    `INSERT INTO muscle_groups (id, name, color, target_sets_per_week, target_sets_per_month, image_uri, category, created_at, updated_at, dirty, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = COALESCE(excluded.name, name),
       color = COALESCE(excluded.color, color),
       target_sets_per_week = COALESCE(excluded.target_sets_per_week, target_sets_per_week),
       target_sets_per_month = COALESCE(excluded.target_sets_per_month, target_sets_per_month),
       image_uri = COALESCE(excluded.image_uri, image_uri),
       category = excluded.category,
       updated_at = datetime('now'),
       dirty = COALESCE(excluded.dirty, dirty),
       deleted = COALESCE(excluded.deleted, deleted)`,
    [
      group.id,
      group.name,
      group.color || null,
      group.target_sets_per_week || 10,
      group.target_sets_per_month || 40,
      group.image_uri || null,
      group.category || null,
      group.created_at,
      group.updated_at || new Date().toISOString(),
      dirty,
      deleted,
    ]
  );
}

export async function getDirtyMuscleGroups() {
  const database = await getDatabase();
  const result = await database.getAllAsync<LocalMuscleGroup>(
    'SELECT * FROM muscle_groups WHERE dirty = 1 ORDER BY updated_at ASC'
  );
  return result;
}

export async function markMuscleGroupClean(id: string) {
  const database = await getDatabase();
  await database.runAsync('UPDATE muscle_groups SET dirty = 0 WHERE id = ?', [id]);
}

// Exercises
export async function getExercises(muscleGroupId?: string) {
  const database = await getDatabase();
  if (muscleGroupId) {
    return database.getAllAsync<LocalExercise>(
      `SELECT e.*
       FROM exercises e
       LEFT JOIN (
         SELECT exercise_id, MAX(logged_at) AS last_logged_at
         FROM workout_logs
         WHERE deleted = 0
         GROUP BY exercise_id
       ) wl ON wl.exercise_id = e.id
       WHERE e.muscle_group_id = ? AND e.deleted = 0
       ORDER BY COALESCE(wl.last_logged_at, e.updated_at, e.created_at) DESC`,
      [muscleGroupId]
    );
  }
  return database.getAllAsync<LocalExercise>(
    `SELECT e.*
     FROM exercises e
     LEFT JOIN (
       SELECT exercise_id, MAX(logged_at) AS last_logged_at
       FROM workout_logs
       WHERE deleted = 0
       GROUP BY exercise_id
     ) wl ON wl.exercise_id = e.id
     WHERE e.deleted = 0
     ORDER BY COALESCE(wl.last_logged_at, e.updated_at, e.created_at) DESC`
  );
}

// Returns active exercises (is_active = 1) only, used for log picker
export async function getActiveExercises(muscleGroupId: string) {
  const database = await getDatabase();
  return database.getAllAsync<LocalExercise>(
    `SELECT e.*
     FROM exercises e
     WHERE e.muscle_group_id = ? AND e.deleted = 0 AND e.is_active = 1
     ORDER BY e.name ASC`,
    [muscleGroupId]
  );
}

// Returns exercises with last_logged_at + this-week sets — for detail screen cards
export async function getExercisesWithStats(muscleGroupId: string, weekStart: string) {
  const database = await getDatabase();
  return database.getAllAsync<ExerciseWithStats>(
    `SELECT e.*,
            wl_last.last_logged_at,
            COALESCE(wl_week.weekly_sets, 0) AS weekly_sets
     FROM exercises e
     LEFT JOIN (
       SELECT exercise_id, MAX(logged_at) AS last_logged_at
       FROM workout_logs WHERE deleted = 0
       GROUP BY exercise_id
     ) wl_last ON wl_last.exercise_id = e.id
     LEFT JOIN (
       SELECT exercise_id, SUM(sets) AS weekly_sets
       FROM workout_logs WHERE deleted = 0 AND logged_at >= ?
       GROUP BY exercise_id
     ) wl_week ON wl_week.exercise_id = e.id
     WHERE e.muscle_group_id = ? AND e.deleted = 0
     ORDER BY e.is_active DESC, COALESCE(wl_last.last_logged_at, e.updated_at, e.created_at) DESC`,
    [weekStart, muscleGroupId]
  );
}

// Toggle is_active for a single exercise
export async function setExerciseActive(id: string, isActive: boolean) {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE exercises SET is_active = ?, updated_at = datetime('now'), dirty = 1 WHERE id = ?`,
    [isActive ? 1 : 0, id]
  );
}

// Efficient single-query fetch of recent logs with exercise name (replaces N+1 approach)
export interface RecentLogRow {
  id: string;
  exercise_id: string;
  muscle_group_id: string;
  sets: number;
  reps: number | null;
  weight: number | null;
  note: string | null;
  logged_at: string;
  exercise_name: string;
}

export async function getRecentLogsWithExerciseNames(limit?: number): Promise<RecentLogRow[]> {
  const database = await getDatabase();
  const baseQuery = `SELECT wl.id, wl.exercise_id, wl.muscle_group_id, wl.sets, wl.reps,
            wl.weight, wl.note, wl.logged_at,
            COALESCE(e.name, 'Unknown') AS exercise_name
     FROM workout_logs wl
     LEFT JOIN exercises e ON e.id = wl.exercise_id
     WHERE wl.deleted = 0
     ORDER BY wl.logged_at DESC`;

  if (typeof limit === 'number') {
    return database.getAllAsync<RecentLogRow>(`${baseQuery}\n     LIMIT ?`, [limit]);
  }

  return database.getAllAsync<RecentLogRow>(baseQuery);
}

// Count of workout_logs per muscle_group_id (all-time, non-deleted)
export async function getLogCountsByMuscleGroup(): Promise<Record<string, number>> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ muscle_group_id: string; count: number }>(
    `SELECT muscle_group_id, COUNT(*) AS count
     FROM workout_logs WHERE deleted = 0
     GROUP BY muscle_group_id`
  );
  const map: Record<string, number> = {};
  for (const row of rows) {
    map[row.muscle_group_id] = row.count;
  }
  return map;
}

export async function getExerciseById(id: string) {
  const database = await getDatabase();
  const result = await database.getFirstAsync<LocalExercise>(
    'SELECT * FROM exercises WHERE id = ? AND deleted = 0',
    [id]
  );
  return result;
}

export async function upsertExercise(exercise: LocalExercise) {
  const database = await getDatabase();
  const dirty = exercise.dirty ?? 0;
  const deleted = exercise.deleted ?? 0;
  await database.runAsync(
    `INSERT INTO exercises (id, muscle_group_id, name, notes, image_uri, is_active, created_at, updated_at, dirty, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
      muscle_group_id = COALESCE(excluded.muscle_group_id, muscle_group_id),
      name = COALESCE(excluded.name, name),
      notes = COALESCE(excluded.notes, notes),
      image_uri = COALESCE(excluded.image_uri, image_uri),
      is_active = COALESCE(excluded.is_active, is_active),
      updated_at = datetime('now'),
       dirty = COALESCE(excluded.dirty, dirty),
       deleted = COALESCE(excluded.deleted, deleted)`,
    [
      exercise.id,
      exercise.muscle_group_id,
      exercise.name,
      exercise.notes || null,
      exercise.image_uri || null,
      exercise.is_active ? 1 : 0,
      exercise.created_at,
      exercise.updated_at || new Date().toISOString(),
      dirty,
      deleted,
    ]
  );
}

export async function getDirtyExercises() {
  const database = await getDatabase();
  return database.getAllAsync<LocalExercise>(
    'SELECT * FROM exercises WHERE dirty = 1 ORDER BY updated_at ASC'
  );
}

export async function markExerciseClean(id: string) {
  const database = await getDatabase();
  await database.runAsync('UPDATE exercises SET dirty = 0 WHERE id = ?', [id]);
}

// Workout Logs
export async function getWorkoutLogs(startDate?: string, endDate?: string, exerciseId?: string) {
  const database = await getDatabase();
  let query = 'SELECT * FROM workout_logs WHERE deleted = 0';
  const params: any[] = [];

  if (startDate && endDate) {
    query += ' AND logged_at BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  if (exerciseId) {
    query += ' AND exercise_id = ?';
    params.push(exerciseId);
  }

  query += ' ORDER BY logged_at DESC';

  return database.getAllAsync<LocalWorkoutLog>(query, params);
}

export async function getWorkoutLogById(id: string) {
  const database = await getDatabase();
  const result = await database.getFirstAsync<LocalWorkoutLog>(
    'SELECT * FROM workout_logs WHERE id = ? AND deleted = 0',
    [id]
  );
  return result;
}

export async function upsertWorkoutLog(log: LocalWorkoutLog) {
  const database = await getDatabase();
  const dirty = log.dirty ?? 0;
  const deleted = log.deleted ?? 0;
  await database.runAsync(
    `INSERT INTO workout_logs (id, exercise_id, muscle_group_id, sets, reps, weight, note, logged_at, created_at, updated_at, dirty, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       sets = COALESCE(excluded.sets, sets),
       reps = COALESCE(excluded.reps, reps),
       weight = COALESCE(excluded.weight, weight),
       note = COALESCE(excluded.note, note),
       logged_at = COALESCE(excluded.logged_at, logged_at),
       updated_at = datetime('now'),
       dirty = COALESCE(excluded.dirty, dirty),
       deleted = COALESCE(excluded.deleted, deleted)`,
    [
      log.id,
      log.exercise_id,
      log.muscle_group_id,
      log.sets || null,
      log.reps || null,
      log.weight || null,
      log.note || null,
      log.logged_at,
      log.created_at,
      log.updated_at || new Date().toISOString(),
      dirty,
      deleted,
    ]
  );
}

export async function getDirtyWorkoutLogs() {
  const database = await getDatabase();
  return database.getAllAsync<LocalWorkoutLog>(
    'SELECT * FROM workout_logs WHERE dirty = 1 ORDER BY updated_at ASC'
  );
}

export async function markWorkoutLogClean(id: string) {
  const database = await getDatabase();
  await database.runAsync('UPDATE workout_logs SET dirty = 0 WHERE id = ?', [id]);
}

export async function getDirtyBodyMeasurements() {
  const database = await getDatabase();
  return database.getAllAsync<LocalBodyMeasurement>(
    'SELECT * FROM body_measurements WHERE dirty = 1 ORDER BY updated_at ASC'
  );
}

export async function markBodyMeasurementClean(id: string) {
  const database = await getDatabase();
  await database.runAsync('UPDATE body_measurements SET dirty = 0 WHERE id = ?', [id]);
}

export async function getDirtyMuscleGoals() {
  const database = await getDatabase();
  return database.getAllAsync<LocalMuscleGoal>(
    'SELECT * FROM muscle_goals WHERE dirty = 1 ORDER BY updated_at ASC'
  );
}

export async function markMuscleGoalClean(id: string) {
  const database = await getDatabase();
  await database.runAsync('UPDATE muscle_goals SET dirty = 0 WHERE id = ?', [id]);
}

async function markMissingRowsDeleted(tableName: string, remoteIds: string[]) {
  const database = await getDatabase();
  if (remoteIds.length === 0) {
    await database.runAsync(`UPDATE ${tableName} SET deleted = 1, dirty = 0 WHERE deleted = 0`);
    return;
  }

  const placeholders = remoteIds.map(() => '?').join(',');
  await database.runAsync(
    `UPDATE ${tableName}
     SET deleted = 1, dirty = 0
     WHERE deleted = 0 AND id NOT IN (${placeholders})`,
    remoteIds,
  );
}

export async function markMissingMuscleGroupsDeleted(remoteIds: string[]) {
  await markMissingRowsDeleted('muscle_groups', remoteIds);
}

export async function markMissingExercisesDeleted(remoteIds: string[]) {
  await markMissingRowsDeleted('exercises', remoteIds);
}

export async function markMissingWorkoutLogsDeleted(remoteIds: string[]) {
  await markMissingRowsDeleted('workout_logs', remoteIds);
}

export async function markMissingBodyMeasurementsDeleted(remoteIds: string[]) {
  await markMissingRowsDeleted('body_measurements', remoteIds);
}

export async function markMissingMuscleGoalsDeleted(remoteIds: string[]) {
  await markMissingRowsDeleted('muscle_goals', remoteIds);
}

export async function getBodyMeasurements(metricKey?: string, limit?: number) {
  const database = await getDatabase();
  let query = 'SELECT * FROM body_measurements WHERE deleted = 0';
  const params: (string | number)[] = [];

  if (metricKey) {
    query += ' AND metric_key = ?';
    params.push(metricKey);
  }

  query += ' ORDER BY measured_at DESC';

  if (typeof limit === 'number') {
    query += ' LIMIT ?';
    params.push(limit);
  }

  return database.getAllAsync<LocalBodyMeasurement>(query, params);
}

export async function getBodyMeasurementById(id: string) {
  const database = await getDatabase();
  return database.getFirstAsync<LocalBodyMeasurement>(
    'SELECT * FROM body_measurements WHERE id = ? LIMIT 1',
    [id]
  );
}

export async function softDeleteBodyMeasurementsByMeasuredAt(measuredAt: string) {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE body_measurements
     SET deleted = 1,
         dirty = 1,
         updated_at = datetime('now')
     WHERE measured_at = ? AND deleted = 0`,
    [measuredAt],
  );
}

export async function upsertBodyMeasurement(measurement: LocalBodyMeasurement) {
  const database = await getDatabase();
  const dirty = measurement.dirty ?? 0;
  const deleted = measurement.deleted ?? 0;

  await database.runAsync(
    `INSERT INTO body_measurements (id, metric_key, value, unit, note, source, measured_at, created_at, updated_at, dirty, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       metric_key = COALESCE(excluded.metric_key, metric_key),
       value = COALESCE(excluded.value, value),
       unit = COALESCE(excluded.unit, unit),
       note = COALESCE(excluded.note, note),
       source = COALESCE(excluded.source, source),
       measured_at = COALESCE(excluded.measured_at, measured_at),
       updated_at = datetime('now'),
       dirty = COALESCE(excluded.dirty, dirty),
       deleted = COALESCE(excluded.deleted, deleted)`,
    [
      measurement.id,
      measurement.metric_key,
      measurement.value,
      measurement.unit,
      measurement.note || null,
      measurement.source || null,
      measurement.measured_at,
      measurement.created_at,
      measurement.updated_at || new Date().toISOString(),
      dirty,
      deleted,
    ]
  );
}

export async function getMuscleGoals() {
  const database = await getDatabase();
  return database.getAllAsync<LocalMuscleGoal>(
    `SELECT * FROM muscle_goals
     WHERE deleted = 0
     ORDER BY COALESCE(target_date, updated_at, created_at) ASC, updated_at DESC`
  );
}

export async function upsertMuscleGoal(goal: LocalMuscleGoal) {
  const database = await getDatabase();
  const dirty = goal.dirty ?? 0;
  const deleted = goal.deleted ?? 0;

  await database.runAsync(
    `INSERT INTO muscle_goals (id, muscle_group_id, metric_key, current_value, target_value, unit, target_date, note, created_at, updated_at, dirty, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       muscle_group_id = COALESCE(excluded.muscle_group_id, muscle_group_id),
       metric_key = COALESCE(excluded.metric_key, metric_key),
       current_value = COALESCE(excluded.current_value, current_value),
       target_value = COALESCE(excluded.target_value, target_value),
       unit = COALESCE(excluded.unit, unit),
       target_date = COALESCE(excluded.target_date, target_date),
       note = COALESCE(excluded.note, note),
       updated_at = datetime('now'),
       dirty = COALESCE(excluded.dirty, dirty),
       deleted = COALESCE(excluded.deleted, deleted)`,
    [
      goal.id,
      goal.muscle_group_id,
      goal.metric_key,
      goal.current_value ?? null,
      goal.target_value,
      goal.unit,
      goal.target_date || null,
      goal.note || null,
      goal.created_at,
      goal.updated_at || new Date().toISOString(),
      dirty,
      deleted,
    ]
  );
}

export async function getWeeklyPlanEntries() {
  const database = await getDatabase();
  return database.getAllAsync<LocalWeeklyPlanEntry>(
    `SELECT * FROM weekly_plan_entries
     WHERE deleted = 0
     ORDER BY
       CASE day_key
         WHEN 'mon' THEN 1
         WHEN 'tue' THEN 2
         WHEN 'wed' THEN 3
         WHEN 'thu' THEN 4
         WHEN 'fri' THEN 5
         WHEN 'sat' THEN 6
         WHEN 'sun' THEN 7
         ELSE 99
       END ASC,
       created_at ASC`
  );
}

export async function upsertWeeklyPlanEntry(entry: LocalWeeklyPlanEntry) {
  const database = await getDatabase();
  const dirty = entry.dirty ?? 0;
  const deleted = entry.deleted ?? 0;

  await database.runAsync(
    `INSERT INTO weekly_plan_entries (id, day_key, muscle_group_id, sets, note, created_at, updated_at, dirty, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       day_key = excluded.day_key,
       muscle_group_id = excluded.muscle_group_id,
       sets = excluded.sets,
       note = excluded.note,
       updated_at = datetime('now'),
       dirty = COALESCE(excluded.dirty, dirty),
       deleted = COALESCE(excluded.deleted, deleted)`,
    [
      entry.id,
      entry.day_key,
      entry.muscle_group_id,
      Math.max(1, Math.round(entry.sets)),
      entry.note || null,
      entry.created_at,
      entry.updated_at || new Date().toISOString(),
      dirty,
      deleted,
    ]
  );
}

export async function getDirtyWeeklyPlanEntries() {
  const database = await getDatabase();
  return database.getAllAsync<LocalWeeklyPlanEntry>(
    'SELECT * FROM weekly_plan_entries WHERE dirty = 1 ORDER BY updated_at ASC'
  );
}

export async function markWeeklyPlanEntryClean(id: string) {
  const database = await getDatabase();
  await database.runAsync('UPDATE weekly_plan_entries SET dirty = 0 WHERE id = ?', [id]);
}

export async function deleteWeeklyPlanEntry(id: string) {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE weekly_plan_entries
     SET deleted = 1,
         dirty = 1,
         updated_at = datetime('now')
     WHERE id = ?`,
    [id]
  );
}

export async function markMissingWeeklyPlanEntriesDeleted(remoteIds: string[]) {
  await markMissingRowsDeleted('weekly_plan_entries', remoteIds);
}

// Clear all local data (for logout or account switch)
export async function clearAllLocalData() {
  const database = await getDatabase();
  try {
    await database.runAsync('DELETE FROM weekly_plan_entries');
    await database.runAsync('DELETE FROM body_measurements');
    await database.runAsync('DELETE FROM muscle_goals');
    await database.runAsync('DELETE FROM workout_logs');
    await database.runAsync('DELETE FROM exercises');
    await database.runAsync('DELETE FROM muscle_groups');
  } catch (err) {
    console.error('Error clearing local data:', err);
    throw err;
  }
}

export async function hasAnyLocalData() {
  const database = await getDatabase();
  const [groups, exercises, logs, measurements, goals, weeklyPlans] = await Promise.all([
    database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM muscle_groups'),
    database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM exercises'),
    database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM workout_logs'),
    database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM body_measurements'),
    database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM muscle_goals'),
    database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM weekly_plan_entries'),
  ]);

  return (
    (groups?.count ?? 0) > 0 ||
    (exercises?.count ?? 0) > 0 ||
    (logs?.count ?? 0) > 0 ||
    (measurements?.count ?? 0) > 0 ||
    (goals?.count ?? 0) > 0 ||
    (weeklyPlans?.count ?? 0) > 0
  );
}

// Cleanup
export async function closeDatabase() {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}

export async function saveImageUriToMuscleGroup(id: string, imageUri: string) {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE muscle_groups SET image_uri = ?, dirty = 1 WHERE id = ?`,
    [imageUri, id]
  );
}

export async function saveImageUriToExercise(id: string, imageUri: string) {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE exercises SET image_uri = ?, dirty = 1 WHERE id = ?`,
    [imageUri, id]
  );
}

export async function getMonthlyVolume(startDate: string, endDate: string): Promise<number> {
  const database = await getDatabase();
  const result = await database.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(CAST(sets AS REAL) * CAST(reps AS REAL) * CAST(weight AS REAL)), 0) as total
     FROM workout_logs
     WHERE logged_at BETWEEN ? AND ? AND deleted = 0
       AND sets IS NOT NULL AND sets > 0
       AND reps IS NOT NULL AND reps > 0
       AND weight IS NOT NULL AND weight > 0`,
    [startDate, endDate]
  );
  return result?.total ?? 0;
}
