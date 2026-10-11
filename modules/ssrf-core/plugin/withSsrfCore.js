// AI-generated (Claude)
//
// Config plugin that materializes the Subsurface core subset before the native
// project is generated. `expo prebuild` runs config plugins first and pod
// install afterwards, so by the time CocoaPods reads SsrfCore.podspec the
// cpp/generated tree exists.
//
// Running it here (rather than in a package.json script) means a plain
// `npx expo prebuild && npx expo run:ios` works from a fresh clone.

const { execFileSync } = require('child_process');
const path = require('path');

const withSsrfCore = (config) => {
  const script = path.join(__dirname, '..', 'scripts', 'vendor-core.mjs');
  // The script's progress goes to stderr: tools such as eas-cli evaluate the
  // config in a subprocess and parse its stdout as JSON.
  execFileSync('node', [script], { stdio: ['ignore', 2, 2] });
  return config;
};

module.exports = withSsrfCore;
