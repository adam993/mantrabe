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

  if (code === 'invalid_credentials' || /invalid.*(login|credentials|password)/i.test(raw)) {
    return 'Wrong email or password.';
  }

  if (code === 'user_already_exists' || /already.*registered/i.test(raw)) {
    return 'An account with this email already exists. Try signing in instead.';
  }

  if (code === 'weak_password' || /password.*(short|weak|requirements)/i.test(raw)) {
    return 'Password is too weak. Use at least 6 characters.';
  }

  return raw || 'Sign-in failed. Please try again.';
}

interface AuthContextValue {
  enabled: boolean;
  loading: boolean;
  user: User | null;
  session: Session | null;
  signInWithEmail: (email: string) => Promise<void>;
  verifyEmailOtp: (email: string, token: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  setPassword: (newPassword: string) => Promise<void>;
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
    // Two-mode dispatch by platform:
    //
    //   Web (no emailRedirectTo): Supabase issues a pure email-OTP token
    //     that verifyOtp(6-digit) can validate directly. The email
    //     template must be Token-only (no {{ .ConfirmationURL }}) to
    //     avoid scanner prefetch consuming the token before the user
    //     types it. UI shows the 6-digit code input.
    //
    //   Native (emailRedirectTo set): Supabase issues a redirect-bound
    //     OTP. Tapping the link in the email goes Supabase → 302 →
    //     com.mantrabe.app://auth-callback#access_token=… and the
    //     intent filter routes it back into the app, where the
    //     appUrlOpen listener below calls setSession. verifyOtp(6-digit)
    //     no longer works in this branch — the server refuses the same
    //     token a second time — so the UI must hide the code input on
    //     native. The corresponding redirect URL must be allowlisted in
    //     Supabase Auth → URL Configuration → Redirect URLs.
    const options = isNative() ? { emailRedirectTo: NATIVE_REDIRECT } : undefined;
    const { error } = await supabase.auth.signInWithOtp({ email, options });
    if (error) {
      // Keep the raw error in the console for diagnosis — quota vs SMTP
      // creds vs Brevo outage all hit the same user-facing branch.
      console.error('signInWithOtp failed:', error);
      throw new Error(prettifyAuthError(error));
    }
  }, []);

  // Verify a 6-digit code from the OTP email. Supabase issues the token
  // under different `type`s depending on user state:
  //   - first-time email (no existing user): `signup`
  //   - existing user via signInWithOtp:      `magiclink` or `email`
  // The frontend doesn't know which case applies, and a wrong type
  // returns the generic 403 "Token has expired or is invalid". So we
  // try them in order of likelihood and only surface the error if all
  // fail. (Genuine errors like rate limit / bad email exit early.)
  const verifyEmailOtp = React.useCallback(async (email: string, token: string) => {
    if (!supabase) throw new Error('Supabase not configured.');
    const types: Array<'email' | 'magiclink' | 'signup'> = ['email', 'magiclink', 'signup'];
    let lastError: AuthError | null = null;
    for (const type of types) {
      const { error } = await supabase.auth.verifyOtp({ email, token, type });
      if (!error) return;
      lastError = error;
      if (!/expired|invalid|not.*found/i.test(error.message)) break;
    }
    if (lastError) {
      console.error('verifyOtp failed:', lastError);
      throw new Error(prettifyAuthError(lastError));
    }
  }, []);

  // Email + password fallback. Reliable when the OTP path is broken by
  // email-scanner prefetching (Gmail, corporate scanners, etc.) that
  // consume the token before the user enters it. For this to work as a
  // real first-time-signup path, the Supabase project must have
  // "Confirm email" turned OFF (Auth → Providers → Email). Otherwise
  // signUp creates an unconfirmed user and the same OTP-via-email loop
  // re-emerges.
  const signUpWithPassword = React.useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase not configured.');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      console.error('signUp failed:', error);
      throw new Error(prettifyAuthError(error));
    }
  }, []);

  const signInWithPassword = React.useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase not configured.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('signInWithPassword failed:', error);
      throw new Error(prettifyAuthError(error));
    }
  }, []);

  // Sets / changes the password on the currently-authenticated user.
  // This is the bootstrap path for accounts that were originally created
  // via magic link and therefore have no password — once the user signs
  // in once via the email-code flow, they can set a password here and
  // use signInWithPassword on future devices without depending on email
  // delivery at all.
  const setPassword = React.useCallback(async (newPassword: string) => {
    if (!supabase) throw new Error('Supabase not configured.');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      console.error('updateUser(password) failed:', error);
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
      verifyEmailOtp,
      signUpWithPassword,
      signInWithPassword,
      setPassword,
      signOut,
    }),
    [loading, session, signInWithEmail, verifyEmailOtp, signUpWithPassword, signInWithPassword, setPassword, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
