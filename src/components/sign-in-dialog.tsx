import * as React from "react";
import { Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SignInDialog({ open, onOpenChange }: Props) {
  const { signInWithOAuth, signInWithEmail } = useAuth();
  const [email, setEmail] = React.useState("");
  const [emailSent, setEmailSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setEmail("");
      setEmailSent(false);
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const oauth = async (provider: "google" | "github") => {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-id="sign-in-dialog" className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle data-id="sign-in-dialog-title">
            Sign in to sync
          </DialogTitle>
          <DialogDescription data-id="sign-in-dialog-description">
            Optional. Your mantras will sync across devices. You can keep using
            Mantrabe without an account.
          </DialogDescription>
        </DialogHeader>

        {emailSent ? (
          <div
            data-id="sign-in-dialog-email-sent"
            className="rounded-md border border-border bg-muted px-4 py-3 text-sm"
          >
            Check your email for the sign-in link.
          </div>
        ) : (
          <>
            <div data-id="sign-in-dialog-oauth" className="flex flex-col gap-2">
              {/* <Button
                data-id="sign-in-dialog-google"
                variant="ghost"
                disabled={busy}
                onClick={() => oauth('google')}
              >
                Continue with Google
              </Button>
              <Button
                data-id="sign-in-dialog-github"
                variant="ghost"
                disabled={busy}
                onClick={() => oauth('github')}
              >
                Continue with GitHub
              </Button> */}
            </div>

            {/* <div
              data-id="sign-in-dialog-divider"
              className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground"
            >
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div> */}

            <form
              data-id="sign-in-dialog-email-form"
              className="flex flex-col gap-3"
              onSubmit={submitEmail}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  data-id="sign-in-dialog-email-input"
                  id="signin-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                />
              </div>
              <Button
                data-id="sign-in-dialog-email-submit"
                type="submit"
                disabled={busy || !email.trim()}
              >
                <Mail className="h-4 w-4" /> Send magic link
              </Button>
            </form>
          </>
        )}

        {error && (
          <p
            data-id="sign-in-dialog-error"
            className="text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
