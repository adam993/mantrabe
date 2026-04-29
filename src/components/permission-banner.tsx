import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  permission: NotificationPermission | 'prompt';
  onEnable: () => void;
}

/**
 * Sticky front-of-app banner. Shows whenever notifications aren't granted —
 * the whole app is meaningless without them, so the prompt should be loud.
 *
 * Two variants:
 *  - default / prompt: a primary-colored CTA encouraging the user to enable
 *  - denied: a warn-colored banner pointing at system settings
 */
export function PermissionBanner({ permission, onEnable }: Props) {
  if (permission === 'granted') return null;

  if (permission === 'denied') {
    return (
      <div
        data-id="permission-banner"
        data-state="denied"
        className="mx-5 mt-3 flex items-center gap-3 rounded-lg border border-[var(--warn)] bg-[var(--warn)]/10 px-4 py-3 text-sm shadow-[var(--shadow-soft)]"
        role="alert"
      >
        <BellOff className="h-5 w-5 flex-shrink-0 text-[var(--warn)]" aria-hidden="true" />
        <div className="flex-1">
          <strong className="font-medium">Notifications are blocked.</strong>{' '}
          <span className="text-muted-foreground">
            Enable them in your system settings so reminders can reach you.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      data-id="permission-banner"
      data-state="prompt"
      className="mx-5 mt-3 flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm shadow-[var(--shadow-soft)]"
      role="alert"
    >
      <Bell className="h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
      <div className="flex-1">
        <strong className="font-medium">Turn on notifications</strong>{' '}
        <span className="text-muted-foreground">
          to actually hear your reminders. Without this, Mantrabe stays silent.
        </span>
      </div>
      <Button
        data-id="permission-banner-enable"
        size="sm"
        onClick={onEnable}
      >
        Enable
      </Button>
    </div>
  );
}
