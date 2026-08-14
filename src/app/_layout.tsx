// AI-generated (Claude)
// Root navigation.
//
// A stack holding the tab group. Each tab carries its own stack (see
// (tabs)/dives/_layout.tsx and friends) so pushes stay inside the tab, which is
// what iOS does everywhere.
//
// The startup work lives here because it must happen once per launch, before
// any screen reads the store: preferences are hydrated from disk and the
// working logbook is opened, seeded from the bundled sample on first run - see
// src/lib/logbook-file.ts.
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useIncomingFileImports } from '@/features/transfer/use-incoming-files';
import { useLogStore } from '@/store/log-store';
import { useSettingsStore } from '@/store/settings-store';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const hydrateSettings = useSettingsStore((state) => state.hydrate);
  const openLog = useLogStore((state) => state.open);

  useEffect(() => {
    hydrateSettings();
    void openLog();
  }, [hydrateSettings, openLog]);

  // A file opened from Files, Mail or AirDrop reaches the app as a URL, so the
  // handler belongs above every screen (task 11).
  useIncomingFileImports();

  return (
    // The root view is what makes gestures work anywhere below it - the
    // profile chart in task 08 pinches and pans inside it.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
