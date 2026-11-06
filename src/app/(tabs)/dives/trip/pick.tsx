// AI-generated (Claude)
// The sheet that sends dives to a trip: a new one, any existing one with the
// closest in time first, or out of the trip they are in.
//
// It takes the dives by id in a route parameter, from wherever it was opened.
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { HeaderAction } from '@/components/header-action';
import { StatusView } from '@/components/status-view';
import { TripPickerView } from '@/components/trip-picker-view';
import { useTripActions } from '@/features/dives/use-trip-actions';
import type { DiveStackPath } from '@/app/(tabs)/dives/[id]';
import { useTheme } from '@/hooks/use-theme';
import { describeError, formatErrorLine } from '@/models/errors';
import { nearestTrips, parseDiveIds, searchTrips, tripPickerTitle } from '@/models/trips';
import { useDives, useTrips } from '@/queries/logbook';

export default function TripPickScreen({ stackPath = '/dives' }: { stackPath?: DiveStackPath }) {
  const params = useLocalSearchParams<{ diveIds: string }>();
  const router = useRouter();
  const theme = useTheme();
  const divesQuery = useDives();
  const tripsQuery = useTrips();
  const tripActions = useTripActions();
  const [query, setQuery] = useState('');

  const dives = useMemo(() => {
    const ids = new Set(parseDiveIds(params.diveIds));
    return (divesQuery.data ?? []).filter((dive) => ids.has(dive.id));
  }, [divesQuery.data, params.diveIds]);
  const candidates = useMemo(
    () => nearestTrips(tripsQuery.data ?? [], dives),
    [tripsQuery.data, dives],
  );
  const trips = useMemo(() => searchTrips(candidates, query), [candidates, query]);

  const failure = divesQuery.error ?? tripsQuery.error;
  if (failure) {
    return (
      <StatusView
        kind="error"
        title="The trips could not be read"
        description={formatErrorLine(describeError(failure))}
        systemImage="exclamationmark.triangle"
      />
    );
  }
  if (divesQuery.isPending || tripsQuery.isPending) {
    return <StatusView kind="loading" title="Reading trips" />;
  }

  return (
    // An opaque ground: on the sheet's glass the list behind blurs through the rows.
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen options={{ title: tripPickerTitle(dives) }} />
      <HeaderAction label="Cancel" icon="xmark" onPress={() => router.back()} />
      <Stack.SearchBar
        placeholder="Location or date"
        autoCapitalize="none"
        hideWhenScrolling={false}
        onChangeText={(event) => setQuery(event.nativeEvent.text)}
        onCancelButtonPress={() => setQuery('')}
      />
      <TripPickerView
        trips={trips}
        hasCandidates={candidates.length > 0}
        searching={query.trim() !== ''}
        canRemove={dives.some((dive) => dive.tripId !== 0)}
        onNewTrip={() =>
          tripActions.createTrip(dives, (trip) => {
            // The sheet goes and the new trip comes up in the stack below it, so
            // it can be named right away.
            router.back();
            router.push(`${stackPath}/trip/${trip.id}`);
          })
        }
        onPickTrip={(trip) => tripActions.addToTrip(dives, trip.id, () => router.back())}
        onRemove={() => tripActions.removeFromTrip(dives, () => router.back())}
      />
    </View>
  );
}
