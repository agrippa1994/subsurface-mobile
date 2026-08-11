// AI-generated (Claude)
import type { ExpoConfig, ConfigContext } from 'expo/config';

// Dynamic Expo config. Replaces app.json so we can register document types,
// the dev-client, and (task 02) the ssrf-core native module config plugin.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Subsurface',
  slug: 'subsurface-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'subsurface',
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: 'codes.mani.subsurface-react',
    // Liquid glass requires iOS 26. Bump if the toolchain needs a higher floor.
    deploymentTarget: '26.0',
    infoPlist: {
      // Registers .ssrf / .xml logbooks as document types the app opens and
      // exports. Consumed by import/export in task 11.
      CFBundleDocumentTypes: [
        {
          CFBundleTypeName: 'Subsurface logbook',
          LSHandlerRank: 'Owner',
          LSItemContentTypes: ['org.subsurface.ssrf', 'public.xml'],
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
      ],
    },
  },
  android: {
    // Android is a later phase (task 13); config kept from the template.
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
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
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    // Native module config plugin slot (task 02): once modules/ssrf-core exists,
    // add its plugin here, e.g. './modules/ssrf-core/app.plugin.js'.
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
