// AI-generated (Claude)
// The dive list.
//
// The screen owns no data: it renders whatever the module answered on the last
// read, grouped by the presentation model, and shows the loading / empty /
// error placeholders around it. Deleting from the list (a swipe on iOS) asks
// first, the same way the dive editor does - a deleted dive is gone for good.
//
// The header search bar narrows the list by site, trip, buddy, dive guide,
// dive number or date (see searchDives); while a query is typed, the list says
// how many dives it kept.
import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { DiveListSkeleton, DiveListView } from '@/components/dive-list-view';
import { StatusView } from '@/components/status-view';
import { warned } from '@/lib/haptics';
import { flush } from '@/lib/logbook-persist';
import type { DiveSummary } from '@/models';
import { describeError, formatErrorLine } from '@/models/errors';
import {
  buildDiveSearchIndex,
  diveRowTitle,
  groupDivesByTrip,
  searchDives,
  searchResultsText,
} from '@/models/dive-list';
import { useDives, useLogbook } from '@/queries/logbook';
import { useDeleteDive } from '@/queries/logbook-mutations';
import { useUnitSystem } from '@/queries/settings';

export default function DivesScreen() {
  const router = useRouter();
  const logbook = useLogbook();
  const divesQuery = useDives();
  const dives = useMemo(() => divesQuery.data ?? [], [divesQuery.data]);
  const unitSystem = useUnitSystem();
  const deleteDive = useDeleteDive();

  const [query, setQuery] = useState('');
  const searchIndex = useMemo(() => buildDiveSearchIndex(dives), [dives]);
  const searching = query.trim() !== '';
  const matches = useMemo(() => searchDives(searchIndex, query), [searchIndex, query]);
  const sections = useMemo(() => groupDivesByTrip(matches), [matches]);

  const onDeleteDive = useCallback(
    (dive: DiveSummary) => {
      warned();
      Alert.alert(
        `Delete "${diveRowTitle(dive)}"?`,
        'This dive and its profile are gone for good.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  await deleteDive.mutateAsync(dive.id);
                  // Same as the editor: a force-quit right after must still find
                  // the dive gone from disk.
                  await flush();
                } catch (error) {
                  Alert.alert(
                    'The dive could not be deleted',
                    formatErrorLine(describeError(error)),
                  );
                }
              })();
            },
          },
        ],
      );
    },
    [deleteDive],
  );

  // Also shown over the loading skeleton: the search field makes the navigation
  // bar taller, so adding it only once the dives are in would shift the list.
  const searchBar = (
    <Stack.SearchBar
      placeholder="Site, buddy, date"
      autoCapitalize="none"
      onChangeText={(event) => setQuery(event.nativeEvent.text)}
      onCancelButtonPress={() => setQuery('')}
    />
  );

  if (logbook.isError) {
    return (
      <StatusView
        kind="error"
        title="The logbook could not be opened"
        description={formatErrorLine(describeError(logbook.error))}
        systemImage="exclamationmark.triangle"
        actionLabel="Try again"
        onAction={() => void logbook.refetch()}
      />
    );
  }

  // The dive query only starts once the logbook is in, so it is still pending
  // for a moment after; without waiting for it the empty state would flash.
  if (!logbook.isSuccess || divesQuery.isPending) {
    return (
      <>
        {searchBar}
        <DiveListSkeleton />
      </>
    );
  }

  if (dives.length === 0) {
    return (
      <StatusView
        kind="empty"
        title="No dives yet"
        description="Import a Suunto database or a Subsurface logbook to get started."
        systemImage="water.waves"
      />
    );
  }

  // Only reachable while searching: the log itself has dives at this point.
  if (matches.length === 0) {
    return (
      <>
        {searchBar}
        <StatusView
          kind="empty"
          title="No matching dives"
          description={`No dive matches "${query.trim()}". Try a site, buddy or date.`}
          systemImage="magnifyingglass"
        />
      </>
    );
  }

  return (
    <>
      {searchBar}
      <DiveListView
        sections={sections}
        unitSystem={unitSystem}
        onSelectDive={(id) => router.push(`/dives/${id}`)}
        onDeleteDive={onDeleteDive}
        resultsText={searching ? searchResultsText(matches.length, dives.length) : undefined}
      />
    </>
  );
}
