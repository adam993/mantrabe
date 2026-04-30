import * as React from 'react';
import type { AuthError, Session, User } from '@supabase/supabase-js';
import { App as CapacitorApp } from '@capacitor/app';
import { isNative } from '@/lib/platform';
import { supabase, SUPABASE_ENABLED } from '@/lib/supabase';

// Map Supabase auth errors to messages a user can act on. The most
// common silent failure here is the upstream SMTP (Brevo, free tier =
// 300 emails / month) hitting its monthly quota — Supabase surfaces
// that as a 500 with "Error sending magic link email", which is
// useless to the user. Anything we don't recognize falls through with
// the original message.
function prettifyAuthError(err: AuthError | Error): string {
  const status = (err as Partial<AuthError>).status;
  const code = (err as Partial<AuthError>).code;
  const raw = err.message || '';

  // Per-IP / per-email rate limit on Supabase's side. Distinct from
  // the Brevo monthly quota — this resets on the order of minutes.
  if (status === 429 || code === 'over_email_send_rate_limit') {
    return 'Too many sign-in attempts in a short window. Please wait a minute and try again.';
  }

  // Email delivery failure. Could be Brevo over its monthly quota,
  // bad SMTP creds, or Brevo itself being down — from the user's
  // perspective they all look the same: the email won't arrive.
  if (
    status === 500 ||
    code === 'unexpected_failure' ||
    /sending.*(magic|email|otp|sign[-_ ]?in|confirmation)/i.test(raw)
  ) {
    return "Couldn't send the sign-in email right now — our email service may be over its monthly limit or temporarily down. Please try again later. Your mantras still work locally without signing in.";
  }

  if (/invalid.*(email|address)/i.test(raw)) {
    return "That doesn't look like a valid email address.";
  }

  return raw || 'Sign-in failed. Please try again.';
}

interface AuthContextValue {
  enabled: boolean;
  loading: boolean;
  user: User | null;
  session: Session | null;
  signInWithEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

// Custom URL scheme used for auth-callback deep links on native. Mirrors
// the intent filter in scripts/apply-android-customizations.cjs and the
// scheme entry in Supabase Auth → URL Configuration → Redirect URLs.
const NATIVE_REDIRECT = 'com.mantrabe.app://auth-callback';

function authRedirectUrl(): string {
  if (isNative()) return NATIVE_REDIRECT;
  return typeof window !== 'undefined' ? window.location.origin : '';
}

// On native, Supabase's browser auth flow won't see the magic-link
// callback (the link opens the OS browser, not the app). The intent
// filter routes com.mantrabe.app://auth-callback#... back into the app
// and Capacitor surfaces it via App.appUrlOpen — at which point we
// hand the URL fragment to supabase-js so it can complete the session.
function extractTokens(url: string): { access_token: string; refresh_token: string } | null {
  const hashIdx = url.indexOf('#');
  if (hashIdx === -1) return null;
  const params = new URLSearchParams(url.slice(hashIdx + 1));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

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

  // Native-only: when the OS hands us a com.mantrabe.app:// URL (because
  // the user tapped the magic link in their email), pull the access /
  // refresh tokens out of the fragment and complete the session.
  React.useEffect(() => {
    const sb = supabase;
    if (!sb || !isNative()) return;
    const handle = CapacitorApp.addListener('appUrlOpen', async (event) => {
      const tokens = extractTokens(event.url);
      if (!tokens) return;
      const { error } = await sb.auth.setSession(tokens);
      if (error) console.error('appUrlOpen setSession failed:', error);
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, []);

  const signInWithEmail = React.useCallback(async (email: string) => {
    if (!supabase) throw new Error('Supabase not configured.');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: authRedirectUrl() },
    });
    if (error) {
      // Keep the raw error in the console for diagnosis — quota vs SMTP
      // creds vs Brevo outage all hit the same user-facing branch.
      console.error('signInWithOtp failed:', error);
      throw new Error(prettifyAuthError(error));
    }
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
      signInWithEmail,
      signOut,
    }),
    [loading, session, signInWithEmail, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
