// AI-generated (Claude)
// Merging dives as the screens ask for it: what a dive offers, the question, the
// mutation, the save and the feedback, in one place so the list and the dive
// detail behave alike.
//
// Nothing is decided about navigation here: the merge records where the source
// dives went, and a detail screen open on one of them moves on by itself
// (see src/lib/merged-dives.ts).
import { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';

import { previewMerge } from '../../../modules/ssrf-core/src';
import { operationFailed, operationSucceeded, warned } from '@/lib/haptics';
import { flush } from '@/lib/logbook-persist';
import { mergeActionsFor, mergeConfirmation, mergeNeighbours, type MergeAction } from '@/models/dive-merge';
import { describeError, formatErrorLine } from '@/models/errors';
import { useDives, useMergePairs, useTrips } from '@/queries/logbook';
import { useMergeDives } from '@/queries/logbook-mutations';
import { useUnitSystem } from '@/queries/settings';

export type DiveMerge = {
  actionsFor: (diveId: number) => MergeAction[];
  /** Says what the merge will do, and does it if the user agrees. */
  confirmMerge: (diveId: number, action: MergeAction) => void;
};

export function useDiveMerge(): DiveMerge {
  const { data: dives = [] } = useDives();
  const { data: pairs = [] } = useMergePairs();
  const { data: trips = [] } = useTrips();
  const unitSystem = useUnitSystem();
  const merge = useMergeDives();

  const divesById = useMemo(() => new Map(dives.map((dive) => [dive.id, dive])), [dives]);
  const neighbours = useMemo(() => mergeNeighbours(pairs), [pairs]);

  const actionsFor = useCallback(
    (diveId: number) => mergeActionsFor(diveId, neighbours, divesById),
    [neighbours, divesById],
  );

  const fail = useCallback((error: unknown) => {
    operationFailed();
    Alert.alert('The dives could not be merged', formatErrorLine(describeError(error)));
  }, []);

  const confirmMerge = useCallback(
    (diveId: number, action: MergeAction) => {
      const first = divesById.get(diveId);
      const second = divesById.get(action.otherId);
      if (!first || !second) {
        return;
      }
      const ids = [first.id, second.id];
      let question;
      try {
        question = mergeConfirmation([first, second], previewMerge(ids), trips, unitSystem);
      } catch (error) {
        fail(error);
        return;
      }
      warned();
      Alert.alert(question.title, question.message, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: question.confirmLabel,
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await merge.mutateAsync(ids);
                // Same as a delete: a force-quit right after must not find the
                // dives apart again on disk.
                await flush();
                operationSucceeded();
              } catch (error) {
                fail(error);
              }
            })();
          },
        },
      ]);
    },
    [divesById, fail, merge, trips, unitSystem],
  );

  return useMemo(() => ({ actionsFor, confirmMerge }), [actionsFor, confirmMerge]);
}
