// AI-generated (Claude)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ExpoConfig, ConfigContext } from 'expo/config';

// Which Subsurface core the app is built on, taken from the manifest that has
// to be kept accurate anyway (modules/ssrf-core/cpp/CORE_MANIFEST.md) so the
// About screen cannot claim a pin the build does not have. The GPL-2.0 notice
// this feeds is not decoration: the app links the core, so it has to say what
// it links and where the source is.
function corePins(): { commit: string; version: string } {
  const manifest = readFileSync(join(__dirname, 'modules/ssrf-core/cpp/CORE_MANIFEST.md'), 'utf8');
  const commit = /`subsurface\/` submodule \| `([0-9a-f]+)`/.exec(manifest);
  const version = /Core version string \| `([^`]+)`/.exec(manifest);
  return { commit: commit?.[1] ?? 'unknown', version: version?.[1] ?? 'unknown' };
}

// Dynamic Expo config. Replaces app.json so we can register document types,
// the dev-client, and (task 02) the ssrf-core native module config plugin.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Subsurface',
  slug: 'subsurface-mobile',
  version: '1.15.0',
  // The app declares every orientation so a tablet can use any, and a phone's
  // dive profile can go full screen when the device is turned
  // (src/hooks/use-landscape.ts). A phone's other screens are held in portrait at
  // runtime by expo-screen-orientation, which needs the platform to permit
  // landscape in the first place.
  orientation: 'default',
  icon: './assets/images/icon.png',
  scheme: 'subsurface',
  userInterfaceStyle: 'automatic',
  ios: {
    // An Icon Composer bundle: iOS 26 renders it with its own material and
    // depth rather than compositing a flat PNG. The mark is the dive profile
    // drawn by scripts/make-icons.mjs, which also writes the PNG fallbacks.
    icon: './assets/subsurface.icon',
    bundleIdentifier: 'codes.mani.subsurface-react',
    // Signing team for prebuild (DEVELOPMENT_TEAM) and EAS.
    appleTeamId: 'PZP46GS9KE',
    // Liquid glass requires iOS 26. Bump if the toolchain needs a higher floor.
    deploymentTarget: '26.0',
    // Runs natively on iPad. Not requiring full screen lets the window be
    // resized (Split View, Stage Manager, iPadOS 26 windowing); iPadOS only
    // allows that when every orientation is declared, which `orientation`
    // above already does.
    supportsTablet: true,
    requireFullScreen: false,
    infoPlist: {
      // Document types the app opens (task 11): its own logbooks plus the dive
      // exports it can import. Tapping one of these in Files or Mail offers
      // Subsurface, and the file arrives as a URL - see
      // src/features/transfer/use-incoming-files.ts.
      CFBundleDocumentTypes: [
        {
          CFBundleTypeName: 'Subsurface logbook',
          LSHandlerRank: 'Owner',
          LSItemContentTypes: ['org.subsurface.ssrf', 'public.xml'],
        },
        {
          CFBundleTypeName: 'Dive computer export',
          LSHandlerRank: 'Alternate',
          LSItemContentTypes: ['org.subsurface.sde', 'public.json', 'public.zip-archive'],
        },
      ],
      UTImportedTypeDeclarations: [
        {
          UTTypeIdentifier: 'org.subsurface.ssrf',
          UTTypeDescription: 'Subsurface logbook',
          UTTypeConformsTo: ['public.xml', 'public.data'],
          UTTypeTagSpecification: {
            'public.filename-extension': ['ssrf', 'xml'],
            'public.mime-type': ['application/xml'],
          },
        },
        {
          // The Suunto Dive Manager export: a zip of one XML document per dive.
          // Suunto registers no UTI for it, so the app declares one.
          UTTypeIdentifier: 'org.subsurface.sde',
          UTTypeDescription: 'Suunto Dive Manager export',
          UTTypeConformsTo: ['public.zip-archive', 'public.data'],
          UTTypeTagSpecification: {
            'public.filename-extension': ['sde'],
          },
        },
      ],
      // Deliberately *not* LSSupportsOpeningDocumentsInPlace: opening in place
      // hands over a security-scoped URL, and the C++ core reads plain paths
      // with fopen(). Without the entitlement iOS drops a copy into
      // Documents/Inbox, which is inside the sandbox and always readable; the
      // app merges it into its own logbook and deletes the copy.
      // File sharing is on so the logbook is reachable from the Files app.
      UIFileSharingEnabled: true,
      // Downloading dives from a dive computer (src/features/dive-computer). The
      // prompt comes with the first scan, not at launch.
      NSBluetoothAlwaysUsageDescription:
        'Subsurface connects to your dive computer over Bluetooth to download your dives.',
      // The MCP server in Settings (src/lib/mcp/server.ts) listens on the
      // local network; iOS may ask before it lets clients there reach it.
      NSLocalNetworkUsageDescription:
        'The MCP server you can switch on in Settings lets AI assistants on your local network read your logbook.',
    },
  },
  android: {
    package: 'codes.mani.subsurfacereact',
    versionCode: 11,
    adaptiveIcon: {
      backgroundColor: '#062C53',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // "Open with" for the files the app reads (task 13), the counterpart of
    // CFBundleDocumentTypes above. The file arrives as a content:// URL - see
    // src/features/transfer/use-incoming-files.ts. Providers are loose about
    // MIME types (an .ssrf is usually octet-stream), so the generic ones are
    // listed too; the import itself tells a bad file apart.
    intentFilters: [
      {
        action: 'VIEW',
        category: ['DEFAULT', 'BROWSABLE'],
        data: [
          { scheme: 'content', mimeType: 'application/xml' },
          { scheme: 'content', mimeType: 'text/xml' },
          { scheme: 'content', mimeType: 'application/json' },
          { scheme: 'content', mimeType: 'application/zip' },
          { scheme: 'content', mimeType: 'application/octet-stream' },
          { scheme: 'file', mimeType: 'application/xml' },
          { scheme: 'file', mimeType: 'text/xml' },
        ],
      },
    ],
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    'expo-asset',
    'expo-font',
    'expo-image',
    'expo-status-bar',
    'expo-sharing',
    // The keychain the SSI credentials and session token are kept in
    // (src/lib/ssi/auth.ts). Nothing else in the app stores a secret.
    'expo-secure-store',
    // Apple Maps on iOS, for picking and showing a dive site's position (task
    // 10). Android uses MapLibre with OpenFreeMap (src/components/platform-map.tsx)
    // and leaves expo-maps out of its build (expo.autolinking in package.json).
    'expo-maps',
    [
      'expo-location',
      { locationWhenInUsePermission: 'Use your location to find nearby SSI dive sites.' },
    ],
    // The phone's barometer for the live surface GF (src/features/surface-gf).
    // iOS reads it through CMAltimeter, which asks for Motion & Fitness access.
    [
      'expo-sensors',
      {
        motionPermission:
          'Subsurface reads the air pressure from the barometer to work out your surface gradient factor at your altitude.',
      },
    ],
    [
      'expo-splash-screen',
      {
        // The two ends of the icon's gradient, so the launch screen reads as
        // the same water in either appearance.
        backgroundColor: '#146FC4',
        dark: { backgroundColor: '#062C53', image: './assets/images/splash-icon.png' },
        image: './assets/images/splash-icon.png',
        imageWidth: 120,
      },
    ],
    [
      'expo-build-properties',
      {
        ios: {
          // Route every C/C++ compile (the vendored Subsurface core, React
          // Native, the pods) through ccache. A missing ccache only warns at
          // pod install, so this is safe on machines without it.
          ccacheEnabled: true,
        },
        android: {
          // The ABIs the native modules' static dependencies (libxml2,
          // libxslt, libgit2) are cross-built for: devices and Apple Silicon
          // emulators, Intel emulators. 32-bit devices are not supported.
          buildArchs: ['arm64-v8a', 'x86_64'],
        },
      },
    ],
    // modules/ssrf-core is picked up by local autolinking
    // (expo-module.config.json); this plugin only vendors the Subsurface core
    // subset into the module before pod install (task 03).
    './modules/ssrf-core/plugin/withSsrfCore',
    // Android's Bluetooth permissions for downloading from a dive computer.
    './modules/ssrf-core/plugin/withBluetoothPermissions',
    // Debug builds install as a separate testing app next to the production
    // one, with its own identity, amber icon and sandbox (own logbook).
    [
      './plugins/with-ios-variants',
      {
        debug: {
          name: 'Subsurface Dev',
          bundleIdentifier: 'codes.mani.subsurface-react.dev',
          scheme: 'subsurface-dev',
          icon: './assets/subsurface-dev.icon',
        },
      },
    ],
    // Home screen and Lock Screen widgets (src/widgets), kept current by
    // src/features/widgets/use-widget-sync.ios.ts. Listed after the variants
    // plugin on purpose: a later plugin's mods run first, so the variants plugin
    // sees the widget extension target and gives the debug build its own widget
    // bundle identifier and app group.
    [
      'expo-widgets',
      {
        widgets: [
          {
            name: 'LastDive',
            displayName: 'Last Dive',
            description: 'Your latest dive: site, depth, time and profile.',
            ios: {
              supportedFamilies: [
                'systemSmall',
                'systemMedium',
                'systemLarge',
                'accessoryCircular',
                'accessoryRectangular',
                'accessoryInline',
              ],
              initialLayout: 'src/widgets/last-dive.tsx',
            },
            android: null,
          },
          {
            name: 'SurfaceInterval',
            displayName: 'Surface Interval',
            description: 'Time since your last dive ended, counting up.',
            ios: {
              supportedFamilies: [
                'systemSmall',
                'accessoryCircular',
                'accessoryRectangular',
                'accessoryInline',
              ],
              initialLayout: 'src/widgets/surface-interval.tsx',
            },
            android: null,
          },
          {
            name: 'LogbookTotals',
            displayName: 'Logbook Totals',
            description: 'Dives, hours underwater, deepest and longest dive.',
            ios: {
              supportedFamilies: [
                'systemSmall',
                'systemMedium',
                'systemLarge',
                'accessoryCircular',
                'accessoryRectangular',
                'accessoryInline',
              ],
              initialLayout: 'src/widgets/logbook-totals.tsx',
              configuration: {
                title: 'Logbook Totals',
                description: 'Choose which dives the totals cover.',
                parameters: {
                  period: {
                    title: 'Period',
                    type: 'enum',
                    default: 'all',
                    values: [
                      { name: 'All dives', value: 'all' },
                      { name: 'This year', value: 'year' },
                      { name: 'Last 12 months', value: 'last12' },
                    ],
                  },
                },
              },
            },
            android: null,
          },
          {
            name: 'DiveActivity',
            displayName: 'Dive Activity',
            description: 'Dives per month over the last year.',
            ios: {
              supportedFamilies: ['systemSmall', 'systemMedium', 'systemLarge'],
              initialLayout: 'src/widgets/dive-activity.tsx',
            },
            android: null,
          },
        ],
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    ...config.extra,
    core: corePins(),
    sourceUrl: 'https://github.com/agrippa1994/subsurface-mobile',
    eas: {
      projectId: 'dac5cff9-2dc1-4201-914f-3f785a783589',
    },
  },
});
