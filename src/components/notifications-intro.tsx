import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Enso } from '@/components/enso';

interface Props {
  onEnable: () => Promise<void> | void;
  onDecline: () => void;
  showDecline: boolean;
}

/**
 * First-run welcome screen on Android. The whole app is silent without
 * notifications, so we ask up front before showing anything else.
 *
 * `showDecline` is intentionally Android-only: web users get a passive
 * banner instead of a hard wall.
 */
export function NotificationsIntro({ onEnable, onDecline, showDecline }: Props) {
  return (
    <main
      data-id="intro-screen"
      className="screen-fade mx-auto flex w-full max-w-[var(--content-width)] flex-1 flex-col items-center justify-center gap-6 p-6 text-center"
    >
      <div className="relative flex items-center justify-center text-accent">
        <Enso strong size={120} className="opacity-70" />
        <Bell
          className="absolute h-10 w-10 text-primary"
          aria-hidden="true"
        />
      </div>

      <h1
        data-id="intro-title"
        className="m-0 max-w-[20ch] font-serif-zen text-[1.7rem] font-medium leading-tight tracking-wide"
      >
        Turn on notifications to actually hear&hellip;
      </h1>

      <p
        data-id="intro-body"
        className="m-0 max-w-[34ch] text-muted-foreground"
      >
        Mantrabe rings throughout the day so your mantras and reminders find
        you. Without permission, the app stays silent.
      </p>

      <div className="mt-2 flex w-full max-w-[24rem] flex-col gap-3">
        <Button
          data-id="intro-enable"
          size="lg"
          onClick={() => void onEnable()}
        >
          Turn on notifications
        </Button>

        {showDecline && (
          <button
            type="button"
            data-id="intro-decline"
            onClick={onDecline}
            className="cursor-pointer px-2 py-3 text-[0.85rem] leading-snug text-muted-foreground/80 transition-colors hover:text-foreground"
          >
            No thanks, I&rsquo;m actually superman and will remember everything
            myself. I don&rsquo;t actually know why I installed this app, lol.
          </button>
        )}
      </div>
    </main>
  );
}
