# Muscle Exercise Manager - Google Sign-In & Supabase+SQLite Integration

## Overview

This document describes the integrated authentication and data synchronization system that combines:
- **Google Sign-In** for user authentication
- **Supabase** as the remote database backend
- **SQLite** as the local offline-first database
- **Bidirectional sync** to keep data consistent across devices

## Architecture

### Components

1. **AuthContext** (`src/context/AuthContext.tsx`)
   - Manages Google Sign-In and Supabase authentication
   - Provides `useAuth()` hook for components
   - Handles login/logout and session persistence

2. **SyncContext** (`src/context/SyncContext.tsx`)
   - Manages data synchronization between local and remote databases
   - Auto-syncs every 60 seconds (configurable)
   - Detects app lifecycle changes for smart syncing
   - Provides `useSync()` hook for sync status

3. **Local Database** (`src/db/localDB.ts`)
   - SQLite-based local database with:
     - `dirty` flag (1 = needs sync, 0 = synced)
     - `deleted` flag for soft deletes
     - Automatic timestamps (created_at, updated_at)
   - Supports CRUD operations for:
     - Muscle Groups
     - Exercises
     - Workout Logs

4. **Sync Service** (`src/services/syncService.ts`)
   - Bidirectional sync algorithm:
     1. PUSH: Sends all dirty local changes to Supabase
     2. PULL: Fetches recent remote changes
     3. Marks synced items as clean
   - Conflict resolution: Timestamp-based (last-write-wins)
   - Error handling with detailed error reporting

5. **Repository Layer** (`src/lib/repository.ts`)
   - High-level data access API
   - Abstracts local database and sync details
   - CRUD functions for all entities
   - Query functions for analytics (e.g., weekly stats)

## Setup Instructions

### 1. Install Missing Dependencies

```bash
npm install @react-native-async-storage/async-storage
```

### 2. Update Environment Variables

Create or update `.env` file:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=YOUR_ANON_KEY
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
```

### 3. Google Sign-In Setup

#### For Android:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a Web OAuth 2.0 Client ID
3. Get the Web Client ID and update `.env`

#### For iOS:
1. Create iOS OAuth 2.0 Client ID in Google Cloud Console
2. Update `app.json`:
   ```json
   "ios": {
     "config": {
       "googleSignIn": {
         "reservedClientId": "YOUR_IOS_CLIENT_ID"
       }
     }
   }
   ```

### 4. Supabase Configuration

1. Create a Supabase project
2. In Authentication > Providers, enable Google OAuth:
   - Redirect URL: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
3. Add Google OAuth credentials
4. Migrations are already created in `supabase/migrations/`

### 5. Initialize the App

The app automatically:
- Initializes SQLite database on first launch
- Generates a unique device ID (stored in AsyncStorage)
- Starts auto-sync when authenticated
- Persists auth sessions

## Data Flow

### Creating a Workout Log

```
User Input
    ↓
createWorkoutLog() in Repository
    ↓
Insert into Local SQLite (marked dirty=1)
    ↓
Component re-renders with local data
    ↓
(Every 60 seconds) SyncContext triggers sync
    ↓
Sync Service finds dirty items
    ↓
PUSH to Supabase → marks clean
    ↓
PULL recent changes from Supabase
    ↓
Update local database
```

### Offline Scenario

1. User creates workout log while offline
   - Stored locally with `dirty=1`
   - UI updates immediately (optimistic update)
2. User goes online
   - SyncContext detects app resume
   - Triggers immediate sync
   - Dirty items uploaded to Supabase
   - Recent changes pulled down

## API Usage

### Authentication

```typescript
import { useAuth } from '@/src/context/AuthContext';

function MyComponent() {
  const { user, login, logout, isAuthenticated } = useAuth();
  
  return (
    <Button
      title={isAuthenticated ? `Logout ${user?.email}` : 'Login with Google'}
      onPress={isAuthenticated ? logout : login}
    />
  );
}
```

### Data Operations

```typescript
import * as Repository from '@/src/lib/repository';

// Create muscle group
const group = await Repository.createMuscleGroup({
  name: 'Chest',
  color: '#FF5A5A',
  targetSetsPerWeek: 10,
});

// Get weekly stats
const stats = await Repository.getMuscleGroupsWithWeeklyStats(startDate, endDate);

// Create workout log
const log = await Repository.createWorkoutLog({
  exerciseId: 'exercise-123',
  muscleGroupId: 'chest',
  sets: 3,
  reps: 10,
  weight: 100,
});
```

### Sync Status

```typescript
import { useSync } from '@/src/context/SyncContext';

function SyncStatusComponent() {
  const { isSyncing, lastSyncTime, syncError, syncCountdown } = useSync();
  
  return (
    <View>
      {isSyncing && <ActivityIndicator />}
      {syncError && <Text style={{color: 'red'}}>{syncError}</Text>}
      <Text>Last synced: {lastSyncTime}</Text>
      <Text>Next sync in: {syncCountdown / 1000}s</Text>
    </View>
  );
}
```

## Key Features

### ✅ Offline-First
- App works without internet connection
- All data stored locally
- Auto-syncs when connection returns

### ✅ Multi-Device Sync
- Changes sync across all devices
- Device ID tracks changes origin
- Conflict resolution by timestamp

### ✅ Efficient Sync
- Only syncs dirty/changed data
- Incremental updates from server
- Configurable sync interval

### ✅ Type-Safe
- Full TypeScript support
- Database types auto-generated from Supabase
- Type-safe queries and mutations

### ✅ Battery Efficient
- Smart app lifecycle detection
- Sync only when needed
- Configurable intervals

## Troubleshooting

### Sync Not Working

1. Check network connectivity
2. Verify Supabase credentials in `.env`
3. Check `useSync()` for errors:
   ```typescript
   const { syncError } = useSync();
   if (syncError) console.error('Sync failed:', syncError);
   ```

### Authentication Issues

1. Verify Google OAuth Client ID in `.env`
2. Check Google Cloud Console credentials
3. Ensure redirect URLs are configured correctly

### Database Errors

1. Check SQLite initialization:
   ```typescript
   import { initializeDatabase } from '@/src/db/localDB';
   await initializeDatabase();
   ```
2. Verify database file isn't corrupted
3. Check device storage permissions

## Performance Considerations

- **Sync Interval**: Default 60 seconds - adjust in `src/context/SyncContext.tsx`
- **Batch Size**: Sync processes changes one by one - consider batching for large datasets
- **Database Indexes**: Created for common queries (`dirty` flag, `logged_at`, foreign keys)
- **WAL Mode**: Enabled for better concurrent access

## Future Enhancements

- [ ] Add compression for sync payloads
- [ ] Implement retry logic with exponential backoff
- [ ] Add sync progress tracking
- [ ] Implement local query optimization
- [ ] Add data export functionality
- [ ] Implement change notifications
