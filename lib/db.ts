import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

let _db: SQLite.SQLiteDatabase | null = null;
let _dbInitializing = false;
let _dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

async function openDatabaseWithRetry(
  retries: number = MAX_RETRIES,
): Promise<SQLite.SQLiteDatabase> {
  try {
    const db = await SQLite.openDatabaseAsync('muscle-manager.db');
    return db;
  } catch (error) {
    if (retries > 0) {
      console.warn(
        `Database open failed, retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`,
        error,
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return openDatabaseWithRetry(retries - 1);
    }
    throw error;
  }
}

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (_db) {
    return _db;
  }

  // If already initializing, wait for that promise
  if (_dbInitPromise) {
    return _dbInitPromise;
  }

  // Prevent multiple simultaneous initialization attempts
  if (_dbInitializing) {
    // Wait a bit and try again
    await new Promise((resolve) => setTimeout(resolve, 100));
    return getDB();
  }

  _dbInitializing = true;

  try {
    _dbInitPromise = (async () => {
      const db = await openDatabaseWithRetry();
      await initSchema(db);

      // Chỉ debug khi development
      if (__DEV__) {
        await debugDatabasePath();
      }

      return db;
    })();

    _db = await _dbInitPromise;
    return _db;
  } catch (error) {
    _dbInitPromise = null;
    console.error('Failed to initialize database:', error);
    throw error;
  } finally {
    _dbInitializing = false;
  }
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

export async function debugDatabasePath(): Promise<void> {
  const dbPath = `${FileSystem.documentDirectory}SQLite/muscle-manager.db`;

  console.log("── DEBUG DATABASE INFO ──");
  console.log("Vị trí tệp DB:", dbPath);

  const fileInfo = await FileSystem.getInfoAsync(dbPath);
  if (fileInfo.exists) {
    console.log("Trạng thái: Đã tìm thấy tệp ✅");
    console.log("Kích thước:", fileInfo.size, "bytes");
  } else {
    console.log("Trạng thái: Tệp chưa được tạo hoặc sai đường dẫn ❌");
    const sqliteDir = `${FileSystem.documentDirectory}SQLite/`;
    const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
    if (dirInfo.exists) {
      const files = await FileSystem.readDirectoryAsync(sqliteDir);
      console.log("Các tệp trong thư mục SQLite:", files);
    }
  }
  console.log("─────────────────────────");
}


export async function exportDatabase(): Promise<void> {
  const db = await getDB();

  // Flush WAL vào file .db chính trước khi xuất
  await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');

  const dbPath = `${FileSystem.documentDirectory}SQLite/muscle-manager.db`;

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    console.log("Thiết bị không hỗ trợ chia sẻ file");
    return;
  }

  const fileInfo = await FileSystem.getInfoAsync(dbPath);
  if (!fileInfo.exists) {
    console.log("Không tìm thấy file DB");
    return;
  }

  await Sharing.shareAsync(dbPath, {
    mimeType: 'application/octet-stream',
    dialogTitle: 'Xuất database',
    UTI: 'public.database',
  });
}