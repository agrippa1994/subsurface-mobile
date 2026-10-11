// AI-generated (Claude)
// What a sync does, decided from where the two branches stand.
//
// The sync always commits the working logbook first (src/lib/git-sync.ts), so
// the decision is between the local branch - which then holds every change
// made on this device - and the server's branch as just fetched:
//
//   - the server has nothing          -> push ours
//   - same commit                     -> nothing to do
//   - ours is ahead                   -> push
//   - ours is behind                  -> take the server's logbook as is
//   - both moved on (or no shared     -> merge the server's logbook into ours,
//     history at all)                    commit with both parents, push
//
// A logbook is XML that a line-based git merge would wreck, so "merge" is the
// core's own: the server's file is imported into the loaded log, the way an
// imported file is merged (matching dives are combined, new ones added). The
// cost is that a dive deleted on one side and kept on the other comes back.

export type SyncAction =
  { kind: 'push' } | { kind: 'up-to-date' } | { kind: 'fast-forward' } | { kind: 'merge' };

export function planSync(
  local: string,
  remote: string | null,
  relation: { ahead: number; behind: number } | null,
): SyncAction {
  if (remote === null) {
    return { kind: 'push' };
  }
  if (local === remote) {
    return { kind: 'up-to-date' };
  }
  if (relation === null) {
    throw new Error('Two different commits need comparing before a sync can go on.');
  }
  if (relation.behind === 0) {
    return { kind: 'push' };
  }
  if (relation.ahead === 0) {
    return { kind: 'fast-forward' };
  }
  return { kind: 'merge' };
}

/** Short commit id, the length git itself prints. */
export function shortId(commit: string): string {
  return commit.slice(0, 7);
}
