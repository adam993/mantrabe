# Mantrabe

A serene cross-platform mantra reminder. Add a phrase, set how often you want
to be reminded, pick the hours and weekdays that suit you, and the app rings
a soft bell chime when the time comes.

You can use Mantrabe without an account — your mantras live on your device.
Sign in (Google, GitHub, or magic-link email) to sync across devices.

Runs on **iOS**, **Android**, and **Linux desktop** (Windows / macOS too).

## Stack

- **Vite + React 19 + TypeScript** for the app itself
- **Tailwind 4 + shadcn/ui** for styling, with a hand-built zen palette
  (washi paper / sumi ink / matcha gold / temple sage) wired in via Tailwind
  theme tokens
- **Supabase** for optional auth + cloud sync (`@supabase/supabase-js`)
- **[Capacitor](https://capacitorjs.com/)** for iOS + Android (uses
  `@capacitor/local-notifications` for OS-level scheduled reminders, so
  reminders fire even when the app is closed)
- **[Electron](https://www.electronjs.org/)** for desktop, with a tray icon
  so the app can keep ringing in the background
- **`localStorage` / Capacitor `Preferences`** as the source of truth.
  Supabase mirrors signed-in users' mantras for cross-device sync.
- **Yarn 4** as the package manager (`nodeLinker: node-modules` —
  Capacitor's native projects expect a real `node_modules` layout)

## Running locally

```bash
yarn install
cp .env.example .env.local   # fill in Supabase URL + anon key (optional)
yarn dev                     # opens at http://localhost:5173
```

If you skip the `.env.local` step the auth UI hides itself and the app runs
in fully-local mode.

Click "Enable" on the permission banner so notifications can fire, then add
a mantra and hit "Ring the bell" to hear the chime.

## Cloud sync (optional)

1. Create a Supabase project and copy the project URL + anon key into
   `.env.local`.
2. Run `supabase/schema.sql` in the SQL editor — it creates the `mantras`
   table and row-level security policies that scope rows to `auth.uid()`.
3. In **Authentication → Providers**, enable Email + Google + GitHub. Set
   the OAuth redirect URL to your app origin (e.g. `http://localhost:5173`
   in dev).

When a user signs in:
- Mantrabe pulls their remote mantras and merges with whatever is local
  (last-write-wins on `updated_at`).
- Subsequent edits write to both local storage and Supabase.
- Sign-out leaves the local copy untouched.

If `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing the sync layer
is no-op'd — the app reverts to local-only mode.

## Building installers

| Target          | Command              | Output                                     |
| --------------- | -------------------- | ------------------------------------------ |
| Linux desktop   | `yarn build:linux`| `release/Mantrabe-*.AppImage`, `*.deb`     |
| Android         | `yarn build:android` | `release/mantrabe-android.apk`           |
| iOS (macOS)     | `yarn build:ios`  | Opens Xcode for `Product > Archive`        |
| Everything      | `yarn build:all`  | Tries all of the above on this machine     |

### Linux desktop (Electron)

```bash
yarn build:linux
```

Builds an AppImage and a `.deb`. Tested on Fedora; needs Node 20+. If you
hit a missing icon on package, run `node scripts/generate-icon.cjs` first
(the build script also calls it automatically).

### Android (Capacitor)

Requirements: JDK 17+ on `PATH`, Android SDK with platform-tools, and
`ANDROID_SDK_ROOT` (or `ANDROID_HOME`) set.

```bash
yarn build:android
```

The first run scaffolds `./android/`. The script also drops `bell.wav` into
`android/app/src/main/res/raw/` so the local-notifications plugin can play
it as the reminder sound.

To install on a connected device:

```bash
adb install -r release/mantrabe-android.apk
```

### iOS (Capacitor)

Building an `.ipa` requires **macOS + Xcode + a paid Apple Developer
certificate**. From a Mac:

```bash
yarn install
yarn build:ios
# then in Xcode: Product > Archive > Distribute App
```

On Linux this script just builds the web assets and prints the steps you'll
need on a Mac.

> Note: iOS officially expects `.caf` files for custom notification sounds.
> Modern iOS handles `.wav` fine in practice, but if the system silently
> falls back to the default sound on your test device, run
> `afconvert -f caff -d ima4 public/bell.wav public/bell.caf` on a Mac and
> swap the filename in `capacitor.config.json`.

## Project layout

```
mantrabe/
├── index.html               # Vite entry
├── src/
│   ├── main.tsx             # bootstrap + AuthProvider
│   ├── App.tsx              # screen state + routing between list/editor
│   ├── components/
│   │   ├── ui/              # shadcn primitives (Button, Dialog, Select, ...)
│   │   ├── mantra-list.tsx
│   │   ├── mantra-editor.tsx
│   │   ├── account-menu.tsx
│   │   ├── sign-in-dialog.tsx
│   │   ├── permission-banner.tsx
│   │   ├── footer.tsx
│   │   └── enso.tsx         # the zen circle SVG
│   ├── hooks/
│   │   ├── use-mantras.ts   # local + remote orchestration
│   │   └── use-permission.ts
│   ├── lib/
│   │   ├── auth.tsx         # AuthProvider + useAuth
│   │   ├── supabase.ts      # client (null when env vars missing)
│   │   ├── storage.ts       # local + remote read/write/sync
│   │   ├── scheduler.ts     # pure: next-occurrences math
│   │   ├── notifications.ts # Capacitor + web/Electron schedulers
│   │   ├── bell-chime.ts    # in-app audio playback (+ Web Audio fallback)
│   │   ├── sounds.ts        # bell sound catalog
│   │   └── utils.ts         # cn() helper
│   ├── types/mantra.ts
│   └── styles.css           # Tailwind 4 + theme tokens
├── supabase/
│   └── schema.sql           # mantras table + RLS policies
├── public/
│   ├── icon.svg
│   └── *.wav                # bundled bell sounds
├── electron/
│   ├── main.cjs
│   └── preload.cjs
├── scripts/
│   ├── version.cjs          # version bump + sync to all platforms
│   ├── prepare-public-apk.cjs
│   ├── generate-bell.cjs
│   ├── generate-icon.cjs
│   ├── build-android.sh
│   ├── build-ios.sh
│   ├── build-linux.sh
│   └── build-all.sh
├── capacitor.config.json
├── tsconfig.json
├── vite.config.ts
└── package.json
```

## How reminders work

- **Native (iOS / Android)**: when you save or edit a mantra, Mantrabe
  computes the next ~50 occurrences per mantra (capped at 60 total to stay
  under iOS's 64-pending limit) and schedules them all with the OS via
  `LocalNotifications`. The OS fires them even if the app has been killed.
- **Desktop / web**: a single `setTimeout` is armed for the soonest upcoming
  occurrence across all enabled mantras. When it fires, Mantrabe shows a
  system notification, plays the bell, and re-arms the timer for the next
  one. The Electron build keeps a tray icon so the renderer stays alive
  after you close the window.
