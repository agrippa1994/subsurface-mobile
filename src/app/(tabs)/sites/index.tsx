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

import { HeaderAction } from '@/components/header-action';
import { MAPS_AVAILABLE } from '@/components/site-map';
import { SitesMap } from '@/components/sites-map';
import { StatusView } from '@/components/status-view';
import { SitesList } from '@/features/sites/sites-list';
import { useLogbook, useSites } from '@/queries/logbook';

export default function SitesScreen() {
  const logbook = useLogbook();
  const { data: sites = [] } = useSites();
  const router = useRouter();
  const [mode, setMode] = useState<'map' | 'list'>(MAPS_AVAILABLE ? 'map' : 'list');

  const openNew = () => router.push('/sites/new');
  const openSite = (uuid: number) => router.push(`/sites/${uuid}`);

  // Native bar button items, so New gets the system add button (liquid glass
  // on iOS 26) instead of a custom header view.
  const header = MAPS_AVAILABLE ? (
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

  return (
    <>
      {header}
      {body}
    </>
  );
}
