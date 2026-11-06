// AI-generated (Claude)
// The trip operations as the screens ask for them: the confirmation where one is
// due, the mutation, the save and the feedback, in one place so the list, a dive
// and a trip behave alike.
//
// Moving a dive is undone by moving it back, so it just happens - unless it is
// the last dive of a trip that has a location or notes: the core removes that
// trip, and those are gone (see tripLossWarning).
import { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';

import { operationFailed, selectionChanged, warned } from '@/lib/haptics';
import { flush } from '@/lib/logbook-persist';
import type { DiveSummary, Trip } from '@/models';
import { describeError, formatErrorLine } from '@/models/errors';
import { diveCountText, tripLossWarning, tripsEmptiedBy, tripTitle } from '@/models/trips';
import { useTrips } from '@/queries/logbook';
import {
  useAddDivesToTrip,
  useCreateTrip,
  useRemoveDivesFromTrip,
} from '@/queries/logbook-mutations';

export type TripActions = {
  /** `onDone` gets the new trip. */
  createTrip: (dives: readonly DiveSummary[], onDone?: (trip: Trip) => void) => void;
  addToTrip: (dives: readonly DiveSummary[], tripId: number, onDone?: () => void) => void;
  removeFromTrip: (dives: readonly DiveSummary[], onDone?: () => void) => void;
  /** Takes all of a trip's dives out of it, which ends the trip. Always asks. */
  ungroupTrip: (trip: Trip, dives: readonly DiveSummary[], onDone?: () => void) => void;
};

/** Saved straight away: the screen behind may be closed the moment this returns. */
async function apply<T>(work: () => Promise<T>, onDone?: (result: T) => void): Promise<void> {
  try {
    const result = await work();
    await flush();
    selectionChanged();
    onDone?.(result);
  } catch (error) {
    operationFailed();
    Alert.alert('The trip could not be changed', formatErrorLine(describeError(error)));
  }
}

export function useTripActions(): TripActions {
  const { data: trips = [] } = useTrips();
  const create = useCreateTrip();
  const add = useAddDivesToTrip();
  const remove = useRemoveDivesFromTrip();

  const confirmLoss = useCallback(
    (dives: readonly DiveSummary[], except: number, proceed: () => void) => {
      const warning = tripLossWarning(tripsEmptiedBy(dives, trips, except));
      if (!warning) {
        proceed();
        return;
      }
      warned();
      Alert.alert(warning.title, warning.message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: proceed },
      ]);
    },
    [trips],
  );

  return useMemo(() => {
    const ids = (dives: readonly DiveSummary[]) => dives.map((dive) => dive.id);
    return {
      createTrip: (dives, onDone) =>
        confirmLoss(dives, 0, () =>
          void apply(() => create.mutateAsync({ diveIds: ids(dives) }), onDone),
        ),
      addToTrip: (dives, tripId, onDone) =>
        confirmLoss(dives, tripId, () =>
          void apply(() => add.mutateAsync({ diveIds: ids(dives), tripId }), () => onDone?.()),
        ),
      removeFromTrip: (dives, onDone) =>
        confirmLoss(dives, 0, () =>
          void apply(() => remove.mutateAsync(ids(dives)), () => onDone?.()),
        ),
      ungroupTrip: (trip, dives, onDone) => {
        warned();
        Alert.alert(
          `Ungroup "${tripTitle(trip.location)}"?`,
          `The trip goes away with its location and notes. Its ${diveCountText(dives.length)} ` +
            'stay in your logbook, outside any trip.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Ungroup',
              style: 'destructive',
              onPress: () =>
                void apply(() => remove.mutateAsync(ids(dives)), () => onDone?.()),
            },
          ],
        );
      },
    };
  }, [add, confirmLoss, create, remove]);
}
