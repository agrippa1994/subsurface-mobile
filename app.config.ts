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
  const manifest = readFileSync(
    join(__dirname, 'modules/ssrf-core/cpp/CORE_MANIFEST.md'),
    'utf8'
  );
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
  version: '1.0.0',
  // The app declares every orientation so the dive profile can go full screen
  // when the device is turned (src/hooks/use-landscape.ts). Every other screen
  // is held in portrait at runtime by expo-screen-orientation, which needs the
  // platform to permit landscape in the first place.
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
    // Liquid glass requires iOS 26. Bump if the toolchain needs a higher floor.
    deploymentTarget: '26.0',
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
    },
  },
  android: {
    // Android is a later phase (task 13); config kept from the template.
    // The package id only exists so `expo prebuild` does not stop to ask for
    // one - nothing Android-side is built yet.
    package: 'codes.mani.subsurfacereact',
    adaptiveIcon: {
      backgroundColor: '#062C53',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    'expo-sharing',
    // The keychain the SSI credentials and session token are kept in
    // (src/lib/ssi/auth.ts). Nothing else in the app stores a secret.
    'expo-secure-store',
    // Apple Maps on iOS, for picking and showing a dive site's position
    // (task 10). No location permission is requested: the app never needs the
    // diver's own position, only the site's.
    'expo-maps',
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
    // modules/ssrf-core is picked up by local autolinking
    // (expo-module.config.json); this plugin only vendors the Subsurface core
    // subset into the module before pod install (task 03).
    './modules/ssrf-core/plugin/withSsrfCore',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    ...config.extra,
    core: corePins(),
    sourceUrl: 'https://github.com/agrippa1994/subsurface-mobile',
  },
});
