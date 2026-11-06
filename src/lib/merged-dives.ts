// AI-generated (Claude)
// Where a merged dive went.
//
// A merge gives the dive a new id, and any screen open on one of the source dives
// is left holding an id the core no longer knows: the detail screen it was started
// from, or one further back in another tab's stack. Those screens ask here, and
// move on to the merged dive when they are next on screen.
//
// Held for the life of the process and never cleared: the core's dive ids only
// ever count up (dive_getUniqID), so an old entry cannot come to mean another dive
// after a load. The worst it can do is lead to a dive that has gone since, which
// the screen reports as for any other stale id.

import { useSyncExternalStore } from 'react';

const mergedInto = new Map<number, number>();
const listeners = new Set<() => void>();

export function recordMerge(sourceIds: readonly number[], mergedId: number): void {
  for (const id of sourceIds) {
    mergedInto.set(id, mergedId);
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The id this dive goes by now, following merges of merges. */
export function currentDiveId(id: number): number {
  let current = id;
  for (let next = mergedInto.get(current); next !== undefined; next = mergedInto.get(current)) {
    current = next;
  }
  return current;
}

/**
 * The same for a screen. A store rather than a plain call: the React Compiler
 * takes a call to be pure, so it would keep the first answer for as long as the
 * screen has the same id.
 */
export function useCurrentDiveId(id: number): number {
  return useSyncExternalStore(subscribe, () => currentDiveId(id));
}
