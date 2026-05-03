import * as React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
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

/** dnd-kit ID convention: every slot is registered as a draggable
 *  (when bound) and a droppable (always). The id is the slot index. */
export function slotDndId(index: number): string {
  return `bonsai-slot-${index}`;
}

const STAR_RADIUS_OUTER = 14;
const STAR_RADIUS_INNER = 5.6;

/**
 * Generates the "d" attribute for a 5-point star centered at origin.
 * Memoized as a constant since all stars share the same shape; we just
 * translate the parent group to position individual stars.
 */
function starPath(rOuter: number, rInner: number): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2; // start at top
    const r = i % 2 === 0 ? rOuter : rInner;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return `M${points.join(' L')} Z`;
}

const STAR_D = starPath(STAR_RADIUS_OUTER, STAR_RADIUS_INNER);

/**
 * One interactive star on the bonsai illustration overlay.
 *
 *   - Mantra ⇒ filled gold star
 *   - Reminder ⇒ filled sage star (slightly smaller-feeling)
 *   - Empty   ⇒ outline-only muted star at lower opacity
 *   - Active  ⇒ a pulsing matcha-gold halo behind the star
 *
 * Each star also dangles a thin thread from a phantom branch above it,
 * to suggest "hanging." The thread length comes from SLOT_POSITIONS so
 * we can tune it per-anchor when one slot needs to reach further up to
 * a branch.
 *
 * Uses CSS variables via inline `style` (not the `fill` attribute) so
 * the colors resolve reliably in Safari and Android WebView, which
 * don't always honour `fill="var(--token)"`.
 */
export function LeafSlot({ index, mantra, active, onActivate }: LeafSlotProps) {
  const pos = SLOT_POSITIONS[index];
  if (!pos) throw new Error(`LeafSlot: invalid slot index ${index}`);

  const dndId = slotDndId(index);
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({ id: dndId, disabled: !mantra });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: dndId });

  const setNodeRef = React.useCallback(
    (node: SVGGElement | null) => {
      setDragRef(node as unknown as HTMLElement | null);
      setDropRef(node as unknown as HTMLElement | null);
    },
    [setDragRef, setDropRef],
  );

  const isReminder = mantra?.kind === 'reminder';
  const isBound = mantra !== null;

  const ariaLabel = !mantra
    ? `Empty slot ${index + 1} — tap to add a mantra here`
    : `${mantra.kind === 'reminder' ? 'Reminder' : 'Mantra'}: ${mantra.text || '(empty)'}`;

  const handleKeyDown = (e: React.KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onActivate(index);
    }
  };

  const dragStyle: React.CSSProperties = transform
    ? {
        transform: `translate(${transform.x}px, ${transform.y}px)`,
        zIndex: 50,
        cursor: 'grabbing',
      }
    : {};

  // Star fill + stroke. Inline `style` so var(--*) resolves reliably.
  let starStyle: React.CSSProperties;
  if (!isBound) {
    starStyle = {
      fill: 'transparent',
      stroke: 'var(--text-muted)',
      strokeWidth: 1.4,
      opacity: 0.62,
    };
  } else if (isReminder) {
    starStyle = {
      fill: 'var(--accent)',
      stroke: 'var(--accent)',
      strokeWidth: 0.4,
      opacity: 1,
    };
  } else {
    starStyle = {
      fill: 'var(--primary)',
      stroke: 'var(--primary-press)',
      strokeWidth: 0.4,
      opacity: 1,
    };
  }

  return (
    <g
      ref={setNodeRef}
      style={dragStyle}
      {...attributes}
      {...listeners}
      data-id={`bonsai-slot-${index}`}
      data-bound={isBound}
      data-kind={mantra?.kind ?? 'empty'}
      data-active={active}
      data-dragging={isDragging}
      data-drop-target={isOver}
      aria-label={ariaLabel}
      onClick={() => {
        if (isDragging) return;
        onActivate(index);
      }}
      onKeyDown={handleKeyDown}
      className="bonsai-slot outline-none focus-visible:[--slot-focus-opacity:0.6]"
    >
      {/* Hanging thread from a phantom branch above the star. */}
      <line
        x1={pos.x}
        y1={pos.y - STAR_RADIUS_OUTER - pos.thread}
        x2={pos.x}
        y2={pos.y - STAR_RADIUS_OUTER + 1}
        style={{ stroke: 'var(--text-muted)', strokeWidth: 1, opacity: 0.45 }}
        aria-hidden="true"
      />

      {/* Active halo, behind the star. */}
      {active && (
        <circle
          cx={pos.x}
          cy={pos.y}
          r={STAR_RADIUS_OUTER * 1.85}
          fill="url(#bonsaiGlow)"
          className="bonsai-slot__glow"
          aria-hidden="true"
        />
      )}

      {/* Drop-target ring, when another star is being dragged over. */}
      {isOver && !isDragging && (
        <circle
          cx={pos.x}
          cy={pos.y}
          r={STAR_RADIUS_OUTER * 1.4}
          fill="none"
          style={{ stroke: 'var(--primary)', strokeOpacity: 0.6, strokeWidth: 1.2 }}
          aria-hidden="true"
        />
      )}

      {/* Focus ring for keyboard nav. */}
      <circle
        cx={pos.x}
        cy={pos.y}
        r={STAR_RADIUS_OUTER * 1.45}
        fill="none"
        stroke="var(--ring)"
        strokeWidth={1.4}
        style={{ strokeOpacity: 'var(--slot-focus-opacity, 0)' }}
        aria-hidden="true"
      />

      {/* The star itself. */}
      <path
        d={STAR_D}
        transform={`translate(${pos.x} ${pos.y})`}
        style={starStyle}
      />

      {/* Generous transparent hit target for fingertips. */}
      <rect
        x={pos.x - 28}
        y={pos.y - 28}
        width={56}
        height={56}
        fill="transparent"
        aria-hidden="true"
      />
    </g>
  );
}
