import type { EntryKind } from '@/types/mantra';
import { cn } from '@/lib/utils';

interface Props {
  value: EntryKind;
  onChange: (kind: EntryKind) => void;
}

/**
 * Two-segment toggle. The selected segment gets a tinted pill that slides
 * between positions; the tint color is sage for `mantra` and amber for
 * `reminder`, so the visual matches the per-kind accent the cards use in
 * the list view.
 */
export function KindToggle({ value, onChange }: Props) {
  const isReminder = value === 'reminder';
  return (
    <div
      data-id="kind-toggle"
      role="radiogroup"
      aria-label="Entry type"
      className="relative grid grid-cols-2 rounded-md border border-border bg-card p-1"
    >
      <span
        aria-hidden="true"
        data-id="kind-toggle-indicator"
        className={cn(
          'pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-sm transition-[transform,background-color] duration-200 ease-out',
          isReminder ? 'translate-x-full bg-warn/25' : 'translate-x-0 bg-accent/25',
        )}
      />
      <Segment
        kind="mantra"
        active={!isReminder}
        onClick={() => onChange('mantra')}
      >
        Mantra
      </Segment>
      <Segment
        kind="reminder"
        active={isReminder}
        onClick={() => onChange('reminder')}
      >
        Reminder
      </Segment>
    </div>
  );
}

function Segment({
  kind,
  active,
  onClick,
  children,
}: {
  kind: EntryKind;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      data-id={`kind-toggle-${kind}`}
      data-state={active ? 'active' : 'inactive'}
      onClick={onClick}
      className={cn(
        'relative z-[1] cursor-pointer rounded-sm px-3 py-2.5 font-serif-zen text-[1rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
