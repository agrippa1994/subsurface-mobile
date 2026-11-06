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

const mergedInto = new Map<number, number>();

export function recordMerge(sourceIds: readonly number[], mergedId: number): void {
  for (const id of sourceIds) {
    mergedInto.set(id, mergedId);
  }
}

/** The id this dive goes by now, following merges of merges. */
export function currentDiveId(id: number): number {
  let current = id;
  for (let next = mergedInto.get(current); next !== undefined; next = mergedInto.get(current)) {
    current = next;
  }
  return current;
}
