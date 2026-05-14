# Setup Checklist - Google Sign-In & Supabase + SQLite Integration

## ✅ Completed Files

- [x] `src/lib/supabase.ts` - Supabase client initialization
- [x] `src/context/AuthContext.tsx` - Google Sign-In authentication
- [x] `src/context/SyncContext.tsx` - Bidirectional data sync
- [x] `src/db/localDB.ts` - SQLite local database
- [x] `src/services/syncService.ts` - Sync service logic
- [x] `src/lib/repository.ts` - Data access layer
- [x] `app.json` - Updated with Google Sign-In plugin
- [x] `.env.example` - Updated with GOOGLE_WEB_CLIENT_ID

## 🚀 Next Steps

### 1. Install Missing Dependencies

```bash
npm install @react-native-async-storage/async-storage
```

### 2. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create **Web OAuth 2.0 Client ID**:
   - Authorized JavaScript origins: `http://localhost:19006` (for web testing)
   - Authorized redirect URIs: 
     - `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
     - `exp://localhost:19000` (for Expo)
5. Copy the Client ID and paste in `.env`:
   ```
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
   ```

### 3. Set Up Supabase OAuth

1. Go to your Supabase project dashboard
2. Navigate to **Authentication > Providers**
3. Enable **Google** provider
4. Add Google OAuth credentials:
   - Client ID: (from step 2)
   - Client Secret: (from Google Cloud Console)
5. Set Redirect URL: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`

### 4. Update `.env` File

```bash
# Copy .env.example to .env and fill in:
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=YOUR_ANON_KEY
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
EXPO_PUBLIC_MINIO_ENDPOINT=https://api-minio.devmindtan.uk
EXPO_PUBLIC_MINIO_BUCKET=muscle-manager
```

### 5. Verify Component Integration

The following components are already configured to use the new contexts:
- ✅ `src/components/SyncStatusChip.tsx` - Uses `useSync()` and `useAuth()`
- ✅ `src/components/UserAccountModal.tsx` - Uses `useAuth()`
- ✅ `app/_layout.tsx` - Already wraps app in providers

### 6. Install and Test

```bash
# Install dependencies
npm install

# Start dev server
npm start

# Test on Expo Go or emulator
# You should see:
# - Login button if not authenticated
# - Sync status chip showing sync state
# - User account modal when authenticated
```

## 📝 Key Features Implemented

### Google Sign-In
- ✅ Configured with Google OAuth
- ✅ Authenticates with Supabase
- ✅ Persists session with AsyncStorage
- ✅ Sign out functionality

### Offline-First SQLite
- ✅ Local database with dirty/deleted flags
- ✅ Automatic schema creation on app launch
- ✅ WAL mode for concurrent access
- ✅ Indexed queries for performance

### Bidirectional Sync
- ✅ Push: Upload dirty local changes
- ✅ Pull: Download recent remote changes
- ✅ Conflict resolution: Last-write-wins
- ✅ Auto-sync every 60 seconds
- ✅ Smart app lifecycle detection

### Data Management
- ✅ Repository layer for easy access
- ✅ Type-safe queries with TypeScript
- ✅ CRUD operations for all entities
- ✅ Weekly stats calculations

## 🔍 API Reference

### useAuth Hook

```typescript
const { user, isAuthenticated, isGuestMode, signIn, signOut, loading, error } = useAuth();

// user: { id, email, name, avatar, user_metadata, app_metadata }
// isAuthenticated: boolean
// isGuestMode: boolean (true when no session)
// signIn(): Promise<void>
// signOut(): Promise<void>
// loading: boolean
// error: string | null
```

### useSync Hook

```typescript
const { status, lastSyncAt, syncError, deviceId, sync } = useSync();

// status: 'syncing' | 'synced' | 'error' | 'idle'
// lastSyncAt: Date | null
// syncError: string | null
// deviceId: string (unique per device)
// sync(): Promise<void> (manual sync trigger)
```

### Repository Functions

```typescript
// Muscle Groups
await Repository.getMuscleGroupsWithWeeklyStats(startDate, endDate)
await Repository.createMuscleGroup({ name, color, targetSetsPerWeek })
await Repository.updateMuscleGroup(id, data)
await Repository.deleteMuscleGroup(id)

// Exercises
await Repository.getExercises(muscleGroupId?)
await Repository.createExercise({ muscleGroupId, name, notes })
await Repository.updateExercise(id, data)
await Repository.deleteExercise(id)

// Workout Logs
await Repository.getWorkoutLogs(startDate?, endDate?, exerciseId?)
await Repository.createWorkoutLog({ exerciseId, muscleGroupId, sets, reps, weight, note })
await Repository.updateWorkoutLog(id, data)
await Repository.deleteWorkoutLog(id)
```

## 🛠️ Troubleshooting

### "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is missing"
- Add `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` to `.env` file
- Restart dev server

### Sync errors
- Check network connectivity
- Verify Supabase credentials in `.env`
- Check `useSync()` for error messages:
  ```typescript
  const { syncError } = useSync();
  console.error('Sync error:', syncError);
  ```

### Database errors
- Clear app cache/data and reinstall
- Check device storage permissions
- Verify SQLite is initialized:
  ```typescript
  import { initializeDatabase } from '@/src/db/localDB';
  await initializeDatabase();
  ```

### Authentication issues
- Verify Google OAuth Client ID is correct
- Check Supabase provider configuration
- Ensure redirect URLs are set up in Google Cloud Console

## 📚 Documentation

- See [INTEGRATION.md](./INTEGRATION.md) for complete architecture details
- Check [package.json](./package.json) for all dependencies
- Review database schema in [supabase/migrations/](./supabase/migrations/)
