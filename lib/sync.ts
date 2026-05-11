import { supabase } from './supabase';
import { getDB, getMetaValue, setMetaValue } from './db';

type TableName = 'muscle_groups' | 'exercises' | 'workout_logs';

const TABLES: TableName[] = ['muscle_groups', 'exercises', 'workout_logs'];

// ── Push pending local changes to Supabase ────────────────────────────────────
export async function pushPendingChanges(): Promise<void> {
  const db = await getDB();

  for (const table of TABLES) {
    // Push upserts (non-deleted pending rows)
    const toUpsert = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM ${table} WHERE sync_status = 'pending' AND deleted_at IS NULL`,
    );
    if (toUpsert.length > 0) {
      const mapped = toUpsert.map((r) => {
        const row = { ...r };
        delete row.sync_status;
        if (table === 'exercises') row.is_active = r.is_active === 1;
        return row;
      });
      const { error } = await supabase
        .from(table)
        .upsert(mapped as never[], { onConflict: 'id' });
      if (!error) {
        const ids = toUpsert.map((r) => r.id as string);
        const ph = ids.map(() => '?').join(',');
        await db.runAsync(
          `UPDATE ${table} SET sync_status = 'synced' WHERE id IN (${ph})`,
          ids,
        );
      }
    }

    // Push deletes (soft-deleted pending rows → hard delete on Supabase)
    const toDelete = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM ${table} WHERE sync_status = 'pending' AND deleted_at IS NOT NULL`,
    );
    if (toDelete.length > 0) {
      const ids = toDelete.map((r) => r.id);
      const { error } = await supabase.from(table).delete().in('id', ids);
      if (!error) {
        const ph = ids.map(() => '?').join(',');
        await db.runAsync(
          `UPDATE ${table} SET sync_status = 'synced' WHERE id IN (${ph})`,
          ids,
        );
      }
    }
  }
}

// ── Pull remote changes from Supabase since last pull ─────────────────────────
export async function pullRemoteChanges(): Promise<void> {
  const db = await getDB();
  const lastPull =
    (await getMetaValue('last_pull_at')) ?? '1970-01-01T00:00:00.000Z';

  for (const table of TABLES) {
    let query = supabase.from(table).select('*').limit(500);

    // Only filter by updated_at if the column exists (guard against missing migration)
    try {
      query = query.gt('updated_at', lastPull) as typeof query;
    } catch {
      // column may not exist yet; fall through to full fetch on first run
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) continue;

    // Cast to a flexible record type since remote rows will have extra
    // columns (updated_at, deleted_at) not present in our local TypeScript types
    const remoteRows = data as Record<string, unknown>[];

    for (const remote of remoteRows) {
      const local = await db.getFirstAsync<{ id: string; updated_at: string }>(
        `SELECT id, updated_at FROM ${table} WHERE id = ?`,
        [remote.id as string],
      );

      const remoteDate = new Date(
        (remote.updated_at ?? remote.created_at ?? 0) as string | number,
      );
      const localDate = local ? new Date(local.updated_at) : new Date(0);

      if (!local || remoteDate > localDate) {
        await upsertFromRemote(db, table, remote);
      }
    }
  }

  await setMetaValue('last_pull_at', new Date().toISOString());
}

async function upsertFromRemote(
  db: Awaited<ReturnType<typeof getDB>>,
  table: TableName,
  row: Record<string, unknown>,
): Promise<void> {
  // Helper: safely coerce a value to a SQLite-compatible bind type
  const s = (v: unknown): string | null => (v == null ? null : String(v));
  const n = (v: unknown): number | null => (v == null ? null : Number(v));
  const b = (v: unknown): number => (v === true || v === 1 ? 1 : 0);

  const ts = s(row.updated_at ?? row.created_at) ?? new Date().toISOString();
  const createdAt = s(row.created_at) ?? ts;

  if (table === 'muscle_groups') {
    await db.runAsync(
      `INSERT OR REPLACE INTO muscle_groups
         (id, name, color, target_sets_per_week, target_sets_per_month,
          image_uri, created_at, updated_at, sync_status, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
      [
        s(row.id),
        s(row.name),
        s(row.color) ?? '#4A90E2',
        n(row.target_sets_per_week) ?? 10,
        n(row.target_sets_per_month) ?? 40,
        s(row.image_uri),
        createdAt,
        ts,
        s(row.deleted_at),
      ],
    );
  } else if (table === 'exercises') {
    await db.runAsync(
      `INSERT OR REPLACE INTO exercises
         (id, muscle_group_id, name, notes, image_uri, is_active,
          created_at, updated_at, sync_status, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
      [
        s(row.id),
        s(row.muscle_group_id),
        s(row.name),
        s(row.notes),
        s(row.image_uri),
        b(row.is_active),
        createdAt,
        ts,
        s(row.deleted_at),
      ],
    );
  } else if (table === 'workout_logs') {
    await db.runAsync(
      `INSERT OR REPLACE INTO workout_logs
         (id, muscle_group_id, exercise_id, sets, reps, weight, note,
          logged_at, created_at, updated_at, sync_status, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
      [
        s(row.id),
        s(row.muscle_group_id),
        s(row.exercise_id),
        n(row.sets) ?? 0,
        n(row.reps),
        n(row.weight),
        s(row.note),
        s(row.logged_at) ?? createdAt,
        createdAt,
        ts,
        s(row.deleted_at),
      ],
    );
  }
}

// ── Seed local DB from Supabase on first launch ───────────────────────────────
export async function seedFromSupabase(): Promise<void> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM muscle_groups',
  );
  if (row && row.n > 0) return; // already have local data
  await setMetaValue('last_pull_at', '1970-01-01T00:00:00.000Z');
  await pullRemoteChanges();
}

// ── Full sync: push then pull ─────────────────────────────────────────────────
export async function syncAll(): Promise<void> {
  await pushPendingChanges();
  await pullRemoteChanges();
}
