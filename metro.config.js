// AI-generated (Claude)
// Metro needs to treat the bundled fixtures as binary assets, not as source, so
// they can be required and resolved through expo-asset at runtime: the sample
// logbook (assets/sample/sample-log.ssrf) and the Suunto DM4 database the
// developer tools import (assets/sample/suunto-sample.db), and the Suunto DM4
// XML export next to it. Without this Metro tries to parse them as JavaScript -
// and would hand back a parsed object for anything it recognizes, such as JSON.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('ssrf', 'db', 'xml');

module.exports = config;
