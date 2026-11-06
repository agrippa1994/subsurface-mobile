// AI-generated (Claude)
// A screen whose dive, trip or site an undo or redo took away goes back, once it is
// on screen. Only then: going away for any other reason already has its own way out,
// and a screen behind the one in front waits until it is the one in front.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, useSyncExternalStore } from 'react';

import { lastRestoreRevision, subscribeLogbookHistory } from '@/lib/logbook-history';

export function useLastRestore(): number {
  return useSyncExternalStore(subscribeLogbookHistory, lastRestoreRevision);
}

export function useLeaveWhenGone(gone: boolean): void {
  const router = useRouter();
  const lastRestore = useLastRestore();
  const [openedAt] = useState(lastRestore);

  useFocusEffect(
    useCallback(() => {
      if (gone && lastRestore !== openedAt && router.canGoBack()) {
        router.back();
      }
    }, [gone, lastRestore, openedAt, router]),
  );
}
