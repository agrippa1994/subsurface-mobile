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

type Merge = { sources: readonly number[]; merged: number; undone: boolean };

const merges: Merge[] = [];
const mergedInto = new Map<number, number>();
const listeners = new Set<() => void>();

function rebuild(): void {
  mergedInto.clear();
  for (const { sources, merged, undone } of merges) {
    if (undone) {
      // The merged dive is what went, and a screen on it goes back to the first
      // of the dives it was made of.
      mergedInto.set(merged, sources[0]);
    } else {
      for (const id of sources) {
        mergedInto.set(id, merged);
      }
    }
  }
  listeners.forEach((listener) => listener());
}

export function recordMerge(sourceIds: readonly number[], mergedId: number): void {
  merges.push({ sources: sourceIds, merged: mergedId, undone: false });
  rebuild();
}

/**
 * After an undo or redo: a merge may have been taken back, or put back again, and
 * ids survive both (cpp/bindings/history.cpp). Which way a merge leads depends on
 * which side of it the log now holds.
 */
export function reconcileMerges(liveIds: ReadonlySet<number>): void {
  if (merges.length === 0) {
    return;
  }
  for (const merge of merges) {
    merge.undone = !liveIds.has(merge.merged) && merge.sources.some((id) => liveIds.has(id));
  }
  rebuild();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The id this dive goes by now, following merges of merges. */
export function currentDiveId(id: number): number {
  let current = id;
  const seen = new Set([id]);
  for (let next = mergedInto.get(current); next !== undefined; next = mergedInto.get(current)) {
    if (seen.has(next)) {
      break;
    }
    seen.add(next);
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
