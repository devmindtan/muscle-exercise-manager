import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!_db) {
    _db = await SQLite.openDatabaseAsync('muscle-manager.db');
    await initSchema(_db);
  }
  return _db;
}

async function initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS app_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS muscle_groups (
      id                    TEXT PRIMARY KEY,
      name                  TEXT NOT NULL,
      color                 TEXT NOT NULL DEFAULT '#4A90E2',
      target_sets_per_week  INTEGER NOT NULL DEFAULT 10,
      target_sets_per_month INTEGER NOT NULL DEFAULT 40,
      image_uri             TEXT,
      created_at            TEXT NOT NULL,
      updated_at            TEXT NOT NULL,
      sync_status           TEXT NOT NULL DEFAULT 'pending',
      deleted_at            TEXT
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id               TEXT PRIMARY KEY,
      muscle_group_id  TEXT NOT NULL,
      name             TEXT NOT NULL,
      notes            TEXT,
      image_uri        TEXT,
      is_active        INTEGER NOT NULL DEFAULT 1,
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL,
      sync_status      TEXT NOT NULL DEFAULT 'pending',
      deleted_at       TEXT
    );

    CREATE TABLE IF NOT EXISTS workout_logs (
      id               TEXT PRIMARY KEY,
      muscle_group_id  TEXT NOT NULL,
      exercise_id      TEXT NOT NULL,
      sets             INTEGER NOT NULL DEFAULT 1,
      reps             INTEGER,
      weight           REAL,
      note             TEXT,
      logged_at        TEXT NOT NULL,
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL,
      sync_status      TEXT NOT NULL DEFAULT 'pending',
      deleted_at       TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_ex_group    ON exercises(muscle_group_id);
    CREATE INDEX IF NOT EXISTS idx_log_group   ON workout_logs(muscle_group_id);
    CREATE INDEX IF NOT EXISTS idx_log_at      ON workout_logs(logged_at DESC);
    CREATE INDEX IF NOT EXISTS idx_mg_status   ON muscle_groups(sync_status);
    CREATE INDEX IF NOT EXISTS idx_ex_status   ON exercises(sync_status);
    CREATE INDEX IF NOT EXISTS idx_log_status  ON workout_logs(sync_status);
  `);
}

export async function getMetaValue(key: string): Promise<string | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_meta WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

export async function setMetaValue(key: string, value: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    'INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)',
    [key, value],
  );
}
