// AI-generated (Claude)
// Dive sites: a map or a list of them, the way into one site, and the way to a
// new site.
//
// With a map (iOS, Apple Maps) the tab opens on it and offers the list as a
// toggle in the navigation bar. Without one (Android) it only ever shows the
// list. This screen only picks the body and owns the header; the map and the
// list are their own components.
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { HeaderAction } from '@/components/header-action';
import { MAPS_AVAILABLE } from '@/components/site-map';
import { SitesMap } from '@/components/sites-map';
import { SsiSiteBrowser } from '@/features/ssi/ssi-site-browser';
import { StatusView } from '@/components/status-view';
import { SitesList } from '@/features/sites/sites-list';
import { useLogbook, useSites } from '@/queries/logbook';

export default function SitesScreen() {
  const logbook = useLogbook();
  const { data: sites = [] } = useSites();
  const router = useRouter();
  const [source, setSource] = useState<'logbook' | 'ssi'>('logbook');
  const [mode, setMode] = useState<'map' | 'list'>(MAPS_AVAILABLE ? 'map' : 'list');

  const openNew = () => router.push('/sites/new');
  const openSite = (uuid: number) => router.push(`/sites/${uuid}`);

  // Native bar button items, so New gets the system add button (liquid glass
  // on iOS 26) instead of a custom header view.
  const header = MAPS_AVAILABLE ? (
    <>
      {/* A large title has no scroll view to collapse into over a map. */}
      <Stack.Screen
        options={{
          title: 'Sites',
          headerTransparent: mode === 'map',
          headerLargeTitle: mode === 'list',
          headerSearchBarOptions: undefined,
          unstable_headerLeftItems: undefined,
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon="line.3.horizontal.decrease" accessibilityLabel="Site options">
          <Stack.Toolbar.MenuAction isOn>My dive sites</Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction onPress={() => setSource('ssi')}>
            SSI dive sites
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
        <Stack.Toolbar.Button
          icon={mode === 'map' ? 'list.bullet' : 'map'}
          accessibilityLabel={mode === 'map' ? 'Show as list' : 'Show on map'}
          onPress={() => setMode(mode === 'map' ? 'list' : 'map')}
        />
        <Stack.Toolbar.Button icon="plus" accessibilityLabel="New dive site" onPress={openNew} />
      </Stack.Toolbar>
    </>
  ) : (
    <HeaderAction
      label="Site options"
      onPress={() =>
        Alert.alert('Dive sites', undefined, [
          { text: 'SSI dive sites', onPress: () => setSource('ssi') },
          { text: 'New dive site', onPress: openNew },
          { text: 'Cancel', style: 'cancel' },
        ])
      }
    />
  );

  const body = !logbook.isSuccess ? (
    <StatusView kind="loading" title="Opening logbook" />
  ) : sites.length === 0 ? (
    <StatusView
      kind="empty"
      title="No dive sites"
      description="Sites appear here once a logbook with sites is loaded, or when you add one."
      systemImage="mappin.slash"
      actionLabel="New site"
      onAction={openNew}
    />
  ) : mode === 'map' ? (
    <SitesMap sites={sites} onSelectSite={openSite} />
  ) : (
    <SitesList sites={sites} onSelectSite={openSite} />
  );

  if (source === 'ssi') return <SsiSiteBrowser onMySites={() => setSource('logbook')} />;
  return (
    <>
      {header}
      {body}
    </>
  );
}
