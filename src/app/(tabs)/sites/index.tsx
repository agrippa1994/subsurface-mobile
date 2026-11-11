// AI-generated (Claude)
// Dive sites: a map with a list of them in a sheet over it, the way into one site,
// and the way to a new site.
//
// With a map (Apple Maps on iOS, MapLibre on Android) the list and the map are one
// screen, as in Maps, and the sheet's search narrows both. Without one it only ever
// shows the list. This screen only picks the body and owns the header; the map, the
// sheet and the list are their own components.
import { Stack, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, Keyboard, Platform, StyleSheet, Text, View } from 'react-native';

import { HeaderIconButton } from '@/components/header-icon-button';
import { MapSheet, type MapSheetHandle } from '@/components/map-sheet';
import { SearchField } from '@/components/search-field';
import { MAPS_AVAILABLE } from '@/components/site-map';
import { SitesMap } from '@/components/sites-map';
import { useHistoryMenu } from '@/features/history/use-history-actions';
import { SsiSiteBrowser } from '@/features/ssi/ssi-site-browser';
import { StatusView } from '@/components/status-view';
import { Spacing } from '@/constants/theme';
import { SiteRowView, SitesList } from '@/features/sites/sites-list';
import { useTheme } from '@/hooks/use-theme';
import { useUserLocation } from '@/hooks/use-user-location';
import { createMapViewport } from '@/models/map-viewport';
import { NEARBY_ZOOM, searchSites, sortSitesByName, toSiteRow } from '@/models/site-edit';
import { useLogbook, useSites } from '@/queries/logbook';
import { t } from '@/i18n';

export default function SitesScreen() {
  const logbook = useLogbook();
  const { data: sites = [] } = useSites();
  const router = useRouter();
  const historyMenu = useHistoryMenu();
  const [source, setSource] = useState<'logbook' | 'ssi'>('logbook');
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const sheet = useRef<MapSheetHandle>(null);
  const matches = useMemo(() => searchSites(sites, query), [sites, query]);
  const rows = useMemo(() => sortSitesByName(matches).map(toSiteRow), [matches]);
  // Owned here so the viewport survives switching between both kinds of site.
  const [viewport] = useState(createMapViewport);
  const { locate, locating, locationGranted } = useUserLocation();

  const goToMyLocation = async () => {
    const here = await locate();
    if (!here) return;
    viewport.move({ latitude: here.lat, longitude: here.lon, zoom: NEARBY_ZOOM });
  };

  const openNew = () => router.push('/sites/new');
  const openSite = (uuid: number) => {
    // The sheet's search field would otherwise bring it back over the site's screen.
    Keyboard.dismiss();
    router.push(`/sites/${uuid}`);
  };

  // Native bar button items, so New gets the system add button (liquid glass
  // on iOS 26) instead of a custom header view.
  const header = Platform.OS === 'ios' ? (
    <>
      {/* A large title has no scroll view to collapse into over a map. */}
      <Stack.Screen
        options={{
          title: t('nav.sites'),
          headerTransparent: MAPS_AVAILABLE,
          headerLargeTitle: !MAPS_AVAILABLE,
          headerSearchBarOptions: undefined,
          unstable_headerLeftItems: undefined,
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon="line.3.horizontal.decrease" accessibilityLabel={t('sitesScreen.options')}>
          <Stack.Toolbar.MenuAction isOn>{t('sitesScreen.mySites')}</Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction onPress={() => setSource('ssi')}>
            {t('sitesScreen.ssiSites')}
          </Stack.Toolbar.MenuAction>
          {historyMenu ? (
            <Stack.Toolbar.Menu inline>
              <Stack.Toolbar.MenuAction
                icon="arrow.uturn.backward"
                disabled={!historyMenu.canUndo}
                onPress={historyMenu.undo}>
                {historyMenu.undoTitle}
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                icon="arrow.uturn.forward"
                disabled={!historyMenu.canRedo}
                onPress={historyMenu.redo}>
                {historyMenu.redoTitle}
              </Stack.Toolbar.MenuAction>
            </Stack.Toolbar.Menu>
          ) : null}
        </Stack.Toolbar.Menu>
        <Stack.Toolbar.Button
          hidden={!MAPS_AVAILABLE || sites.length === 0}
          icon={locating ? 'location.fill' : 'location'}
          accessibilityLabel={t('sitesScreen.myLocation')}
          onPress={() => void goToMyLocation()}
        />
        <Stack.Toolbar.Button icon="plus" accessibilityLabel={t('sitesScreen.newSite')} onPress={openNew} />
      </Stack.Toolbar>
    </>
  ) : (
    // Android draws only bitmap icons in Stack.Toolbar, and its alerts hold at
    // most three buttons, so the map actions are buttons of their own.
    <Stack.Screen
      options={{
        headerRight: () => (
          <View style={{ flexDirection: 'row' }}>
            {MAPS_AVAILABLE && sites.length > 0 ? (
              <HeaderIconButton
                label={t('sitesScreen.myLocation')}
                icon={locating ? 'location.fill' : 'location'}
                onPress={() => void goToMyLocation()}
              />
            ) : null}
            {historyMenu ? (
              <HeaderIconButton
                label={t('common.undoRedo')}
                icon="arrow.uturn.backward"
                onPress={() =>
                  Alert.alert(t('common.undoRedo'), undefined, [
                    { text: t('ui.cancel'), style: 'cancel' },
                    ...(historyMenu.canRedo
                      ? [{ text: historyMenu.redoTitle, onPress: historyMenu.redo }]
                      : []),
                    ...(historyMenu.canUndo
                      ? [{ text: historyMenu.undoTitle, onPress: historyMenu.undo }]
                      : []),
                  ])
                }
              />
            ) : null}
            <HeaderIconButton
              label={t('sitesScreen.options')}
              icon="ellipsis"
              onPress={() =>
                Alert.alert(t('nav.sites'), undefined, [
                  { text: t('sitesScreen.ssiSites'), onPress: () => setSource('ssi') },
                  { text: t('sitesScreen.newSite'), onPress: openNew },
                  { text: t('ui.cancel'), style: 'cancel' },
                ])
              }
            />
          </View>
        ),
      }}
    />
  );

  const body = !logbook.isSuccess ? (
    <StatusView kind="loading" title={t('ui.openingLogbook')} />
  ) : sites.length === 0 ? (
    <StatusView
      kind="empty"
      title={t('sitesScreen.empty')}
      description={t('sitesScreen.emptyDetail')}
      systemImage="mappin.slash"
      actionLabel={t('nav.newSite')}
      onAction={openNew}
    />
  ) : MAPS_AVAILABLE ? (
    <View style={styles.mapArea}>
      <SitesMap
        sites={matches}
        onSelectSite={openSite}
        viewport={viewport}
        showsUserLocation={locationGranted}
      />
      <MapSheet
        ref={sheet}
        header={
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder={t('sitesScreen.search')}
            onFocus={() => sheet.current?.expand()}
            tint={`${theme.textSecondary}26`}
          />
        }
        data={rows}
        keyExtractor={(row) => String(row.uuid)}
        renderItem={({ item }) => (
          <SiteRowView row={item} onPress={() => openSite(item.uuid)} />
        )}
        ListEmptyComponent={
          <Text style={[styles.noMatches, { color: theme.textSecondary }]}>
            {t('sitesScreen.noMatch')}
          </Text>
        }
      />
    </View>
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

const styles = StyleSheet.create({
  mapArea: {
    flex: 1,
  },
  noMatches: {
    fontSize: 15,
    textAlign: 'center',
    padding: Spacing.four,
  },
});
