// AI-generated (Claude)
// The React side of src/lib/logbook-persist.ts.

import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { recordProblem } from '@/lib/diagnostics';
import { flush, isSaving, subscribeSaving } from '@/lib/logbook-persist';

/** True between the first unsaved mutation and the write completing. */
export function useSaving(): boolean {
  return useSyncExternalStore(subscribeSaving, isSaving, isSaving);
}

/**
 * A logbook must not be left behind in memory when the app is swiped away, so
 * anything still inside the debounce window is written as the app backgrounds.
 * Nobody is on screen to be told if that write fails, so it goes to the problem
 * log instead of being dropped.
 */
export function useFlushOnBackground(): void {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        void flush().catch((error: unknown) => recordProblem('save', error));
      }
    });
    return () => subscription.remove();
  }, []);
}
