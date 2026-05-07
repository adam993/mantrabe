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
const APP_GRADLE = path.join(ROOT, 'android', 'app', 'build.gradle');
const KEYSTORE = path.join(ROOT, 'keystore', 'mantrabe-debug.keystore');

const DEEP_LINK_SENTINEL = '<!-- mantrabe-deep-link -->';
const DEEP_LINK_FILTER = `${DEEP_LINK_SENTINEL}
            <intent-filter android:autoVerify="false">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="com.mantrabe.app" android:host="auth-callback" />
            </intent-filter>`;

// USE_EXACT_ALARM is API 33+ and a normal-protection permission for
// alarm/reminder apps — granted at install, can't be revoked without
// uninstall. SCHEDULE_EXACT_ALARM covers API 31–32 and *can* be revoked
// by the user via "Alarms & reminders"; the scheduler falls back to
// inexact mode if it ever loses that grant.
//
// REQUEST_IGNORE_BATTERY_OPTIMIZATIONS is what lets us launch the
// system dialog asking the user to whitelist Mantrabe from Doze. We
// can't bypass Doze without this; setExactAndAllowWhileIdle still has
// rate limits that the OEM battery savers exploit. Holding it doesn't
// auto-whitelist us — it only unlocks the dialog.
//
// The block uses paired start/end sentinels so this script can REPLACE
// an out-of-date block on a stale android/ checkout (single-line
// sentinels would be detected as "already present" and we'd silently
// keep the old set of permissions).
const PERM_SENTINEL_START = '<!-- mantrabe-native-permissions:start -->';
const PERM_SENTINEL_END = '<!-- mantrabe-native-permissions:end -->';
const PERM_BLOCK = `${PERM_SENTINEL_START}
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.USE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
    ${PERM_SENTINEL_END}`;

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

// Pin the debug-signing identity to the keystore committed at
// keystore/mantrabe-debug.keystore so local and CI builds produce APKs
// with the *same* signature. Without this, gradle falls through to
// ~/.android/debug.keystore — which differs between every dev machine
// and every fresh CI runner — and devices then refuse to install one
// build over another with INSTALL_FAILED_UPDATE_INCOMPATIBLE.
//
// Debug-grade only: alias and both passwords are the well-known
// "android" defaults, intentional so the keystore can live in-repo
// without ceremony. The release buildType is irrelevant here — we only
// ship debug APKs (AltStore / sideload), and a release config would
// need a real upload key anyway.
const SIGNING_SENTINEL = '// mantrabe-debug-signing';
const SIGNING_BLOCK = `${SIGNING_SENTINEL}
    signingConfigs {
        debug {
            storeFile file('../../keystore/mantrabe-debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;

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
  //    Idempotent across version bumps: if a previous start/end-bracketed
  //    block exists, replace it; if a pre-bracket-era single-sentinel
  //    block exists, scrub it; otherwise insert fresh after INTERNET.
  const oldSingleSentinel = '<!-- mantrabe-native-permissions -->';
  const bracketed = new RegExp(
    `${PERM_SENTINEL_START.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}[\\s\\S]*?${PERM_SENTINEL_END.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`,
  );
  if (bracketed.test(contents)) {
    const next = contents.replace(bracketed, PERM_BLOCK);
    if (next !== contents) {
      contents = next;
      changed = true;
      console.log('apply-android-customizations: native permissions refreshed.');
    } else {
      console.log('apply-android-customizations: native permissions already up to date.');
    }
  } else {
    // Strip the legacy single-sentinel block + everything from there
    // through the last <uses-permission> on a contiguous run. Cheap
    // approximation: drop the sentinel line and the following 3 perm
    // lines (the v1 set: BOOT_COMPLETED, POST_NOTIFICATIONS, WAKE_LOCK).
    if (contents.includes(oldSingleSentinel)) {
      contents = contents.replace(
        new RegExp(`\\s*${oldSingleSentinel.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?:\\s*<uses-permission[^/]*/>)+`),
        '',
      );
      console.log('apply-android-customizations: stripped legacy permission block.');
    }
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

function patchAppGradle() {
  if (!fs.existsSync(APP_GRADLE)) {
    console.warn(
      `apply-android-customizations: ${path.relative(ROOT, APP_GRADLE)} not found — skipping signing-config patch.`,
    );
    return;
  }
  if (!fs.existsSync(KEYSTORE)) {
    throw new Error(
      `apply-android-customizations: missing ${path.relative(ROOT, KEYSTORE)} — debug signing key must be checked into the repo.`,
    );
  }
  let contents = fs.readFileSync(APP_GRADLE, 'utf8');
  if (contents.includes(SIGNING_SENTINEL)) {
    console.log('apply-android-customizations: signing config already present.');
    return;
  }
  // Anchor before the buildTypes block so signingConfigs.debug is
  // declared in scope when gradle resolves the implicit debug buildType.
  const next = contents.replace(
    /(\n\s*)buildTypes\s*\{/,
    `\n    ${SIGNING_BLOCK}$&`,
  );
  if (next === contents) {
    throw new Error('apply-android-customizations: failed to find buildTypes block in build.gradle');
  }
  fs.writeFileSync(APP_GRADLE, next);
  console.log('apply-android-customizations: signing config inserted.');
}

console.log('apply-android-customizations: copying res overrides…');
copyTree(SRC_RES, DST_RES);
console.log('apply-android-customizations: copying native java sources…');
copyTree(SRC_JAVA, DST_JAVA);
patchManifest();
patchAppGradle();
console.log('apply-android-customizations: done.');
