// AI-generated (Claude)
// Root navigation.
//
// A stack holding the tab group. Each tab carries its own stack (see
// (tabs)/dives/_layout.tsx and friends) so pushes stay inside the tab, which is
// what iOS does everywhere.
//
// The startup work lives here because it must happen once per launch, before
// any screen reads the logbook: the working logbook is opened here, created
// empty on first run - see src/lib/logbook-file.ts. Preferences
// need no startup step; they are read synchronously as the settings query's
// initial data.
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { StatusView } from '@/components/status-view';
import { UndoToastHost } from '@/features/history/undo-toast';
import { useIncomingFileImports } from '@/features/transfer/use-incoming-files';
import { useWidgetSync } from '@/features/widgets/use-widget-sync';
import { usePortraitLock } from '@/hooks/use-landscape';
import { useNavigationTheme, useRootScreenOptions } from '@/hooks/use-navigation-theme';
import { useFlushOnBackground } from '@/hooks/use-logbook-persist';
import { t } from '@/i18n';
import { useDeviceClock } from '@/lib/device-clock';
import { installProblemHandlers, recordProblem } from '@/lib/diagnostics';
import { queryClient } from '@/lib/query-client';
import { describeError, formatErrorLine } from '@/models/errors';
import { useLogbook } from '@/queries/logbook';
import { useSyncCorePreferences } from '@/queries/settings';

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
      title={t('app.errorTitle')}
      description={formatErrorLine(describeError(error))}
      systemImage="exclamationmark.triangle"
      actionLabel={t('common.tryAgain')}
      onAction={() => void retry()}
    />
  );
}

export default function RootLayout() {
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
  // Before anything formats a date: the region and the 12/24-hour clock, and
  // the language the app speaks.
  useDeviceClock();
  // Strings are looked up as screens render, so a change of language (the
  // device's, while the app runs) remounts the tree to say everything anew.
  const { i18n } = useTranslation();
  // The preferences the core reads itself, such as the default cylinder.
  useSyncCorePreferences();

  const navigationTheme = useNavigationTheme();
  const rootScreenOptions = useRootScreenOptions();

  // Mounted here so the logbook starts loading at launch rather than when the
  // first screen that renders dives happens to mount.
  useLogbook();

  // A file opened from Files, Mail or AirDrop reaches the app as a URL, so the
  // handler belongs above every screen (task 11).
  useIncomingFileImports();

  // Anything still inside the save debounce is written as the app backgrounds.
  useFlushOnBackground();

  // Portrait on a phone; the dive profile opts back out while it is on screen.
  usePortraitLock();

  // The home screen and Lock Screen widgets show what the logbook holds now.
  useWidgetSync();

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack key={i18n.language} screenOptions={rootScreenOptions}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="ssi-site-picker" options={{ presentation: 'fullScreenModal' }} />
      </Stack>
      {/* Above every screen: any of them can make a change. */}
      <UndoToastHost />
    </ThemeProvider>
  );
}
