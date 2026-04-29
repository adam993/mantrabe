import * as React from 'react';
import { ChevronDown, Cloud } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { SignInForm } from '@/components/sign-in-form';

/**
 * Inline sign-in entry point. Renders collapsed by default — just a
 * "Sync across devices" header that doubles as a button — and expands
 * on click to reveal the email magic-link form. Keeps the list screen
 * uncluttered for users who don't want sync.
 */
export function SignInPanel() {
  const { enabled, user, loading } = useAuth();
  const [open, setOpen] = React.useState(false);

  if (!enabled || loading || user) return null;

  return (
    <section
      data-id="sign-in-panel"
      data-open={open}
      className="mx-auto flex w-full max-w-[var(--content-width)] flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]"
    >
      <button
        type="button"
        data-id="sign-in-panel-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="sign-in-panel-body"
        className="flex w-full items-center gap-3 text-left"
      >
        <Cloud className="h-5 w-5 flex-shrink-0 text-accent" aria-hidden="true" />
        <span className="flex-1 font-serif-zen text-[1.05rem] font-medium tracking-wide">
          Sync across devices
        </span>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id="sign-in-panel-body"
          data-id="sign-in-panel-body"
          className="flex flex-col gap-3"
        >
          <p className="m-0 text-sm text-muted-foreground">
            Optional. Connect to keep your mantras safe and on every device.
          </p>
          <SignInForm layout="inline" idPrefix="sign-in-panel" />
        </div>
      )}
    </section>
  );
}
