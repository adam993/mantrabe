import * as React from 'react';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';

interface Props {
  /** `dialog` stacks a labelled email field above a full-width submit
   *  button (more breathing room inside a modal). `inline` puts the
   *  unlabelled field next to the submit button on >= sm screens. */
  layout: 'dialog' | 'inline';
  /** ID prefix used for `data-id` + the `<Label>`/<Input> association.
   *  Lets the dialog and the inline panel keep their distinct hooks
   *  without colliding when both render in the same DOM. */
  idPrefix: string;
  /** Reset the form whenever the parent toggles this. Useful for the
   *  dialog where closing should clear leftover input/state. */
  resetSignal?: unknown;
}

/**
 * Email sign-in form. Supabase sends both a magic link AND a 6-digit
 * code in the same email. Tapping the link works on desktop / native,
 * but on iOS PWAs the link opens Safari (separate storage from the
 * installed PWA), so we also let the user paste the code to complete
 * sign-in inside whichever browser context they started in.
 */
export function SignInForm({ layout, idPrefix, resetSignal }: Props) {
  const { signInWithEmail, verifyEmailOtp } = useAuth();
  const [email, setEmail] = React.useState('');
  const [emailSent, setEmailSent] = React.useState(false);
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setEmail('');
    setEmailSent(false);
    setCode('');
    setBusy(false);
    setError(null);
  }, [resetSignal]);

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
      // On success, AuthProvider's onAuthStateChange will flip the UI;
      // no further state to update here.
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const isDialog = layout === 'dialog';
  const inputId = `${idPrefix}-email`;
  const codeInputId = `${idPrefix}-code`;

  if (emailSent) {
    return (
      <div data-id={`${idPrefix}-verify`} className="flex flex-col gap-3">
        <div
          data-id={`${idPrefix}-email-sent`}
          className="rounded-md border border-border bg-muted px-4 py-3 text-sm"
        >
          We emailed a sign-in link and a 6-digit code to{' '}
          <span className="font-medium">{email}</span>. Tap the link, or paste
          the code below if the link opens in another browser (e.g. on an iOS
          home-screen app).
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

  return (
    <>
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
          <Mail className="h-4 w-4" /> {isDialog ? 'Send link & code' : 'Send'}
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
    </>
  );
}
