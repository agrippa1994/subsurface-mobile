// AI-generated (Claude)
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { MAPS_AVAILABLE } from '@/components/site-map';
import { StatusView } from '@/components/status-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { distanceMeters } from '@/models/site-edit';
import { browseSsiSites, hasSsiPosition, type SitePosition } from '@/models/ssi/site-browse';
import { describeSsiSite, type SsiSite } from '@/models/ssi/sites';
import { useSsiAccount, useSsiLogbook, useSsiSiteIndex } from '@/queries/ssi';
import { SsiBrowserHeader, type SsiBrowserView } from './ssi-browser-header';
import { useSsiSiteLocation } from './use-ssi-site-location';
import { SsiSiteDetails } from './ssi-site-details';
import { SsiSitesMap } from './ssi-sites-map';

export function SsiSiteBrowser({
  position: initialPosition = null,
  onSelect,
  onClose,
  onMySites,
}: {
  position?: SitePosition | null;
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
  const [view, setView] = useState<SsiBrowserView>(
    onSelect ? 'nearby' : MAPS_AVAILABLE ? 'map' : 'list',
  );
  const [sort, setSort] = useState<'distance' | 'recent'>('distance');
  const { position, locationError, locating, locate, mapKey } = useSsiSiteLocation(initialPosition);
  const [selected, setSelected] = useState<SsiSite | null>(null);
  const [cluster, setCluster] = useState<SsiSite[] | null>(null);
  const [detail, setDetail] = useState<SsiSite | null>(null);
  useEffect(() => {
    if (locationError) Alert.alert('Location unavailable', locationError);
  }, [locationError]);
  const allMatches = useMemo(
    () => browseSsiSites(catalogue.data ?? [], searchQuery, position),
    [catalogue.data, searchQuery, position],
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
  const rows = cluster ?? (view === 'nearby' && sort === 'recent' ? recent : allMatches);
  const chosen = detail ?? selected;
  const changeView = (next: SsiBrowserView) => {
    Keyboard.dismiss();
    setView(next);
    setSelected(null);
    setCluster(null);
  };
  const back = detail
    ? () => setDetail(null)
    : selected
      ? () => setSelected(null)
      : cluster
        ? () => setCluster(null)
        : onSelect && view !== 'nearby'
          ? () => changeView('nearby')
          : undefined;
  const header = (
    <SsiBrowserHeader
      title={
        (catalogue.data && searchQuery.trim() && allMatches.length === 0
          ? 'No matching SSI sites'
          : null) ??
        detail?.name ??
        selected?.name ??
        (cluster ? 'Sites at this location' : onSelect ? 'Select dive site' : 'SSI dive sites')
      }
      view={view}
      sort={sort}
      onViewChange={changeView}
      onSortChange={setSort}
      onSearch={(text) => {
        setQuery(text);
        setSelected(null);
        setCluster(null);
      }}
      onLocate={() => void locate()}
      locating={locating}
      onBack={back}
      onClose={onClose}
      onMySites={onMySites}
      onDetails={selected && !detail ? () => setDetail(selected) : undefined}
      onSelect={chosen && onSelect ? () => onSelect(chosen) : undefined}
      showingDetail={Boolean(detail)}
      mapsAvailable={MAPS_AVAILABLE}
    />
  );
  let body;
  if (detail) body = <SsiSiteDetails key={detail.id} site={detail} />;
  else if (!catalogue.data && catalogue.isError)
    body = (
      <StatusView
        kind="error"
        title="Could not load SSI sites"
        description={catalogue.error.message}
        actionLabel="Try again"
        onAction={() => void catalogue.refetch()}
      />
    );
  else if (!catalogue.data)
    body = (
      <StatusView
        kind="loading"
        title={
          catalogue.fetchStatus === 'paused'
            ? 'Connect to download SSI sites'
            : 'Downloading SSI dive sites'
        }
        description="The catalogue is saved on this device for offline browsing."
      />
    );
  else if (view === 'map' && !cluster)
    body = (
      <SsiSitesMap
        key={`${mapKey}:${searchQuery}`}
        fitToSites={Boolean(searchQuery.trim())}
        sites={allMatches}
        position={position}
        onSelect={(site) => {
          Keyboard.dismiss();
          setSelected(site);
        }}
        onCluster={(sites) => {
          Keyboard.dismiss();
          setCluster(sites);
          setSelected(null);
        }}
      />
    );
  else if (view === 'nearby' && sort === 'recent' && !history.data && account.data)
    body = (
      <StatusView
        kind={history.isError ? 'error' : 'loading'}
        title={
          history.isError ? 'Could not load recently used sites' : 'Loading recently used sites'
        }
        actionLabel={history.isError ? 'Try again' : undefined}
        onAction={() => void history.refetch()}
      />
    );
  else
    body = (
      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.id)}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          view === 'nearby' && sort === 'distance' ? (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              {position
                ? initialPosition && position === initialPosition
                  ? 'Distance from this dive’s site'
                  : 'Distance from your location'
                : 'Sorted by name. Use Site options to find nearby sites.'}
            </Text>
          ) : undefined
        }
        ListEmptyComponent={
          <StatusView
            kind="empty"
            title={
              query
                ? 'No matching SSI sites'
                : sort === 'recent'
                  ? 'No recently used sites'
                  : 'No SSI sites'
            }
            description={
              query
                ? 'Try another name or country.'
                : !account.data && sort === 'recent'
                  ? 'Sign in to SSI in Settings to see sites from your SSI logbook.'
                  : 'Use the map or search for a dive site.'
            }
          />
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => (onSelect ? onSelect(item) : setDetail(item))}
            style={({ pressed }) => [
              styles.row,
              pressed && { backgroundColor: theme.backgroundSelected },
            ]}
          >
            <View style={styles.main}>
              <Text style={[styles.name, { color: theme.text }]}>{item.name}</Text>
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
