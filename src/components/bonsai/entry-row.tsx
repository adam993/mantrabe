import * as React from 'react';
import type { SlotBinding } from '@/hooks/use-slot-map';

const TRUNCATE_AT = 20;

interface EntryRowProps {
  slot: SlotBinding;
  active: boolean;
  /** Hover or single-tap → highlight the matching leaf. */
  onHighlight: (index: number) => void;
  /** Long-press / double-tap on a bound row, or single tap on an empty
   *  row, opens the read overlay (or editor for empty). The page
   *  collapses both into one callback; behavior diverges on `mantra`. */
  onOpen: (slot: SlotBinding) => void;
}

function truncate(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= TRUNCATE_AT) return trimmed;
  return `${trimmed.slice(0, TRUNCATE_AT)}…`;
}

/**
 * One row in the BonsaiList beneath the tree.
 *
 * Single tap: highlights the corresponding leaf (via onHighlight) — the
 *   user can scout without committing to read.
 * Long-press (~450ms) OR double-tap: opens the read overlay (via onOpen).
 * Hover (pointer): same as single-tap.
 *
 * Empty slots collapse the dual interaction: a single tap goes straight
 * to onOpen (which navigates to the editor for that slot).
 */
export function EntryRow({ slot, active, onHighlight, onOpen }: EntryRowProps) {
  const { mantra } = slot;
  const isReminder = mantra?.kind === 'reminder';
  const dotColor = isReminder ? 'var(--accent)' : 'var(--primary)';
  const display = mantra ? truncate(mantra.text) || `(empty ${mantra.kind})` : 'Empty slot';
  const empty = mantra === null;

  const longPressTimer = React.useRef<number | null>(null);
  const lastTapAt = React.useRef<number>(0);

  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerDown = () => {
    if (empty) return; // empty slots open immediately, handled in onClick
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      onOpen(slot);
    }, 450);
  };

  const handlePointerUpOrLeave = () => clearLongPress();

  const handleClick = () => {
    // Empty slot → straight to editor.
    if (empty) {
      onOpen(slot);
      return;
    }
    // Bound: detect double-tap (within 320ms) → open. Otherwise, highlight.
    const now = Date.now();
    if (now - lastTapAt.current < 320) {
      lastTapAt.current = 0;
      clearLongPress();
      onOpen(slot);
      return;
    }
    lastTapAt.current = now;
    onHighlight(slot.index);
  };

  return (
    <li
      data-id={`bonsai-row-${slot.index}`}
      data-bound={!empty}
      data-active={active}
      data-kind={mantra?.kind ?? 'empty'}
      onMouseEnter={() => onHighlight(slot.index)}
      onMouseLeave={() => onHighlight(-1)}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUpOrLeave}
      onPointerCancel={handlePointerUpOrLeave}
      onClick={handleClick}
      className={`group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 font-serif-zen text-[0.95rem] leading-snug transition-colors ${
        active ? 'bg-[var(--primary)]/[0.18]' : 'hover:bg-card'
      } ${empty ? 'italic text-muted-foreground' : ''}`}
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: empty ? 'var(--border-strong)' : dotColor }}
      />
      <span className="truncate">{display}</span>
    </li>
  );
}
