#!/usr/bin/env node
// Pulls the latest Android APK from the `android-latest` rolling GitHub
// Release into release/ so prepare-public-apk.cjs can stage it for the
// web bundle. Used by Netlify (and any other CI without the Android
// toolchain). Local devs don't need this — `yarn build:android` already
// populates release/.
//
// Soft-fails: if the release isn't there yet, or the network is down,
// the build proceeds without an APK and the Download button hides itself.

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const DST_DIR = path.join(ROOT, 'release');
const DST = path.join(DST_DIR, 'mantrabe-android-latest.apk');

const REPO = process.env.GITHUB_REPOSITORY || 'adam993/mantrabe';
const TAG = process.env.MANTRABE_APK_RELEASE_TAG || 'android-latest';
const ASSET = 'mantrabe-android-latest.apk';

if (fs.existsSync(DST)) {
  console.log(
    `fetch-public-apk: ${path.relative(ROOT, DST)} already present — skipping fetch.`,
  );
  process.exit(0);
}

const url = `https://github.com/${REPO}/releases/download/${TAG}/${ASSET}`;

function get(u, redirects = 5) {
  return new Promise((resolve, reject) => {
    if (redirects < 0) return reject(new Error('too many redirects'));
    https
      .get(u, { headers: { 'user-agent': 'mantrabe-fetch-public-apk' } }, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          res.resume();
          return resolve(get(res.headers.location, redirects - 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${u}`));
        }
        resolve(res);
      })
      .on('error', reject);
  });
}

(async () => {
  try {
    fs.mkdirSync(DST_DIR, { recursive: true });
    const res = await get(url);
    await new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(DST);
      res.pipe(stream);
      stream.on('finish', () => stream.close(resolve));
      stream.on('error', reject);
      res.on('error', reject);
    });
    const bytes = fs.statSync(DST).size;
    console.log(
      `fetch-public-apk: downloaded ${(bytes / 1024 / 1024).toFixed(1)} MB to ${path.relative(ROOT, DST)}`,
    );
  } catch (err) {
    // Don't fail the build — prepare-public-apk.cjs will hide the download
    // button if the APK isn't there.
    console.warn(`fetch-public-apk: could not fetch ${url}: ${err.message}`);
    console.warn('fetch-public-apk: continuing without APK; download button will be hidden.');
    if (fs.existsSync(DST)) fs.unlinkSync(DST);
  }
})();
