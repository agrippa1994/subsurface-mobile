// AI-generated (Claude)
// Metro needs to treat a logbook as a binary asset, not as source, so the
// bundled sample log (assets/sample/sample-log.ssrf) can be required and
// resolved through expo-asset at runtime. Without this Metro tries to parse the
// file as JavaScript.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('ssrf');

module.exports = config;
