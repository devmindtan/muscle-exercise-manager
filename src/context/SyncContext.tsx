import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { initializeDatabase } from '@/src/db/localDB';
import { syncData, SyncResult } from '@/src/services/syncService';
import { useAuth } from '@/src/context/AuthContext';

// Simple UUID v4 generator
function generateUUID(): string {
  const chars = '0123456789abcdef';
  let uuid = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-';
    } else if (i === 14) {
      uuid += '4';
    } else if (i === 19) {
      uuid += chars[Math.floor(Math.random() * 16)];
    } else {
      uuid += chars[Math.floor(Math.random() * 16)];
    }
  }
  return uuid;
}

type SyncStatus = 'syncing' | 'synced' | 'error' | 'idle';

interface SyncContextType {
  status: SyncStatus;
  lastSyncAt: Date | null;
  syncError: string | null;
  deviceId: string;
  sync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

const DEVICE_ID_KEY = 'device_id';
const LAST_SYNC_KEY = 'last_sync_time';
const SYNC_INTERVAL = 60000; // 60 seconds

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize device ID and database
  useEffect(() => {
    const initializeSync = async () => {
      try {
        // Initialize local database
        await initializeDatabase();

        // Get or create device ID
        let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (!id) {
          id = generateUUID();
          await AsyncStorage.setItem(DEVICE_ID_KEY, id);
        }
        setDeviceId(id);

        // Load last sync time
        const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);
        if (lastSync) {
          setLastSyncAt(new Date(lastSync));
        }
      } catch (err) {
        console.error('Failed to initialize sync:', err);
        setSyncError('Failed to initialize sync');
      }
    };

    initializeSync();
  }, []);

  // Subscribe to app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const handleAppStateChange = useCallback(
    (newState: AppStateStatus) => {
      if (newState === 'active' && appStateRef.current !== 'active' && isAuthenticated && deviceId) {
        // App returned to foreground
        try {
          performSync();
        } catch (err) {
          console.error('Failed to sync on app resume:', err);
        }
      }
      appStateRef.current = newState;
    },
    [isAuthenticated, deviceId]
  );

  const performSync = useCallback(async () => {
    if (!isAuthenticated || !deviceId || status === 'syncing') {
      return;
    }

    try {
      setStatus('syncing');
      setSyncError(null);

      const result = await syncData(deviceId);

      if (!result.success && result.errors.length > 0) {
        setStatus('error');
        setSyncError(result.errors[0]);
      } else {
        setStatus('synced');
        setSyncError(null);
      }

      const syncTime = new Date();
      setLastSyncAt(syncTime);
      await AsyncStorage.setItem(LAST_SYNC_KEY, syncTime.toISOString());
    } catch (err: any) {
      const errorMessage = err.message || 'Sync failed';
      setStatus('error');
      setSyncError(errorMessage);
      console.error('Sync error:', err);
    }
  }, [isAuthenticated, deviceId, status]);

  // Start auto-sync interval
  useEffect(() => {
    if (!isAuthenticated || !deviceId) {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      return;
    }

    // Perform initial sync
    performSync();

    // Set up recurring sync
    syncIntervalRef.current = setInterval(() => {
      performSync();
    }, SYNC_INTERVAL);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [isAuthenticated, deviceId, performSync]);

  const value: SyncContextType = {
    status,
    lastSyncAt,
    syncError,
    deviceId,
    sync: performSync,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
