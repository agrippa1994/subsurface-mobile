// AI-generated (Claude)
// Which dive computer the dive detail screen is showing.
//
// The profile is fetched before the selection moves. Its query is keyed on the
// computer, so moving first would leave the screen with no data for a moment: it
// would drop to the loading state, lose its scroll position and, in landscape,
// close the fullscreen profile. Fetching first means the profile, its events and
// the computer's details all change in the same render.
//
// Making a computer first follows the same rule: the reordered dive and the new
// first computer's profile are in the cache before the selection moves to index 0,
// so the screen goes on showing the same computer, now at the front.
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { operationFailed, operationSucceeded } from '@/lib/haptics';
import { flush } from '@/lib/logbook-persist';
import { describeError, formatErrorLine } from '@/models/errors';
import { selectedComputerIndex, type ComputerSelection } from '@/models/dive-computers';
import { usePrepareProfile } from '@/queries/logbook';
import { useMakeFirstDiveComputer } from '@/queries/logbook-mutations';

export function useComputerSelection(diveId: number, computerCount: number) {
  const [selection, setSelection] = useState<ComputerSelection>({ diveId, index: 0 });
  const prepare = usePrepareProfile(diveId);
  const reorder = useMakeFirstDiveComputer();

  const select = useCallback(
    (index: number) => {
      // A failed fetch still moves: the screen's own query then reports it.
      void prepare(index)
        .catch(() => undefined)
        .then(() => setSelection({ diveId, index }));
    },
    [diveId, prepare],
  );

  const makeFirst = useCallback(
    (index: number) => {
      if (index <= 0) {
        return;
      }
      void (async () => {
        try {
          await reorder.mutateAsync({
            id: diveId,
            dcIndex: index,
            onApplied: async () => {
              await prepare(0).catch(() => undefined);
              setSelection({ diveId, index: 0 });
            },
          });
          // As after a merge: a force-quit right after must find the new order on disk.
          await flush();
          operationSucceeded();
        } catch (error) {
          operationFailed();
          Alert.alert('The computer could not be made first', formatErrorLine(describeError(error)));
        }
      })();
    },
    [diveId, prepare, reorder],
  );

  return { index: selectedComputerIndex(selection, diveId, computerCount), select, makeFirst };
}
