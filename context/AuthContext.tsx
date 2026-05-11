import React, { createContext, useContext, useEffect, useState } from 'react';
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
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
        signIn: signInWithGoogle,
        signOut: authSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
