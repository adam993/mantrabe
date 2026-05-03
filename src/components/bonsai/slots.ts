// 15 lantern anchor positions on the user-supplied bonsai illustration
// (assets/bonsai.svg, viewBox 0 0 717.328 827.305). Each lantern hangs
// from a thin thread; the `thread` length is tuned per-slot so the top
// of the thread reaches up into actual foliage/branch mass rather than
// dangling from empty sky. Slot order reads roughly top-to-bottom,
// left-to-right.

export const BONSAI_VIEWBOX = { width: 717.328, height: 827.305 };

export interface SlotPosition {
  /** X in the bonsai illustration viewBox (0..717). */
  x: number;
  /** Y in the bonsai illustration viewBox (0..827) — the *center* of
   *  the lantern body. The thread runs from y - body/2 - thread up
   *  to y - body/2 (the top of the lantern). */
  y: number;
  /** Length of the thread above the lantern. Tune per-slot so the
   *  thread terminates inside a real branch/foliage cluster. */
  thread: number;
  /** Region tag; debug-only metadata. */
  region:
    | "crown-left"
    | "crown-mid"
    | "crown-right"
    | "mid-left"
    | "mid-right"
    | "lower";
}

export const SLOT_COUNT = 14;

export const SLOT_POSITIONS: SlotPosition[] = [
  // Crown row — lanterns sit just below the dense top foliage so the
  // thread roots up *into* the canopy.
  { x: 110, y: 200, thread: 60, region: "crown-left" },
  { x: 210, y: 180, thread: 70, region: "crown-left" },
  { x: 320, y: 195, thread: 80, region: "crown-mid" },
  { x: 430, y: 205, thread: 70, region: "crown-right" },
  { x: 545, y: 290, thread: 60, region: "crown-right" },

  // Upper-mid — hanging from the lateral branches.
  { x: 110, y: 320, thread: 60, region: "mid-left" },
  { x: 270, y: 305, thread: 60, region: "mid-left" },
  { x: 460, y: 320, thread: 60, region: "mid-right" },
  { x: 610, y: 340, thread: 50, region: "mid-right" },

  // Mid-low — long-dangling lanterns below outer branches.
  { x: 660, y: 470, thread: 60, region: "mid-right" },
  { x: 160, y: 500, thread: 60, region: "mid-left" },
  { x: 540, y: 480, thread: 50, region: "mid-right" },

  // Lower row — hanging just above the pot lip.
  { x: 230, y: 590, thread: 40, region: "lower" },
  { x: 380, y: 600, thread: 36, region: "lower" },
  // { x: 510, y: 590, thread: 40, region: "lower" },
];

if (SLOT_POSITIONS.length !== SLOT_COUNT) {
  throw new Error(
    `SLOT_POSITIONS length (${SLOT_POSITIONS.length}) must equal SLOT_COUNT (${SLOT_COUNT})`,
  );
}
