import * as React from 'react';
import { Cloud, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';

/**
 * Inline sign-in panel — shows on the list screen when Supabase is
 * configured and the user isn't authed yet. All three providers are
 * surfaced as visible buttons so the connect options are discoverable
 * without opening a dialog.
 */
export function SignInPanel() {
  const { enabled, user, loading, signInWithOAuth, signInWithEmail } = useAuth();
  const [email, setEmail] = React.useState('');
  const [emailSent, setEmailSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!enabled || loading || user) return null;

  const oauth = async (provider: 'google' | 'github') => {
    setError(null);
    setBusy(true);
    try {
      await signInWithOAuth(provider);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const submitEmail = async (e: React.FormEvent) => {
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

  return (
    <section
      data-id="sign-in-panel"
      className="mx-auto flex w-full max-w-[var(--content-width)] flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
    >
      <div data-id="sign-in-panel-header" className="flex items-start gap-3">
        <Cloud className="mt-1 h-5 w-5 flex-shrink-0 text-accent" aria-hidden="true" />
        <div>
          <h3 className="m-0 font-serif-zen text-[1.1rem] font-medium tracking-wide">
            Sync across devices
          </h3>
          <p className="m-0 text-sm text-muted-foreground">
            Optional. Connect to keep your mantras safe and on every device.
          </p>
        </div>
      </div>

      <div data-id="sign-in-panel-buttons" className="flex flex-col gap-2">
        <Button
          data-id="sign-in-panel-google"
          variant="ghost"
          disabled={busy}
          onClick={() => oauth('google')}
        >
          Connect with Google
        </Button>
        <Button
          data-id="sign-in-panel-github"
          variant="ghost"
          disabled={busy}
          onClick={() => oauth('github')}
        >
          Connect with GitHub
        </Button>
      </div>

      {emailSent ? (
        <div
          data-id="sign-in-panel-email-sent"
          className="rounded-md border border-border bg-muted px-4 py-2.5 text-sm"
        >
          Check your email for the sign-in link.
        </div>
      ) : (
        <form
          data-id="sign-in-panel-email-form"
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={submitEmail}
        >
          <Input
            data-id="sign-in-panel-email-input"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            className="flex-1"
          />
          <Button
            data-id="sign-in-panel-email-submit"
            type="submit"
            disabled={busy || !email.trim()}
          >
            <Mail className="h-4 w-4" /> Send link
          </Button>
        </form>
      )}

      {error && (
        <p data-id="sign-in-panel-error" className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
