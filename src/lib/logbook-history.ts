// AI-generated (Claude)
// The undo history, between the module and the screens.
//
// The history itself is the native module's (cpp/bindings/history.cpp). This keeps
// the last state it reported for the screens to render, and does what an undo or redo
// needs around the module's call: an undo is a mutation like any other, so the cache
// re-reads and the file is written. Free of React Native, so the Node tests reach it.

import type { QueryClient } from '@tanstack/react-query';

import {
  listDives,
  redo,
  subscribeHistory,
  undo,
  type HistoryEntry,
  type HistoryState,
} from '../../modules/ssrf-core/src';
import { flush, schedulePersist } from '@/lib/logbook-persist';
import { reconcileMerges } from '@/lib/merged-dives';
import { queryKeys } from '@/lib/query-keys';
import type { HistoryDirection } from '@/models/logbook-history';
import { t } from '@/i18n';

let state: HistoryState = {
  canUndo: false,
  canRedo: false,
  undo: null,
  redo: null,
  undoDepth: 0,
  redoDepth: 0,
  bytes: 0,
  revision: 0,
  lastAction: 'none',
};
/** The revision of the last undo or redo: what lets a screen tell why its dive went. */
let lastRestore = 0;

const listeners = new Set<(state: HistoryState) => void>();

subscribeHistory((next) => {
  state = next;
  if (next.lastAction === 'undo' || next.lastAction === 'redo') {
    lastRestore = next.revision;
  }
  for (const listener of listeners) {
    listener(next);
  }
});

export function logbookHistory(): HistoryState {
  return state;
}

export function lastRestoreRevision(): number {
  return lastRestore;
}

export function subscribeLogbookHistory(listener: (state: HistoryState) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Screens a change closed, to open again if it is undone. Keyed by entry, since the
// undo may come later and from anywhere.
const screenOfChange = new Map<number, string>();

/** Says where the newest change was made from, for its undo to go back there. */
export function rememberScreenOfLastChange(href: string): void {
  if (state.undo) {
    screenOfChange.set(state.undo.serial, href);
  }
}

/** Where to go now that `entry` has been undone, if anywhere. */
export function screenToReopen(entry: HistoryEntry): string | undefined {
  return screenOfChange.get(entry.serial);
}

let holds = 0;

/**
 * Keeps undo and redo away while `work` runs. A git sync writes the server's logbook
 * straight over the file and then reloads it: an undo landing in between would save
 * over what just arrived, and the reload would then read that back as the server's.
 */
export async function holdingHistory<T>(work: () => Promise<T>): Promise<T> {
  holds += 1;
  try {
    return await work();
  } finally {
    holds -= 1;
  }
}

/**
 * Undoes or redoes the newest step, and writes the logbook: a sync, or a force-quit
 * right after, must find the undone state on disk. Dive ids survive it, so what is on
 * screen only has to re-read; a dive that went is the screen's to leave.
 */
export async function stepHistory(
  client: QueryClient,
  direction: HistoryDirection,
): Promise<HistoryEntry> {
  if (holds > 0) {
    throw new Error(t('errors.syncRunning'));
  }
  const { entry, idsKept } = direction === 'undo' ? undo() : redo();
  reconcileMerges(new Set(listDives().map((dive) => dive.id)));
  if (idsKept) {
    // Dropped, not left stale: nothing refetches on mount in this app, and a query
    // that failed when a redo took its dive away would still say so after an undo
    // brought the dive back.
    client.removeQueries({ queryKey: queryKeys.logData(), type: 'inactive' });
    await client.invalidateQueries({ queryKey: queryKeys.logData() });
  } else {
    await client.resetQueries({ queryKey: queryKeys.logData() });
  }
  schedulePersist();
  await flush();
  return entry;
}
