import { supabase } from './supabase';
import { MuscleGroup, Exercise, WorkoutLog } from '@/types/database';

type TableName = 'muscle_groups' | 'exercises' | 'workout_logs';
type AnyRow = MuscleGroup | Exercise | WorkoutLog;

const STATE_KEY = 'muscle-manager:web-state';
const META_KEY = 'muscle-manager:web-meta';

type LocalState = {
  muscle_groups: MuscleGroup[];
  exercises: Exercise[];
  workout_logs: WorkoutLog[];
};

type LocalMeta = {
  last_pull_at: string;
  last_user_id?: string;
};

function loadState(): LocalState {
  if (typeof window === 'undefined')
    return { muscle_groups: [], exercises: [], workout_logs: [] };
  try {
    const raw = window.localStorage.getItem(STATE_KEY);
    if (!raw) return { muscle_groups: [], exercises: [], workout_logs: [] };
    return JSON.parse(raw) as LocalState;
  } catch {
    return { muscle_groups: [], exercises: [], workout_logs: [] };
  }
}

function saveState(state: LocalState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function loadMeta(): LocalMeta {
  if (typeof window === 'undefined')
    return {
      last_pull_at: '1970-01-01T00:00:00.000Z',
      last_user_id: undefined,
    };
  try {
    const raw = window.localStorage.getItem(META_KEY);
    if (!raw)
      return {
        last_pull_at: '1970-01-01T00:00:00.000Z',
        last_user_id: undefined,
      };
    return JSON.parse(raw) as LocalMeta;
  } catch {
    return {
      last_pull_at: '1970-01-01T00:00:00.000Z',
      last_user_id: undefined,
    };
  }
}

function saveMeta(meta: LocalMeta): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(META_KEY, JSON.stringify(meta));
}

function toEpochMs(value: string | undefined): number {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

// ── Push pending local changes to Supabase ────────────────────────────────────
export async function pushPendingChanges(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return; // not signed in, skip

  const userId = sessionData.session.user.id;
  const state = loadState();
  const tables: TableName[] = ['muscle_groups', 'exercises', 'workout_logs'];

  for (const table of tables) {
    const rows = state[table] as (AnyRow & {
      sync_status?: string;
      deleted_at?: string | null;
      user_id?: string | null;
    })[];

    const pending = rows.filter((r) => r.sync_status === 'pending');
    if (pending.length === 0) continue;

    // Upsert all pending rows, including soft-deleted rows.
    // This lets other devices pull deleted_at and hide/delete locally.
    const toUpsert = pending;
    if (toUpsert.length > 0) {
      const mapped = toUpsert.map((r) => {
        const row = { ...r } as Record<string, unknown>;
        delete row.sync_status;
        // Let DB trigger set updated_at to server time to avoid client clock skew.
        delete row.updated_at;
        row.user_id = userId; // Add current user_id to payload
        return row;
      });
      const { error } = await supabase
        .from(table)
        .upsert(mapped as never[], { onConflict: 'id' });
      if (!error) {
        const ids = new Set(toUpsert.map((r) => (r as { id: string }).id));
        (state[table] as AnyRow[]).forEach((r) => {
          if (ids.has((r as { id: string }).id)) {
            (
              r as { sync_status: string; user_id?: string | null }
            ).sync_status = 'synced';
            (r as { user_id?: string | null }).user_id = userId;
          }
        });
      }
    }
  }

  saveState(state);
}

// ── Pull remote changes from Supabase since last pull ─────────────────────────
export async function pullRemoteChanges(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return;

  const userId = sessionData.session.user.id;
  const meta = loadMeta();
  const state = loadState();
  const nowMs = Date.now();
  // Guard against a cursor accidentally moving into the future.
  const safeSinceMs = Math.min(toEpochMs(meta.last_pull_at), nowMs);
  const safeSinceIso = new Date(safeSinceMs).toISOString();
  let nextLastPullMs = safeSinceMs;

  // Filter out rows from other users (safety measure)
  state.muscle_groups = state.muscle_groups.filter(
    (r) => !r.user_id || r.user_id === userId,
  );
  state.exercises = state.exercises.filter(
    (r) => !r.user_id || r.user_id === userId,
  );
  state.workout_logs = state.workout_logs.filter(
    (r) => !r.user_id || r.user_id === userId,
  );

  const tables: TableName[] = ['muscle_groups', 'exercises', 'workout_logs'];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .gte('updated_at', safeSinceIso)
      .order('updated_at', { ascending: true })
      .limit(500);

    if (error || !data || data.length === 0) continue;

    const remoteRows = data as Record<string, unknown>[];

    for (const remote of remoteRows) {
      const remoteId = remote.id as string;
      const remoteUpdatedAt = String(remote.updated_at ?? '');
      const remoteUpdatedAtMs = toEpochMs(remoteUpdatedAt);
      const existing = (state[table] as AnyRow[]).find(
        (r) => (r as { id: string }).id === remoteId,
      ) as
        | (Record<string, unknown> & {
            updated_at?: string;
            sync_status?: string;
          })
        | undefined;

      // Keep local unsynced edits if any; otherwise remote is source of truth.
      if (existing?.sync_status === 'pending') continue;

      const merged = { ...remote, sync_status: 'synced' } as AnyRow;
      if (existing) {
        const idx = (state[table] as AnyRow[]).findIndex(
          (r) => (r as { id: string }).id === remoteId,
        );
        (state[table] as AnyRow[])[idx] = merged;
      } else {
        (state[table] as AnyRow[]).push(merged);
      }

      if (remoteUpdatedAtMs > nextLastPullMs) {
        nextLastPullMs = remoteUpdatedAtMs;
      }
    }
  }

  saveMeta({
    last_pull_at: new Date(nextLastPullMs).toISOString(),
    last_user_id: userId,
  });
  saveState(state);
}

// ── Seed local storage from Supabase on first launch ─────────────────────────
export async function seedFromSupabase(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return;

  const currentUserId = sessionData.session.user.id;
  const meta = loadMeta();

  // Check if user has switched: if stored user_id differs from current user_id, clear local state
  if (meta.last_user_id && meta.last_user_id !== currentUserId) {
    // User switched - clear old data
    saveState({ muscle_groups: [], exercises: [], workout_logs: [] });
    saveMeta({
      last_pull_at: '1970-01-01T00:00:00.000Z',
      last_user_id: currentUserId,
    });
    await pullRemoteChanges();
    return;
  }

  // FIX: Always pull remote changes regardless of whether local data exists.
  // Previously, the `hasData` guard prevented pulling when localStorage already
  // had data — so changes made on another device (e.g. phone) were never fetched
  // unless the user manually cleared localStorage on this device.
  // The pull is cursor-based (last_pull_at), so it only fetches rows updated
  // since the last sync — no performance concern with existing data.
  if (!meta.last_user_id) {
    // First time for this user — reset cursor to epoch so we get everything
    saveMeta({
      last_pull_at: '1970-01-01T00:00:00.000Z',
      last_user_id: currentUserId,
    });
  }

  await pullRemoteChanges();
}

// ── Full sync: push then pull ─────────────────────────────────────────────────
export async function syncAll(): Promise<void> {
  await pushPendingChanges();
  await pullRemoteChanges();
}