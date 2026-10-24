import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getSession, signIn, signOut, signUp } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (
    email: string,
    password: string,
    username: string,
    displayName?: string,
  ) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore the stored session on mount and follow sign-in/sign-out events.
  useEffect(() => {
    let cancelled = false;

    getSession()
      .then((stored) => {
        if (!cancelled) setSession(stored);
      })
      .catch(() => {
        // A failed restore just means "not signed in".
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setIsLoading(false);
      },
    );

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const result = await signIn(email, password);
      setSession(result.session);
    },
    [],
  );

  const signUpWithPassword = useCallback(
    async (
      email: string,
      password: string,
      username: string,
      displayName?: string,
    ) => {
      const result = await signUp(email, password, username, displayName);
      setSession(result.session);
    },
    [],
  );

  const signOutUser = useCallback(async () => {
    await signOut();
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      isLoading,
      signInWithPassword,
      signUpWithPassword,
      signOutUser,
    }),
    [session, isLoading, signInWithPassword, signUpWithPassword, signOutUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
}
