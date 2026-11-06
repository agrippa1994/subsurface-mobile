// AI-generated (Claude)
// One trip: its summary, notes and dives.
//
// Trip ids are process-local like dive ids, so the screen looks its trip up in
// the list rather than assuming it is there: it is gone once its last dive has
// left, and after a reload. The totals are the core's statistics for this trip.
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';

import { HeaderAction } from '@/components/header-action';
import { StatusView } from '@/components/status-view';
import { TripDetailView } from '@/components/trip-detail-view';
import { useTripActions } from '@/features/dives/use-trip-actions';
import type { DiveStackPath } from '@/app/(tabs)/dives/[id]';
import { describeError, formatErrorLine } from '@/models/errors';
import { sortDivesNewestFirst } from '@/models/dive-list';
import { tripSummaryFooter, tripSummaryRows, tripTitle } from '@/models/trips';
import { useDives, useTrips, useTripStatistics } from '@/queries/logbook';
import { useUnitSystem } from '@/queries/settings';

export default function TripDetailScreen({ stackPath = '/dives' }: { stackPath?: DiveStackPath }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const router = useRouter();
  const unitSystem = useUnitSystem();
  const tripsQuery = useTrips();
  const divesQuery = useDives();
  const statsQuery = useTripStatistics(tripId);
  const tripActions = useTripActions();

  const trip = tripsQuery.data?.find((candidate) => candidate.id === tripId);
  const dives = useMemo(
    () => sortDivesNewestFirst((divesQuery.data ?? []).filter((dive) => dive.tripId === tripId)),
    [divesQuery.data, tripId],
  );

  const failure = tripsQuery.error ?? divesQuery.error;
  if (failure) {
    return (
      <StatusView
        kind="error"
        title="The trip could not be opened"
        description={formatErrorLine(describeError(failure))}
        systemImage="exclamationmark.triangle"
      />
    );
  }
  if (tripsQuery.isPending || divesQuery.isPending) {
    return <StatusView kind="loading" title="Opening trip" />;
  }
  if (!trip) {
    return (
      <>
        <Stack.Screen options={{ title: 'Trip' }} />
        <StatusView
          kind="empty"
          title="This trip is gone"
          description="A trip ends when its last dive leaves it. The dives are still in your logbook."
          systemImage="suitcase"
          actionLabel="Back"
          onAction={() => router.back()}
        />
      </>
    );
  }

  const openEditor = () => router.push(`${stackPath}/trip/edit/${trip.id}`);
  return (
    <>
      <Stack.Screen options={{ title: tripTitle(trip.location) }} />
      <HeaderAction label="Edit" onPress={openEditor} />
      <TripDetailView
        summary={tripSummaryRows(trip, statsQuery.data, unitSystem)}
        summaryFooter={tripSummaryFooter(trip, statsQuery.data)}
        location={trip.location}
        notes={trip.notes}
        dives={dives}
        unitSystem={unitSystem}
        onEdit={openEditor}
        onSelectDive={(diveId) => router.push(`${stackPath}/${diveId}`)}
        onRemoveDive={(dive) =>
          // The last dive takes the trip with it: there is nothing left to show.
          tripActions.removeFromTrip([dive], dives.length === 1 ? () => router.back() : undefined)
        }
        onUngroup={() => tripActions.ungroupTrip(trip, dives, () => router.back())}
      />
    </>
  );
}
