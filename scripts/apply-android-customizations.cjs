#!/usr/bin/env node
// Reapplies project-specific overrides on top of the freshly-scaffolded
// android/ tree. Capacitor's `cap add android` writes a vanilla
// AndroidManifest.xml + default Capacitor launcher icons each time it
// runs, and `cap sync` doesn't preserve our customizations either.
// Both `android/` and the gradle-fed customizations are gitignored, so
// this script is the single source of truth for what we want patched in.
//
// Two patches:
//
//   1. Launcher icon — copy android-resources/* over the matching paths
//      under android/app/src/main/res/. That swaps Capacitor's green
//      circle for the parchment + brushed-enso adaptive icon.
//
//   2. Deep-link intent filter — add an <intent-filter> to MainActivity
//      so com.mantrabe.app:// URLs open the app (used by the magic-link
//      auth callback). Idempotent: the script looks for a sentinel
//      comment and skips if already applied.
//
// Run from scripts/build-android.sh after `cap sync android`.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_RES = path.join(ROOT, 'android-resources');
const DST_RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const MANIFEST = path.join(ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

const SENTINEL = '<!-- mantrabe-deep-link -->';
const INTENT_FILTER = `${SENTINEL}
            <intent-filter android:autoVerify="false">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="com.mantrabe.app" android:host="auth-callback" />
            </intent-filter>`;

function copyTree(src, dst) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyTree(path.join(src, name), path.join(dst, name));
    }
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

function patchManifest() {
  if (!fs.existsSync(MANIFEST)) {
    console.warn(`apply-android-customizations: ${path.relative(ROOT, MANIFEST)} not found — skipping deep-link patch.`);
    return;
  }
  const original = fs.readFileSync(MANIFEST, 'utf8');
  if (original.includes(SENTINEL)) {
    console.log('apply-android-customizations: deep-link intent filter already present.');
    return;
  }
  // Insert right before the closing </activity> tag of MainActivity.
  // Capacitor scaffolds exactly one <activity>, so a simple replace is safe.
  const patched = original.replace(
    /(\s*)<\/activity>/,
    `$1    ${INTENT_FILTER}\n$1</activity>`,
  );
  if (patched === original) {
    throw new Error('apply-android-customizations: failed to find </activity> in AndroidManifest.xml');
  }
  fs.writeFileSync(MANIFEST, patched);
  console.log('apply-android-customizations: deep-link intent filter inserted.');
}

console.log('apply-android-customizations: copying res overrides…');
copyTree(SRC_RES, DST_RES);
patchManifest();
console.log('apply-android-customizations: done.');
