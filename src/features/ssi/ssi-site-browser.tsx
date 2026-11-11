// AI-generated (Claude)
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { MAPS_AVAILABLE } from '@/components/site-map';
import { StatusView } from '@/components/status-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUserLocation } from '@/hooks/use-user-location';
import { createMapViewport, type MapViewport } from '@/models/map-viewport';
import { distanceMeters, NEARBY_ZOOM } from '@/models/site-edit';
import {
  browseSsiSites,
  fitSsiSitesCamera,
  hasSsiPosition,
  type SitePosition,
} from '@/models/ssi/site-browse';
import { describeSsiSite, type SsiSite } from '@/models/ssi/sites';
import { useSsiAccount, useSsiLogbook, useSsiSiteIndex } from '@/queries/ssi';
import { SsiBrowserHeader, type SsiBrowserView, type SsiSiteSort } from './ssi-browser-header';
import { SsiSitesMap } from './ssi-sites-map';
import { t } from '@/i18n';

export function SsiSiteBrowser({
  position: initialPosition = null,
  viewport: sharedViewport,
  onOpenSite,
  onSelect,
  onClose,
  onMySites,
}: {
  position?: SitePosition | null;
  /** Passed in when the viewport should outlive this browser. */
  viewport?: MapViewport;
  /** Pushes the site's details: a real screen, so the back swipe works. */
  onOpenSite: (site: SsiSite) => void;
  onSelect?: (site: SsiSite) => void;
  onClose?: () => void;
  onMySites?: () => void;
}) {
  const theme = useTheme();
  const catalogue = useSsiSiteIndex();
  const account = useSsiAccount();
  const history = useSsiLogbook(Boolean(account.data));
  const [query, setQuery] = useState('');
  const searchQuery = useDeferredValue(query);
  const [view, setView] = useState<SsiBrowserView>(onSelect || !MAPS_AVAILABLE ? 'list' : 'map');
  const [sort, setSort] = useState<SsiSiteSort>('nearest');
  const { position, locating, locate, locationGranted } = useUserLocation(initialPosition);
  const [cluster, setCluster] = useState<SsiSite[] | null>(null);
  const [ownViewport] = useState(createMapViewport);
  const viewport = sharedViewport ?? ownViewport;
  const listRef = useRef<FlatList<SsiSite>>(null);
  // Open on the user's position only when there is no viewport to keep.
  const [opensOnPosition] = useState(() => !viewport.camera() && !initialPosition);
  const openedOnPosition = useRef(false);
  useEffect(() => {
    if (!position || !opensOnPosition || openedOnPosition.current) return;
    openedOnPosition.current = true;
    viewport.move({ latitude: position.lat, longitude: position.lon, zoom: NEARBY_ZOOM });
  }, [position, opensOnPosition, viewport]);
  const allMatches = useMemo(
    () => browseSsiSites(catalogue.data ?? [], searchQuery, sort === 'name' ? null : position),
    [catalogue.data, searchQuery, position, sort],
  );
  const recent = useMemo(
    () =>
      browseSsiSites(
        catalogue.data ?? [],
        searchQuery,
        position,
        history.data?.recentSiteIds ?? [],
      ),
    [catalogue.data, searchQuery, position, history.data],
  );
  const rows = cluster ?? (view === 'list' && sort === 'recent' ? recent : allMatches);
  const fittedQuery = useRef(searchQuery);
  useEffect(() => {
    if (fittedQuery.current === searchQuery) return;
    fittedQuery.current = searchQuery;
    if (!searchQuery.trim()) return;
    const fit = fitSsiSitesCamera(allMatches);
    if (fit) viewport.move(fit);
  }, [searchQuery, allMatches, viewport]);
  const changeView = (next: SsiBrowserView) => {
    Keyboard.dismiss();
    setView(next);
    setCluster(null);
  };
  const changeSort = (next: SsiSiteSort) => {
    setSort(next);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    if (next === 'nearest' && !position) void locate();
  };
  const goToMyLocation = async () => {
    setCluster(null);
    if (view === 'list') changeSort('nearest');
    const here = await locate();
    if (here) viewport.move({ latitude: here.lat, longitude: here.lon, zoom: NEARBY_ZOOM });
  };
  const openSite = (site: SsiSite) => {
    Keyboard.dismiss();
    onOpenSite(site);
  };
  const back = cluster ? () => setCluster(null) : undefined;
  const header = (
    <SsiBrowserHeader
      title={
        (catalogue.data && searchQuery.trim() && allMatches.length === 0
          ? t('ssiBrowser.noMatch')
          : null) ??
        (cluster ? t('ssiBrowser.atLocation') : onSelect ? t('ssiPicker.title') : t('sitesScreen.ssiSites'))
      }
      view={view}
      sort={sort}
      onViewChange={changeView}
      onSortChange={changeSort}
      query={query}
      onSearch={(text) => {
        setQuery(text);
        setCluster(null);
      }}
      onLocate={() => void goToMyLocation()}
      locating={locating}
      onBack={back}
      onClose={onClose}
      onMySites={onMySites}
      mapsAvailable={MAPS_AVAILABLE}
    />
  );
  const listHint =
    view !== 'list' || cluster || sort === 'name'
      ? null
      : sort === 'recent'
        ? t('ssiBrowser.fromLogbook')
        : locating
          ? t('ssiBrowser.finding')
          : !position
            ? t('ssiBrowser.byName')
            : position === initialPosition
              ? t('ssiBrowser.nearestDive')
              : t('ssiBrowser.nearestYou');
  let body;
  if (!catalogue.data && catalogue.isError)
    body = (
      <StatusView
        kind="error"
        title={t('ui.couldNotLoadSsiSites')}
        description={catalogue.error.message}
        actionLabel={t('ui.tryAgain')}
        onAction={() => void catalogue.refetch()}
      />
    );
  else if (!catalogue.data)
    body = (
      <StatusView
        kind="loading"
        title={
          catalogue.fetchStatus === 'paused'
            ? t('ssiBrowser.connect')
            : t('ui.downloadingSsiDiveSites')
        }
        description={t('ui.theCatalogueIsSavedOnThis')}
      />
    );
  else if (view === 'map' && !cluster)
    body = (
      <SsiSitesMap
        sites={allMatches}
        position={position}
        viewport={viewport}
        showsUserLocation={locationGranted}
        onSelect={openSite}
        onCluster={(sites) => {
          Keyboard.dismiss();
          setCluster(sites);
        }}
      />
    );
  else if (view === 'list' && sort === 'recent' && !history.data && account.data)
    body = (
      <StatusView
        kind={history.isError ? 'error' : 'loading'}
        title={
          history.isError ? t('ssiBrowser.recentFailed') : t('ssiBrowser.recentLoading')
        }
        actionLabel={history.isError ? t('common.tryAgain') : undefined}
        onAction={() => void history.refetch()}
      />
    );
  else
    body = (
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(item) => String(item.id)}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          listHint ? (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>{listHint}</Text>
          ) : undefined
        }
        ListEmptyComponent={
          <StatusView
            kind="empty"
            title={
              query
                ? t('ssiBrowser.noMatch')
                : sort === 'recent'
                  ? t('ssiBrowser.noRecent')
                  : t('ssiBrowser.none')
            }
            description={
              query
                ? t('ssiBrowser.tryAnother')
                : !account.data && sort === 'recent'
                  ? t('ssiBrowser.signIn')
                  : t('ssiBrowser.useMap')
            }
          />
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => (onSelect ? onSelect(item) : openSite(item))}
            style={({ pressed }) => [
              styles.row,
              pressed && { backgroundColor: theme.backgroundSelected },
            ]}
          >
            <View style={styles.main}>
              <Text style={[styles.name, { color: theme.text }]}>{item.name.trim()}</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {describeSsiSite(item)}
              </Text>
            </View>
            {position && hasSsiPosition(item) ? (
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {(
                  distanceMeters(position.lat, position.lon, item.lat, item.lon) / 1000
                ).toLocaleString(undefined, { maximumFractionDigits: 1 })}{' '}
                km
              </Text>
            ) : null}
          </Pressable>
        )}
      />
    );
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {header}
      {body}
    </View>
  );
}
const styles = StyleSheet.create({
  content: { paddingVertical: Spacing.two, paddingBottom: Spacing.six },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  main: { flex: 1, gap: Spacing.half },
  name: { fontSize: 17 },
  subtitle: { fontSize: 13 },
  hint: { fontSize: 13, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
});
