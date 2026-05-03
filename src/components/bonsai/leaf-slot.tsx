import * as React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { Mantra } from '@/types/mantra';
import { SLOT_POSITIONS } from './slots';

interface LeafSlotProps {
  /** 0..14 — index into SLOT_POSITIONS. */
  index: number;
  mantra: Mantra | null;
  active: boolean;
  onActivate: (index: number) => void;
}

/** dnd-kit ID convention: every slot is registered as a draggable
 *  (when bound) and a droppable (always). */
export function slotDndId(index: number): string {
  return `bonsai-slot-${index}`;
}

// Lantern dimensions (in bonsai viewBox units). The body is a tapered
// vertical pill — wider at the equator, narrower at top + bottom — to
// read as a paper chochin. Top cap is a wooden ring; bottom dangles a
// small tassel.
export const LANTERN_WIDTH = 32;
export const LANTERN_HEIGHT = 38;
export const CAP_HEIGHT = 5;
export const TASSEL = 6;
const BOTTOM_CAP_HEIGHT = 2.6;

/**
 * SVG path for a chochin lantern body, centered on origin. Tapered so
 * the silhouette reads as a paper lantern rather than a generic pill.
 */
function lanternBodyPath(w: number, h: number): string {
  const halfW = w / 2;
  const halfH = h / 2;
  const taper = halfW * 0.15; // how much narrower at top/bottom vs middle
  return [
    `M ${-(halfW - taper)},${-halfH}`,
    `Q ${-halfW},${-halfH * 0.65} ${-halfW},${0}`,
    `Q ${-halfW},${halfH * 0.65} ${-(halfW - taper)},${halfH}`,
    `L ${halfW - taper},${halfH}`,
    `Q ${halfW},${halfH * 0.65} ${halfW},${0}`,
    `Q ${halfW},${-halfH * 0.65} ${halfW - taper},${-halfH}`,
    'Z',
  ].join(' ');
}

const LANTERN_BODY_D = lanternBodyPath(LANTERN_WIDTH, LANTERN_HEIGHT);

interface LanternBodyProps {
  mantra: Mantra | null;
  active: boolean;
  /** Center of the lantern body in the parent SVG's coordinate system. */
  cx: number;
  cy: number;
  /** Suffix for gradient ids — must be unique per concurrent instance.
   *  When the same lantern is shown in both LeafSlot and DragOverlay
   *  at once, both must use distinct ids or fills cross-bind. */
  idKey: string;
}

/**
 * Pure visual: the lantern itself (cap, paper body, bands, bottom cap,
 * tassel) and its radial-gradient defs. No thread, no hit target, no
 * dnd-kit hooks — those live in LeafSlot. Reused by the DragOverlay so
 * the dragged copy looks identical to the source.
 *
 * Colors go through inline style props (not the SVG fill attribute) so
 * CSS variables resolve in Safari / Android WebView, which don't always
 * honour `fill="var(--token)"`.
 */
export function LanternBody({ mantra, active, cx, cy, idKey }: LanternBodyProps) {
  const isReminder = mantra?.kind === 'reminder';
  const isBound = mantra !== null;
  const lanternTopY = cy - LANTERN_HEIGHT / 2 - CAP_HEIGHT;

  const bodyFillId = isBound
    ? isReminder
      ? `lanternFillSage-${idKey}`
      : `lanternFillGold-${idKey}`
    : undefined;

  let glowClass = '';
  if (isBound) {
    if (active) glowClass = 'lantern-active';
    else glowClass = isReminder ? 'lantern-lit-sage' : 'lantern-lit';
  }

  const capStroke = 'var(--text)';
  const bandStroke = isBound
    ? isReminder
      ? 'rgba(40, 60, 45, 0.55)'
      : 'rgba(80, 50, 20, 0.55)'
    : 'var(--text-muted)';
  const bodyStroke = isBound
    ? isReminder
      ? 'rgba(40, 60, 45, 0.65)'
      : 'rgba(80, 50, 20, 0.65)'
    : 'var(--text-muted)';

  return (
    <g className={glowClass}>
      {isBound && bodyFillId && (
        <defs>
          {isReminder ? (
            <radialGradient id={bodyFillId} cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#cfe6c6" />
              <stop offset="55%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="#4f6d52" />
            </radialGradient>
          ) : (
            <radialGradient id={bodyFillId} cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#ffe6a8" />
              <stop offset="55%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="#7a5a26" />
            </radialGradient>
          )}
        </defs>
      )}

      <rect
        x={cx - 5}
        y={lanternTopY}
        width={10}
        height={CAP_HEIGHT}
        rx={1}
        ry={1}
        style={{
          fill: isBound ? 'var(--text)' : 'transparent',
          stroke: capStroke,
          strokeWidth: 1,
          opacity: isBound ? 0.9 : 0.55,
        }}
      />

      <path
        d={LANTERN_BODY_D}
        transform={`translate(${cx} ${cy})`}
        style={{
          fill: isBound && bodyFillId ? `url(#${bodyFillId})` : 'transparent',
          stroke: bodyStroke,
          strokeWidth: 1.2,
          opacity: isBound ? 1 : 0.55,
        }}
      />

      {isBound && (
        <>
          {[-LANTERN_HEIGHT * 0.25, 0, LANTERN_HEIGHT * 0.25].map((dy, i) => {
            const halfW = LANTERN_WIDTH / 2;
            const bandHalf = halfW * (1 - Math.abs(dy / LANTERN_HEIGHT) * 0.3);
            return (
              <line
                key={i}
                x1={cx - bandHalf}
                y1={cy + dy}
                x2={cx + bandHalf}
                y2={cy + dy}
                style={{ stroke: bandStroke, strokeWidth: 0.9 }}
              />
            );
          })}
        </>
      )}

      <rect
        x={cx - 3.5}
        y={cy + LANTERN_HEIGHT / 2}
        width={7}
        height={BOTTOM_CAP_HEIGHT}
        rx={0.6}
        ry={0.6}
        style={{
          fill: isBound ? 'var(--text)' : 'transparent',
          stroke: capStroke,
          strokeWidth: 0.9,
          opacity: isBound ? 0.9 : 0.55,
        }}
      />

      {isBound && (
        <line
          x1={cx}
          y1={cy + LANTERN_HEIGHT / 2 + BOTTOM_CAP_HEIGHT}
          x2={cx}
          y2={cy + LANTERN_HEIGHT / 2 + BOTTOM_CAP_HEIGHT + TASSEL}
          style={{ stroke: 'var(--text)', strokeWidth: 1, opacity: 0.85 }}
        />
      )}
    </g>
  );
}

/**
 * One interactive paper lantern hanging from the bonsai. Combines a
 * thread + knot + hit target with a `LanternBody` visual. Registers
 * as both a draggable and a droppable so swaps work between any two
 * slots regardless of whether the destination is occupied.
 *
 * Drag movement is rendered by the `DragOverlay` in BonsaiPage, not by
 * applying the dnd-kit `transform` here. CSS transforms on SVG `<g>`
 * elements force a full SVG repaint per pointer-move (no GPU layer in
 * SVG-land), which is what was making the dragged lantern lag behind
 * the cursor. The overlay lives in plain HTML and is composited by the
 * GPU. While this slot is being dragged, we hide it via opacity so the
 * overlay is the only visible copy.
 *
 * `touchAction: 'none'` is critical for Android: without it, WebView
 * claims the touch for scroll before dnd-kit's 6 px activation
 * distance is met, and the drag never starts.
 */
export function LeafSlot({ index, mantra, active, onActivate }: LeafSlotProps) {
  const pos = SLOT_POSITIONS[index];
  if (!pos) throw new Error(`LeafSlot: invalid slot index ${index}`);

  const dndId = slotDndId(index);
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
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

  const isBound = mantra !== null;

  const ariaLabel = !mantra
    ? `Empty lantern slot ${index + 1} — tap to add a mantra here`
    : `${mantra.kind === 'reminder' ? 'Reminder' : 'Mantra'}: ${mantra.text || '(empty)'}`;

  const handleKeyDown = (e: React.KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onActivate(index);
    }
  };

  // Top of the lantern body; thread starts here and climbs `pos.thread` up.
  const lanternTopY = pos.y - LANTERN_HEIGHT / 2 - CAP_HEIGHT;
  const knotY = lanternTopY - pos.thread;

  const threadStroke = isBound ? 'rgba(60, 45, 25, 0.55)' : 'var(--text-muted)';

  const slotStyle: React.CSSProperties = {
    touchAction: 'none',
    ...(isDragging ? { opacity: 0 } : {}),
  };

  return (
    <g
      ref={setNodeRef}
      style={slotStyle}
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
      {/* Thread from the knot up to just above the lantern cap. */}
      <line
        x1={pos.x}
        y1={knotY + 1}
        x2={pos.x}
        y2={lanternTopY}
        style={{ stroke: threadStroke, strokeWidth: 1.2 }}
        aria-hidden="true"
      />

      {/* Knot — small dark dot at the top of the thread, "tied" to a branch. */}
      <circle
        cx={pos.x}
        cy={knotY}
        r={2.2}
        style={{ fill: 'var(--text)', opacity: isBound ? 0.85 : 0.55 }}
        aria-hidden="true"
      />

      {/* Drop-target ring while another lantern is dragged over. */}
      {isOver && !isDragging && (
        <circle
          cx={pos.x}
          cy={pos.y}
          r={LANTERN_HEIGHT * 0.7}
          fill="none"
          style={{ stroke: 'var(--primary)', strokeOpacity: 0.6, strokeWidth: 1.6 }}
          aria-hidden="true"
        />
      )}

      {/* Focus ring for keyboard nav. */}
      <rect
        x={pos.x - LANTERN_WIDTH / 2 - 4}
        y={pos.y - LANTERN_HEIGHT / 2 - 4}
        width={LANTERN_WIDTH + 8}
        height={LANTERN_HEIGHT + 8}
        rx={LANTERN_WIDTH / 2 + 4}
        ry={LANTERN_HEIGHT / 2 + 4}
        fill="none"
        stroke="var(--ring)"
        strokeWidth={1.6}
        style={{ strokeOpacity: 'var(--slot-focus-opacity, 0)' }}
        aria-hidden="true"
      />

      <LanternBody mantra={mantra} active={active} cx={pos.x} cy={pos.y} idKey={String(index)} />

      {/* Generous transparent hit target for fingertips. */}
      <rect
        x={pos.x - LANTERN_WIDTH / 2 - 8}
        y={pos.y - LANTERN_HEIGHT / 2 - 8}
        width={LANTERN_WIDTH + 16}
        height={LANTERN_HEIGHT + 16}
        fill="transparent"
        aria-hidden="true"
      />
    </g>
  );
}
