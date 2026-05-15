import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/src/lib/supabase';
import * as LocalDB from '@/src/db/localDB';

type GoogleSigninLike = {
  configure: (options: Record<string, any>) => Promise<void> | void;
  signIn: () => Promise<any>;
  getTokens: () => Promise<{ idToken?: string }>;
  signOut: () => Promise<void>;
};

type GoogleSigninModuleLike = {
  GoogleSignin: GoogleSigninLike;
  statusCodes?: {
    SIGN_IN_CANCELLED?: string;
    IN_PROGRESS?: string;
  };
};

let GoogleSignin: GoogleSigninLike | null = null;
let googleStatusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
};

async function ensureGoogleSigninLoaded() {
  if (GoogleSignin) {
    return true;
  }

  try {
    const googleModule = (await import(
      '@react-native-google-signin/google-signin'
    )) as unknown as GoogleSigninModuleLike;
    GoogleSignin = googleModule.GoogleSignin;
    if (googleModule.statusCodes) {
      googleStatusCodes = {
        SIGN_IN_CANCELLED:
          googleModule.statusCodes.SIGN_IN_CANCELLED ||
          googleStatusCodes.SIGN_IN_CANCELLED,
        IN_PROGRESS:
          googleModule.statusCodes.IN_PROGRESS ||
          googleStatusCodes.IN_PROGRESS,
      };
    }
    return true;
  } catch {
    GoogleSignin = null;
    return false;
  }
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isGuestMode: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CURRENT_USER_ID_KEY = 'current_user_id';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);

  // Initialize Google Sign-In
  useEffect(() => {
    const initGoogleSignIn = async () => {
      try {
        const loaded = await ensureGoogleSigninLoaded();
        if (!loaded || !GoogleSignin) {
          return;
        }

        const webClientId = process.env.EXPO_PUBLIC_WEB_CLIENT_ID;

        await GoogleSignin.configure({
          webClientId,
          // offlineAccess requires a valid Web client ID from Google Cloud Console.
          offlineAccess: !!webClientId,
          scopes: ['profile', 'email'],
        });
      } catch (err: any) {
        console.error('Failed to configure Google Sign-In:', err);
      }
    };

    initGoogleSignIn();
  }, []);

  // Check existing session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const previousUserId = await AsyncStorage.getItem(CURRENT_USER_ID_KEY);

        if (data.session?.user) {
          const authUser = data.session.user;
          const newUserId = authUser.id;

          // If user changed, clear local data
          if (previousUserId && previousUserId !== newUserId) {
            console.log(`User switched from ${previousUserId} to ${newUserId}, clearing local data`);
            await LocalDB.clearAllLocalData();
            await AsyncStorage.removeItem('last_sync_time'); // Reset sync timer for new user
          }

          // Save new user ID
          await AsyncStorage.setItem(CURRENT_USER_ID_KEY, newUserId);

          setUser({
            id: authUser.id,
            email: authUser.email || '',
            name: authUser.user_metadata?.full_name || authUser.user_metadata?.name,
            avatar: authUser.user_metadata?.picture,
            user_metadata: authUser.user_metadata,
            app_metadata: authUser.app_metadata,
          });
          setIsGuestMode(false);
        } else {
          setIsGuestMode(true);
        }
      } catch (err) {
        console.error('Error checking session:', err);
        setIsGuestMode(true);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Subscribe to auth state changes
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const authUser = session.user;
        const newUserId = authUser.id;
        const previousUserId = await AsyncStorage.getItem(CURRENT_USER_ID_KEY);

        // If user changed, clear local data
        if (previousUserId && previousUserId !== newUserId) {
          console.log(`User switched from ${previousUserId} to ${newUserId}, clearing local data`);
          await LocalDB.clearAllLocalData();
          await AsyncStorage.removeItem('last_sync_time'); // Reset sync timer for new user
        }

        // Save new user ID
        await AsyncStorage.setItem(CURRENT_USER_ID_KEY, newUserId);

        setUser({
          id: authUser.id,
          email: authUser.email || '',
          name: authUser.user_metadata?.full_name || authUser.user_metadata?.name,
          avatar: authUser.user_metadata?.picture,
          user_metadata: authUser.user_metadata,
          app_metadata: authUser.app_metadata,
        });
        setIsGuestMode(false);
      } else {
        setUser(null);
        setIsGuestMode(true);
      }
    });

    return () => {
      data?.subscription?.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      const loaded = await ensureGoogleSigninLoaded();
      if (!loaded || !GoogleSignin) {
        throw new Error('Google Sign-In requires a development build. Expo Go is not supported.');
      }

      const webClientId = process.env.EXPO_PUBLIC_WEB_CLIENT_ID;

      if (!webClientId) {
        throw new Error('Missing Google Web Client ID. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID or EXPO_PUBLIC_WEB_CLIENT_ID in .env');
      }

      await GoogleSignin.signIn();
      const { idToken } = await GoogleSignin.getTokens();

      if (!idToken) {
        throw new Error('Google Sign-In did not return idToken. Check Web Client ID configuration.');
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) throw error;

      if (data.user) {
        const authUser = data.user;
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          name: authUser.user_metadata?.full_name || authUser.user_metadata?.name,
          avatar: authUser.user_metadata?.picture,
          user_metadata: authUser.user_metadata,
          app_metadata: authUser.app_metadata,
        });
        setIsGuestMode(false);
      }
    } catch (err: any) {
      let errorMessage = 'Login failed';
      if (err.code === googleStatusCodes.SIGN_IN_CANCELLED) {
        errorMessage = 'Sign in cancelled';
      } else if (err.code === googleStatusCodes.IN_PROGRESS) {
        errorMessage = 'Sign in in progress';
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      setLoading(true);
      
      // Clear local data before signing out
      await LocalDB.clearAllLocalData();
      await AsyncStorage.removeItem(CURRENT_USER_ID_KEY);
      await AsyncStorage.removeItem('last_sync_time'); // Reset sync timer
      
      await supabase.auth.signOut();
      try {
        await GoogleSignin?.signOut();
      } catch (e) {
        console.error('Error signing out from Google:', e);
      }
      setUser(null);
      setIsGuestMode(true);
      setError(null);
    } catch (err: any) {
      const errorMessage = err.message || 'Logout failed';
      setError(errorMessage);
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    isGuestMode,
    signIn,
    signOut,
    error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
