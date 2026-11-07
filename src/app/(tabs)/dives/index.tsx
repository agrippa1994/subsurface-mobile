// AI-generated (Claude)
// The dive list.
//
// The screen owns no data: it renders whatever the module answered on the last
// read, grouped by the presentation model, and shows the loading / empty /
// error placeholders around it. Deleting from the list (a swipe on iOS) does not
// ask: it undoes, and the toast says so (see src/lib/logbook-history.ts).
//
// Trips are reached from here too: a section header opens its trip, a row's swipe
// or long press offers the trip actions, and "Select" marks several dives to
// group or move at once. A selection lasts until the log changes - which is what
// finishing one of those actions does, wherever it was finished.
//
// A long press on a row can also merge the dive with a neighbour. The list stays
// where it is afterwards, with the merged dive in place of the two.
//
// The header search bar narrows the list by site, trip, buddy, dive guide,
// dive number or date (see searchDives); while a query is typed, the list says
// how many dives it kept.
import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { DiveListSkeleton, DiveListView } from '@/components/dive-list-view';
import { DiveSelectionBar } from '@/components/dive-selection-bar';
import { HeaderActions, type HeaderActionProps } from '@/components/header-action';
import { StatusView } from '@/components/status-view';
import { useDiveMerge } from '@/features/dives/use-dive-merge';
import { useTripActions } from '@/features/dives/use-trip-actions';
import { operationFailed, operationSucceeded, selectionChanged } from '@/lib/haptics';
import { flush } from '@/lib/logbook-persist';
import type { DiveSummary } from '@/models';
import { describeError, formatErrorLine } from '@/models/errors';
import {
  buildDiveSearchIndex,
  groupDivesByTrip,
  searchDives,
  searchResultsText,
} from '@/models/dive-list';
import {
  adjacentTripsByDive,
  formatDiveIds,
  tripActionsFor,
  type TripAction,
} from '@/models/trips';
import { useDives, useLogbook, useTrips } from '@/queries/logbook';
import { useDeleteDive } from '@/queries/logbook-mutations';
import { useUnitSystem } from '@/queries/settings';

function selectedTitle(count: number): string {
  return count === 0 ? 'Select Dives' : `${count} Selected`;
}

export default function DivesScreen() {
  const router = useRouter();
  const logbook = useLogbook();
  const divesQuery = useDives();
  const dives = useMemo(() => divesQuery.data ?? [], [divesQuery.data]);
  const unitSystem = useUnitSystem();
  const deleteDive = useDeleteDive();
  const tripsQuery = useTrips();
  const trips = useMemo(() => tripsQuery.data ?? [], [tripsQuery.data]);
  const tripActions = useTripActions();
  const diveMerge = useDiveMerge();

  const adjacent = useMemo(() => adjacentTripsByDive(dives, trips), [dives, trips]);

  // Kept with the dive list it was made on: a selection over a list that has
  // since changed would act on dives the user no longer sees marked. That also
  // ends selection mode once the picker has moved the dives.
  const [selection, setSelection] = useState<{
    ids: ReadonlySet<number>;
    of: readonly DiveSummary[];
  } | null>(null);
  const selectedIds = selection?.of === dives ? selection.ids : null;
  const selectedDives = useMemo(
    () => (selectedIds ? dives.filter((dive) => selectedIds.has(dive.id)) : []),
    [dives, selectedIds],
  );

  const toggleDive = useCallback(
    (id: number) => {
      const ids = new Set(selectedIds);
      if (!ids.delete(id)) {
        ids.add(id);
      }
      selectionChanged();
      setSelection({ ids, of: dives });
    },
    [dives, selectedIds],
  );

  const openPicker = useCallback(
    (ids: readonly number[]) => {
      router.push(`/dives/trip/pick?diveIds=${formatDiveIds(ids)}`);
    },
    [router],
  );

  const onTripAction = useCallback(
    (dive: DiveSummary, action: TripAction) => {
      switch (action.kind) {
        case 'open':
          router.push(`/dives/trip/${action.tripId}`);
          break;
        case 'pick':
          openPicker([dive.id]);
          break;
        case 'add':
          tripActions.addToTrip([dive], action.tripId);
          break;
        case 'new':
          tripActions.createTrip([dive], (trip) => router.push(`/dives/trip/${trip.id}`));
          break;
        case 'remove':
          tripActions.removeFromTrip([dive]);
          break;
      }
    },
    [openPicker, router, tripActions],
  );

  const openDownload = useCallback(() => router.push('/dives/download'), [router]);
  const openAdd = useCallback(() => router.push('/dives/add'), [router]);
  // One button for the ways a dive gets into the log from here, so that the header
  // keeps room for Select and undo.
  const addAction = useMemo<HeaderActionProps>(
    () => ({
      label: 'Add dive',
      icon: 'plus',
      items: [
        { label: 'Add dive manually', icon: 'square.and.pencil', onPress: openAdd },
        { label: 'Download from dive computer', icon: 'arrow.down.circle', onPress: openDownload },
      ],
    }),
    [openAdd, openDownload],
  );

  const [query, setQuery] = useState('');
  const searchIndex = useMemo(() => buildDiveSearchIndex(dives), [dives]);
  const searching = query.trim() !== '';
  const matches = useMemo(() => searchDives(searchIndex, query), [searchIndex, query]);
  const sections = useMemo(() => groupDivesByTrip(matches), [matches]);

  const onDeleteDive = useCallback(
    (dive: DiveSummary) => {
      void (async () => {
        try {
          await deleteDive.mutateAsync(dive.id);
          // Same as the editor: a force-quit right after must still find the
          // dive gone from disk.
          await flush();
          operationSucceeded();
        } catch (error) {
          operationFailed();
          Alert.alert('The dive could not be deleted', formatErrorLine(describeError(error)));
        }
      })();
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
      <>
        {/* The last dive may just have been deleted, and that undoes too. */}
        <HeaderActions actions={[addAction]} history />
        <StatusView
        kind="empty"
        title="No dives yet"
        description="Download them from your dive computer, add one by hand, or import a Suunto database or a Subsurface logbook."
        systemImage="water.waves"
        actionLabel="Download from dive computer"
        onAction={openDownload}
        secondaryActionLabel="Add dive manually"
        onSecondaryAction={openAdd}
      />
      </>
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
      <Stack.Screen
        options={{
          title: selectedIds ? selectedTitle(selectedIds.size) : 'Dives',
        }}
      />
      <HeaderActions
        history={!selectedIds}
        actions={
          selectedIds
            ? [{ label: 'Done', done: true, onPress: () => setSelection(null) }]
            : [
                addAction,
                { label: 'Select', onPress: () => setSelection({ ids: new Set(), of: dives }) },
              ]
        }
      />
      <DiveListView
        sections={sections}
        unitSystem={unitSystem}
        onSelectDive={(id) => router.push(`/dives/${id}`)}
        onDeleteDive={onDeleteDive}
        resultsText={searching ? searchResultsText(matches.length, dives.length) : undefined}
        onOpenTrip={(tripId) => router.push(`/dives/trip/${tripId}`)}
        tripActions={(dive) => tripActionsFor(dive, adjacent.get(dive.id))}
        onTripAction={onTripAction}
        selectedIds={selectedIds}
        onToggleDive={toggleDive}
        onStartSelecting={(id) => setSelection({ ids: new Set([id]), of: dives })}
        mergeActions={(dive) => diveMerge.actionsFor(dive.id)}
        onMergeAction={(dive, action) => diveMerge.confirmMerge(dive.id, action)}
      />
      {selectedIds ? (
        <DiveSelectionBar
          dives={selectedDives}
          onNewTrip={() =>
            tripActions.createTrip(selectedDives, (trip) => router.push(`/dives/trip/${trip.id}`))
          }
          onAddToTrip={() => openPicker(selectedDives.map((dive) => dive.id))}
          onRemoveFromTrip={() => tripActions.removeFromTrip(selectedDives)}
        />
      ) : null}
    </>
  );
}
