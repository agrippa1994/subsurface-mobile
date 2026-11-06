// AI-generated (Claude)
// The trip operations as the screens ask for them: the mutation, the save and the
// feedback, in one place so the list, a dive and a trip behave alike.
//
// None of them asks first. They all undo, with a trip's location and notes coming
// back with it, and the toast says what happened (see src/lib/logbook-history.ts).
import { useMemo } from 'react';
import { Alert } from 'react-native';

import { operationFailed, selectionChanged } from '@/lib/haptics';
import { flush } from '@/lib/logbook-persist';
import type { DiveSummary, Trip } from '@/models';
import { describeError, formatErrorLine } from '@/models/errors';
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
  /** Takes all of a trip's dives out of it, which ends the trip. */
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
  const create = useCreateTrip();
  const add = useAddDivesToTrip();
  const remove = useRemoveDivesFromTrip();

  return useMemo(() => {
    const ids = (dives: readonly DiveSummary[]) => dives.map((dive) => dive.id);
    return {
      createTrip: (dives, onDone) =>
        void apply(() => create.mutateAsync({ diveIds: ids(dives) }), onDone),
      addToTrip: (dives, tripId, onDone) =>
        void apply(() => add.mutateAsync({ diveIds: ids(dives), tripId }), () => onDone?.()),
      removeFromTrip: (dives, onDone) =>
        void apply(() => remove.mutateAsync(ids(dives)), () => onDone?.()),
      ungroupTrip: (_trip, dives, onDone) =>
        void apply(() => remove.mutateAsync(ids(dives)), () => onDone?.()),
    };
  }, [add, create, remove]);
}
