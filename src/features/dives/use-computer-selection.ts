// AI-generated (Claude)
// Which dive computer the dive detail screen is showing.
//
// The profile is fetched before the selection moves. Its query is keyed on the
// computer, so moving first would leave the screen with no data for a moment: it
// would drop to the loading state, lose its scroll position and, in landscape,
// close the fullscreen profile. Fetching first means the profile, its events and
// the computer's details all change in the same render.
import { useCallback, useState } from 'react';

import { selectedComputerIndex, type ComputerSelection } from '@/models/dive-computers';
import { usePrepareProfile } from '@/queries/logbook';

export function useComputerSelection(diveId: number, computerCount: number) {
  const [selection, setSelection] = useState<ComputerSelection>({ diveId, index: 0 });
  const prepare = usePrepareProfile(diveId);

  const select = useCallback(
    (index: number) => {
      // A failed fetch still moves: the screen's own query then reports it.
      void prepare(index)
        .catch(() => undefined)
        .then(() => setSelection({ diveId, index }));
    },
    [diveId, prepare],
  );

  return { index: selectedComputerIndex(selection, diveId, computerCount), select };
}
