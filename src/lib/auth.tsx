import * as React from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, SUPABASE_ENABLED } from '@/lib/supabase';

interface AuthContextValue {
  enabled: boolean;
  loading: boolean;
  user: User | null;
  session: Session | null;
  signInWithOAuth: (provider: 'google' | 'github') => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState<boolean>(SUPABASE_ENABLED);

  React.useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithOAuth = React.useCallback(async (provider: 'google' | 'github') => {
    if (!supabase) throw new Error('Supabase not configured.');
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  }, []);

  const signInWithEmail = React.useCallback(async (email: string) => {
    if (!supabase) throw new Error('Supabase not configured.');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
  }, []);

  const signOut = React.useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      enabled: SUPABASE_ENABLED,
      loading,
      user: session?.user ?? null,
      session,
      signInWithOAuth,
      signInWithEmail,
      signOut,
    }),
    [loading, session, signInWithOAuth, signInWithEmail, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
