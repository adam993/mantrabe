# React + shadcn + Tailwind 4 + Supabase migration (2026-04-29)

## Summary

Migrated the Mantrabe app from vanilla JS / hand-rolled CSS to:

- **React 19 + TypeScript** (was: vanilla JS with a custom `h()` DOM helper)
- **Tailwind 4 + shadcn/ui** primitives wired up via `@theme inline` tokens
  that point at the existing zen palette CSS variables. Hex colors only;
  no oklch.
- **Supabase auth + cloud sync** as an *optional* layer on top of local
  storage. The app still runs without an account, and without `.env` the
  Supabase code paths no-op.

The README's "no auth, no cloud, no tracking, no network requests" wording
was replaced — that copy was incorrect once cloud sync became an option.

## What's new

```
src/
  App.tsx                 # screen state + AuthProvider mount
  main.tsx                # createRoot bootstrap
  components/
    ui/                   # shadcn primitives (button, input, textarea,
                          # switch, label, select, dialog, alert-dialog,
                          # dropdown-menu)
    mantra-list.tsx       # list screen + delete confirm
    mantra-editor.tsx     # edit screen
    permission-banner.tsx
    account-menu.tsx      # avatar + sign in/out + sync now
    sign-in-dialog.tsx    # Google / GitHub / email magic link
    footer.tsx
    enso.tsx
    sync-error-toast.tsx
  hooks/
    use-mantras.ts        # local + remote sync orchestration
    use-permission.ts
  lib/
    auth.tsx              # AuthProvider + useAuth
    supabase.ts           # client (null when env vars missing)
    storage.ts            # local + remote read/write/merge
    scheduler.ts          # ported from scheduler.js
    notifications.ts      # ported from notifications.js
    bell-chime.ts         # ported from bell-chime.js
    sounds.ts             # ported from sounds.js
    utils.ts              # cn() helper
  types/mantra.ts
supabase/
  schema.sql              # mantras table + RLS

.env.example              # Supabase env stub
.env.local                # local Supabase URL pre-filled (anon key empty —
                          # paste from dashboard)
```

Generated files moved from `.js` to `.ts`:
- `src/version.js` → `src/version.ts`
- `src/build-info.js` → `src/build-info.ts`

The generators (`scripts/version.cjs`, `scripts/prepare-public-apk.cjs`)
were updated to write the `.ts` versions, and `.gitignore` covers both.

## Sync model

Local storage (Capacitor `Preferences` on native, `localStorage` on web) is
the source of truth at all times.

- On sign-in (or app load with an existing session), `syncWithRemote(userId)`
  fetches the user's remote rows and merges with local using last-write-wins
  on `updatedAt`. Newer local rows are pushed back up.
- Each `saveMantra` writes locally first, then upserts to Supabase if signed
  in. Same for delete.
- Sign-out leaves local data untouched.
- Sync errors surface as a non-blocking banner; local edits always succeed.

## Supabase setup steps the user still needs to do

1. Run `supabase/schema.sql` in the SQL editor for project
   `mantrabesupabase` (`qtakphvcpkxzlgauxyxd`).
2. Paste the anon key into `.env.local` (`VITE_SUPABASE_ANON_KEY=`). The
   URL is already filled in.
3. Enable Email + Google + GitHub providers in Authentication → Providers.
   Add the dev origin `http://localhost:5173` (and any production origin) to
   the OAuth redirect allowlist.
4. **Rotate the DB password.** It was pasted into `CLAUDE.md` and any chat
   history; treat it as compromised.

## Notes on the design migration

- The hand-tuned zen aesthetic (washi-paper noise overlay, hand-drawn enso,
  matcha gold + sage palette) is preserved. Tailwind 4's `@theme inline`
  block aliases the shadcn token names (`--color-primary` etc.) onto the
  existing CSS variables, so all the shadcn primitives pick up the zen
  palette automatically — no token rewriting needed.
- Day-of-week pills, the active-bar accent on cards, and the gentle fade-in
  on screen change are reproduced with utility classes + a small custom
  `screen-fade` keyframe.
- Dark mode follows `prefers-color-scheme` exactly as before.
