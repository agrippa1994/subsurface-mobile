// AI-generated (Claude)
// "Make first dive computer" through the bindings: dive 224 of abitofeverything has
// three computers. The order is what SSI upload, CSV export and the summary read,
// so it must hold in memory, in the saved file, and come back on undo.

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { Dive } from '../src/models';
import { computerLabels } from '../src/models/dive-computers';
import { changeDone, changeTitle } from '../src/models/logbook-history';
import { fixture } from './harness/fixtures';
import { SsrfHost } from './harness/ssrf-host';

const ORIGINAL = ['Uemis Zurich', 'Heinrichs Weikamp OSTC 2N', 'Shearwater Petrel'];
const dir = mkdtempSync(join(tmpdir(), 'ssrf-make-first-'));

const host = new SsrfHost();
let dive: Dive;
let file = 0;

async function dive224(on: SsrfHost = host): Promise<Dive> {
  const summary = (await on.listDives()).find((candidate) => candidate.number === 224);
  return on.getDive(summary!.id);
}

async function saved(): Promise<string> {
  const path = join(dir, `saved-${(file += 1)}.ssrf`);
  await host.saveToXML(path);
  return path;
}

beforeEach(async () => {
  await host.loadFromXML(fixture('abitofeverything.ssrf'));
  dive = await dive224();
});

afterAll(async () => {
  await host.close();
});

describe('makeFirstDiveComputer', () => {
  it('moves the chosen computer to the front and keeps the rest in order', async () => {
    expect(computerLabels(dive.dcs)).toEqual(ORIGINAL);
    const result = await host.makeFirstDiveComputer(dive.id, 2);
    expect(computerLabels(result.dcs)).toEqual([ORIGINAL[2], ORIGINAL[0], ORIGINAL[1]]);

    const reread = await host.getDive(dive.id);
    expect(reread.id).toBe(dive.id);
    expect(computerLabels(reread.dcs)).toEqual([ORIGINAL[2], ORIGINAL[0], ORIGINAL[1]]);
    expect(reread.dcs[0].sampleCount).toBe(dive.dcs[2].sampleCount);
    // The dive stays where it was: same trip, site, number and place in the list.
    expect(reread.tripId).toBe(dive.tripId);
    expect(reread.siteUuid).toBe(dive.siteUuid);
    expect(reread.number).toBe(dive.number);
    expect((await host.listDives()).map((d) => d.id)).toContain(dive.id);
    // The default profile is now the new first computer's.
    const profile = await host.getProfile(dive.id);
    expect(profile.entry.length).toBe((await host.getProfile(dive.id, 0)).entry.length);
  });

  it('keeps the new order through a save and a load', async () => {
    await host.makeFirstDiveComputer(dive.id, 1);
    const path = await saved();
    const other = new SsrfHost();
    try {
      await other.loadFromXML(path);
      const loaded = await dive224(other);
      expect(computerLabels(loaded.dcs)).toEqual([ORIGINAL[1], ORIGINAL[0], ORIGINAL[2]]);
    } finally {
      await other.close();
    }
  });

  it('undoes to the file before it and redoes to the file after it', async () => {
    const before = readFileSync(await saved(), 'utf8');
    await host.makeFirstDiveComputer(dive.id, 2);
    const state = await host.historyState();
    expect(state.undo?.kind).toBe('makeFirstDiveComputer');
    expect(state.undo?.computerModel).toBe('Shearwater Petrel');
    expect(changeTitle(state.undo!)).toBe('Change First Computer of Dive 224');
    expect(changeDone(state.undo!)).toBe('Shearwater Petrel is now first on Dive 224');
    const after = readFileSync(await saved(), 'utf8');
    expect(after).not.toBe(before);

    const undone = await host.undo();
    expect(undone.idsKept).toBe(true);
    expect(readFileSync(await saved(), 'utf8')).toBe(before);
    expect(computerLabels((await host.getDive(dive.id)).dcs)).toEqual(ORIGINAL);

    await host.redo();
    expect(readFileSync(await saved(), 'utf8')).toBe(after);
    expect(computerLabels((await host.getDive(dive.id)).dcs)[0]).toBe(ORIGINAL[2]);
  });

  it('changes nothing for the computer that is already first', async () => {
    const before = readFileSync(await saved(), 'utf8');
    const depth = (await host.historyState()).undoDepth;
    const result = await host.makeFirstDiveComputer(dive.id, 0);
    expect(result.id).toBe(dive.id);
    expect(computerLabels(result.dcs)).toEqual(ORIGINAL);
    expect((await host.historyState()).undoDepth).toBe(depth);
    expect(readFileSync(await saved(), 'utf8')).toBe(before);
  });

  it('rejects a computer out of range', async () => {
    const depth = (await host.historyState()).undoDepth;
    await expect(host.makeFirstDiveComputer(dive.id, 3)).rejects.toThrow(/out of range/);
    await expect(host.makeFirstDiveComputer(dive.id, -1)).rejects.toThrow(/out of range/);
    expect((await host.historyState()).undoDepth).toBe(depth);
    expect(computerLabels((await host.getDive(dive.id)).dcs)).toEqual(ORIGINAL);
  });

  it('rejects an unknown dive', async () => {
    await expect(host.makeFirstDiveComputer(-12345, 1)).rejects.toThrow(/no dive/);
  });
});
