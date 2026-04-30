import * as React from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Lets an already-authenticated user set or change their password.
 * Specifically valuable for accounts created via magic link, which have
 * no password and therefore can't use the password sign-in path until
 * one is set here.
 */
export function SetPasswordDialog({ open, onOpenChange }: Props) {
  const { setPassword } = useAuth();
  const [password, setPasswordValue] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    setPasswordValue('');
    setConfirm('');
    setBusy(false);
    setError(null);
    setDone(false);
  }, [open]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await setPassword(password);
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-id="set-password-dialog" className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle data-id="set-password-dialog-title">Set a password</DialogTitle>
          <DialogDescription data-id="set-password-dialog-description">
            Once set, you can sign in with email + password on any device —
            no email codes required.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div
            data-id="set-password-done"
            className="rounded-md border border-border bg-muted px-4 py-3 text-sm"
          >
            Password updated. You can now sign in with it on other devices.
          </div>
        ) : (
          <form
            data-id="set-password-form"
            className="flex flex-col gap-3"
            onSubmit={onSubmit}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="set-password-new">New password</Label>
              <Input
                data-id="set-password-new-input"
                id="set-password-new"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPasswordValue(e.target.value)}
                disabled={busy}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="set-password-confirm">Confirm password</Label>
              <Input
                data-id="set-password-confirm-input"
                id="set-password-confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={busy}
              />
            </div>

            <Button
              data-id="set-password-submit"
              type="submit"
              disabled={busy || password.length < 6 || confirm.length < 6}
            >
              <Lock className="h-4 w-4" /> Save password
            </Button>

            {error && (
              <p
                data-id="set-password-error"
                className="text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
