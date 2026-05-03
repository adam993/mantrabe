import * as React from 'react';
import type { Mantra } from '@/types/mantra';
import { SLOT_POSITIONS } from './slots';

interface LeafSlotProps {
  /** 0..14 — index into SLOT_POSITIONS. */
  index: number;
  /** Mantra bound to this slot, or null if the slot is empty. */
  mantra: Mantra | null;
  /** Slot is currently being read or row-highlighted. Drives the glow halo. */
  active: boolean;
  /** Click on a bound slot opens the read overlay; click on an empty slot
   *  opens the editor pre-filled with this slot index. */
  onActivate: (index: number) => void;
}

/**
 * One interactive leaf-or-berry on the bonsai SVG.
 *
 * Rendered in two layers:
 *   1. A radial-gradient glow halo (only when `active`).
 *   2. The leaf/berry shape itself, plus a transparent square "hit target"
 *      sized for fingertips. Clicking the SVG element fires `onActivate`.
 *
 * The DOM element is a native <g role="button" tabIndex={0}> rather than a
 * <button> because Safari (and some Android WebViews) won't let an HTML
 * button host SVG-only children. We re-implement keyboard semantics via
 * onKeyDown to keep enter/space firing the click.
 */
export function LeafSlot({ index, mantra, active, onActivate }: LeafSlotProps) {
  const pos = SLOT_POSITIONS[index];
  if (!pos) throw new Error(`LeafSlot: invalid slot index ${index}`);

  const isReminder = mantra?.kind === 'reminder';
  const isBound = mantra !== null;
  const opacity = isBound ? 1 : 0.7;

  const ariaLabel = !mantra
    ? `Empty slot ${index + 1} — tap to add a mantra here`
    : `${mantra.kind === 'reminder' ? 'Reminder' : 'Mantra'}: ${mantra.text || '(empty)'}`;

  const handleKeyDown = (e: React.KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onActivate(index);
    }
  };

  return (
    <g
      data-id={`bonsai-slot-${index}`}
      data-bound={isBound}
      data-kind={mantra?.kind ?? 'empty'}
      data-active={active}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-pressed={active}
      onClick={() => onActivate(index)}
      onKeyDown={handleKeyDown}
      className="bonsai-slot cursor-pointer outline-none focus-visible:[--slot-focus-opacity:0.55]"
    >
      {/* Glow halo behind the leaf, only when active. */}
      {active && (
        <circle
          cx={pos.x}
          cy={pos.y}
          r={11}
          fill="url(#bonsaiGlow)"
          className="bonsai-slot__glow"
          aria-hidden="true"
        />
      )}

      {/* Focus halo, shown on keyboard focus. */}
      <circle
        cx={pos.x}
        cy={pos.y}
        r={9}
        fill="none"
        stroke="var(--ring)"
        strokeWidth={1.5}
        strokeOpacity="var(--slot-focus-opacity, 0)"
        aria-hidden="true"
      />

      {/* The leaf or berry. */}
      {isReminder ? (
        <>
          <circle cx={pos.x} cy={pos.y} r={3.4} fill="#3f5c44" opacity={opacity} />
          <circle cx={pos.x} cy={pos.y} r={2.4} fill="var(--accent)" opacity={opacity} />
        </>
      ) : (
        <ellipse
          cx={pos.x}
          cy={pos.y}
          rx={5}
          ry={3}
          transform={`rotate(${pos.rotation} ${pos.x} ${pos.y})`}
          fill="var(--primary)"
          opacity={opacity}
        />
      )}

      {/* Transparent hit target — generous for fingertips. */}
      <rect
        x={pos.x - 14}
        y={pos.y - 14}
        width={28}
        height={28}
        fill="transparent"
        aria-hidden="true"
      />
    </g>
  );
}
