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
 * Magic-link sign-in form. The dialog and the inline panel both wrap
 * this — the only differences are surrounding chrome (modal vs
 * collapsible section) and field layout.
 */
export function SignInForm({ layout, idPrefix, resetSignal }: Props) {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = React.useState('');
  const [emailSent, setEmailSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setEmail('');
    setEmailSent(false);
    setBusy(false);
    setError(null);
  }, [resetSignal]);

  const onSubmit = async (e: React.FormEvent) => {
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

  if (emailSent) {
    return (
      <div
        data-id={`${idPrefix}-email-sent`}
        className="rounded-md border border-border bg-muted px-4 py-3 text-sm"
      >
        Check your email for the sign-in link.
      </div>
    );
  }

  const isDialog = layout === 'dialog';
  const inputId = `${idPrefix}-email`;

  return (
    <>
      <form
        data-id={`${idPrefix}-email-form`}
        className={isDialog ? 'flex flex-col gap-3' : 'flex flex-col gap-2 sm:flex-row'}
        onSubmit={onSubmit}
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
          <Mail className="h-4 w-4" /> {isDialog ? 'Send magic link' : 'Send link'}
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
