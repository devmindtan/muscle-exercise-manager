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

export type LocalCardioLog = Database['public']['Tables']['cardio_logs']['Row'];

export type LocalNutrientConfig = {
  id: string;
  key: string;
  label: string;
  unit: string;
  is_enabled: number; // 0 | 1
  display_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
  user_id: string | null;
};

export type LocalNutritionFood = {
  id: string;
  name: string;
  brand: string | null;
  serving_size: number;
  serving_unit: string;
  nutrients_json: string; // JSON string
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
  user_id: string | null;
};

export type LocalNutritionLog = {
  id: string;
  food_id: string | null;
  food_name: string;
  quantity: number;
  nutrients_json: string; // JSON string
  meal_type: string;
  note: string | null;
  logged_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
  user_id: string | null;
};

export type LocalNutritionGoal = {
  id: string;
  nutrient_key: string;
  target_value: number;
  unit: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
  user_id: string | null;
};

export type LocalTdeeSettings = {
  id: string;
  bmr_method: string;
  custom_bmr: number | null;
  bmr_pct: number;
  neat_pct: number;
  tef_pct: number;
  eat_pct: number;
  protein_multiplier: number;
  goal_type: string;
  created_at: string;
  updated_at: string;
  user_id: string | null;
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
    CREATE TABLE IF NOT EXISTS cardio_logs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      note TEXT,
      logged_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT,
      sync_status TEXT DEFAULT 'pending',
      user_id TEXT
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
    CREATE INDEX IF NOT EXISTS idx_cardio_logs_logged_at ON cardio_logs(logged_at);
    CREATE INDEX IF NOT EXISTS idx_cardio_logs_deleted_at ON cardio_logs(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_dirty_muscle_groups ON muscle_groups(dirty) WHERE dirty = 1;
    CREATE INDEX IF NOT EXISTS idx_dirty_exercises ON exercises(dirty) WHERE dirty = 1;
    CREATE INDEX IF NOT EXISTS idx_dirty_workout_logs ON workout_logs(dirty) WHERE dirty = 1;
    CREATE INDEX IF NOT EXISTS idx_dirty_body_measurements ON body_measurements(dirty) WHERE dirty = 1;
    CREATE INDEX IF NOT EXISTS idx_dirty_muscle_goals ON muscle_goals(dirty) WHERE dirty = 1;
    CREATE TABLE IF NOT EXISTS nutrition_nutrient_configs (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL,
      label TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT 'g',
      is_enabled INTEGER NOT NULL DEFAULT 1,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT,
      sync_status TEXT DEFAULT 'pending',
      user_id TEXT
    );
    CREATE TABLE IF NOT EXISTS nutrition_foods (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT,
      serving_size REAL NOT NULL DEFAULT 100,
      serving_unit TEXT NOT NULL DEFAULT 'g',
      nutrients_json TEXT NOT NULL DEFAULT '{}',
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT,
      sync_status TEXT DEFAULT 'pending',
      user_id TEXT
    );
    CREATE TABLE IF NOT EXISTS nutrition_logs (
      id TEXT PRIMARY KEY,
      food_id TEXT,
      food_name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      nutrients_json TEXT NOT NULL DEFAULT '{}',
      meal_type TEXT NOT NULL DEFAULT 'snack',
      note TEXT,
      logged_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT,
      sync_status TEXT DEFAULT 'pending',
      user_id TEXT
    );
    CREATE TABLE IF NOT EXISTS nutrition_goals (
      id TEXT PRIMARY KEY,
      nutrient_key TEXT NOT NULL,
      target_value REAL NOT NULL,
      unit TEXT NOT NULL DEFAULT 'g',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT,
      sync_status TEXT DEFAULT 'pending',
      user_id TEXT
    );
    CREATE TABLE IF NOT EXISTS nutrition_tdee_settings (
      id TEXT PRIMARY KEY,
      bmr_method TEXT NOT NULL DEFAULT 'katch_mccardl',
      custom_bmr REAL,
      bmr_pct REAL NOT NULL DEFAULT 65,
      neat_pct REAL NOT NULL DEFAULT 15,
      tef_pct REAL NOT NULL DEFAULT 10,
      eat_pct REAL NOT NULL DEFAULT 10,
      protein_multiplier REAL NOT NULL DEFAULT 1.8,
      goal_type TEXT NOT NULL DEFAULT 'maintain',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      user_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_nutrition_logs_logged_at ON nutrition_logs(logged_at);
    CREATE INDEX IF NOT EXISTS idx_nutrition_logs_deleted_at ON nutrition_logs(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_nutrition_foods_name ON nutrition_foods(name);
    CREATE INDEX IF NOT EXISTS idx_nutrition_goals_key ON nutrition_goals(nutrient_key);
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

  await database.execAsync(
    `CREATE TABLE IF NOT EXISTS cardio_logs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      note TEXT,
      logged_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT,
      sync_status TEXT DEFAULT 'pending',
      user_id TEXT
    )`
  );
  await ensureColumn(database, 'cardio_logs', 'created_at', "TEXT NOT NULL DEFAULT (datetime('now'))");
  await ensureColumn(database, 'cardio_logs', 'updated_at', "TEXT NOT NULL DEFAULT (datetime('now'))");
  await ensureColumn(database, 'cardio_logs', 'deleted_at', 'TEXT');
  await ensureColumn(database, 'cardio_logs', 'sync_status', "TEXT DEFAULT 'pending'");
  await ensureColumn(database, 'cardio_logs', 'user_id', 'TEXT');
  await database.execAsync(
    'CREATE INDEX IF NOT EXISTS idx_cardio_logs_logged_at ON cardio_logs(logged_at)'
  );
  await database.execAsync(
    'CREATE INDEX IF NOT EXISTS idx_cardio_logs_deleted_at ON cardio_logs(deleted_at)'
  );

  // Create this index after legacy columns are ensured, otherwise old DBs
  // (created before dirty/deleted existed) can crash on startup.
  await database.execAsync(
    'CREATE INDEX IF NOT EXISTS idx_dirty_weekly_plan_entries ON weekly_plan_entries(dirty) WHERE dirty = 1'
  );
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

export async function getMuscleGoalById(id: string) {
  const database = await getDatabase();
  return database.getFirstAsync<LocalMuscleGoal>(
    'SELECT * FROM muscle_goals WHERE id = ? LIMIT 1',
    [id],
  );
}

export async function softDeleteMuscleGoal(id: string) {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE muscle_goals
     SET deleted = 1,
         dirty = 1,
         updated_at = datetime('now')
     WHERE id = ? AND deleted = 0`,
    [id],
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

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function insertCardioLog(data: {
  name: string;
  duration_minutes: number;
  note: string | null;
  logged_at: string;
}) {
  const database = await getDatabase();
  const now = new Date().toISOString();
  await database.runAsync(
    `INSERT INTO cardio_logs (id, name, duration_minutes, note, logged_at, created_at, updated_at, deleted_at, sync_status, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'pending', NULL)`,
    [
      generateId(),
      data.name,
      Math.max(1, Math.round(data.duration_minutes)),
      data.note || null,
      data.logged_at,
      now,
      now,
    ]
  );
}

export async function getRecentCardioLogs(limit = 100): Promise<LocalCardioLog[]> {
  const database = await getDatabase();
  return database.getAllAsync<LocalCardioLog>(
    `SELECT id, name, duration_minutes, note, logged_at, created_at, updated_at, deleted_at, sync_status, user_id
     FROM cardio_logs
     WHERE deleted_at IS NULL
     ORDER BY logged_at DESC
     LIMIT ?`,
    [limit]
  );
}

export async function getPendingCardioLogs(): Promise<LocalCardioLog[]> {
  const database = await getDatabase();
  return database.getAllAsync<LocalCardioLog>(
    `SELECT id, name, duration_minutes, note, logged_at, created_at, updated_at, deleted_at, sync_status, user_id
     FROM cardio_logs
     WHERE sync_status = 'pending'
     ORDER BY updated_at ASC`
  );
}

export async function markCardioLogSynced(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE cardio_logs
     SET sync_status = 'synced',
         updated_at = datetime('now')
     WHERE id = ?`,
    [id]
  );
}

export async function upsertCardioLog(log: LocalCardioLog): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO cardio_logs (id, name, duration_minutes, note, logged_at, created_at, updated_at, deleted_at, sync_status, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = COALESCE(excluded.name, name),
       duration_minutes = COALESCE(excluded.duration_minutes, duration_minutes),
       note = excluded.note,
       logged_at = COALESCE(excluded.logged_at, logged_at),
       created_at = COALESCE(excluded.created_at, created_at),
       updated_at = COALESCE(excluded.updated_at, updated_at),
       deleted_at = excluded.deleted_at,
       sync_status = COALESCE(excluded.sync_status, sync_status),
       user_id = COALESCE(excluded.user_id, user_id)`,
    [
      log.id,
      log.name,
      Math.max(1, Math.round(log.duration_minutes)),
      log.note || null,
      log.logged_at,
      log.created_at,
      log.updated_at,
      log.deleted_at || null,
      log.sync_status || 'synced',
      log.user_id || null,
    ]
  );
}

export async function softDeleteCardioLog(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE cardio_logs
     SET deleted_at = datetime('now'),
         updated_at = datetime('now'),
         sync_status = 'pending'
     WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
}

// Clear all local data (for logout or account switch)
export async function clearAllLocalData() {
  const database = await getDatabase();
  try {
    await database.runAsync('DELETE FROM cardio_logs');
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
  const [groups, exercises, logs, measurements, goals, weeklyPlans, cardioLogs] = await Promise.all([
    database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM muscle_groups'),
    database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM exercises'),
    database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM workout_logs'),
    database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM body_measurements'),
    database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM muscle_goals'),
    database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM weekly_plan_entries'),
    database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM cardio_logs'),
  ]);

  return (
    (groups?.count ?? 0) > 0 ||
    (exercises?.count ?? 0) > 0 ||
    (logs?.count ?? 0) > 0 ||
    (measurements?.count ?? 0) > 0 ||
    (goals?.count ?? 0) > 0 ||
    (weeklyPlans?.count ?? 0) > 0 ||
    (cardioLogs?.count ?? 0) > 0
  );
}

// Cleanup
export async function closeDatabase() {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}

// ─── Nutrition ────────────────────────────────────────────────────────────────

export async function getNutrientConfigs(): Promise<LocalNutrientConfig[]> {
  const database = await getDatabase();
  return database.getAllAsync<LocalNutrientConfig>(
    `SELECT * FROM nutrition_nutrient_configs
     WHERE deleted_at IS NULL
     ORDER BY display_order ASC, created_at ASC`
  );
}

export async function upsertNutrientConfig(config: LocalNutrientConfig): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO nutrition_nutrient_configs
       (id, key, label, unit, is_enabled, display_order, created_at, updated_at, deleted_at, sync_status, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       key = excluded.key,
       label = excluded.label,
       unit = excluded.unit,
       is_enabled = excluded.is_enabled,
       display_order = excluded.display_order,
       updated_at = datetime('now'),
       deleted_at = excluded.deleted_at,
       sync_status = excluded.sync_status,
       user_id = excluded.user_id`,
    [
      config.id, config.key, config.label, config.unit,
      config.is_enabled, config.display_order,
      config.created_at, config.updated_at || new Date().toISOString(),
      config.deleted_at || null, config.sync_status || 'pending', config.user_id || null,
    ]
  );
}

export async function getNutritionFoods(): Promise<LocalNutritionFood[]> {
  const database = await getDatabase();
  return database.getAllAsync<LocalNutritionFood>(
    `SELECT * FROM nutrition_foods
     WHERE deleted_at IS NULL
     ORDER BY name ASC`
  );
}

export async function upsertNutritionFood(food: LocalNutritionFood): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO nutrition_foods
       (id, name, brand, serving_size, serving_unit, nutrients_json, note, created_at, updated_at, deleted_at, sync_status, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       brand = excluded.brand,
       serving_size = excluded.serving_size,
       serving_unit = excluded.serving_unit,
       nutrients_json = excluded.nutrients_json,
       note = excluded.note,
       updated_at = datetime('now'),
       deleted_at = excluded.deleted_at,
       sync_status = excluded.sync_status,
       user_id = excluded.user_id`,
    [
      food.id, food.name, food.brand || null,
      food.serving_size, food.serving_unit,
      food.nutrients_json, food.note || null,
      food.created_at, food.updated_at || new Date().toISOString(),
      food.deleted_at || null, food.sync_status || 'pending', food.user_id || null,
    ]
  );
}

export async function softDeleteNutritionFood(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE nutrition_foods
     SET deleted_at = datetime('now'), updated_at = datetime('now'), sync_status = 'pending'
     WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
}

export async function getNutritionLogsForDate(dateStr: string): Promise<LocalNutritionLog[]> {
  const database = await getDatabase();
  const start = `${dateStr} 00:00:00`;
  const end = `${dateStr} 23:59:59`;
  return database.getAllAsync<LocalNutritionLog>(
    `SELECT * FROM nutrition_logs
     WHERE deleted_at IS NULL
       AND logged_at >= ? AND logged_at <= ?
     ORDER BY logged_at ASC`,
    [start, end]
  );
}

export async function getNutritionLogsForDateRange(startDate: string, endDate: string): Promise<LocalNutritionLog[]> {
  const database = await getDatabase();
  return database.getAllAsync<LocalNutritionLog>(
    `SELECT * FROM nutrition_logs
     WHERE deleted_at IS NULL
       AND logged_at >= ? AND logged_at <= ?
     ORDER BY logged_at ASC`,
    [`${startDate} 00:00:00`, `${endDate} 23:59:59`]
  );
}

export async function deleteNutrientConfig(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `DELETE FROM nutrition_nutrient_configs WHERE id = ?`,
    [id]
  );
}

export async function insertNutritionLog(data: {
  id: string;
  food_id: string | null;
  food_name: string;
  quantity: number;
  nutrients_json: string;
  meal_type: string;
  note: string | null;
  logged_at: string;
}): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  await database.runAsync(
    `INSERT INTO nutrition_logs
       (id, food_id, food_name, quantity, nutrients_json, meal_type, note, logged_at, created_at, updated_at, deleted_at, sync_status, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', NULL)`,
    [
      data.id, data.food_id || null, data.food_name,
      data.quantity, data.nutrients_json, data.meal_type,
      data.note || null, data.logged_at, now, now,
    ]
  );
}

export async function softDeleteNutritionLog(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE nutrition_logs
     SET deleted_at = datetime('now'), updated_at = datetime('now'), sync_status = 'pending'
     WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
}

export async function getNutritionGoals(): Promise<LocalNutritionGoal[]> {
  const database = await getDatabase();
  return database.getAllAsync<LocalNutritionGoal>(
    `SELECT * FROM nutrition_goals WHERE deleted_at IS NULL ORDER BY created_at ASC`
  );
}

export async function upsertNutritionGoal(goal: LocalNutritionGoal): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO nutrition_goals
       (id, nutrient_key, target_value, unit, created_at, updated_at, deleted_at, sync_status, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       nutrient_key = excluded.nutrient_key,
       target_value = excluded.target_value,
       unit = excluded.unit,
       updated_at = datetime('now'),
       deleted_at = excluded.deleted_at,
       sync_status = excluded.sync_status,
       user_id = excluded.user_id`,
    [
      goal.id, goal.nutrient_key, goal.target_value, goal.unit,
      goal.created_at, goal.updated_at || new Date().toISOString(),
      goal.deleted_at || null, goal.sync_status || 'pending', goal.user_id || null,
    ]
  );
}

export async function deleteNutritionGoalByKey(nutrientKey: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE nutrition_goals
     SET deleted_at = datetime('now'), updated_at = datetime('now'), sync_status = 'pending'
     WHERE nutrient_key = ? AND deleted_at IS NULL`,
    [nutrientKey]
  );
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

export async function getTdeeSettings(): Promise<LocalTdeeSettings | null> {
  const database = await getDatabase();
  return database.getFirstAsync<LocalTdeeSettings>(
    `SELECT * FROM nutrition_tdee_settings ORDER BY updated_at DESC LIMIT 1`
  );
}

export async function upsertTdeeSettings(s: LocalTdeeSettings): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO nutrition_tdee_settings (id, bmr_method, custom_bmr, bmr_pct, neat_pct, tef_pct, eat_pct, protein_multiplier, goal_type, created_at, updated_at, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       bmr_method = excluded.bmr_method,
       custom_bmr = excluded.custom_bmr,
       bmr_pct = excluded.bmr_pct,
       neat_pct = excluded.neat_pct,
       tef_pct = excluded.tef_pct,
       eat_pct = excluded.eat_pct,
       protein_multiplier = excluded.protein_multiplier,
       goal_type = excluded.goal_type,
       updated_at = excluded.updated_at,
       user_id = excluded.user_id`,
    [
      s.id, s.bmr_method, s.custom_bmr, s.bmr_pct, s.neat_pct, s.tef_pct, s.eat_pct,
      s.protein_multiplier, s.goal_type, s.created_at, s.updated_at, s.user_id,
    ]
  );
}

// ── Nutrition sync helpers ────────────────────────────────────────────────────

export async function getPendingNutrientConfigs(): Promise<LocalNutrientConfig[]> {
  const database = await getDatabase();
  return database.getAllAsync<LocalNutrientConfig>(
    `SELECT * FROM nutrition_nutrient_configs WHERE sync_status = 'pending' ORDER BY updated_at ASC`
  );
}

export async function markNutrientConfigSynced(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE nutrition_nutrient_configs SET sync_status = 'synced' WHERE id = ?`, [id]
  );
}

export async function getPendingNutritionFoods(): Promise<LocalNutritionFood[]> {
  const database = await getDatabase();
  return database.getAllAsync<LocalNutritionFood>(
    `SELECT * FROM nutrition_foods WHERE sync_status = 'pending' ORDER BY updated_at ASC`
  );
}

export async function markNutritionFoodSynced(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE nutrition_foods SET sync_status = 'synced' WHERE id = ?`, [id]
  );
}

export async function getPendingNutritionLogs(): Promise<LocalNutritionLog[]> {
  const database = await getDatabase();
  return database.getAllAsync<LocalNutritionLog>(
    `SELECT * FROM nutrition_logs WHERE sync_status = 'pending' ORDER BY updated_at ASC`
  );
}

export async function markNutritionLogSynced(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE nutrition_logs SET sync_status = 'synced' WHERE id = ?`, [id]
  );
}

export async function upsertNutritionLog(log: LocalNutritionLog): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO nutrition_logs
       (id, food_id, food_name, quantity, nutrients_json, meal_type, note, logged_at, created_at, updated_at, deleted_at, sync_status, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       food_id = excluded.food_id,
       food_name = excluded.food_name,
       quantity = excluded.quantity,
       nutrients_json = excluded.nutrients_json,
       meal_type = excluded.meal_type,
       note = excluded.note,
       logged_at = excluded.logged_at,
       updated_at = excluded.updated_at,
       deleted_at = excluded.deleted_at,
       sync_status = excluded.sync_status,
       user_id = excluded.user_id`,
    [
      log.id, log.food_id ?? null, log.food_name, log.quantity, log.nutrients_json,
      log.meal_type, log.note ?? null, log.logged_at, log.created_at, log.updated_at,
      log.deleted_at ?? null, log.sync_status, log.user_id ?? null,
    ]
  );
}

export async function getPendingNutritionGoals(): Promise<LocalNutritionGoal[]> {
  const database = await getDatabase();
  return database.getAllAsync<LocalNutritionGoal>(
    `SELECT * FROM nutrition_goals WHERE sync_status = 'pending' ORDER BY updated_at ASC`
  );
}

export async function markNutritionGoalSynced(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE nutrition_goals SET sync_status = 'synced' WHERE id = ?`, [id]
  );
}

export async function getPendingTdeeSettings(): Promise<LocalTdeeSettings | null> {
  const database = await getDatabase();
  return database.getFirstAsync<LocalTdeeSettings>(
    `SELECT * FROM nutrition_tdee_settings WHERE user_id IS NULL OR user_id = '' ORDER BY updated_at DESC LIMIT 1`
  );
}

export async function markTdeeSettingsSynced(id: string, userId: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE nutrition_tdee_settings SET user_id = ? WHERE id = ?`, [userId, id]
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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
