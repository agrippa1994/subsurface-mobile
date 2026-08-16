// AI-generated (Claude)
// Root navigation.
//
// A stack holding the tab group. Each tab carries its own stack (see
// (tabs)/dives/_layout.tsx and friends) so pushes stay inside the tab, which is
// what iOS does everywhere.
//
// The startup work lives here because it must happen once per launch, before
// any screen reads the logbook: the working logbook is opened here, seeded from
// the bundled sample on first run - see src/lib/logbook-file.ts. Preferences
// need no startup step; they are read synchronously as the settings query's
// initial data.
import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { StatusView } from '@/components/status-view';
import { useIncomingFileImports } from '@/features/transfer/use-incoming-files';
import { usePortraitLock } from '@/hooks/use-landscape';
import { useFlushOnBackground } from '@/hooks/use-logbook-persist';
import { installProblemHandlers, recordProblem } from '@/lib/diagnostics';
import { createQueryClient } from '@/lib/query-client';
import { describeError, formatErrorLine } from '@/models/errors';
import { useLogbook } from '@/queries/logbook';

/**
 * Expo Router renders this instead of the tree when a screen below throws. It
 * exists so a failure is a screen with a way out rather than a white app, and
 * so the failure reaches the problem log - the app reports to nobody but the
 * user (see src/models/diagnostics.ts).
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  useEffect(() => {
    recordProblem('render', error);
  }, [error]);

  return (
    <StatusView
      kind="error"
      title="Something went wrong"
      description={formatErrorLine(describeError(error))}
      systemImage="exclamationmark.triangle"
      actionLabel="Try again"
      onAction={() => void retry()}
    />
  );
}

export default function RootLayout() {
  // One client for the life of the app. useState rather than a module constant
  // so a fast refresh in development cannot leave two clients behind.
  const [queryClient] = useState(createQueryClient);

  useEffect(() => {
    installProblemHandlers();
  }, []);

  return (
    // The root view is what makes gestures work anywhere below it - the
    // profile chart in task 08 pinches and pans inside it.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AppShell />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

/** Everything that needs the query client, which the layout above creates. */
function AppShell() {
  const colorScheme = useColorScheme();

  // Mounted here so the logbook starts loading at launch rather than when the
  // first screen that renders dives happens to mount.
  useLogbook();

  // A file opened from Files, Mail or AirDrop reaches the app as a URL, so the
  // handler belongs above every screen (task 11).
  useIncomingFileImports();

  // Anything still inside the save debounce is written as the app backgrounds.
  useFlushOnBackground();

  // Portrait everywhere; the dive profile opts back out while it is on screen.
  usePortraitLock();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ThemeProvider>
  );
}
