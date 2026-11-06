// AI-generated (Claude)
// Undo and redo as a screen presses them: the step, the feedback, and the screen the
// change closed. The toast and the header menu go through here alike.

import { useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { Alert } from 'react-native';

import { operationFailed, operationSucceeded } from '@/lib/haptics';
import {
  logbookHistory,
  screenToReopen,
  stepHistory,
  subscribeLogbookHistory,
} from '@/lib/logbook-history';
import { describeError, formatErrorLine } from '@/models/errors';
import { redoTitle, undoTitle, type HistoryDirection } from '@/models/logbook-history';
import type { HistoryState } from '@/models';

/** The history as it stands, for what renders from it. */
export function useLogbookHistory(): HistoryState {
  return useSyncExternalStore(subscribeLogbookHistory, logbookHistory);
}

export function useHistoryActions(): { step: (direction: HistoryDirection) => void } {
  const client = useQueryClient();
  const router = useRouter();

  const step = useCallback(
    (direction: HistoryDirection) => {
      void (async () => {
        try {
          const entry = await stepHistory(client, direction);
          operationSucceeded();
          const screen = direction === 'undo' ? screenToReopen(entry) : undefined;
          if (screen) {
            router.navigate(screen as Href);
          }
        } catch (error) {
          operationFailed();
          Alert.alert(
            direction === 'undo' ? 'Could not undo' : 'Could not redo',
            formatErrorLine(describeError(error)),
          );
        }
      })();
    },
    [client, router],
  );

  return useMemo(() => ({ step }), [step]);
}

export type HistoryMenu = {
  /** "Undo Delete Dive 42", or "Undo" with nothing to undo. */
  undoTitle: string;
  redoTitle: string;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
};

/** What a header menu offers; null while the history is empty, so it can stay away. */
export function useHistoryMenu(): HistoryMenu | null {
  const history = useLogbookHistory();
  const { step } = useHistoryActions();
  return useMemo(
    () =>
      history.canUndo || history.canRedo
        ? {
            undoTitle: history.undo ? undoTitle(history.undo) : 'Undo',
            redoTitle: history.redo ? redoTitle(history.redo) : 'Redo',
            canUndo: history.canUndo,
            canRedo: history.canRedo,
            undo: () => step('undo'),
            redo: () => step('redo'),
          }
        : null,
    [history, step],
  );
}
