import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { BellRing } from 'lucide-react';
import { playBellChime } from '@/lib/bell-chime';
import type { Mantra } from '@/types/mantra';

interface MantraOverlayProps {
  mantra: Mantra | null;
  /** Controlled open state — overlay is open iff mantra is set. The
   *  parent passes mantra=null to close. */
  onClose: () => void;
}

/**
 * Full-screen sumi-ink overlay that displays one mantra in big serif type
 * with a "ring the bell" affordance. Tap anywhere outside the chime
 * button (or press Escape) to dismiss.
 *
 * Uses Radix Dialog directly rather than the project's shadcn DialogContent
 * because we need a full-bleed overlay, not a centered card.
 */
export function MantraOverlay({ mantra, onClose }: MantraOverlayProps) {
  const open = mantra !== null;

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-id="mantra-overlay-veil"
          className="fixed inset-0 z-50 bg-foreground/[0.92] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          data-id="mantra-overlay-content"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8 outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          onClick={(e) => {
            // Tap on the backdrop area (the Content itself) dismisses.
            // Inner clickable elements stop propagation themselves.
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            {mantra?.kind === 'reminder' ? 'Reminder' : 'Mantra'}
          </DialogPrimitive.Title>
          {mantra && (
            <>
              <p
                data-id="mantra-overlay-text"
                className="font-serif-zen text-2xl md:text-3xl leading-snug text-center max-w-[26ch] text-[var(--bg-elevated)]"
              >
                {mantra.text || `(empty ${mantra.kind})`}
              </p>
              <button
                data-id="mantra-overlay-chime"
                type="button"
                aria-label="Ring the bell"
                onClick={(e) => {
                  e.stopPropagation();
                  void playBellChime(mantra.soundId);
                }}
                className="mt-10 inline-flex h-14 w-14 items-center justify-center rounded-full border border-[var(--primary)] text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-foreground"
              >
                <BellRing className="h-6 w-6" />
              </button>
              <p
                data-id="mantra-overlay-hint"
                className="mt-8 text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground"
              >
                Tap anywhere to dismiss
              </p>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
