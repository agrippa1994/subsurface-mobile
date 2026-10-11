// AI-generated (Claude)
// One sync of the logbook with its git repository.
//
// Order matters, and is chosen so that the slow, interruptible part comes
// first and changes nothing:
//
//   1. fetch the server's branch (network; touches only a remote-tracking ref)
//   2. write pending edits and commit the working logbook if it changed
//   3. decide (src/models/git/sync-plan.ts) and bring in the server's logbook
//   4. push, unless this is a pull
//
// Everything that touches the app - flushing, merging, reloading - comes in
// through `SyncDeps`, so this file is plain sequencing that the Node tests can
// drive with a fake repository (src/lib/git/sync.test.ts).

import type { CommitFileArgs, Heads, Remote } from '../../../modules/git-sync/src';
import type { GitSyncConfig } from '../../models/git/sync-config';
import { planSync } from '../../models/git/sync-plan';

export type SyncDeps = {
  git: {
    heads(branch: string): Promise<Heads>;
    fetchBranch(branch: string, remote: Remote): Promise<string | null>;
    commitFile(args: CommitFileArgs): Promise<{ commit: string; created: boolean }>;
    aheadBehind(local: string, upstream: string): Promise<{ ahead: number; behind: number }>;
    setBranch(branch: string, commit: string): Promise<void>;
    extractFile(commit: string, pathInRepo: string, destination: string): Promise<boolean>;
    pushBranch(branch: string, remote: Remote): Promise<void>;
  };
  logbook: {
    /** Writes pending edits to disk and returns the working logbook's path. */
    flush(): Promise<string>;
    /** Merges a logbook file into the loaded one and writes the result. */
    mergeFrom(path: string): Promise<void>;
    /** Reloads the working logbook after its file was replaced. */
    reload(): Promise<void>;
    /** True when the loaded logbook has no dives and no sites. */
    isEmpty(): Promise<boolean>;
  };
  /** A path to extract the server's logbook to. */
  tempPath(): string;
  removeFile(path: string): void;
};

export type SyncMode = 'sync' | 'pull';

export type SyncOutcome =
  /** Nothing new on either side. */
  | 'up-to-date'
  /** Only this device had changes; they were pushed (or, pulling, committed). */
  | 'sent'
  /** Only the server had changes; the logbook now is the server's. */
  | 'received'
  /** Both had changes; the server's were merged in. */
  | 'merged';

export type SyncResult = {
  outcome: SyncOutcome;
  /** Whether the logbook on screen changed, so the caller refreshes it. */
  logbookChanged: boolean;
  pushed: boolean;
  /** Commits on this device the server does not have yet (pull only). */
  unpushed: boolean;
  head: string;
};

export type CommitMessages = { update: string; merge: string };

export async function runSync(
  mode: SyncMode,
  config: GitSyncConfig,
  remote: Remote,
  messages: CommitMessages,
  deps: SyncDeps,
): Promise<SyncResult> {
  const { git, logbook } = deps;
  const { branch, pathInRepo } = config;

  const before = await git.heads(branch);
  const remoteHead = await git.fetchBranch(branch, remote);
  const logbookPath = await logbook.flush();

  const commit = (parents: string[], message: string, skipIfUnchanged: boolean) =>
    git.commitFile({
      file: logbookPath,
      pathInRepo,
      branch,
      parents,
      message,
      authorName: config.authorName,
      authorEmail: config.authorEmail,
      skipIfUnchanged,
    });

  // Merges the server's logbook into the loaded one. False when the server's
  // commit has no logbook at that path (a fresh repository with a README).
  const mergeServerLogbook = async (from: string): Promise<boolean> => {
    const temp = deps.tempPath();
    try {
      if (!(await git.extractFile(from, pathInRepo, temp))) {
        return false;
      }
      await logbook.mergeFrom(temp);
      return true;
    } finally {
      deps.removeFile(temp);
    }
  };

  let head: string;
  let outcome: SyncOutcome;
  let logbookChanged = false;

  // Replaces the working logbook with the server's, byte for byte - written
  // straight over it rather than re-serialized, so the next sync does not find
  // a reformatted file to commit. False when the server has no logbook.
  const takeServerLogbook = async (from: string): Promise<boolean> => {
    if (!(await git.extractFile(from, pathInRepo, logbookPath))) {
      return false;
    }
    await git.setBranch(branch, from);
    await logbook.reload();
    return true;
  };

  if (before.local === null && remoteHead !== null) {
    // First sync against a repository that already has history. A device with
    // nothing on it yet simply takes the server's logbook; anything else is
    // merged into it, never put in its place.
    if ((await logbook.isEmpty()) && (await takeServerLogbook(remoteHead))) {
      head = remoteHead;
      outcome = 'received';
      logbookChanged = true;
    } else {
      logbookChanged = await mergeServerLogbook(remoteHead);
      head = (await commit([remoteHead], messages.update, false)).commit;
      outcome = logbookChanged ? 'merged' : 'sent';
    }
  } else if (before.local === null) {
    // Nothing anywhere yet: this device starts the history.
    head = (await commit([], messages.update, false)).commit;
    outcome = 'sent';
  } else {
    const local = (await commit([before.local], messages.update, true)).commit;
    const relation =
      remoteHead !== null && remoteHead !== local ? await git.aheadBehind(local, remoteHead) : null;
    const plan = planSync(local, remoteHead, relation);

    switch (plan.kind) {
      case 'up-to-date':
        head = local;
        outcome = 'up-to-date';
        break;
      case 'push':
        head = local;
        outcome = 'sent';
        break;
      case 'fast-forward': {
        const server = remoteHead as string;
        if (await takeServerLogbook(server)) {
          logbookChanged = true;
          head = server;
          outcome = 'received';
        } else {
          // The server removed the logbook. Ours goes back on top of its
          // history rather than the deletion winning.
          head = (await commit([server], messages.update, false)).commit;
          outcome = 'sent';
        }
        break;
      }
      case 'merge': {
        const server = remoteHead as string;
        logbookChanged = await mergeServerLogbook(server);
        head = (await commit([local, server], messages.merge, false)).commit;
        outcome = 'merged';
        break;
      }
    }
  }

  const needsPush = remoteHead !== head;
  let pushed = false;
  if (mode === 'sync' && needsPush) {
    await git.pushBranch(branch, remote);
    pushed = true;
  }
  return { outcome, logbookChanged, pushed, unpushed: needsPush && !pushed, head };
}
