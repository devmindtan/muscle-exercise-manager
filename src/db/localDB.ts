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

export type LocalWorkoutLog = Database['public']['Tables']['workout_logs']['Row'] & {
  dirty?: 0 | 1;
  deleted?: 0 | 1;
};

const DB_NAME = 'muscle-manager.db';

let db: SQLite.SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDatabase() {
  if (db) {
    return db;
  }

  if (!dbInitPromise) {
    dbInitPromise = SQLite.openDatabaseAsync(DB_NAME)
      .then(async (database) => {
        // Enable WAL mode for better concurrency
        await database.execAsync('PRAGMA journal_mode = WAL;');
        db = database;
        return database;
      })
      .catch((error) => {
        db = null;
        throw error;
      })
      .finally(() => {
        dbInitPromise = null;
      });
  }

  return dbInitPromise;
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

  await ensureColumn(database, 'exercises', 'dirty', 'INTEGER DEFAULT 0');
  await ensureColumn(database, 'exercises', 'deleted', 'INTEGER DEFAULT 0');

  await ensureColumn(database, 'workout_logs', 'dirty', 'INTEGER DEFAULT 0');
  await ensureColumn(database, 'workout_logs', 'deleted', 'INTEGER DEFAULT 0');
}

export async function initializeDatabase() {
  const database = await getDatabase();

  // Create muscle_groups table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS muscle_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT,
      target_sets_per_week INTEGER DEFAULT 10,
      target_sets_per_month INTEGER DEFAULT 40,
      image_uri TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      dirty INTEGER DEFAULT 0,
      deleted INTEGER DEFAULT 0
    );
  `);

  // Create exercises table
  await database.execAsync(`
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
  `);

  // Create workout_logs table
  await database.execAsync(`
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
  `);

  // Create indexes for common queries
  await migrateLegacySchema(database);

  // Create indexes for common queries
  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_exercises_muscle_group_id ON exercises(muscle_group_id);
    CREATE INDEX IF NOT EXISTS idx_workout_logs_exercise_id ON workout_logs(exercise_id);
    CREATE INDEX IF NOT EXISTS idx_workout_logs_muscle_group_id ON workout_logs(muscle_group_id);
    CREATE INDEX IF NOT EXISTS idx_workout_logs_logged_at ON workout_logs(logged_at);
    CREATE INDEX IF NOT EXISTS idx_dirty_muscle_groups ON muscle_groups(dirty) WHERE dirty = 1;
    CREATE INDEX IF NOT EXISTS idx_dirty_exercises ON exercises(dirty) WHERE dirty = 1;
    CREATE INDEX IF NOT EXISTS idx_dirty_workout_logs ON workout_logs(dirty) WHERE dirty = 1;
  `);
}

// Muscle Groups
export async function getMuscleGroups() {
  const database = await getDatabase();
  const result = await database.getAllAsync<LocalMuscleGroup>(
    'SELECT * FROM muscle_groups WHERE deleted = 0 ORDER BY created_at DESC'
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
    `INSERT INTO muscle_groups (id, name, color, target_sets_per_week, target_sets_per_month, image_uri, created_at, updated_at, dirty, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = COALESCE(excluded.name, name),
       color = COALESCE(excluded.color, color),
       target_sets_per_week = COALESCE(excluded.target_sets_per_week, target_sets_per_week),
       target_sets_per_month = COALESCE(excluded.target_sets_per_month, target_sets_per_month),
       image_uri = COALESCE(excluded.image_uri, image_uri),
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
      'SELECT * FROM exercises WHERE muscle_group_id = ? AND deleted = 0 ORDER BY created_at DESC',
      [muscleGroupId]
    );
  }
  return database.getAllAsync<LocalExercise>(
    'SELECT * FROM exercises WHERE deleted = 0 ORDER BY muscle_group_id, created_at DESC'
  );
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

// Clear all local data (for logout or account switch)
export async function clearAllLocalData() {
  const database = await getDatabase();
  try {
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
  const [groups, exercises, logs] = await Promise.all([
    database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM muscle_groups'),
    database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM exercises'),
    database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM workout_logs'),
  ]);

  return (
    (groups?.count ?? 0) > 0 ||
    (exercises?.count ?? 0) > 0 ||
    (logs?.count ?? 0) > 0
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
