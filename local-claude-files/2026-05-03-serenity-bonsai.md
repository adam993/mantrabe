# 2026-05-03 — Serenity Bonsai (ritual page)

## What shipped

A new "ritual" screen reachable from a "Sit with your bonsai" button at
the bottom of the mantra list. Renders the user's mantras + reminders
on a hand-authored SVG bonsai with 15 fixed leaf slots.

- Mantras → matcha-gold ellipse leaves.
- Reminders → sage-green berries with a darker ring.
- Empty slots render at opacity 0.7; bound at 1.0; the active leaf gets
  a soft matcha-gold radial-glow halo (slow pulse, frozen under
  prefers-reduced-motion). The bonsai itself is intentionally still.
- Tap a bound leaf → full-screen sumi-ink overlay with the mantra in
  big serif, plus a "ring the bell" chime button.
- Tap an empty leaf → editor pre-filled with that slot index; on save
  the new mantra claims that slot.
- Below the tree: a two-column list of all 15 slots (mantra/reminder
  text truncated at 20 chars). Hover/tap a row → highlights the
  matching leaf. Long-press (~450ms) or double-tap → opens the overlay.
- Drag-to-reorder via `@dnd-kit/core`. Drop on empty slot = move;
  drop on occupied slot = swap. 6px activation distance keeps tap and
  drag cleanly separate.

## Files

```
docs/superpowers/specs/2026-05-03-serenity-bonsai-design.md   design spec
src/types/mantra.ts                                            +slotIndex
src/lib/storage.ts                                             slot_index in/out
supabase/schema.sql                                            +slot_index column
src/hooks/use-slot-map.ts                                      slot resolution
src/components/bonsai/slots.ts                                 15 slot positions
src/components/bonsai/bonsai.tsx                               main SVG
src/components/bonsai/leaf-slot.tsx                            interactive leaf+drag
src/components/bonsai/bonsai-page.tsx                          orchestrator
src/components/bonsai/bonsai-list.tsx                          two-column list
src/components/bonsai/entry-row.tsx                            row long-press logic
src/components/bonsai/mantra-overlay.tsx                       sumi-ink reader
src/components/bonsai/bonsai-icon.tsx                          entry-button glyph
src/components/bonsai/bonsai-button.tsx                        list-page entry
src/App.tsx                                                    'bonsai' screen + targetSlot
src/components/mantra-list.tsx                                 +bonsai button render
src/components/mantra-editor.tsx                               +targetSlot prop
src/styles.css                                                 glow keyframes
```

## Schema migration (Supabase)

The new column is at the bottom of `supabase/schema.sql`:

```sql
alter table public.mantras
  add column if not exists slot_index int
    check (slot_index is null or (slot_index between 0 and 14));
```

Existing rows get `NULL`; the bonsai page falls back to a
`createdAt`-sorted ordering for any mantra without an explicit slot.
Run that snippet once in the Supabase SQL editor to apply.

## Brainstorm trail

The visual companion mockups live in `.superpowers/brainstorm/` and
should not be committed (added to `.gitignore`). Useful as a record
of decisions made during the design conversation:

- Plan D (standalone ritual page) over A/B/C
- 15 fixed leaf slots
- Mantras = gold leaves, reminders = sage berries
- Read overlay B (full-screen sumi veil) with chime button
- Completely still bonsai; only the active-leaf glow pulses
- Default order = createdAt, drag to reposition with swap
- @dnd-kit/core (~30 KB) chosen for accessible drag

## Outstanding / deferred

- Outliers above 15 entries silently overflow today — the spec defers
  the long tail.
- No unit tests in the project yet, so `useSlotMap` and the swap logic
  are covered only by typecheck + manual QA. If/when a runner is
  added, the design spec lists the cases to cover.
- Custom keyboard coordinate-getter for snap-to-slot drag (default is
  25px per arrow-key press).
- The list cards on the existing mantra list use clay (`--warn`) for
  reminders, while the bonsai uses sage. The user explicitly chose
  sage during brainstorming; flagging here in case it reads as
  inconsistent in real use.
