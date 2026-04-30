import * as React from 'react';
import { Mail, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';

interface Props {
  /** `dialog` stacks fields above a full-width submit button. `inline`
   *  keeps things compact when the form is embedded in a panel. */
  layout: 'dialog' | 'inline';
  idPrefix: string;
  /** Reset the form whenever the parent toggles this. Useful for the
   *  dialog where closing should clear leftover input/state. */
  resetSignal?: unknown;
}

type Mode = 'code' | 'password';
type PasswordIntent = 'sign-in' | 'sign-up';

/**
 * Email sign-in form supporting two paths:
 *   - "code"     — Supabase signInWithOtp + verifyOtp(6-digit). Brittle
 *                  on Gmail / corporate inboxes that prefetch links and
 *                  consume the token before the user enters it.
 *   - "password" — Supabase signInWithPassword / signUp. Doesn't depend
 *                  on email delivery at all. Requires "Confirm email"
 *                  to be OFF in the Supabase dashboard for sign-up to
 *                  produce an immediately usable session.
 */
export function SignInForm({ layout, idPrefix, resetSignal }: Props) {
  const {
    signInWithEmail,
    verifyEmailOtp,
    signUpWithPassword,
    signInWithPassword,
  } = useAuth();
  const [mode, setMode] = React.useState<Mode>('code');
  const [pwIntent, setPwIntent] = React.useState<PasswordIntent>('sign-in');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [emailSent, setEmailSent] = React.useState(false);
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMode('code');
    setPwIntent('sign-in');
    setEmail('');
    setPassword('');
    setEmailSent(false);
    setCode('');
    setBusy(false);
    setError(null);
  }, [resetSignal]);

  // Switching modes shouldn't carry the post-send "code sent" state
  // across, but keep email + error blank-slate handling minimal.
  React.useEffect(() => {
    setEmailSent(false);
    setCode('');
    setError(null);
  }, [mode]);

  const isDialog = layout === 'dialog';
  const inputId = `${idPrefix}-email`;
  const codeInputId = `${idPrefix}-code`;
  const pwInputId = `${idPrefix}-password`;

  const onSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await signInWithEmail(email.trim());
      setEmailSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setError(null);
    setBusy(true);
    try {
      await verifyEmailOtp(email.trim(), trimmed);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const e1 = email.trim();
    const p1 = password;
    if (!e1 || !p1) return;
    setError(null);
    setBusy(true);
    try {
      if (pwIntent === 'sign-up') {
        await signUpWithPassword(e1, p1);
      } else {
        await signInWithPassword(e1, p1);
      }
      // onAuthStateChange will flip the surrounding UI; no local state
      // update needed here.
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const ModeToggle = (
    <div
      data-id={`${idPrefix}-mode`}
      className="inline-flex rounded-md border border-border bg-muted p-0.5 text-xs"
    >
      <button
        type="button"
        data-id={`${idPrefix}-mode-code`}
        className={
          'rounded px-2.5 py-1 transition ' +
          (mode === 'code'
            ? 'bg-background font-medium shadow-sm'
            : 'text-muted-foreground hover:text-foreground')
        }
        onClick={() => setMode('code')}
        disabled={busy}
      >
        Email code
      </button>
      <button
        type="button"
        data-id={`${idPrefix}-mode-password`}
        className={
          'rounded px-2.5 py-1 transition ' +
          (mode === 'password'
            ? 'bg-background font-medium shadow-sm'
            : 'text-muted-foreground hover:text-foreground')
        }
        onClick={() => setMode('password')}
        disabled={busy}
      >
        Password
      </button>
    </div>
  );

  // --- Password mode ---
  if (mode === 'password') {
    return (
      <div data-id={`${idPrefix}-password-mode`} className="flex flex-col gap-3">
        {ModeToggle}

        <form
          data-id={`${idPrefix}-password-form`}
          className="flex flex-col gap-3"
          onSubmit={onPasswordSubmit}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={inputId}>Email</Label>
            <Input
              data-id={`${idPrefix}-email-input`}
              id={inputId}
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={pwInputId}>Password</Label>
            <Input
              data-id={`${idPrefix}-password-input`}
              id={pwInputId}
              type="password"
              autoComplete={pwIntent === 'sign-up' ? 'new-password' : 'current-password'}
              required
              minLength={6}
              placeholder={pwIntent === 'sign-up' ? 'At least 6 characters' : ''}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </div>

          <Button
            data-id={`${idPrefix}-password-submit`}
            type="submit"
            disabled={busy || !email.trim() || password.length < 6}
          >
            <Lock className="h-4 w-4" />{' '}
            {pwIntent === 'sign-up' ? 'Create account' : 'Sign in'}
          </Button>
        </form>

        <button
          type="button"
          data-id={`${idPrefix}-password-toggle-intent`}
          className="self-start text-sm text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
          disabled={busy}
          onClick={() => {
            setPwIntent(pwIntent === 'sign-up' ? 'sign-in' : 'sign-up');
            setError(null);
          }}
        >
          {pwIntent === 'sign-up'
            ? 'Already have an account? Sign in'
            : "Don't have an account? Create one"}
        </button>

        {error && (
          <p
            data-id={`${idPrefix}-error`}
            className="text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }

  // --- Code mode, after we've sent the email ---
  if (emailSent) {
    return (
      <div data-id={`${idPrefix}-verify`} className="flex flex-col gap-3">
        {ModeToggle}

        <div
          data-id={`${idPrefix}-email-sent`}
          className="rounded-md border border-border bg-muted px-4 py-3 text-sm"
        >
          We emailed a 6-digit code to{' '}
          <span className="font-medium">{email}</span>. Enter it below.
        </div>

        <form
          data-id={`${idPrefix}-code-form`}
          className={isDialog ? 'flex flex-col gap-3' : 'flex flex-col gap-2 sm:flex-row'}
          onSubmit={onVerifyCode}
        >
          {isDialog ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={codeInputId}>6-digit code</Label>
              <Input
                data-id={`${idPrefix}-code-input`}
                id={codeInputId}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={6}
                required
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                disabled={busy}
              />
            </div>
          ) : (
            <Input
              data-id={`${idPrefix}-code-input`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              required
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              disabled={busy}
              className="flex-1"
            />
          )}
          <Button
            data-id={`${idPrefix}-code-submit`}
            type="submit"
            disabled={busy || code.trim().length < 6}
          >
            Verify code
          </Button>
        </form>

        <button
          data-id={`${idPrefix}-resend`}
          type="button"
          className="self-start text-sm text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
          disabled={busy}
          onClick={() => {
            setEmailSent(false);
            setCode('');
            setError(null);
          }}
        >
          Use a different email
        </button>

        {error && (
          <p
            data-id={`${idPrefix}-error`}
            className="text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }

  // --- Code mode, request the email ---
  return (
    <div className="flex flex-col gap-3">
      {ModeToggle}

      <form
        data-id={`${idPrefix}-email-form`}
        className={isDialog ? 'flex flex-col gap-3' : 'flex flex-col gap-2 sm:flex-row'}
        onSubmit={onSendEmail}
      >
        {isDialog ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={inputId}>Email</Label>
            <Input
              data-id={`${idPrefix}-email-input`}
              id={inputId}
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </div>
        ) : (
          <Input
            data-id={`${idPrefix}-email-input`}
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            className="flex-1"
          />
        )}
        <Button
          data-id={`${idPrefix}-email-submit`}
          type="submit"
          disabled={busy || !email.trim()}
        >
          <Mail className="h-4 w-4" /> {isDialog ? 'Email me a code' : 'Send code'}
        </Button>
      </form>

      {error && (
        <p
          data-id={`${idPrefix}-error`}
          className="text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
