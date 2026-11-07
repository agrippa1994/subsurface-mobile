// AI-generated (Claude)
// Adding a dive by hand, and correcting one, through the bindings: what the core makes
// of the figures (numbers, profile, statistics, SAC), what it writes, and the rule that
// depth and duration can only change on a dive with no samples of its own.

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MANUAL_DC_MODEL } from '../src/models/dive-basics';
import type { Dive, NewDiveInput, PlotInfo } from '../src/models';
import { fixture } from './harness/fixtures';
import { SsrfHost } from './harness/ssrf-host';

const dir = mkdtempSync(join(tmpdir(), 'ssrf-add-dive-'));
const LOG = fixture('abitofeverything.ssrf');

// 2026-03-01 10:00:00, after everything in the fixture.
const WHEN = 1772359200;
const DIVE: NewDiveInput = { when: WHEN, durationSec: 2700, maxDepthMm: 24000 };

function sampleDepths(profile: PlotInfo): number[] {
  return profile.entry.map((entry) => entry.depthMm);
}

describe('adding a dive', () => {
  const host = new SsrfHost();
  let file = 0;

  async function saved(): Promise<string> {
    const path = join(dir, `saved-${(file += 1)}.ssrf`);
    await host.saveToXML(path);
    return readFileSync(path, 'utf8');
  }

  /** The dive's own element in a saved file. */
  function diveXml(xml: string, dive: Dive): string {
    const date = new Date(dive.when * 1000).toISOString().slice(0, 10);
    const start = xml.indexOf(`date='${date}'`);
    expect(start).toBeGreaterThan(-1);
    return xml.slice(start, xml.indexOf('</dive>', start));
  }

  /** Save, load, and find it again: ids do not survive a load. */
  async function reloaded(dive: Dive): Promise<Dive> {
    const path = join(dir, `reload-${(file += 1)}.ssrf`);
    await host.saveToXML(path);
    await host.loadFromXML(path);
    const found = (await host.listDives()).find((other) => other.when === dive.when);
    expect(found).toBeDefined();
    return host.getDive(found!.id);
  }

  beforeAll(() => host.configure());
  afterAll(async () => {
    await host.close();
    expect(host.diagnostics).not.toMatch(/AddressSanitizer/);
  });
  beforeEach(() => host.loadFromXML(LOG).then(() => undefined));

  it('makes a dive the core recognizes as manually added', async () => {
    const dive = await host.addDive(DIVE);
    expect(dive.dcModel).toBe(MANUAL_DC_MODEL);
    expect(dive.dcs).toHaveLength(1);
    expect(dive.dcs[0].model).toBe(MANUAL_DC_MODEL);
    expect(dive.when).toBe(WHEN);
    expect(dive.dcs[0].when).toBe(WHEN);
    expect(dive.durationSec).toBe(2700);
    expect(dive.maxDepthMm).toBe(24000);
    expect(dive.planned).toBe(false);
    expect(dive.cylinders).toEqual([]);
  });

  it('draws a profile from the depth and duration', async () => {
    const dive = await host.addDive(DIVE);
    expect(dive.dcs[0].sampleCount).toBeGreaterThanOrEqual(4);
    expect(dive.dcs[0].sampleCount).toBeLessThanOrEqual(6);
    expect(dive.meanDepthMm).toBeGreaterThan(0);
    expect(dive.meanDepthMm).toBeLessThan(24000);

    const depths = sampleDepths(await host.getProfile(dive.id));
    expect(Math.max(...depths)).toBe(24000);
    expect(depths[0]).toBe(0);
    expect(depths[depths.length - 1]).toBe(0);
  });

  it('aims the profile at a given average', async () => {
    const dive = await host.addDive({ ...DIVE, meanDepthMm: 15000 });
    expect(dive.maxDepthMm).toBe(24000);
    expect(Math.abs(dive.meanDepthMm - 15000)).toBeLessThan(1000);
  });

  it.each([
    ['a shallow, short dive', 60, 1000],
    ['a very deep, very short dive', 60, 500000],
    ['the longest', 24 * 3600, 500000],
    ['seconds', 2730, 12345],
  ])('keeps the figures of %s', async (_name, durationSec, maxDepthMm) => {
    const dive = await host.addDive({ when: WHEN, durationSec, maxDepthMm });
    expect(dive.durationSec).toBe(durationSec);
    expect(dive.maxDepthMm).toBe(maxDepthMm);
    await expect(host.getProfile(dive.id)).resolves.toBeDefined();
  });

  it('numbers it the way the core does', async () => {
    const dives = await host.listDives();
    const newest = dives.reduce((a, b) => (a.when > b.when ? a : b));
    const oldest = dives.reduce((a, b) => (a.when < b.when ? a : b));
    if (newest.number > 0) {
      expect((await host.addDive(DIVE)).number).toBe(newest.number + 1);
    }
    // In the middle of the log the core gives none, rather than renumber what is there.
    const earlier = await host.addDive({ ...DIVE, when: oldest.when + 60 });
    expect(earlier.number).toBe(0);
  });

  it('starts an empty log at number 1', async () => {
    await host.clear();
    expect((await host.addDive(DIVE)).number).toBe(1);
    expect((await host.addDive({ ...DIVE, when: WHEN + 7200 })).number).toBe(2);
  });

  it('takes everything else a patch can say', async () => {
    const [site] = await host.listDiveSites();
    const dive = await host.addDive({
      ...DIVE,
      airTempMkelvin: 295150,
      waterTempMkelvin: 288150,
      notes: 'Typed in afterwards',
      buddy: 'Anna',
      siteUuid: site.uuid,
      tags: ['boat'],
      weightsystems: [{ description: 'belt', weightGrams: 6000 }],
    });
    expect(dive.airTempMkelvin).toBe(295150);
    expect(dive.waterTempMkelvin).toBe(288150);
    expect(dive.notes).toBe('Typed in afterwards');
    expect(dive.siteUuid).toBe(site.uuid);
    expect(dive.tags).toEqual(['boat']);
    expect(dive.totalWeightGrams).toBe(6000);
  });

  it('has a SAC once there is a cylinder with pressures', async () => {
    const without = await host.addDive(DIVE);
    expect(without.sac).toBe(0);
    const dive = await host.addDive({
      ...DIVE,
      when: WHEN + 7200,
      cylinders: [
        {
          description: 'AL80',
          sizeMl: 11100,
          workingPressureMbar: 207000,
          startMbar: 200000,
          endMbar: 50000,
        },
      ],
    });
    expect(dive.sac).toBeGreaterThan(5000);
    expect(dive.sac).toBeLessThan(40000);
    expect(dive.cylinders).toHaveLength(1);
    expect(dive.otu).toBeGreaterThan(0);
    expect(dive.maxcns).toBeGreaterThan(0);
  });

  it('counts in the statistics', async () => {
    const before = await host.getStatistics();
    await host.addDive({ ...DIVE, maxDepthMm: 490000 });
    const after = await host.getStatistics();
    expect(after.total.selectionSize).toBe(before.total.selectionSize + 1);
    expect(after.total.maxDepthMm).toBe(490000);
    expect(after.total.totalTimeSec).toBe(before.total.totalTimeSec + 2700);
  });

  it('joins no trip, even between the dives of one', async () => {
    const dives = await host.listDives();
    const inTrip = dives.find((dive) => dive.tripId !== 0);
    const trips = await host.listTrips();
    expect(inTrip).toBeDefined();
    const dive = await host.addDive({ ...DIVE, when: inTrip!.when + 3600 });
    expect(dive.tripId).toBe(0);
    expect(dive.notrip).toBe(false);
    expect((await host.listTrips()).length).toBe(trips.length);
  });

  it('refuses figures the core could not keep, and adds nothing', async () => {
    const count = (await host.listDives()).length;
    const depth = (await host.historyState()).undoDepth;
    await expect(host.addDive({ ...DIVE, maxDepthMm: 0 })).rejects.toThrow(/maxDepthMm/);
    await expect(host.addDive({ ...DIVE, maxDepthMm: 500001 })).rejects.toThrow(/maxDepthMm/);
    await expect(host.addDive({ ...DIVE, durationSec: 0 })).rejects.toThrow(/durationSec/);
    await expect(host.addDive({ ...DIVE, meanDepthMm: 24000 })).rejects.toThrow(/meanDepthMm/);
    await expect(host.addDive({ ...DIVE, when: 1893456000 })).rejects.toThrow(/when/);
    await expect(host.addDive({ ...DIVE, airTempMkelvin: 1000 })).rejects.toThrow(/airTemp/);
    await expect(host.addDive({ ...DIVE, siteUuid: 12345 })).rejects.toThrow(/site/);
    expect((await host.listDives()).length).toBe(count);
    expect((await host.historyState()).undoDepth).toBe(depth);
  });

  it('previews without adding', async () => {
    const before = await saved();
    const depth = (await host.historyState()).undoDepth;
    const preview = await host.previewNewDive({
      ...DIVE,
      cylinders: [{ sizeMl: 11100, workingPressureMbar: 207000, startMbar: 200000, endMbar: 50000 }],
    });
    expect(preview.sac).toBeGreaterThan(0);
    expect(await saved()).toBe(before);
    expect((await host.historyState()).undoDepth).toBe(depth);
  });

  describe('in the file', () => {
    it('reads back as what was added', async () => {
      const dive = await host.addDive({
        ...DIVE,
        airTempMkelvin: 295150,
        waterTempMkelvin: 288150,
        cylinders: [{ description: 'AL80', sizeMl: 11100, workingPressureMbar: 207000, startMbar: 200000, endMbar: 50000 }],
      });
      const back = await reloaded(dive);
      expect(back.when).toBe(dive.when);
      expect(back.number).toBe(dive.number);
      expect(back.durationSec).toBe(dive.durationSec);
      expect(back.maxDepthMm).toBe(dive.maxDepthMm);
      expect(back.meanDepthMm).toBe(dive.meanDepthMm);
      expect(back.airTempMkelvin).toBe(295150);
      expect(back.waterTempMkelvin).toBe(288150);
      expect(back.sac).toBe(dive.sac);
      expect(back.dcs[0].model).toBe(MANUAL_DC_MODEL);
      expect(back.dcs[0].sampleCount).toBe(dive.dcs[0].sampleCount);
    });

    it('saves the same bytes after a load', async () => {
      await host.addDive({ ...DIVE, waterTempMkelvin: 288150 });
      const first = await saved();
      const path = join(dir, `again-${(file += 1)}.ssrf`);
      await host.saveToXML(path);
      await host.loadFromXML(path);
      expect(await saved()).toBe(first);
    });

    it('writes what desktop looks for', async () => {
      const dive = await host.addDive(DIVE);
      const xml = diveXml(await saved(), dive);
      expect(xml).toContain(`<divecomputer model='${MANUAL_DC_MODEL}'`);
      expect(xml).toContain("duration='45:00 min'");
      expect(xml).toContain("<depth max='24.0 m'");
      expect(xml).toContain('<sample time=');
    });

    it('keeps the last date the core can read back', async () => {
      const dive = await host.addDive({ ...DIVE, when: 1893455940 });
      expect((await reloaded(dive)).when).toBe(1893455940);
    });

    it('keeps a dive with no cylinder', async () => {
      const dive = await host.addDive(DIVE);
      expect((await reloaded(dive)).cylinders).toEqual([]);
    });
  });

  describe('undo', () => {
    it('takes it out and puts it back, with the same id', async () => {
      const before = await saved();
      const count = (await host.listDives()).length;
      const dive = await host.addDive(DIVE);
      const after = await saved();
      expect((await host.historyState()).undo?.kind).toBe('addDive');

      const undone = await host.undo();
      expect(undone.entry.kind).toBe('addDive');
      expect(undone.idsKept).toBe(true);
      expect(await saved()).toBe(before);
      expect((await host.listDives()).length).toBe(count);

      const redone = await host.redo();
      expect(redone.entry.kind).toBe('addDive');
      expect(await saved()).toBe(after);
      expect((await host.getDive(dive.id)).dcs[0].model).toBe(MANUAL_DC_MODEL);
    });
  });
});

describe('correcting a dive', () => {
  const host = new SsrfHost();
  let file = 0;

  async function saved(): Promise<string> {
    const path = join(dir, `edit-${(file += 1)}.ssrf`);
    await host.saveToXML(path);
    return readFileSync(path, 'utf8');
  }

  async function downloaded(): Promise<Dive> {
    for (const summary of await host.listDives()) {
      const dive = await host.getDive(summary.id);
      if (dive.dcs[0].model !== MANUAL_DC_MODEL && dive.dcs[0].sampleCount > 10 && !dive.planned) {
        return dive;
      }
    }
    throw new Error('the fixture has no downloaded dive');
  }

  beforeAll(() => host.configure());
  afterAll(async () => {
    await host.close();
    expect(host.diagnostics).not.toMatch(/AddressSanitizer/);
  });
  beforeEach(() => host.loadFromXML(LOG).then(() => undefined));

  describe('on a manually added dive', () => {
    it('redraws the profile for a new depth', async () => {
      const dive = await host.addDive({ ...DIVE, meanDepthMm: 15000 });
      const edited = await host.updateDive(dive.id, { maxDepthMm: 30000 });
      expect(edited.maxDepthMm).toBe(30000);
      expect(edited.dcs[0].maxDepthMm).toBe(30000);
      expect(edited.durationSec).toBe(2700);
      expect(Math.max(...sampleDepths(await host.getProfile(dive.id)))).toBe(30000);
    });

    it('can go shallower, which the fixup alone never would', async () => {
      const dive = await host.addDive(DIVE);
      const edited = await host.updateDive(dive.id, { maxDepthMm: 10000 });
      expect(edited.maxDepthMm).toBe(10000);
      expect(Math.max(...sampleDepths(await host.getProfile(dive.id)))).toBe(10000);
      expect(edited.meanDepthMm).toBeLessThan(10000);
    });

    it('redraws the profile for a new duration', async () => {
      const dive = await host.addDive(DIVE);
      const edited = await host.updateDive(dive.id, { durationSec: 1800 });
      expect(edited.durationSec).toBe(1800);
      expect(edited.dcs[0].durationSec).toBe(1800);
      expect(edited.maxDepthMm).toBe(24000);
    });

    it('moves the SAC with the average', async () => {
      const dive = await host.addDive({
        ...DIVE,
        cylinders: [{ sizeMl: 11100, workingPressureMbar: 207000, startMbar: 200000, endMbar: 50000 }],
      });
      const edited = await host.updateDive(dive.id, { maxDepthMm: 40000 });
      expect(edited.meanDepthMm).toBeGreaterThan(dive.meanDepthMm);
      expect(edited.sac).toBeLessThan(dive.sac);
    });

    it('refuses an average at the maximum depth', async () => {
      const dive = await host.addDive(DIVE);
      await expect(host.updateDive(dive.id, { meanDepthMm: 24000 })).rejects.toThrow(/meanDepthMm/);
    });

    it('previews without changing', async () => {
      const dive = await host.addDive(DIVE);
      const before = await saved();
      expect((await host.previewDive(dive.id, { maxDepthMm: 30000 })).maxDepthMm).toBe(30000);
      expect(await saved()).toBe(before);
      expect((await host.getDive(dive.id)).dcs[0].maxDepthMm).toBe(24000);
    });

    it('undoes to the file before', async () => {
      const dive = await host.addDive(DIVE);
      const before = await saved();
      await host.updateDive(dive.id, { maxDepthMm: 30000, durationSec: 1800 });
      expect((await host.historyState()).undo?.kind).toBe('updateDive');
      await host.undo();
      expect(await saved()).toBe(before);
    });
  });

  describe('on a downloaded dive', () => {
    it.each([
      ['depth', { maxDepthMm: 30000 }],
      ['duration', { durationSec: 1800 }],
      ['average', { meanDepthMm: 5000 }],
    ])('refuses a new %s and changes nothing', async (_name, patch) => {
      const dive = await downloaded();
      const before = await saved();
      await expect(host.updateDive(dive.id, patch)).rejects.toThrow(/manually added/);
      expect(await saved()).toBe(before);
      await expect(host.previewDive(dive.id, patch)).rejects.toThrow(/manually added/);
    });

    it('takes temperatures and a number, and leaves the samples alone', async () => {
      const dive = await downloaded();
      const edited = await host.updateDive(dive.id, {
        airTempMkelvin: 300150,
        waterTempMkelvin: 280150,
        number: 4242,
      });
      expect(edited.airTempMkelvin).toBe(300150);
      expect(edited.waterTempMkelvin).toBe(280150);
      expect(edited.number).toBe(4242);
      expect(edited.dcs[0].sampleCount).toBe(dive.dcs[0].sampleCount);
      expect(edited.maxDepthMm).toBe(dive.maxDepthMm);
      expect(edited.durationSec).toBe(dive.durationSec);

      const path = join(dir, `temps-${(file += 1)}.ssrf`);
      await host.saveToXML(path);
      await host.loadFromXML(path);
      const found = (await host.listDives()).find((other) => other.number === 4242);
      const back = await host.getDive(found!.id);
      expect(back.airTempMkelvin).toBe(300150);
      expect(back.waterTempMkelvin).toBe(280150);
    });
  });

  describe('a new date', () => {
    it('moves the dive and sets the first computer', async () => {
      const dive = await downloaded();
      const edited = await host.updateDive(dive.id, { when: WHEN });
      expect(edited.when).toBe(WHEN);
      expect(edited.dcs[0].when).toBe(WHEN);
      expect(edited.number).toBe(dive.number);
      const whens = (await host.listDives()).map((other) => other.when);
      expect(whens).toEqual([...whens].sort((a, b) => a - b));
    });

    it('keeps the dive in its trip wherever it lands', async () => {
      const dives = await host.listDives();
      const inTrip = dives.find((dive) => dive.tripId !== 0)!;
      const edited = await host.updateDive(inTrip.id, { when: WHEN });
      expect(edited.tripId).toBe(inTrip.tripId);
      const trip = (await host.listTrips()).find((other) => other.id === inTrip.tripId)!;
      expect(trip.lastDiveWhen).toBeGreaterThanOrEqual(WHEN);
    });

    it('survives a save and undoes', async () => {
      const dive = await downloaded();
      const before = await saved();
      await host.updateDive(dive.id, { when: WHEN });
      const after = await saved();
      expect(after).not.toBe(before);
      await host.undo();
      expect(await saved()).toBe(before);
    });
  });

  it('leaves the file alone when no basic field is mentioned', async () => {
    const dive = await downloaded();
    const before = await saved();
    await host.updateDive(dive.id, { notes: dive.notes });
    expect(await saved()).toBe(before);
  });
});
