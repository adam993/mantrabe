#!/usr/bin/env node
// Reapplies project-specific overrides on top of the freshly-scaffolded
// android/ tree. Capacitor's `cap add android` writes a vanilla
// AndroidManifest.xml + default Capacitor launcher icons each time it
// runs, and `cap sync` doesn't preserve our customizations either.
// Both `android/` and the gradle-fed customizations are gitignored, so
// this script is the single source of truth for what we want patched in.
//
// Patches:
//
//   1. Launcher icon — copy android-resources/* over the matching paths
//      under android/app/src/main/res/. That swaps Capacitor's green
//      circle for the parchment + brushed-enso adaptive icon.
//
//   2. Native source — copy android-native-src/main/java/** over
//      android/app/src/main/java/**. Includes:
//        - MainActivity.java (replaces auto-gen so MantraScheduler plugin registers)
//        - MantraScheduler + plugin/receivers (self-rescheduling alarms)
//
//   3. AndroidManifest patches — deep-link intent filter, native
//      permissions (boot + post-notifications + wake-lock), and receiver
//      entries for MantraAlarmReceiver / MantraBootReceiver. Idempotent:
//      each patch checks for a sentinel and skips if present.
//
// Run from scripts/build-android.sh after `cap sync android`.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_RES = path.join(ROOT, 'android-resources');
const DST_RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const SRC_JAVA = path.join(ROOT, 'android-native-src', 'main', 'java');
const DST_JAVA = path.join(ROOT, 'android', 'app', 'src', 'main', 'java');
const MANIFEST = path.join(ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

const DEEP_LINK_SENTINEL = '<!-- mantrabe-deep-link -->';
const DEEP_LINK_FILTER = `${DEEP_LINK_SENTINEL}
            <intent-filter android:autoVerify="false">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="com.mantrabe.app" android:host="auth-callback" />
            </intent-filter>`;

const PERM_SENTINEL = '<!-- mantrabe-native-permissions -->';
const PERM_BLOCK = `${PERM_SENTINEL}
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />`;

const RECEIVER_SENTINEL = '<!-- mantrabe-native-receivers -->';
const RECEIVER_BLOCK = `${RECEIVER_SENTINEL}
        <receiver
            android:name=".MantraAlarmReceiver"
            android:exported="false" />
        <receiver
            android:name=".MantraBootReceiver"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.LOCKED_BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
            </intent-filter>
        </receiver>`;

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
    console.warn(
      `apply-android-customizations: ${path.relative(ROOT, MANIFEST)} not found — skipping manifest patches.`,
    );
    return;
  }
  let contents = fs.readFileSync(MANIFEST, 'utf8');
  let changed = false;

  // 1. Deep-link intent filter inside MainActivity.
  if (!contents.includes(DEEP_LINK_SENTINEL)) {
    const next = contents.replace(
      /(\s*)<\/activity>/,
      `$1    ${DEEP_LINK_FILTER}\n$1</activity>`,
    );
    if (next === contents) {
      throw new Error('apply-android-customizations: failed to find </activity> in AndroidManifest.xml');
    }
    contents = next;
    changed = true;
    console.log('apply-android-customizations: deep-link intent filter inserted.');
  } else {
    console.log('apply-android-customizations: deep-link intent filter already present.');
  }

  // 2. Permissions — placed alongside the auto-generated INTERNET line.
  if (!contents.includes(PERM_SENTINEL)) {
    const next = contents.replace(
      /(<uses-permission android:name="android\.permission\.INTERNET"\s*\/>)/,
      `$1\n\n    ${PERM_BLOCK}`,
    );
    if (next === contents) {
      throw new Error('apply-android-customizations: could not anchor permission block — is INTERNET still in the manifest?');
    }
    contents = next;
    changed = true;
    console.log('apply-android-customizations: native permissions inserted.');
  } else {
    console.log('apply-android-customizations: native permissions already present.');
  }

  // 3. Receivers — inserted before </application>.
  if (!contents.includes(RECEIVER_SENTINEL)) {
    const next = contents.replace(
      /(\s*)<\/application>/,
      `$1    ${RECEIVER_BLOCK}\n$1</application>`,
    );
    if (next === contents) {
      throw new Error('apply-android-customizations: failed to find </application> in AndroidManifest.xml');
    }
    contents = next;
    changed = true;
    console.log('apply-android-customizations: receiver entries inserted.');
  } else {
    console.log('apply-android-customizations: receiver entries already present.');
  }

  if (changed) fs.writeFileSync(MANIFEST, contents);
}

console.log('apply-android-customizations: copying res overrides…');
copyTree(SRC_RES, DST_RES);
console.log('apply-android-customizations: copying native java sources…');
copyTree(SRC_JAVA, DST_JAVA);
patchManifest();
console.log('apply-android-customizations: done.');
