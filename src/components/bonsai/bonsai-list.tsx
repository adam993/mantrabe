import * as React from 'react';
import type { SlotBinding } from '@/hooks/use-slot-map';
import { EntryRow } from './entry-row';

interface BonsaiListProps {
  slots: SlotBinding[];
  /** Slot index to highlight, or -1 for none. */
  activeSlot: number;
  onHighlight: (index: number) => void;
  onOpen: (slot: SlotBinding) => void;
}

/**
 * Two-column list of all 15 leaf slots beneath the bonsai. Mantras +
 * reminders mixed in slot order. Hovering or tapping a row highlights
 * the corresponding leaf above.
 */
export function BonsaiList({ slots, activeSlot, onHighlight, onOpen }: BonsaiListProps) {
  const counts = React.useMemo(() => {
    let mantras = 0;
    let reminders = 0;
    let empty = 0;
    for (const s of slots) {
      if (s.mantra?.kind === 'mantra') mantras += 1;
      else if (s.mantra?.kind === 'reminder') reminders += 1;
      else empty += 1;
    }
    return { mantras, reminders, empty };
  }, [slots]);

  return (
    <section
      data-id="bonsai-list"
      className="mx-auto w-full max-w-[var(--content-width)] px-2"
    >
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
        <span>
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ backgroundColor: 'var(--primary)' }} />
          {counts.mantras} mantra{counts.mantras === 1 ? '' : 's'}
        </span>
        <span>
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ backgroundColor: 'var(--accent)' }} />
          {counts.reminders} reminder{counts.reminders === 1 ? '' : 's'}
        </span>
        <span className="opacity-70">
          {counts.empty} empty
        </span>
      </div>
      <ul className="m-0 grid grid-cols-1 gap-x-6 gap-y-0.5 p-0 list-none sm:grid-cols-2">
        {slots.map((slot) => (
          <EntryRow
            key={slot.index}
            slot={slot}
            active={slot.index === activeSlot}
            onHighlight={onHighlight}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </section>
  );
}
