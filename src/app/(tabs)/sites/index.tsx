// AI-generated (Claude)
// Dive sites: a map or a list of them, the way into one site, and the way to a
// new site.
//
// With a map (Apple Maps on iOS, MapLibre on Android) the tab opens on it and offers the list as a toggle in the navigation
// bar. Without one it only ever shows the list. This screen only picks the body and owns the header; the map and the
// list are their own components.
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { HeaderIconButton } from '@/components/header-icon-button';
import { MAPS_AVAILABLE } from '@/components/site-map';
import { SitesMap } from '@/components/sites-map';
import { SsiSiteBrowser } from '@/features/ssi/ssi-site-browser';
import { StatusView } from '@/components/status-view';
import { SitesList } from '@/features/sites/sites-list';
import { useUserLocation } from '@/hooks/use-user-location';
import { createMapViewport } from '@/models/map-viewport';
import { NEARBY_ZOOM } from '@/models/site-edit';
import { useLogbook, useSites } from '@/queries/logbook';

export default function SitesScreen() {
  const logbook = useLogbook();
  const { data: sites = [] } = useSites();
  const router = useRouter();
  const [source, setSource] = useState<'logbook' | 'ssi'>('logbook');
  const [mode, setMode] = useState<'map' | 'list'>(MAPS_AVAILABLE ? 'map' : 'list');
  // Owned here so the viewport survives switching between both kinds of site
  // and between the map and the list.
  const [viewport] = useState(createMapViewport);
  const { locate, locating, locationGranted } = useUserLocation();

  const goToMyLocation = async () => {
    const here = await locate();
    if (!here) return;
    viewport.move({ latitude: here.lat, longitude: here.lon, zoom: NEARBY_ZOOM });
  };

  const openNew = () => router.push('/sites/new');
  const openSite = (uuid: number) => router.push(`/sites/${uuid}`);

  // Native bar button items, so New gets the system add button (liquid glass
  // on iOS 26) instead of a custom header view.
  const header = Platform.OS === 'ios' ? (
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
          hidden={mode !== 'map' || sites.length === 0}
          icon={locating ? 'location.fill' : 'location'}
          accessibilityLabel="Go to my location"
          onPress={() => void goToMyLocation()}
        />
        <Stack.Toolbar.Button
          icon={mode === 'map' ? 'list.bullet' : 'map'}
          accessibilityLabel={mode === 'map' ? 'Show as list' : 'Show on map'}
          onPress={() => setMode(mode === 'map' ? 'list' : 'map')}
        />
        <Stack.Toolbar.Button icon="plus" accessibilityLabel="New dive site" onPress={openNew} />
      </Stack.Toolbar>
    </>
  ) : (
    // Android draws only bitmap icons in Stack.Toolbar, and its alerts hold at
    // most three buttons, so the map actions are buttons of their own.
    <Stack.Screen
      options={{
        headerRight: () => (
          <View style={{ flexDirection: 'row' }}>
            {MAPS_AVAILABLE && mode === 'map' && sites.length > 0 ? (
              <HeaderIconButton
                label="Go to my location"
                icon={locating ? 'location.fill' : 'location'}
                onPress={() => void goToMyLocation()}
              />
            ) : null}
            {MAPS_AVAILABLE ? (
              <HeaderIconButton
                label={mode === 'map' ? 'Show as list' : 'Show on map'}
                icon={mode === 'map' ? 'list.bullet' : 'map'}
                onPress={() => setMode(mode === 'map' ? 'list' : 'map')}
              />
            ) : null}
            <HeaderIconButton
              label="Site options"
              icon="ellipsis"
              onPress={() =>
                Alert.alert('Dive sites', undefined, [
                  { text: 'SSI dive sites', onPress: () => setSource('ssi') },
                  { text: 'New dive site', onPress: openNew },
                  { text: 'Cancel', style: 'cancel' },
                ])
              }
            />
          </View>
        ),
      }}
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
    <SitesMap
      sites={sites}
      onSelectSite={openSite}
      viewport={viewport}
      showsUserLocation={locationGranted}
    />
  ) : (
    <SitesList sites={sites} onSelectSite={openSite} />
  );

  if (source === 'ssi')
    return (
      <SsiSiteBrowser
        viewport={viewport}
        onOpenSite={(site) => router.push(`/sites/ssi-site/${site.id}`)}
        onMySites={() => setSource('logbook')}
      />
    );
  return (
    <>
      {header}
      {body}
    </>
  );
}
