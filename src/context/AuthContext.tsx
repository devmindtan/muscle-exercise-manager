import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/src/lib/supabase';

type GoogleSigninLike = {
  configure: (options: Record<string, any>) => Promise<void> | void;
  signIn: () => Promise<void>;
  getTokens: () => Promise<{ idToken: string }>;
  signOut: () => Promise<void>;
};

let GoogleSignin: GoogleSigninLike | null = null;
const statusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
};

try {
  const googleModule = require('@react-native-google-signin/google-signin');
  GoogleSignin = googleModule.GoogleSignin as GoogleSigninLike;
} catch {
  GoogleSignin = null;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);

  // Initialize Google Sign-In
  useEffect(() => {
    const initGoogleSignIn = async () => {
      try {
        if (!GoogleSignin) {
          return;
        }
        await GoogleSignin.configure({
          webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
          offlineAccess: true,
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
        if (data.session?.user) {
          const authUser = data.session.user;
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
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const authUser = session.user;
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

      if (!GoogleSignin) {
        throw new Error('Google Sign-In requires a development build. Expo Go is not supported.');
      }

      await GoogleSignin.signIn();
      const { idToken } = await GoogleSignin.getTokens();

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
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        errorMessage = 'Sign in cancelled';
      } else if (err.code === statusCodes.IN_PROGRESS) {
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
