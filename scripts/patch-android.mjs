#!/usr/bin/env node
/**
 * Patches a freshly generated Capacitor Android project:
 *  - sets versionCode / versionName from the root package.json
 *  - allows the app to launch the APK installer (REQUEST_INSTALL_PACKAGES)
 *  - keeps cleartext traffic disabled
 *
 * Usage: node scripts/patch-android.mjs [path-to-android-project]
 */
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const androidDir = path.resolve(process.argv[2] ?? path.join(repoRoot, 'apps/web/android'));
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

const [major = 0, minor = 0, patch = 0] = String(pkg.version)
  .split('.')
  .map((part) => Number.parseInt(part, 10) || 0);
const versionCode = major * 10000 + minor * 100 + patch;

function patchFile(file, transform) {
  if (!fs.existsSync(file)) {
    console.warn(`skip (missing): ${file}`);
    return;
  }
  const before = fs.readFileSync(file, 'utf8');
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(file, after);
    console.log(`patched: ${path.relative(repoRoot, file)}`);
  } else {
    console.log(`unchanged: ${path.relative(repoRoot, file)}`);
  }
}

const manifest = path.join(androidDir, 'app/src/main/AndroidManifest.xml');
patchFile(manifest, (content) => {
  let next = content;
  if (!next.includes('android.permission.REQUEST_INSTALL_PACKAGES')) {
    next = next.replace(
      /<application/,
      '    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n\n    <application',
    );
  }
  if (!next.includes('android:usesCleartextTraffic')) {
    next = next.replace(/<application/, '<application\n        android:usesCleartextTraffic="false"');
  }
  return next;
});

const gradle = path.join(androidDir, 'app/build.gradle');
patchFile(gradle, (content) => {
  let next = content;
  if (/versionCode\s+\d+/.test(next)) {
    next = next.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
  }
  if (/versionName\s+"[^"]*"/.test(next)) {
    next = next.replace(/versionName\s+"[^"]*"/, `versionName "${pkg.version}"`);
  }
  return next;
});

console.log(`Android version: ${pkg.version} (code ${versionCode})`);
