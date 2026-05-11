# Offline-first + Google Sync Roadmap

## Current state review

- App currently reads/writes directly to Supabase in screen components.
- This means core flows depend on network and Supabase availability.
- There is no local persistent source-of-truth layer yet.
- There is no account model, no sync queue, no conflict handling.

## Target architecture

### 1) Local-first data layer (source of truth on device)

- Add a repository layer between UI and storage.
- Store all entities locally first (SQLite recommended for relational workout data):
  - muscle_groups
  - exercises
  - workout_logs
- UI reads from local DB only.
- Writes are committed locally immediately for fast UX.

### 2) Optional cloud identity and sync

- Keep app usable without login.
- Add optional Google Sign-In.
- If user signs in:
  - map local device profile to cloud user_id
  - enable backup and multi-device sync
- If user signs out:
  - keep local data intact
  - stop cloud sync

### 3) Sync engine

- Add local change log table (oplog): create/update/disable actions.
- Push pending changes in background when network is available.
- Pull remote changes incrementally by updated_at cursor.
- Conflict strategy:
  - default: last-write-wins using updated_at
  - prefer soft delete/disable flags over hard deletes

### 4) Schema requirements for sync

- Add to every syncable table:
  - user_id
  - updated_at
  - sync_status (pending/synced/failed)
  - deleted_at (nullable, soft delete)
- Keep exercise is_active for disable flow.

### 5) UX and performance

- Show sync status chip: Offline, Syncing, Synced, Error.
- Debounce expensive dashboard queries; precompute weekly/monthly aggregates locally.
- Keep navigation and form actions instant by avoiding network waits.

## Suggested implementation phases

1. Refactor: introduce repository + local DB without changing UI behavior.
2. Move existing screens to local repository reads/writes.
3. Add optional Google login and user binding.
4. Build push/pull sync workers and conflict handling.
5. Add sync status UI and retry controls.

## Suggested stack for Expo

- Local DB: expo-sqlite
- Lightweight app state: Zustand or existing React state + repository subscriptions
- Background sync trigger: AppState + periodic foreground sync + manual sync button
- Cloud: Supabase (auth + tables) for backup/sync endpoint

## Acceptance criteria

- App fully usable offline after first install and after app restarts.
- Login is optional and never blocks CRUD flows.
- Data created on device A appears on device B after sign-in and sync.
- No destructive hard delete in user data flows where historical logs matter.
