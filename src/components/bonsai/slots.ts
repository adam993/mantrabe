// 15 star-slot anchor positions on the user-supplied bonsai illustration
// (assets/bonsai.svg, viewBox 0 0 717.328 827.305). Picked from the
// densest path-coordinate regions so the stars visually "hang" from
// crown foliage, side branches, and lower hanging twigs rather than
// floating in empty sky. Slot indices read roughly top-to-bottom and
// left-to-right.

export const BONSAI_VIEWBOX = { width: 717.328, height: 827.305 };

export interface SlotPosition {
  /** X in the bonsai illustration viewBox (0..717). */
  x: number;
  /** Y in the bonsai illustration viewBox (0..827). */
  y: number;
  /** Length of the thin "thread" line dangling from the branch above
   *  the star. Visually anchors the star to a bonsai part. */
  thread: number;
  /** Region tag; debug-only metadata, no runtime behavior. */
  region: 'crown-left' | 'crown-mid' | 'crown-right' | 'mid-left' | 'mid-right' | 'lower';
}

export const SLOT_COUNT = 15;

export const SLOT_POSITIONS: SlotPosition[] = [
  // Crown — densest foliage area, ~y=80–230.
  { x: 110, y: 130, thread: 16, region: 'crown-left' },
  { x: 200, y: 100, thread: 18, region: 'crown-left' },
  { x: 300, y: 110, thread: 14, region: 'crown-mid' },
  { x: 420, y: 130, thread: 16, region: 'crown-right' },
  { x: 530, y: 150, thread: 18, region: 'crown-right' },

  // Upper-mid — branches springing off the trunk, ~y=200–300.
  { x: 90, y: 240, thread: 22, region: 'mid-left' },
  { x: 250, y: 220, thread: 16, region: 'mid-left' },
  { x: 440, y: 240, thread: 16, region: 'mid-right' },
  { x: 600, y: 260, thread: 18, region: 'mid-right' },

  // Mid-low — dangling side twigs, ~y=380–450.
  { x: 650, y: 390, thread: 22, region: 'mid-right' },
  { x: 140, y: 430, thread: 22, region: 'mid-left' },
  { x: 540, y: 410, thread: 22, region: 'mid-right' },

  // Lower hanging branches near the pot lip, ~y=520–560.
  { x: 220, y: 540, thread: 22, region: 'lower' },
  { x: 380, y: 560, thread: 22, region: 'lower' },
  { x: 500, y: 540, thread: 22, region: 'lower' },
];

if (SLOT_POSITIONS.length !== SLOT_COUNT) {
  throw new Error(
    `SLOT_POSITIONS length (${SLOT_POSITIONS.length}) must equal SLOT_COUNT (${SLOT_COUNT})`,
  );
}
