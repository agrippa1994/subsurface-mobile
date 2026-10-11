// AI-generated (Claude)
// The sync's sequencing against an in-memory repository and server.
//
// A logbook here is a set of lines (one per "dive"), and merging two is their
// union - the shape of what the core's import does, without the core.

import { beforeEach, describe, expect, test } from 'vitest';

import type { CommitFileArgs, Remote } from '../../../modules/git-sync/src';
import { DEFAULT_GIT_SYNC_CONFIG, type GitSyncConfig } from '../../models/git/sync-config';
import { runSync, type SyncDeps } from './sync';

type Commit = { id: string; parents: string[]; files: Record<string, string> };

const PATH = 'logbook.ssrf';
const WORKING = '/app/logbook.ssrf';

const config: GitSyncConfig = { ...DEFAULT_GIT_SYNC_CONFIG, url: 'git@host:repo.git' };
const remote: Remote = { url: config.url, privateKey: 'key' };
const messages = { update: 'update', merge: 'merge' };

function lines(text: string | undefined): string[] {
  return (text ?? '').split('\n').filter((line) => line !== '');
}

function logbook(...dives: string[]): string {
  return [...new Set(dives)]
    .sort()
    .map((dive) => `${dive}\n`)
    .join('');
}

class World {
  commits = new Map<string, Commit>();
  /** refs/heads/main here, and on the server. */
  local: string | null = null;
  tracking: string | null = null;
  server: string | null = null;
  disk = new Map<string, string>();
  reloads = 0;
  pushes = 0;
  private next = 1;

  constructor() {
    this.disk.set(WORKING, logbook());
  }

  commit(parents: string[], files: Record<string, string>): string {
    const id = `c${this.next++}`;
    this.commits.set(id, { id, parents, files });
    return id;
  }

  /** Another device pushing: the server's branch moves on. */
  serverCommits(content: string | null): string {
    const files: Record<string, string> = content === null ? {} : { [PATH]: content };
    this.server = this.commit(this.server === null ? [] : [this.server], files);
    return this.server;
  }

  ancestors(id: string): Set<string> {
    const seen = new Set<string>();
    const stack = [id];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      if (!seen.has(current)) {
        seen.add(current);
        stack.push(...(this.commits.get(current)?.parents ?? []));
      }
    }
    return seen;
  }

  deps(): SyncDeps {
    return {
      git: {
        heads: async () => ({ local: this.local, remote: this.tracking }),
        fetchBranch: async () => {
          this.tracking = this.server;
          return this.server;
        },
        commitFile: async (args: CommitFileArgs) => {
          const content = this.disk.get(args.file) as string;
          const base = args.parents[0] ? (this.commits.get(args.parents[0]) as Commit).files : {};
          if (
            args.skipIfUnchanged &&
            args.parents.length === 1 &&
            base[args.pathInRepo] === content
          ) {
            return { commit: args.parents[0], created: false };
          }
          this.local = this.commit(args.parents, { ...base, [args.pathInRepo]: content });
          return { commit: this.local, created: true };
        },
        aheadBehind: async (local, upstream) => {
          const mine = this.ancestors(local);
          const theirs = this.ancestors(upstream);
          return {
            ahead: [...mine].filter((id) => !theirs.has(id)).length,
            behind: [...theirs].filter((id) => !mine.has(id)).length,
          };
        },
        setBranch: async (_branch, commit) => {
          this.local = commit;
        },
        extractFile: async (commit, path, destination) => {
          const content = (this.commits.get(commit) as Commit).files[path];
          if (content === undefined) {
            return false;
          }
          this.disk.set(destination, content);
          return true;
        },
        pushBranch: async () => {
          if (this.server !== null && !this.ancestors(this.local as string).has(this.server)) {
            throw new Error('non-fast-forward');
          }
          this.server = this.local;
          this.tracking = this.local;
          this.pushes++;
        },
      },
      logbook: {
        flush: async () => WORKING,
        mergeFrom: async (path) => {
          const merged = logbook(...lines(this.disk.get(WORKING)), ...lines(this.disk.get(path)));
          this.disk.set(WORKING, merged);
        },
        reload: async () => {
          this.reloads++;
        },
        isEmpty: async () => lines(this.disk.get(WORKING)).length === 0,
      },
      tempPath: () => '/tmp/server.ssrf',
      removeFile: (path) => {
        this.disk.delete(path);
      },
    };
  }

  sync(mode: 'sync' | 'pull' = 'sync') {
    return runSync(mode, config, remote, messages, this.deps());
  }

  pull() {
    return this.sync('pull');
  }

  serverLogbook(): string | undefined {
    return this.server === null ? undefined : this.commits.get(this.server)?.files[PATH];
  }
}

let world: World;

beforeEach(() => {
  world = new World();
});

describe('runSync', () => {
  test('starts the history on an empty server', async () => {
    world.disk.set(WORKING, logbook('dive 1'));
    const result = await world.sync();
    expect(result).toMatchObject({ outcome: 'sent', pushed: true, logbookChanged: false });
    expect(world.serverLogbook()).toBe(logbook('dive 1'));
    expect(world.commits.get(world.server as string)?.parents).toEqual([]);
  });

  test('a first sync merges into what the server has instead of overwriting it', async () => {
    world.serverCommits(logbook('server dive'));
    world.disk.set(WORKING, logbook('phone dive'));
    const result = await world.sync();
    expect(result).toMatchObject({ outcome: 'merged', pushed: true, logbookChanged: true });
    expect(world.serverLogbook()).toBe(logbook('phone dive', 'server dive'));
  });

  test('a first sync on a fresh install just takes the server logbook', async () => {
    const server = world.serverCommits(logbook('server dive'));
    world.disk.set(WORKING, logbook());
    const result = await world.sync();
    expect(result).toMatchObject({ outcome: 'received', pushed: false, logbookChanged: true });
    expect(world.local).toBe(server);
    expect(world.disk.get(WORKING)).toBe(logbook('server dive'));
  });

  test('a first sync into a repository without a logbook adds it on top', async () => {
    const readme = world.serverCommits(null);
    world.disk.set(WORKING, logbook('dive 1'));
    const result = await world.sync();
    expect(result).toMatchObject({ outcome: 'sent', pushed: true });
    expect(world.commits.get(world.server as string)?.parents).toEqual([readme]);
  });

  test('nothing new anywhere', async () => {
    world.disk.set(WORKING, logbook('dive 1'));
    await world.sync();
    const pushes = world.pushes;
    const result = await world.sync();
    expect(result).toMatchObject({ outcome: 'up-to-date', pushed: false });
    expect(world.pushes).toBe(pushes);
  });

  test('pushes local edits', async () => {
    await world.sync();
    world.disk.set(WORKING, logbook('dive 1', 'dive 2'));
    const result = await world.sync();
    expect(result).toMatchObject({ outcome: 'sent', pushed: true });
    expect(world.serverLogbook()).toBe(logbook('dive 1', 'dive 2'));
  });

  test('takes the server logbook byte for byte when only the server changed', async () => {
    world.disk.set(WORKING, logbook('dive 1', 'dive 2'));
    await world.sync();
    // Another device deleted dive 2: a fast-forward must honour that.
    const server = world.serverCommits(logbook('dive 1'));
    const result = await world.sync();
    expect(result).toMatchObject({ outcome: 'received', pushed: false, logbookChanged: true });
    expect(world.disk.get(WORKING)).toBe(logbook('dive 1'));
    expect(world.local).toBe(server);
    expect(world.reloads).toBe(1);
  });

  test('merges when both sides changed, with both parents, then pushes', async () => {
    world.disk.set(WORKING, logbook('dive 1'));
    await world.sync();
    const server = world.serverCommits(logbook('dive 1', 'from laptop'));
    world.disk.set(WORKING, logbook('dive 1', 'from phone'));

    const result = await world.sync();
    expect(result).toMatchObject({ outcome: 'merged', pushed: true, logbookChanged: true });
    expect(world.serverLogbook()).toBe(logbook('dive 1', 'from laptop', 'from phone'));
    const merge = world.commits.get(world.server as string) as Commit;
    expect(merge.parents).toHaveLength(2);
    expect(merge.parents[1]).toBe(server);
    expect(world.disk.has('/tmp/server.ssrf')).toBe(false);
  });

  test('keeps the logbook when the server deleted it', async () => {
    world.disk.set(WORKING, logbook('dive 1'));
    await world.sync();
    world.serverCommits(null);
    const result = await world.sync();
    expect(result).toMatchObject({ outcome: 'sent', pushed: true });
    expect(world.serverLogbook()).toBe(logbook('dive 1'));
  });

  test('a pull commits local edits but does not push them', async () => {
    world.disk.set(WORKING, logbook('dive 1'));
    await world.sync();
    world.serverCommits(logbook('dive 1', 'from laptop'));
    world.disk.set(WORKING, logbook('dive 1', 'from phone'));
    const server = world.server;

    const result = await world.pull();
    expect(result).toMatchObject({ outcome: 'merged', pushed: false, unpushed: true });
    expect(world.server).toBe(server);
    expect(world.disk.get(WORKING)).toBe(logbook('dive 1', 'from laptop', 'from phone'));

    // The next sync sends the merge.
    const next = await world.sync();
    expect(next).toMatchObject({ outcome: 'sent', pushed: true });
    expect(world.serverLogbook()).toBe(logbook('dive 1', 'from laptop', 'from phone'));
  });

  test('a push the server refuses fails the sync', async () => {
    world.disk.set(WORKING, logbook('dive 1'));
    await world.sync();
    world.disk.set(WORKING, logbook('dive 1', 'dive 2'));
    const deps = world.deps();
    deps.git.pushBranch = async () => {
      throw new Error('refused');
    };
    await expect(runSync('sync', config, remote, messages, deps)).rejects.toThrow('refused');
  });
});
