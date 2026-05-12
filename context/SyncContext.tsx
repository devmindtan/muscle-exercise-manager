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
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus('syncing');
    try {
      await syncAll();
      setStatus('synced');
      setLastSyncAt(new Date());
    } catch {
      setStatus('error');
    } finally {
      inFlight.current = false;
    }
  }, []);

  // On first mount: seed from Supabase if local DB is empty, then sync
  useEffect(() => {
    seedFromSupabase()
      .then(() => sync())
      .catch(() => setStatus('error'));
  }, [sync]);

  // Auto-sync when app returns to foreground
  useEffect(() => {
    const handler = (state: AppStateStatus) => {
      if (state === 'active') sync();
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, [sync]);

  // Auto-sync when user signs in
  useEffect(() => {
    if (session) sync();
  }, [session, sync]);

  // Web: sync when tab becomes visible/focused.
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        sync();
      }
    };

    const handleFocus = () => sync();

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus);
      }
    };
  }, [sync]);

  // Keep pulling remote updates periodically while signed in.
  useEffect(() => {
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
