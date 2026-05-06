# iOS distribution via AltStore (unsigned IPA on GitHub Actions)

Date: 2026-05-06

## Why this exists

We don't have a Mac and don't want to pay $99/yr for the Apple Developer
Program. Capacitor's iOS output is an Xcode project, so xtool (which only
builds SwiftPM projects) can't help, and `xcodebuild` is macOS-only.

Solution: build the iOS app on a hosted **macOS GitHub Actions runner**,
ship it as an **unsigned `.ipa`** through **AltStore Classic**. AltStore
re-signs IPAs on the user's device with their free Apple ID, so signing
in CI is unnecessary (and would in fact be wasted work — AltStore
strips signatures before re-signing anyway).

Trade-off the user lives with: free Apple IDs only sign apps for **7
days**. After that the app stops launching until "refreshed" — AltServer
re-signs over local Wi-Fi automatically once a day if it's running on
their computer, otherwise the user taps Refresh manually in AltStore.
A free Apple ID can hold **up to 3 sideloaded apps** at once.

## How the pieces fit together

```
git push origin master  (with [ios] in commit message)
        │
        ▼
.github/workflows/ios-release.yml  (macos-14 runner)
        │   yarn install
        │   bash scripts/build-ios.sh --ci
        │       ├─ yarn build         (web assets, with VITE_SUPABASE_*)
        │       ├─ cap add ios        (first run, scaffolds ios/)
        │       ├─ copy public/*.wav  (notification sounds)
        │       ├─ cap sync ios
        │       ├─ stamp Info.plist with version.json values
        │       ├─ xcodebuild archive (SPM-based, CODE_SIGNING_ALLOWED=NO)
        │       └─ zip App.app into Payload/  →  release/mantrabe-ios-latest.ipa
        │   generate release/altstore-source.json
        │   gh release upload ios-latest …
        ▼
GitHub Release `ios-latest`
   ├─ mantrabe-ios-latest.ipa
   └─ altstore-source.json
        ▲
        │ 302
        │
Netlify redirects (netlify.toml)
   ├─ https://mantrabe.netlify.app/altstore-source.json
   └─ https://mantrabe.netlify.app/mantrabe-ios.ipa
```

## Triggers

The workflow only runs on:
1. `workflow_dispatch` — clicked manually in the Actions tab.
2. Push to `master` whose commit message contains `[ios]`.

Tag pushes do NOT trigger an iOS build (unlike android). If you want a
fresh build on a tag, add `[ios]` to the tag commit's message.

## Secrets required

The workflow expects these repo secrets (same as android-release.yml):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Vite inlines `VITE_*` env vars at build time, so without these the
Supabase client initializes as disabled and sign-in hides itself in the
shipped app. No iOS-specific secrets are needed because we don't sign.

## End-user install instructions

These go in the README / web download page when ready. Free Apple ID
path:

1. Install **AltStore** + **AltServer** following https://altstore.io/
   (AltServer runs on the user's Mac/Windows machine; AltStore is the
   iOS app).
2. In AltStore on the iPhone: **Browse → ＋ → Add Source** and paste:
   `https://mantrabe.netlify.app/altstore-source.json`
3. Tap **Mantrabe → Free Download**. AltServer signs it with the user's
   Apple ID and pushes it to the phone over Wi-Fi.
4. On iPhone, **Settings → General → VPN & Device Management →** trust
   the developer profile (their own Apple ID).
5. Open Mantrabe.

After 7 days the app needs a refresh:
- AltServer running on the same Wi-Fi as the iPhone refreshes
  automatically once per day.
- Or: open AltStore on the iPhone → **My Apps** → tap refresh icon next
  to Mantrabe (AltServer must be reachable).

## What the source JSON declares

`appPermissions` is empty arrays/object — Mantrabe doesn't request
camera, mic, photo library, location, contacts, etc., and doesn't ship
custom entitlements. If we ever add a Capacitor plugin that needs a
privacy usage string in `Info.plist` (e.g. camera), we MUST also list it
under `appPermissions.privacy` in the source JSON, otherwise AltStore
refuses to install:

> "AltStore will refuse to install any app whose permissions do not match"
> the declared entitlements and privacy permissions.

## What we don't do (and why)

- **No `/register` POST to api.altstore.io.** That endpoint is only for
  AltStore PAL (the EU alternative-marketplace flavor), which requires a
  paid Apple Developer Program account, an Apple "Alternative
  Distribution" entitlement, and an EU-only audience. AltStore Classic
  third-party sources require nothing — just hosting the JSON.
- **No xtool.** xtool only builds SwiftPM-based iOS apps. Capacitor
  produces an Xcode workspace with CocoaPods. They don't compose.
- **No signing in CI.** AltStore re-signs on-device. Any signature we
  applied would be stripped immediately.
- **No tag-based trigger.** The user explicitly wanted iOS builds gated
  on `[ios]` in commit message only. workflow_dispatch is kept as a
  manual escape valve.

## If something breaks

- **`cap add ios` fails on the runner**: the iOS Capacitor template may
  have a version-pinned Pod that can't resolve. Check
  `@capacitor/ios` version in package.json against current CocoaPods
  spec mirrors.
- **`xcodebuild archive` fails with code-signing errors despite
  `CODE_SIGNING_ALLOWED=NO`**: a new SPM dependency has overridden the
  flag. Try adding to the xcodebuild command:
  `OTHER_CODE_SIGN_FLAGS="" CODE_SIGN_ENTITLEMENTS=""` and inspect the
  failing target.
- **`No 'Podfile' found`**: you're on a code path that still expects
  CocoaPods. Capacitor 8 uses SPM exclusively for iOS plugins — there
  is no Podfile, no `pod install`, no `.xcworkspace` at the top level.
  The build uses `-project ios/App/App.xcodeproj` and SPM deps live in
  `ios/App/CapApp-SPM/Package.swift`.
- **AltStore says "permissions mismatch"**: a plugin added a usage
  string to `Info.plist` but the source JSON wasn't updated. Add the
  entry under `appPermissions.privacy` in `ios-release.yml`.
- **AltStore can't render the icon**: the icon is `public/icon-enso.png`
  (1024×1024, 8-bit RGBA, baked from `Enso strong` with `strokeWidth=4`,
  `#B08D57` on `#F5EFE0`). To regenerate after editing the SVG source:
  `magick -background "#F5EFE0" -density 600 icon-enso.svg -resize 1024x1024 -depth 8 -strip icon-enso.png`
