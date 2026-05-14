import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { Session, User } from '@/lib/auth';
import {
  getSession,
  signInWithGoogle,
  signOut as authSignOut,
  onAuthStateChange,
} from '@/lib/auth';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isGuestMode: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isGuestMode: false,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const signOut = async () => {
    try {
      await authSignOut();
    } finally {
      // Keep native local data so users can continue in guest mode after sign out.
      // Web requires auth and will not expose data while signed out.
      setSession(null);
    }
  };

  useEffect(() => {
    // Web: show demo mode immediately
    if (Platform.OS === 'web') {
      setSession(null);
      setLoading(false);
      return;
    }

    // Native: load actual session
    getSession().then((s) => {
      setSession(s);
      setLoading(false);
    });
    const unsub = onAuthStateChange((s) => setSession(s));
    return unsub;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        isGuestMode: Platform.OS !== 'web' && !session,
        signIn: signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
