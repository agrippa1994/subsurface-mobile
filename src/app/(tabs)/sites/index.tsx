// AI-generated (Claude)
// Dive sites: a map or a list of them, the way into one site, and the way to a
// new site.
//
// iOS opens on the map (Apple Maps) and offers the list as a toggle in the
// navigation bar. Android has no map provider configured, so it only ever
// shows the list.
//
// The rows come from the same module read as the dive list; how one renders is
// decided in models/site-edit.ts so the vitest suite covers it.
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { HeaderAction } from '@/components/header-action';
import { SitesMap } from '@/components/sites-map';
import { StatusView } from '@/components/status-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { sortSitesByName, toSiteRow } from '@/models/site-edit';
import { useLogbook, useSites } from '@/queries/logbook';

export default function SitesScreen() {
  const logbook = useLogbook();
  const { data: sites = [] } = useSites();
  const router = useRouter();
  const theme = useTheme();
  const [mode, setMode] = useState<'map' | 'list'>(HAS_MAP ? 'map' : 'list');

  const openNew = () => router.push('/sites/new');
  const openSite = (uuid: number) => router.push(`/sites/${uuid}`);

  // Native bar button items, so New gets the system add button (liquid glass
  // on iOS 26) instead of a custom header view.
  const header = HAS_MAP ? (
    <>
      {/* A large title has no scroll view to collapse into over a map. */}
      <Stack.Screen options={{ headerLargeTitle: mode === 'list' }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={mode === 'map' ? 'list.bullet' : 'map'}
          accessibilityLabel={mode === 'map' ? 'Show as list' : 'Show on map'}
          onPress={() => setMode(mode === 'map' ? 'list' : 'map')}
        />
        <Stack.Toolbar.Button icon="plus" accessibilityLabel="New dive site" onPress={openNew} />
      </Stack.Toolbar>
    </>
  ) : (
    <HeaderAction label="New dive site" icon="plus" onPress={openNew} />
  );

  if (!logbook.isSuccess) {
    return (
      <>
        {header}
        <StatusView kind="loading" title="Opening logbook" />
      </>
    );
  }

  if (sites.length === 0) {
    return (
      <>
        {header}
        <StatusView
          kind="empty"
          title="No dive sites"
          description="Sites appear here once a logbook with sites is loaded, or when you add one."
          systemImage="mappin.slash"
          actionLabel="New site"
          onAction={openNew}
        />
      </>
    );
  }

  if (mode === 'map') {
    return (
      <>
        {header}
        <View style={styles.map}>
          <SitesMap sites={sites} onSelectSite={openSite} />
        </View>
      </>
    );
  }

  const rows = sortSitesByName(sites).map(toSiteRow);

  return (
    <>
      {header}
      <FlatList
        data={rows}
        keyExtractor={(row) => String(row.uuid)}
        style={{ backgroundColor: theme.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openSite(item.uuid)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.row,
              pressed ? { backgroundColor: theme.backgroundSelected } : null,
            ]}>
            <View style={styles.main}>
              <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{item.subtitle}</Text>
            </View>
            <Text style={[styles.count, { color: theme.textSecondary }]}>{item.countText}</Text>
          </Pressable>
        )}
      />
    </>
  );
}

/** Only iOS has a map (Apple Maps); Android has no Google Maps key configured. */
const HAS_MAP = Platform.OS === 'ios';

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  content: {
    paddingVertical: Spacing.two,
    paddingBottom: Spacing.six,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  main: {
    flex: 1,
    gap: Spacing.half,
  },
  title: {
    fontSize: 17,
  },
  subtitle: {
    fontSize: 13,
  },
  count: {
    fontSize: 13,
  },
});
