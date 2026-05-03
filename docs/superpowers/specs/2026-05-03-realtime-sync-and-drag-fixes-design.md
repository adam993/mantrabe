# Realtime sync + bonsai drag fixes

Date: 2026-05-03
Scope: two independent bug/UX fixes shipped on the same branch as separate
commits.

## Problem statement

1. **Sync deletes don't propagate.** A mantra deleted on web reappears on
   Android. The `Sync` button is a no-op for this case. Users expect
   automatic propagation without thinking about it.
2. **Bonsai drag is broken on Android and laggy on web.** On Android, a
   lantern can't be dragged at all. On web, the dragged lantern visibly
   trails behind the cursor.

## Root causes

### Sync — `syncWithRemote` has no delete path
`src/lib/storage.ts:224` does last-write-wins by `updatedAt` and
unconditionally re-pushes any local row missing from remote. So a row
deleted remotely is treated as "local-only, push it" and gets resurrected
on the very next sync. It also has no realtime channel — sync only runs on
sign-in or when the button is pressed.

### Drag — two distinct issues
- **Android:** the draggable `<g>` in `leaf-slot.tsx:146` has no
  `touch-action: none`. WebView claims the touch for scroll/scale before
  the 6 px activation distance is met, so dnd-kit's TouchSensor never
  fires.
- **Web:** the drag transform is applied as `transform: translate(Xpx,
  Ypx)` directly on the SVG `<g>`. Each pointermove re-renders that group,
  triggering a full SVG repaint of all 15 lanterns, gradients, and the
  bonsai illustration underneath — so the visual lags the cursor.

## Design

### Commit 1 — sync (fix delete propagation + add realtime)

**Tombstone via `remoteSyncedAt`.** The local `Mantra` type already has
`remoteSyncedAt`; we'll use it as the "this row was once mirrored to
remote" flag.

In `syncWithRemote(userId)`:
- Pull remote, build `remoteById`.
- For each local row:
  - If present in remote: keep newer of (local, remote) by `updatedAt`.
  - If absent in remote AND `remoteSyncedAt` is set: it was deleted
    remotely — drop it locally.
  - If absent in remote AND `remoteSyncedAt` is unset: never pushed — keep
    and queue for push.
- Pull-only rows (in remote, not in local) → adopt locally.
- After pushes succeed, stamp `remoteSyncedAt = Date.now()` on the pushed
  rows and re-save locally.

In `pushRemote` callers (`useMantras.saveMantra`): on push success, update
the local row with `remoteSyncedAt` so a single-row push behaves the same
as a full sync would.

**Supabase Realtime subscription.** When a session is active, subscribe to
`postgres_changes` on `public.mantras` filtered by
`user_id=eq.<userId>`. Handlers:
- `INSERT` → upsert into local + state.
- `UPDATE` → upsert (replace by id).
- `DELETE` → remove by id from local + state.

Echo handling: when our own write round-trips, the event arrives with the
same `updatedAt` we wrote. The upsert is idempotent; the no-op is fine.
For deletes we just remove if present.

The Sync button stays — it's the cold-start / reconnect safety net.

**Schema requirement.** Realtime requires the table be in the publication.
`supabase/schema.sql` will include
`alter publication supabase_realtime add table public.mantras;` (idempotent
via `do $$ ... $$`).

### Commit 2 — drag (Android + web)

- Add `touch-action: none` to the LeafSlot `<g>` style. Fixes Android.
- Add `willChange: 'transform'` to the drag style on the active group, and
  hide the original via `opacity: 0` while dragging — the **DragOverlay**
  pattern from dnd-kit. Render a small standalone SVG of just the dragged
  lantern inside `<DragOverlay>`. The overlay is positioned by dnd-kit
  with `position: fixed; transform: translate3d(...)` which is GPU
  composited — no full SVG repaint per frame, no cursor lag.

Sizing the overlay lantern: the bonsai stage has a fixed `max-w-[440px]`,
so we measure the rendered overlay area at drag-start using the source
slot's `getBoundingClientRect()` and render a same-sized SVG snippet of
the lantern.

## Out of scope

- Optimistic-conflict resolution beyond last-write-wins.
- Reconnect logic on flaky networks (Supabase Realtime auto-reconnects;
  good enough for now).
- Drag in `BonsaiList` (the textual list view) — the user reported only
  the bonsai SVG drag.

## Test plan

Sync:
- Two browsers / one phone signed into the same account.
- Delete on web → mantra disappears on phone within ~1 s without pressing
  Sync.
- Edit on phone → web list updates within ~1 s.
- Sign out, delete on web, sign back in → no resurrection.
- Press Sync after offline period → reconciled state.

Drag:
- Android: drag a lantern → it follows finger, drops on another slot,
  swap occurs, persists across reload.
- Web: drag a lantern → no visible cursor lag, snaps cleanly.
- Tap (no drag) still opens the mantra overlay.
