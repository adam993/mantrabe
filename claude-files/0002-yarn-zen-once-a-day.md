# 0002 — Yarn 4, church bell sound, zen restyle, once-a-day mode

Follow-up to 0001. Four changes in one batch.

## 1. Sound: church_bell.wav replaces the synthesized bell

User dropped `public/church-bell.mp3` (114 KB, 256 kbps, 48 kHz JntStereo)
into the repo. Converted with `ffmpeg -ac 1 -ar 44100 -acodec pcm_s16le`
to `public/church_bell.wav` (314 KB, mono 16-bit PCM, 44.1 kHz, 3.6 s).

Renamed the WAV with an underscore (`church_bell.wav` not `church-bell.wav`)
because Android resource names in `res/raw/` cannot contain dashes. Same
filename now works on both platforms.

Wiring:
- `capacitor.config.json`: `"sound": "church_bell.wav"`, icon color updated
  to the new gold (`#b08d57`).
- `src/bell-chime.js`: HTMLAudioElement loads `${BASE_URL}church_bell.wav`.
  Web Audio fallback (synthesized bell) kept for autoplay-restricted
  contexts.
- `scripts/build-android.sh`: copies `public/church_bell.wav` to
  `android/app/src/main/res/raw/church_bell.wav` on every run.
- `scripts/build-ios.sh`: copies into `ios/App/App/public/church_bell.wav`
  (and updated the Linux-side instructions to match).
- Removed the `postinstall: node scripts/generate-bell.cjs` hook and the
  `gen-bell` npm script. `scripts/generate-bell.cjs` is kept as a legacy
  utility (still works, just isn't run automatically).
- Deleted the now-unused `public/bell.wav`.

## 2. Package manager: npm → Yarn 4

Switched to **Yarn 4.5.3** with `nodeLinker: node-modules`.

**Why not PnP?** Capacitor's Android Gradle build hard-codes paths like
`../node_modules/@capacitor/android/capacitor` in `build.gradle`, and the
iOS Pods setup likewise expects `@capacitor/*` under `node_modules`. Strict
PnP makes those paths empty, so the native builds break. The
`node-modules` linker still gives us yarn 4 (lockfile, plugins, faster
installs) but writes a real `node_modules/` layout that Capacitor and
electron-builder can both read.

How it's set up:
- Yarn 4.5.3 binary committed to `.yarn/releases/yarn-4.5.3.cjs` so the
  project bootstraps without needing corepack to fetch from
  `repo.yarnpkg.com` (which timed out during setup).
- `.yarnrc.yml` pins `yarnPath` to that file and sets `nodeLinker:
  node-modules` and `enableTelemetry: false`.
- `package.json` declares `"packageManager": "yarn@4.5.3"`.
- `.gitignore` allows `.yarn/releases/`, `.yarn/patches/`, `.yarn/plugins/`
  but ignores caches and `.pnp.*`.
- `package-lock.json` deleted; `yarn.lock` committed.
- All build scripts and README replaced `npm run …` with `yarn …` and
  `npx <bin>` with `yarn <bin>`.

`corepack enable` is enough on a fresh machine — running `yarn` in the
project then transparently uses the pinned 4.5.3 binary.

## 3. Zen Buddhist restyle

Full rewrite of `src/styles.css` and minor touches in `src/ui.js`:

- **Palette**: anchored on washi paper (warm cream `#f3ecdf`) for light
  mode and sumi ink (`#1a1612`) for dark. Accents are matcha gold
  (`#b08d57`) and temple sage (`#6b8e6f`). The previous tech-y
  blue/purple is gone.
- **Background texture**: a faint SVG `feTurbulence` noise layer rendered
  via `body::before`, blended with `multiply` (light) / `screen` (dark)
  for a paper grain effect.
- **Typography**: a serif stack (Iowan Old Style → Palatino → Georgia)
  for titles, mantra text, and labels — gives the meditative feel a
  geometric sans can't. Body UI stays sans for legibility.
- **Logo**: replaced the gradient circle with a hand-tilted **enso**
  (zen brushed circle) drawn as inline SVG with a `stroke-dasharray` gap
  so it reads as a brush stroke, not a perfect ring. Larger version used
  in the empty state.
- **Mantra cards**: a thin sage accent bar on the left like a temple
  banner, gentler corner radii, softer shadows.
- **Empty state copy**: "No mantras yet" → "A still mind" / CTA "Begin".
- **Test button**: "🔔 Test notification" → "Ring the bell" (typographic,
  no emoji).
- **Day pills**, banners, and toggle switch repainted in the new palette.
- Subtle 320 ms fade-in on screen change for calmer transitions
  (gated by `prefers-reduced-motion`).
- `public/icon.svg` redesigned as an enso on washi paper, with a small
  gold dot at the strike point.

## 4. Scheduler: once-a-day frequency

User asked for a "once a day at desired time" option.

- `src/scheduler.js`: exported `ONCE_A_DAY = 1440`. When
  `frequencyMinutes >= ONCE_A_DAY`, `computeNextOccurrences` ignores
  `activeHours.end` and treats the window as `[start, start+1)`, so
  exactly one occurrence per active day at the chosen hour.
- `formatFrequency(1440)` → `"once a day"`; `describeMantra` for once-a-day
  mantras shows `"once a day at 08:00 · weekdays"` instead of a range.
- Editor (`renderEditor`): when `frequencyMinutes === 1440`, the field
  label switches from "Active hours" to "Time of day", and the range
  control is replaced with a single `At [HH:00]` picker
  (`renderTimeControl`). Picking a time keeps `activeHours.end =
  start + 1` to satisfy any code that still reads the range.
- Frequency dropdown gained `Once a day` as a preset (alongside the
  existing 5 min … 4 hr presets). Switching the frequency now triggers a
  re-render so the right time control shows.
- Verified: a once-a-day mantra at 08:00 starting Mon 10:00 correctly
  fires at Tue 08:00, Wed 08:00, Thu 08:00, ….

## Caveats / unresolved

- **Android build still blocked on JDK.** `/usr/lib/jvm/java-21-openjdk`
  is JRE-only on this machine; gradle can't find a `JAVA_COMPILER`. User
  has `Downloads/jdk-26_linux-x64_bin.rpm`; install with
  `sudo dnf install -y /home/arad/Downloads/jdk-26_linux-x64_bin.rpm`
  and set `JAVA_HOME=/usr/lib/jvm/jdk-26-oracle` (or use Fedora's
  `sudo dnf install -y java-21-openjdk-devel` for a more conservative
  JDK that matches what AGP 8.7 expects).
- **Android SDK not yet installed** (`ANDROID_SDK_ROOT` unset). Need
  `cmdline-tools` + `platform-tools` + a recent platform (API 34+) before
  the gradle build succeeds.
