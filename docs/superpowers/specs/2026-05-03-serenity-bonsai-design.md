# Serenity Bonsai — Design Spec

**Date:** 2026-05-03
**Status:** Approved (skipped per-section gate, full design committed for review)
**Owner:** Adam Radivojevic

## Goal

Add a "Serenity Bonsai" — a contemplative, ritual-mode visualization of the
user's mantras and reminders. The bonsai is a hand-authored SVG with 15
fixed leaf positions; each bound leaf represents one entry. Tapping a leaf
opens a full-screen sumi-ink overlay that shows the mantra in a big serif.

The bonsai is *ritual*, not management — editing and scheduling stay on the
existing list/editor screens. The bonsai exists so the user can sit with
their mantras visually, not browse a list.

## Non-goals

- Animation of the bonsai itself (it is intentionally still).
- Editing or disabling mantras from the bonsai page (the list/editor own that).
- A different bonsai per user; everyone sees the same hand-authored silhouette.
- Procedurally generated trunk/foliage — handcrafted SVG looks better here.

## User-facing behavior

### Entry point

- A bonsai-icon button appears at the bottom of the mantra list, beneath the
  existing add-mantra controls.
- Tapping it navigates to the bonsai page (a new top-level screen).
- The bonsai page has a back affordance that returns to the list.

### Bonsai page

- Both `enabled` and disabled mantras render on the bonsai. The bonsai is
  contemplative, not the scheduler — the on/off toggle in the list controls
  whether reminders fire, not whether the mantra exists in the user's life.
- Above the fold: the bonsai SVG with 15 leaf slots.
- Below the bonsai: a two-column list of every entry the user has, mantra
  text or reminder text truncated at 20 characters with an ellipsis. Each
  list row has a small color-coded dot indicating its kind.
- Empty slots are visible at opacity 0.7 (decorative-looking but tappable).
- Bound slots render at opacity 1.0.
- The leaf currently being read (or hovered/tapped from the list) gets a
  soft matcha-gold radial-glow halo behind it.

### Leaf shapes per kind

- **Mantra:** matcha-gold (`var(--primary)`) ellipse, ~5×3 viewBox units,
  rotated by the slot's tilt angle (defined per slot).
- **Reminder:** sage-green (`var(--accent)`) circle ~2.4 units, ringed by a
  darker sage stroke (`#3f5c44` light / `#3f5c44` works in dark too).

### Tap behavior

| Surface              | Tap                                               | Long-press / double-tap                |
| -------------------- | ------------------------------------------------- | -------------------------------------- |
| Bound leaf           | Open the read overlay for that mantra            | (same — single tap is enough)          |
| Empty leaf slot      | Navigate to the editor with `screen='edit'`, then on save the mantra is bound to *that* slot | (same as tap) |
| List row (bound)     | Highlight the corresponding leaf with the glow   | Open the read overlay                  |
| List row (empty slot)| Highlight the corresponding empty slot           | Open the editor for that slot          |

Hover (desktop / pointer device) on a list row or a leaf produces the same
glow as tap-row.

### Read overlay

- Full-screen sumi-ink (`#2a241c` ~92% alpha) veil over the page.
- Mantra text in `var(--font-serif)` at 24–28px, centered, wrapped at ~80% width.
- Below the text: a small circular "ring the bell" button (matcha-gold ring
  with a chime glyph or `lucide-react` `BellRing` icon). Tapping it triggers
  the existing `playBellChime()` from `@/lib/bell-chime`.
- Tap anywhere outside the chime button to dismiss. ESC also dismisses on
  desktop.
- Mounted via a Radix `Dialog` (already a dependency) so focus trap, ESC,
  and aria-modal come for free.
- The active-leaf glow on the page underneath is *not* visible while the
  overlay is open (the sumi veil at 92% alpha covers it). On dismiss, the
  glow is still applied to the previously-opened leaf so the user sees a
  visual breadcrumb of the last-read mantra.

### Drag-and-drop reordering

- Powered by `@dnd-kit/core` (new dependency).
- Each leaf slot is both a `Draggable` and a `Droppable`.
- Default leaf order = entries sorted ascending by `createdAt`, mapped onto
  slots `[0..14]`. Drag overrides take precedence over this default.
- Dropping onto an empty slot moves the entry into that slot.
- Dropping onto an occupied slot **swaps** the two entries.
- Drag pickup uses dnd-kit's pointer + touch sensors with a small
  activation distance (~6px) so quick taps still register as "open mantra"
  rather than as a drag start.
- Keyboard a11y: `KeyboardSensor` with arrow-key navigation, space/enter to
  start drag, arrow keys to move, space/enter to drop, esc to cancel.

## Data model

### Mantra type (`src/types/mantra.ts`)

Add a single new optional field:

```ts
export interface Mantra {
  // ...existing fields...
  /** User-overridden bonsai slot index (0–14). When undefined, the
   *  bonsai page falls back to createdAt-sorted ordering. Set when the
   *  user drags a leaf to a new position. Persisted locally and synced. */
  slotIndex?: number;
}
```

### Storage layer (`src/lib/storage.ts`)

- `makeMantra` passes `slotIndex` through unchanged.
- `RemoteRow` adds `slot_index: number | null`.
- `rowToMantra` reads `slot_index` and maps to `slotIndex` (null → undefined).
- `mantraToRow` writes `slot_index = m.slotIndex ?? null`.
- No migration step inside the app — the Supabase migration is a separate
  SQL change committed under `supabase/schema.sql`.

### Supabase schema change

Append to `supabase/schema.sql`:

```sql
alter table public.mantras
  add column if not exists slot_index int
    check (slot_index is null or (slot_index between 0 and 14));
```

No reflow / backfill; existing rows get `null` and use the createdAt fallback.

### Slot resolution (`useSlotMap`)

A new hook in `src/hooks/use-slot-map.ts`:

```ts
export interface SlotBinding {
  index: number;             // 0–14
  mantra: Mantra | null;     // null = empty slot
}

export function useSlotMap(mantras: Mantra[]): SlotBinding[15] {
  // 1. Build a 15-length array of nulls.
  // 2. Place every mantra with an explicit slotIndex into that slot.
  //    If two mantras claim the same index (shouldn't happen, but
  //    defensive against bad sync state), keep the one with the larger
  //    updatedAt and demote the other to "needs auto-slot".
  // 3. Take the remaining (no slotIndex) mantras sorted ascending by
  //    createdAt, and place each into the first empty slot.
  // 4. Treat any slotIndex outside [0..14] (or non-integer) as if it
  //    were undefined — falls into the auto-slot bucket. Defends against
  //    bad sync state and future slot-count changes.
  // 5. Truncate any overflow beyond 15 (outliers — explicitly out of
  //    scope for this design; we'll deal with that later).
}
```

The hook is pure — given the same `mantras` array, it returns the same
result. Memoized on `mantras`.

## Component breakdown

All new files under `src/components/bonsai/`:

```
bonsai/
  bonsai-page.tsx        BonsaiPage — orchestrator, owns selection + overlay state
  bonsai.tsx             Bonsai — the SVG itself: trunk, branches, foliage, ground halo
  leaf-slot.tsx          LeafSlot — per-slot ellipse/berry, glow, draggable+droppable
  mantra-overlay.tsx     MantraOverlay — full-screen sumi veil + serif text + chime
  bonsai-list.tsx        BonsaiList — two-column entry grid below the tree
  entry-row.tsx          EntryRow — one row in the list
  bonsai-button.tsx      BonsaiButton — the entry-point icon button on the list page
  slots.ts               SLOT_POSITIONS: hand-authored 15 slot coordinates + tilt + kind-default
```

`SLOT_POSITIONS` is a constant array: `{ x, y, rotation, region: 'left'|'right'|'crown' }[]`.
The slot positions are tuned visually so that all-mantras and all-reminders
tree silhouettes both look balanced.

### App.tsx integration

`Screen` union grows `'bonsai'`:

```ts
type Screen =
  | { name: 'intro' }
  | { name: 'list' }
  | { name: 'edit'; id: string | null; targetSlot?: number }
  | { name: 'bonsai' };
```

`MantraEditor` accepts an optional `targetSlot` so saves originating from
an empty-slot tap pre-set the new mantra's `slotIndex`.

### useMantras

Unchanged externally. Internally `saveMantra` already sets `updatedAt`;
`slotIndex` rides along the existing local + remote write paths.

## Visual design tokens

All tokens come from existing CSS variables in `src/styles.css`:

| Element                | Token                              | Light hex   |
| ---------------------- | ---------------------------------- | ----------- |
| Page background        | `var(--bg)` (washi paper)          | `#f3ecdf`   |
| Trunk + branches       | `var(--text)` (sumi ink)           | `#2a241c`   |
| Foliage clouds (base)  | `var(--accent)` (temple sage)      | `#6b8e6f`   |
| Foliage clouds (under) | darker sage variant                | `#5a7a5e`   |
| Mantra leaves          | `var(--primary)` (matcha gold)     | `#b08d57`   |
| Reminder berries       | `var(--accent)` ringed by `#3f5c44`| `#6b8e6f`   |
| Active-leaf glow halo  | `var(--primary)` at low alpha      | `#b08d57`   |
| Overlay veil           | `var(--text)` ~92% alpha           | `#2a241c`   |
| Overlay text           | `var(--bg-elevated)`               | `#fbf6ec`   |

The bonsai inherits dark-mode automatically — all colors are token-driven.

## SVG construction notes

- ViewBox: `0 0 480 380` (matches mockup); responsive via `width="100%"`
  with `max-width: 560px`.
- Trunk: tapered effect achieved by stacking two `<path>`s on the same
  curve — a 9px stroke at 95% opacity for the body, a 3px stroke at 55%
  opacity on top to suggest a brush-tail highlight.
- Branches: same two-stroke trick at 6/2px (mid) and 4.5px (twigs).
- Foliage clouds: three layered `<ellipse>`s per cloud (under-shade,
  base, top-light highlight). Three clouds total: left-mid, right-mid,
  crown.
- Ground halo: a single radial-gradient ellipse — a soft warm glow under
  the pot suggesting a tatami floor without literally drawing one.
- Pot: tapered `<path>` with a linear gradient and a thin shadow line at
  the rim for depth.

## Read overlay implementation

- `MantraOverlay` is a `Radix Dialog` rooted at the document body.
- Backdrop: a single `<div>` styled with `bg-foreground/92` (sumi).
- Content: centered flex column. Mantra text in `font-serif-zen` at
  `text-2xl md:text-3xl`. Below it, a circular icon-button using
  `Button` variant `outline` with custom border in `var(--primary)`.
- The chime button calls `playBellChime()` from `@/lib/bell-chime`.
  `playBellChime()` is already used elsewhere; no new sound wiring.
- Active-leaf glow continues underneath the overlay (it's part of the
  page, not the overlay), so on dismiss the glow is still visible.

## Mobile / responsive

- Below `--content-width` (540px) the SVG fills width; foliage and leaves
  scale proportionally — no separate mobile composition.
- Hit targets: each `LeafSlot` renders an invisible `<rect>` at ~24×24
  units centered on the leaf for touch. Visual leaf stays small.
- Bottom inset: bonsai page respects `var(--safe-bottom)` so the chime
  button on Android doesn't tuck under the system nav.
- `prefers-reduced-motion`: the only animation on the page is the active-
  leaf glow's slow pulse. Under reduced motion the glow is rendered at
  steady max alpha (no pulse).

## Accessibility

- `Bonsai` SVG has `role="img"` and `aria-label="Your serenity bonsai with N mantras and M reminders"`.
- Each `LeafSlot` is a `<button>` element with `aria-label` describing
  its content ("Mantra: I am enough" / "Empty slot").
- Drag uses dnd-kit's `KeyboardSensor` for full keyboard a11y.
- Read overlay is a Radix Dialog: focus trap, ESC dismiss, aria-modal,
  initial focus on the chime button.
- List row + leaf glow are the same `aria-current="true"` state on the
  matching button — assistive tech can announce the linkage.

## Testing strategy

- **`useSlotMap` unit test:** all-empty mantras → 15 nulls. Mix of
  manual + auto slots → manual ones honored, auto fills holes in
  createdAt order. Conflict (two mantras claim same slot) → newer
  `updatedAt` wins, older falls back to auto.
- **Drag swap test:** simulate dnd-kit `onDragEnd` for swap onto
  occupied + drop onto empty + drop on self — verify `slotIndex`
  values written.
- **Editor target slot test:** opening editor with `targetSlot=7`,
  saving — newly created mantra has `slotIndex=7`.
- **Component smoke test:** `BonsaiPage` renders without throwing for
  0, 1, 10, 15 mantras; tap on bound leaf opens overlay; ESC closes.
- **No real Supabase in tests** — local storage path only; sync layer
  is integration-tested separately.

## Out of scope (explicitly deferred)

- Outliers above 15 entries — the design caps at 15 by silently
  dropping overflow; we'll revisit when we have data on real users.
- Bonsai animation (sway, gusts, falling leaves).
- Day/night seasonal variation of the bonsai.
- Sharing / public bonsai.
- Editing schedule/disable from the read overlay.

## Open questions

None blocking.

## Implementation order

1. Add `slotIndex` to `Mantra` type + storage + Supabase schema.
2. Add `@dnd-kit/core` dependency.
3. Build `slots.ts` (the 15 slot positions) + `useSlotMap` hook + tests.
4. Build `Bonsai` SVG + `LeafSlot` (no drag yet).
5. Wire up `BonsaiPage` skeleton + screen routing in `App.tsx`.
6. Add `BonsaiButton` to the list page.
7. Build `MantraOverlay` (read state).
8. Add `BonsaiList` + `EntryRow` and the row↔leaf glow linkage.
9. Wire up dnd-kit drag/swap.
10. Editor `targetSlot` plumbing.
11. Reduced-motion + a11y polish.
12. Manual QA on web + Android, then ship.
