// AI-generated (Claude)
import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { MAPS_AVAILABLE } from '@/components/site-map';
import { StatusView } from '@/components/status-view';
import { useTheme } from '@/hooks/use-theme';
import { distanceMeters } from '@/models/site-edit';
import { browseSsiSites, hasSsiPosition, type SitePosition } from '@/models/ssi/site-browse';
import { describeSsiSite, type SsiSite } from '@/models/ssi/sites';
import { useSsiAccount, useSsiLogbook, useSsiSiteIndex } from '@/queries/ssi';
import { SsiSiteTabs } from './ssi-site-tabs';
import { useSsiSiteLocation } from './use-ssi-site-location';
import { SsiSiteDetails } from './ssi-site-details';
import { SsiSitesMap } from './ssi-sites-map';

export function SsiSiteBrowser({
  position: initialPosition = null,
  onSelect,
  onClose,
}: {
  position?: SitePosition | null;
  onSelect?: (site: SsiSite) => void;
  onClose?: () => void;
}) {
  const theme = useTheme();
  const catalogue = useSsiSiteIndex();
  const account = useSsiAccount();
  const history = useSsiLogbook(Boolean(account.data));
  const [query, setQuery] = useState('');
  const searchQuery = useDeferredValue(query);
  const [view, setView] = useState<'nearby' | 'map' | 'list'>(
    onSelect ? 'nearby' : MAPS_AVAILABLE ? 'map' : 'list',
  );
  const [sort, setSort] = useState<'distance' | 'recent'>('distance');
  const { position, locationError, locating, locate, mapKey } = useSsiSiteLocation(initialPosition);
  const [selected, setSelected] = useState<SsiSite | null>(null);
  const [cluster, setCluster] = useState<SsiSite[] | null>(null);
  const [detail, setDetail] = useState<SsiSite | null>(null);
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
  const rows = view === 'nearby' && sort === 'recent' ? recent : allMatches;
  const button = (label: string, action: () => void, primary = false) => (
    <Pressable
      accessibilityRole="button"
      onPress={action}
      style={{
        padding: 14,
        borderWidth: 1,
        borderColor: theme.text,
        borderRadius: 8,
        backgroundColor: primary ? theme.text : theme.background,
      }}
    >
      <Text
        style={{
          color: primary ? theme.background : theme.text,
          fontWeight: '600',
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
  const header = (
    <View style={{ padding: 16, gap: 14, backgroundColor: theme.background }}>
      {onClose || detail || (view !== 'nearby' && onSelect) ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}>
          {detail
            ? button('Back to sites', () => setDetail(null))
            : onSelect && view !== 'nearby'
              ? button('Back', () => {
                  setView('nearby');
                  setSelected(null);
                })
              : null}
          {onClose ? button('Cancel', onClose) : null}
        </View>
      ) : null}
      {onClose ? (
        <Text style={{ color: theme.text, fontSize: 20, fontWeight: '600' }}>
          {view === 'nearby' ? 'Select dive site' : 'Places'}
        </Text>
      ) : null}
      {!detail ? (
        <>
          <TextInput
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setSelected(null);
              setCluster(null);
            }}
            accessibilityLabel="Search SSI dive sites"
            placeholder="Search SSI dive sites"
            placeholderTextColor={theme.textSecondary}
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
            style={{
              padding: 16,
              fontSize: 17,
              borderWidth: 1,
              borderColor: theme.text,
              borderRadius: 8,
              color: theme.text,
              backgroundColor: theme.background,
            }}
          />
          {view === 'nearby' ? (
            <SsiSiteTabs
              value={sort}
              onChange={setSort}
              options={[
                { value: 'distance', label: 'By distance' },
                { value: 'recent', label: 'Recently used' },
              ]}
            />
          ) : MAPS_AVAILABLE ? (
            <SsiSiteTabs
              value={view}
              onChange={(value) => {
                setView(value);
                setSelected(null);
              }}
              options={[
                { value: 'map', label: 'Map' },
                { value: 'list', label: 'List' },
              ]}
            />
          ) : null}
          {sort === 'distance' || view !== 'nearby' ? (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={() => void locate()}
                style={{ paddingVertical: 4 }}
              >
                <Text style={{ color: theme.accent, fontWeight: '600' }}>
                  {locating ? 'Finding location…' : 'Use my location'}
                </Text>
              </Pressable>
              {locationError || view === 'nearby' ? (
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                  {locationError ||
                    (position
                      ? initialPosition && position === initialPosition
                        ? 'Distance from this dive’s site'
                        : 'Distance from your location'
                      : 'Sorted by name until a location is available.')}
                </Text>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
  let body;
  if (detail)
    body = (
      <>
        <SsiSiteDetails key={detail.id} site={detail} />
        {onSelect ? (
          <View style={{ padding: 16 }}>
            {button('Select dive site', () => onSelect(detail), true)}
          </View>
        ) : null}
      </>
    );
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
  else if (view === 'map' && allMatches.length === 0)
    body = (
      <StatusView
        kind="empty"
        title="No matching SSI sites"
        description="Try another name or country. Sites without coordinates are available in the list."
        actionLabel="Clear search"
        onAction={() => setQuery('')}
      />
    );
  else if (view === 'map')
    body = (
      <View style={{ flex: 1 }}>
        <SsiSitesMap
          key={`${mapKey}:${searchQuery}`}
          fitToSites={Boolean(searchQuery.trim())}
          sites={allMatches}
          position={position}
          onSelect={(site) => {
            Keyboard.dismiss();
            setSelected(site);
            setCluster(null);
          }}
          onCluster={(sites) => {
            Keyboard.dismiss();
            setCluster(sites);
            setSelected(null);
          }}
        />
        <Text
          style={{
            position: 'absolute',
            top: 8,
            alignSelf: 'center',
            padding: 8,
            borderRadius: 8,
            color: theme.text,
            backgroundColor: theme.background,
          }}
        >
          {allMatches.length.toLocaleString()} sites · zoom to expand clusters
        </Text>
        {cluster ? (
          <View
            style={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              right: 16,
              maxHeight: '50%',
              borderRadius: 12,
              padding: 16,
              backgroundColor: theme.background,
            }}
          >
            {button('Close site list', () => setCluster(null))}
            <FlatList
              data={cluster}
              keyExtractor={(site) => String(site.id)}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setSelected(item);
                    setCluster(null);
                  }}
                  style={{ paddingVertical: 16 }}
                >
                  <Text style={{ color: theme.text, fontSize: 17 }}>{item.name}</Text>
                </Pressable>
              )}
            />
          </View>
        ) : null}
        {selected ? (
          <View
            style={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              right: 16,
              padding: 16,
              gap: 12,
              borderRadius: 12,
              backgroundColor: theme.background,
            }}
          >
            <Text style={{ color: theme.text, fontSize: 20, fontWeight: '600' }}>
              {selected.name}
            </Text>
            {button('SSI site details', () => setDetail(selected))}
            {onSelect ? button('Select dive site', () => onSelect(selected), true) : null}
          </View>
        ) : null}
      </View>
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
            style={{ flexDirection: 'row', padding: 16, gap: 14, alignItems: 'center' }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: theme.text,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: theme.background, fontWeight: '700' }}>SSI</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: theme.text, fontSize: 17, fontWeight: '600' }}>
                {item.name}
              </Text>
              <Text style={{ color: theme.textSecondary }}>
                {describeSsiSite(item)}
                {position && hasSsiPosition(item)
                  ? ` · ${(distanceMeters(position.lat, position.lon, item.lat, item.lon) / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km`
                  : ''}
              </Text>
            </View>
          </Pressable>
        )}
      />
    );
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {header}
      {body}
      {!detail && view === 'nearby' ? (
        <View style={{ padding: 16 }}>
          {button(
            MAPS_AVAILABLE ? 'Map and other dive sites' : 'All dive sites',
            () => {
              setView(MAPS_AVAILABLE ? 'map' : 'list');
              setSort('distance');
            },
            true,
          )}
        </View>
      ) : null}
    </View>
  );
}
