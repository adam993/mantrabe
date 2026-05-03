import { useMemo } from 'react';
import type { Mantra } from '@/types/mantra';
import { SLOT_COUNT } from '@/components/bonsai/slots';

export interface SlotBinding {
  /** Slot index, 0..(SLOT_COUNT-1). */
  index: number;
  /** Mantra bound to this slot, or null if the slot is empty. */
  mantra: Mantra | null;
}

/**
 * Resolves the bonsai's 15 leaf slots from the user's mantras list.
 *
 * Two passes:
 *   1. Place every mantra carrying a valid `slotIndex` (0..14, integer)
 *      into that slot. Conflicts are rare (would only happen on bad sync
 *      state) — the row with the larger `updatedAt` wins; the loser
 *      falls back into the auto bucket.
 *   2. Distribute the auto bucket — anything without a slotIndex, plus
 *      the conflict losers — across the remaining empty slots in
 *      ascending `createdAt` order so older mantras keep stable
 *      positions across renders.
 *
 * Mantras beyond SLOT_COUNT silently overflow (outliers — explicitly
 * deferred per the design spec). Pure: same input ⇒ same output.
 */
export function useSlotMap(mantras: Mantra[]): SlotBinding[] {
  return useMemo(() => {
    const occupants: (Mantra | null)[] = new Array(SLOT_COUNT).fill(null);
    const auto: Mantra[] = [];

    for (const m of mantras) {
      if (
        typeof m.slotIndex === 'number' &&
        Number.isInteger(m.slotIndex) &&
        m.slotIndex >= 0 &&
        m.slotIndex < SLOT_COUNT
      ) {
        const incumbent = occupants[m.slotIndex];
        if (!incumbent) {
          occupants[m.slotIndex] = m;
        } else if (m.updatedAt > incumbent.updatedAt) {
          // New claimant wins; demote the previous occupant.
          occupants[m.slotIndex] = m;
          auto.push(incumbent);
        } else {
          auto.push(m);
        }
      } else {
        auto.push(m);
      }
    }

    auto.sort((a, b) => a.createdAt - b.createdAt);

    let cursor = 0;
    for (const m of auto) {
      while (cursor < SLOT_COUNT && occupants[cursor] !== null) cursor += 1;
      if (cursor >= SLOT_COUNT) break;
      occupants[cursor] = m;
      cursor += 1;
    }

    return occupants.map((mantra, index) => ({ index, mantra }));
  }, [mantras]);
}
