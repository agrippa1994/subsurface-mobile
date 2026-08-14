// AI-generated (Claude)
// Fixture locations and snapshot helpers shared by the golden tests.
//
// Fixtures are referenced straight out of the pinned submodule
// (subsurface/dives/); dive files are never copied into this repo, so the tests
// always run against exactly the data the upstream core's own tests use.

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import type { Dive, DiveSite, DiveSummary } from '../../src/models';

export const REPO_ROOT = resolve(__dirname, '../..');
export const MODULE_ROOT = join(REPO_ROOT, 'modules/ssrf-core');
export const HOST_BINARY = join(MODULE_ROOT, 'build/host/ssrf-smoke');
export const DIVES_DIR = join(REPO_ROOT, 'subsurface/dives');

export function fixture(name: string): string {
  return join(DIVES_DIR, name);
}

export function tempDir(prefix = 'ssrf-test-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

/**
 * Everything about a loaded logbook that a round trip must preserve, with the
 * process-local dive ids removed.
 *
 * `dive::id` is a runtime counter that is not persisted (see cpp/API.md), so it
 * differs after every load and would make any save/load comparison fail for the
 * wrong reason. Dive site uuids *are* persisted and stay in the snapshot.
 */
export type LogSnapshot = {
  dives: Omit<Dive, 'id'>[];
  sites: DiveSite[];
};

function stripId(dive: Dive): Omit<Dive, 'id'> {
  const { id: _id, ...rest } = dive;
  return rest;
}

export async function snapshotLog(host: {
  listDives(): Promise<DiveSummary[]>;
  getDive(id: number): Promise<Dive>;
  listDiveSites(): Promise<DiveSite[]>;
}): Promise<LogSnapshot> {
  const summaries = await host.listDives();
  const dives: Omit<Dive, 'id'>[] = [];
  for (const summary of summaries) {
    dives.push(stripId(await host.getDive(summary.id)));
  }
  return { dives, sites: await host.listDiveSites() };
}
