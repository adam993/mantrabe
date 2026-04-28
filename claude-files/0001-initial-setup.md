# 0001 — Initial setup

Bootstrapped the Mantrabe project from scratch in `/home/arad/damnrad/mantabe/`.
(The folder name is `mantabe` due to a typo when it was created — the app name
itself is "Mantrabe" everywhere in code and config.)

## What was built

A cross-platform mantra reminder app with all data stored locally — no auth,
no cloud, no analytics.

### Stack

- **Vite + vanilla JS / CSS / HTML** — keeps the bundle tiny and dependency
  surface small. Bundle size: ~14 KB JS gzipped, ~6 KB CSS.
- **Capacitor 8** for iOS/Android via `@capacitor/local-notifications` and
  `@capacitor/preferences`.
- **Electron 41** for desktop (Linux primary target, also builds for
  macOS/Windows from this config).

### App features

- Add / edit / delete mantras (text up to 240 chars).
- Per-mantra reminder frequency (presets: every 5–240 min).
- Active hours window (e.g. 09:00–17:00, hour granularity).
- Active weekdays (Mon–Sun toggle pills, defaults to weekdays).
- Per-mantra enable/disable switch (pause without deleting).
- Test-notification button to preview.
- Permission banner that requests notification access only when needed.
- Soft dark theme by default, light theme via `prefers-color-scheme`.

### Notification scheduling

- **Native** (Capacitor): on every state change, the app cancels all pending
  notifications and pre-schedules the next ~50 occurrences per mantra,
  capped at 60 total to stay under iOS's 64-pending limit. The OS handles
  delivery even when the app is killed.
- **Desktop / web**: a single `setTimeout` is armed for the next upcoming
  occurrence across all enabled mantras. Fire → notify → re-arm. Electron
  keeps a tray icon so reminders survive closing the window.

### Bell chime

- `scripts/generate-bell.cjs` synthesizes `public/bell.wav` from scratch:
  six inharmonic partials (660/880/1320/1760/2640/3520 Hz) with
  exponential decay envelopes, a 6 ms attack, and a 200 ms tail fade.
  No external audio assets — fully reproducible from source. ~258 KB.
- `src/bell-chime.js` mirrors the same partials in Web Audio for the
  in-app fallback when HTMLAudioElement playback is restricted.

### Build scripts (in `scripts/`)

| Script               | What it does                                    |
| -------------------- | ----------------------------------------------- |
| `generate-bell.cjs`  | Synthesizes `public/bell.wav` (runs on `postinstall` too) |
| `generate-icon.cjs`  | Rasterizes `public/icon.svg` to `assets/icon.png` (512×512) using a hand-rolled minimal PNG encoder so we don't take a `sharp` dep |
| `build-linux.sh`     | `vite build` + `electron-builder --linux`. Outputs AppImage + .deb |
| `build-android.sh`   | `vite build` + `cap add/sync android` + `gradlew assembleDebug`. Outputs `release/mantrabe-android.apk` |
| `build-ios.sh`       | On macOS: scaffolds + opens Xcode. On Linux: builds web assets and prints macOS instructions |
| `build-all.sh`       | Runs whatever the current OS can handle; tolerates per-target failure |

All shell scripts: `chmod +x`'d. All four are also exposed via `npm run build:*`.

## Verified

- `npm install` completes clean (Capacitor 8.3.1, Electron 41.3.0, Vite 8.0.10).
- `npm run build` produces a working `dist/` (verified via `npm run preview`
  → 200 OK on `/`, `/bell.wav`, and the entry JS chunk; entry JS passes
  `node --check`).
- Scheduler logic tested with three cases (mid-day start, end-of-Friday →
  weekend skip, half-hour frequency) — all return expected times.
- `electron/main.cjs` and `electron/preload.cjs` syntax-check clean. Live
  launch was skipped because this environment has no display server.

## Known caveats

- iOS build needs a Mac with Xcode and a paid Apple Developer cert. The
  `build-ios.sh` script handles everything *up to* the native build on
  Linux, then prints the Mac-side steps.
- Android build requires JDK 17 + Android SDK with `ANDROID_SDK_ROOT` set.
- `assets/icon.png` is a programmatically-generated fallback. For the App
  Store / Play Store, replace it with a designer-made icon before shipping.
- iOS notification sound: `.wav` works on modern iOS but Apple's docs
  prefer `.caf`. If a test device falls back to the default sound, run
  `afconvert -f caff -d ima4 public/bell.wav public/bell.caf` on a Mac.

## Layout

```
mantabe/                       (folder name has a typo — app is "Mantrabe")
├── index.html
├── src/
│   ├── main.js
│   ├── ui.js
│   ├── storage.js
│   ├── scheduler.js
│   ├── notifications.js
│   ├── bell-chime.js
│   └── styles.css
├── public/
│   ├── icon.svg
│   └── bell.wav            (generated)
├── electron/
│   ├── main.cjs
│   └── preload.cjs
├── scripts/
│   ├── generate-bell.cjs
│   ├── generate-icon.cjs
│   ├── build-android.sh
│   ├── build-ios.sh
│   ├── build-linux.sh
│   └── build-all.sh
├── claude-files/
│   └── 0001-initial-setup.md  ← this file
├── capacitor.config.json
├── vite.config.js
├── package.json
├── README.md
└── .gitignore
```
