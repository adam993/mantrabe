# Kind split, multi-step editor, proactive notifications, grass animation (2026-04-29)

Follow-up to the React/Tailwind/Supabase migration earlier today. Five
in-flight requests, all on the same branch:

## 1. data-id attributes everywhere

Every meaningful element now carries a `data-id="<scope>-<purpose>"`. Naming
conventions:

- App shell: `app-shell` (with `data-screen="list"|"edit"`).
- List screen: `list-screen`, `list-topbar`, `list-add-button`,
  `list-empty`, `list-items`, `list-delete-dialog`, etc.
- Per-entry rows: `entry-<id>`, `entry-<id>-bar|text|meta|actions`,
  `entry-<id>-edit|delete|toggle`. Plus `data-kind` and
  `data-enabled` on the row itself.
- Editor: `editor` (with `data-kind` + `data-step`),
  `editor-back`, `editor-next`, `editor-step-1|2|3`,
  `field-<id>`, `field-label-<id>`, `field-frequency-trigger`, etc.
- Banner: `permission-banner` (with `data-state="prompt"|"denied"`),
  `permission-banner-enable`.
- Account: `account-menu-trigger`, `account-menu-sync-now`,
  `account-menu-sign-out`, `account-menu-email`.
- Sign-in dialog: `sign-in-dialog`, `sign-in-dialog-google|github|email-*`.
- Footer: `footer`, `footer-download-android`.
- Grass: `grass`, `grass-blade-<i>` (with `data-layer`).

Use these for E2E selectors, screenshot diffs, and analytics if needed.

## 2. Mantra vs Reminder split

`Mantra.kind: 'mantra' | 'reminder'`. The Supabase schema gains a
`kind text not null default 'mantra' check (kind in ('mantra','reminder'))`
column — apply `supabase/schema.sql` before first deploy.

Local entries created before today are backfilled to `'mantra'` on first
load.

Visual difference is intentionally subtle:

- Mantras keep the temple-sage left bar and the serif (`font-serif-zen`)
  body text — they read as contemplative.
- Reminders use the warm clay/amber `--warn` left bar, a faint
  `bg-[var(--warn)]/[0.04]` card tint, and the sans body text — they read
  as practical.

Both kinds carry a small uppercase tag in the card so the distinction is
explicit.

Placeholders per kind:

- mantra: "e.g. Everything is fine."
- reminder: "e.g. Drink a glass of water."

The `KindToggle` component (`components/kind-toggle.tsx`) is a Switch
flanked by two clickable labels — clicking either label or the switch
flips the kind.

## 3. Multi-step editor

`MantraEditor` is a wizard, not a single form:

- **Step 1**: kind toggle + text textarea (auto-focuses).
- **Step 2**: reminder frequency + sound (with "Ring the bell" preview).
- **Step 3**: active hours + active days.

Header gets `Cancel`/`← Back` on the left, an italic step subtitle, and
`Next`/`Save` on the right. `StepIndicator` (3 dots that grow into a bar
on the active step) sits below the header.

Validation:

- Step 1 → step 2 requires non-empty text. Save button on step 3 is
  always enabled (steps 2-3 have defaults).

Editing existing entries reuses the same wizard. The Delete button only
appears on step 3 of an existing entry.

## 4. Proactive permission banner

The banner now uses primary-colored backgrounds, an icon, and stronger
copy:

- prompt/default: bell icon + "Turn on notifications — to actually hear
  your reminders. Without this, Mantrabe stays silent." + Enable button.
- denied: bell-off icon + "Notifications are blocked. Enable them in your
  system settings so reminders can reach you."

The banner sits above all screens (rendered in `App.tsx` outside the
screen routing), so it's visible from both list and editor. It's not
dismissible — the app is meaningless without notifications.

## 5. Wind-blown grass in the footer

`components/grass.tsx` renders 28 absolutely-positioned blades behind/over
the Android download button. Each blade is a tapered `clip-path`
rectangle anchored at its bottom-center.

- **Idle sway**: CSS keyframe `grass-sway` rotates each blade between
  `±--idle` (3°-7°), with per-blade `animationDuration` (3s-6.5s) and
  negative `animationDelay` so blades aren't synchronized.
- **Cursor wind**: a `useEffect` accumulates the cursor's horizontal
  velocity into a running `velocity` value, decays it 12% per frame, and
  writes the result as `--wind` (clamped to ±22°) on the grass container
  via direct DOM mutation. The keyframes blend `--wind * --intensity`
  into the rotation, so a fast mouse movement produces a clearly
  directional gust on top of the idle breeze. No React re-renders.
- The download button has `bg-background` and `z-[1]` so it stays
  readable; grass is `z-2` and 78% opacity so the tips translucently
  cover the bottom edge of the button without obscuring its text.
- `prefers-reduced-motion: reduce` disables the animation but keeps a
  subtle wind response so cursor still nudges the grass.

## Files touched

```
src/types/mantra.ts                          # +kind
src/lib/storage.ts                           # +kind in row mapping + backfill
src/lib/notifications.ts                     # test-notification kind default
supabase/schema.sql                          # +kind column

src/components/kind-toggle.tsx               # NEW
src/components/step-indicator.tsx            # NEW
src/components/grass.tsx                     # NEW

src/components/mantra-editor.tsx             # rewritten as wizard
src/components/mantra-list.tsx               # per-kind styling + EntryCard
src/components/permission-banner.tsx         # louder copy + iconography
src/components/footer.tsx                    # mounts <Grass />
src/components/sign-in-dialog.tsx            # data-ids
src/components/account-menu.tsx              # data-ids
src/components/sync-error-toast.tsx          # data-id

src/styles.css                               # +grass-blade + grass-sway

src/App.tsx                                  # data-id wrapper
```

## Outstanding

- Run `supabase/schema.sql` (still hasn't been deployed).
- Paste the anon key into `.env.local`.
- Rotate the DB password from CLAUDE.md — still compromised.
