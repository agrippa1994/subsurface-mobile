// AI-generated (Claude)
//
// The Android Bluetooth permissions, with the attributes they need: a plain
// `android.permissions` entry in the Expo config cannot carry them.
//
// BLUETOOTH_SCAN carries neverForLocation, which is what lets Android 12+ scan
// without the location permission. Everything the older versions need is capped
// with maxSdkVersion, so a current device is not asked for location at all.

const { withAndroidManifest } = require('expo/config-plugins');

const PERMISSIONS = [
  { name: 'android.permission.BLUETOOTH', maxSdk: '30' },
  { name: 'android.permission.BLUETOOTH_ADMIN', maxSdk: '30' },
  { name: 'android.permission.ACCESS_FINE_LOCATION', maxSdk: '30' },
  { name: 'android.permission.BLUETOOTH_CONNECT' },
  { name: 'android.permission.BLUETOOTH_SCAN', flags: 'neverForLocation' },
];

const withBluetoothPermissions = (config) =>
  withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const entries = manifest['uses-permission'] ?? [];
    const names = new Set(PERMISSIONS.map((permission) => permission.name));
    manifest['uses-permission'] = [
      ...entries.filter((entry) => !names.has(entry.$['android:name'])),
      ...PERMISSIONS.map(({ name, maxSdk, flags }) => ({
        $: {
          'android:name': name,
          ...(maxSdk ? { 'android:maxSdkVersion': maxSdk } : {}),
          ...(flags ? { 'android:usesPermissionFlags': flags } : {}),
        },
      })),
    ];
    // Optional: a device without BLE still runs the rest of the app.
    manifest['uses-feature'] = [
      ...(manifest['uses-feature'] ?? []).filter(
        (entry) => entry.$['android:name'] !== 'android.hardware.bluetooth_le',
      ),
      { $: { 'android:name': 'android.hardware.bluetooth_le', 'android:required': 'false' } },
    ];
    return mod;
  });

module.exports = withBluetoothPermissions;
