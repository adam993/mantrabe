// Hand-authored 15 leaf-slot positions on the bonsai SVG.
//
// Coordinates are in the bonsai's local viewBox (0..480 horizontal,
// 0..380 vertical). Five slots per foliage cloud (crown / right-mid /
// left-mid). Slot indices read roughly top-to-bottom, left-to-right so
// a brand-new user (no slotIndex overrides yet) sees their first
// mantra populate the most prominent crown slot.

export interface SlotPosition {
  /** X in the bonsai SVG viewBox (0..480). */
  x: number;
  /** Y in the bonsai SVG viewBox (0..380). */
  y: number;
  /** Visual rotation of the leaf/berry in degrees. */
  rotation: number;
  /** Cloud the slot belongs to. Used for visual debug overlays only. */
  region: 'crown' | 'right' | 'left';
}

export const SLOT_COUNT = 15;

export const SLOT_POSITIONS: SlotPosition[] = [
  // Crown cloud (top, most prominent).
  { x: 232, y: 74, rotation: -22, region: 'crown' },
  { x: 248, y: 64, rotation: -6, region: 'crown' },
  { x: 270, y: 62, rotation: 8, region: 'crown' },
  { x: 288, y: 68, rotation: 20, region: 'crown' },
  { x: 296, y: 84, rotation: -2, region: 'crown' },

  // Right-mid cloud.
  { x: 306, y: 194, rotation: -12, region: 'right' },
  { x: 332, y: 190, rotation: 18, region: 'right' },
  { x: 338, y: 206, rotation: -4, region: 'right' },
  { x: 320, y: 200, rotation: 6, region: 'right' },
  { x: 300, y: 204, rotation: 22, region: 'right' },

  // Left-mid cloud.
  { x: 110, y: 170, rotation: -26, region: 'left' },
  { x: 128, y: 166, rotation: 8, region: 'left' },
  { x: 138, y: 180, rotation: 22, region: 'left' },
  { x: 114, y: 182, rotation: -8, region: 'left' },
  { x: 132, y: 156, rotation: 14, region: 'left' },
];

if (SLOT_POSITIONS.length !== SLOT_COUNT) {
  throw new Error(
    `SLOT_POSITIONS length (${SLOT_POSITIONS.length}) must equal SLOT_COUNT (${SLOT_COUNT})`,
  );
}
