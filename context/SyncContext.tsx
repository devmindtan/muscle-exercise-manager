import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { syncAll, seedFromSupabase } from '@/lib/sync';
import { useAuth } from './AuthContext';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

type SyncContextType = {
  status: SyncStatus;
  lastSyncAt: Date | null;
  sync: () => Promise<void>;
};

const SyncContext = createContext<SyncContextType>({
  status: 'idle',
  lastSyncAt: null,
  sync: async () => {},
});

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const inFlight = useRef(false);

  const sync = useCallback(async () => {
    // Web: no syncing - just demo mode
    if (Platform.OS === 'web') {
      setStatus('idle');
      return;
    }

    if (!session) {
      setStatus('idle');
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus('syncing');
    try {
      await syncAll();
      setStatus('synced');
      setLastSyncAt(new Date());
    } catch (error) {
      console.error('Sync error:', error);
      setStatus('error');
    } finally {
      inFlight.current = false;
    }
  }, [session]);

  // Seed/pull once after authentication is available.
  // Add delay to ensure database is ready on native platforms
  useEffect(() => {
    // Web: skip sync initialization
    if (Platform.OS === 'web') {
      setStatus('idle');
      return;
    }

    if (!session) {
      setStatus('idle');
      return;
    }

    const initSync = async () => {
      try {
        // Small delay to ensure database initialization is complete
        await new Promise((resolve) => setTimeout(resolve, 100));
        await seedFromSupabase();
        await sync();
      } catch (error) {
        console.error('Initial sync error:', error);
        setStatus('error');
      }
    };

    initSync();
  }, [session, sync]);

  // Auto-sync when app returns to foreground (native only)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!session) return;
    const handler = (state: AppStateStatus) => {
      if (state === 'active') sync();
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, [session, sync]);

  // Auto-sync when user signs in (native only)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (session) sync();
  }, [session, sync]);

  // Keep pulling remote updates periodically while signed in (native only).
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!session) return;
    const id = setInterval(() => {
      sync();
    }, 30000);
    return () => clearInterval(id);
  }, [session, sync]);

  return (
    <SyncContext.Provider value={{ status, lastSyncAt, sync }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  return useContext(SyncContext);
}
