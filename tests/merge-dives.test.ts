// AI-generated (Claude)
// Merging dives, driven through the real C++ bindings.
//
// The surroundings of the core's merge are repeated in the bindings from the
// desktop's MergeDives command, so these cases pin that behaviour: which dives may
// merge, the trip, site and numbers left behind. As everywhere, a change only
// counts once it is in the SSRF file, so each case saves and loads it again.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { fixture, snapshotLog, tempDir } from './harness/fixtures';
import { SsrfHost } from './harness/ssrf-host';

/** Four dives on one day with 5, 2 and 5 minutes on the surface between them. */
const INTERVALS = fixture('test0b.xml');
/** The same dives from two dive computers, at overlapping times. */
const OVERLAPPING = fixture('test-tank-sensor-mapping-merge.xml');
/** Numbered dives in trips, with sites and tanks, mostly days apart. */
const SAMPLE = fixture('abitofeverything.ssrf');

let workDir: string;

/**
 * The sample with two of its dives moved within reach of the one before: dive 19
 * five minutes after dive 18, and dive 96, with its long real profile, twenty
 * minutes after dive 95. Its numbers run out of order after dive 20.
 */
function closeSample(): string {
  const path = join(workDir, 'close-sample.ssrf');
  const moved = readFileSync(SAMPLE, 'utf8')
    .replace("date='2011-12-02' time='12:00:00'", "date='2011-12-02' time='11:35:00'")
    .replace("date='2011-10-22' time='13:33:50'", "date='2011-10-22' time='10:41:26'");
  writeFileSync(path, moved);
  return path;
}

async function neighbours(host: SsrfHost, firstNumber: number) {
  const dives = await divesOldestFirst(host);
  const index = dives.findIndex((dive) => dive.number === firstNumber);
  return { dives, index, ids: [dives[index].id, dives[index + 1].id] };
}
const open: SsrfHost[] = [];

function track(host: SsrfHost): SsrfHost {
  open.push(host);
  return host;
}

async function freshLogbook(name: string, source: string) {
  const path = join(workDir, name);
  const first = new SsrfHost();
  await first.loadFromXML(source);
  await first.saveToXML(path);
  await first.close();
  const host = track(new SsrfHost());
  await host.loadFromXML(path);
  return { host, path };
}

async function saveAndReload(host: SsrfHost, path: string): Promise<SsrfHost> {
  await host.saveToXML(path);
  const next = track(new SsrfHost());
  await next.loadFromXML(path);
  return next;
}

/** Oldest first, the order of the core's table. */
async function divesOldestFirst(host: SsrfHost) {
  return (await host.listDives()).sort((a, b) => a.when - b.when || a.id - b.id);
}

beforeAll(() => {
  workDir = tempDir('ssrf-merge-');
});

afterAll(async () => {
  await Promise.all(open.map((host) => host.close()));
});

describe('what may be merged', () => {
  it('offers neighbours within 30 minutes, with the time on the surface', async () => {
    const { host } = await freshLogbook('pairs.ssrf', INTERVALS);
    const dives = await divesOldestFirst(host);
    const pairs = await host.listMergePairs();
    expect(pairs.map((pair) => [pair.earlierId, pair.laterId])).toEqual([
      [dives[0].id, dives[1].id],
      [dives[1].id, dives[2].id],
      [dives[2].id, dives[3].id],
    ]);
    expect(pairs.every((pair) => pair.surfaceIntervalSec > 0)).toBe(true);
  });

  it('reports no surface interval for dives that overlap', async () => {
    const { host } = await freshLogbook('pairs-overlap.ssrf', OVERLAPPING);
    const pairs = await host.listMergePairs();
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs[0].surfaceIntervalSec).toBe(0);
  });

  it('refuses dives further apart, a dive that is not a neighbour, and a stale id', async () => {
    const sample = await freshLogbook('refused.ssrf', SAMPLE);
    const pairs = await sample.host.listMergePairs();
    const dives = await divesOldestFirst(sample.host);
    const far = dives.findIndex(
      (dive, i) =>
        i + 1 < dives.length && !pairs.some((pair) => pair.earlierId === dive.id),
    );
    expect(far).toBeGreaterThanOrEqual(0);
    const before = await snapshotLog(sample.host);

    await expect(sample.host.mergeDives([dives[far].id, dives[far + 1].id])).rejects.toThrow(
      /30 minutes/,
    );
    await expect(sample.host.previewMerge([dives[far].id, dives[far + 1].id])).rejects.toThrow(
      /30 minutes/,
    );
    await expect(sample.host.mergeDives([dives[0].id, dives[2].id])).rejects.toThrow(/neighbouring/);
    await expect(sample.host.mergeDives([dives[0].id])).rejects.toThrow(/at least two/);
    await expect(sample.host.mergeDives([dives[0].id, 999_999])).rejects.toThrow(/no dive with id/);

    expect(await snapshotLog(sample.host)).toEqual(before);
  });
});

describe('merging dives with a surface interval', () => {
  it('makes one dive out of two, whichever order the ids come in', async () => {
    const { host, path } = await freshLogbook('adjacent.ssrf', INTERVALS);
    const [first, second, third] = await divesOldestFirst(host);
    const [a, b] = [await host.getDive(first.id), await host.getDive(second.id)];

    const result = await host.mergeDives([second.id, first.id]);
    expect(result.dives).toBe(3);
    expect(result.id).not.toBe(first.id);
    expect(result.id).not.toBe(second.id);
    await expect(host.getDive(first.id)).rejects.toThrow(/no dive with id/);
    await expect(host.getDive(second.id)).rejects.toThrow(/no dive with id/);

    const merged = await host.getDive(result.id);
    expect(merged.when).toBe(a.when);
    expect(merged.number).toBe(a.number);
    expect(merged.maxDepthMm).toBe(Math.max(a.maxDepthMm, b.maxDepthMm));
    // One computer's run of samples, the second dive's shifted along by the gap.
    expect(merged.dcs).toHaveLength(1);
    expect(merged.dcs[0].sampleCount).toBeGreaterThanOrEqual(
      a.dcs[0].sampleCount + b.dcs[0].sampleCount,
    );
    expect(merged.durationSec).toBeGreaterThan(a.durationSec);

    const reloaded = await saveAndReload(host, path);
    const after = await divesOldestFirst(reloaded);
    expect(after).toHaveLength(3);
    expect(after[0].when).toBe(a.when);
    expect(after[1].when).toBe(third.when);
    const again = await reloaded.getDive(after[0].id);
    expect(again.durationSec).toBe(merged.durationSec);
    expect(again.dcs[0].sampleCount).toBe(merged.dcs[0].sampleCount);
  });

  it('closes the gap in the numbers, until they run out of order', async () => {
    const { host, path } = await freshLogbook('numbers.ssrf', closeSample());
    const { dives, index, ids } = await neighbours(host, 18);
    expect(dives.slice(index, index + 4).map((dive) => dive.number)).toEqual([18, 19, 20, 1]);

    const preview = await host.previewMerge(ids);
    expect(preview.dive.number).toBe(18);
    expect(preview.renumberedDives).toBe(1);

    await host.mergeDives(ids);
    const expected = dives
      .filter((dive) => dive.number !== 19)
      .map((dive) => (dive.number === 20 ? 19 : dive.number));
    expect((await divesOldestFirst(host)).map((dive) => dive.number)).toEqual(expected);
    const reloaded = await saveAndReload(host, path);
    expect((await divesOldestFirst(reloaded)).map((dive) => dive.number)).toEqual(expected);
  });

  it('leaves the numbers alone when a dive has none', async () => {
    const { host } = await freshLogbook('unnumbered.ssrf', INTERVALS);
    const dives = await divesOldestFirst(host);
    expect(dives[0].number).toBe(0);
    const preview = await host.previewMerge([dives[0].id, dives[1].id]);
    expect(preview.renumberedDives).toBe(0);
    await host.mergeDives([dives[0].id, dives[1].id]);
    expect((await divesOldestFirst(host)).map((dive) => dive.number)).toEqual([0, 0, 0]);
  });

  it('merges several neighbours at once', async () => {
    const { host, path } = await freshLogbook('three.ssrf', INTERVALS);
    const dives = await divesOldestFirst(host);
    const result = await host.mergeDives(dives.slice(0, 3).map((dive) => dive.id));
    expect(result.dives).toBe(2);
    const reloaded = await saveAndReload(host, path);
    expect(await reloaded.listDives()).toHaveLength(2);
  });

  it('previews without changing anything, and says what the merge then does', async () => {
    const { host } = await freshLogbook('preview.ssrf', INTERVALS);
    const dives = await divesOldestFirst(host);
    const ids = [dives[0].id, dives[1].id];
    const before = await snapshotLog(host);

    const preview = await host.previewMerge(ids);
    expect(await snapshotLog(host)).toEqual(before);
    expect(preview.surfaceIntervalSec).toBeGreaterThan(0);

    const result = await host.mergeDives(ids);
    const merged = await host.getDive(result.id);
    expect(preview.dive.durationSec).toBe(merged.durationSec);
    expect(preview.dive.maxDepthMm).toBe(merged.maxDepthMm);
    expect(preview.dive.number).toBe(merged.number);
    expect(preview.dive.dcs.length).toBe(merged.dcs.length);
  });
});

describe('merging overlapping dives', () => {
  it('keeps every recording and survives the file', async () => {
    const { host, path } = await freshLogbook('overlap.ssrf', OVERLAPPING);
    const dives = await divesOldestFirst(host);
    const pair = (await host.listMergePairs())[0];
    const a = await host.getDive(pair.earlierId);
    const b = await host.getDive(pair.laterId);

    const result = await host.mergeDives([pair.earlierId, pair.laterId]);
    expect(result.dives).toBe(dives.length - 1);
    const merged = await host.getDive(result.id);
    expect(merged.when).toBe(Math.min(a.when, b.when));
    const samples = (dive: typeof merged) =>
      dive.dcs.reduce((sum, dc) => sum + dc.sampleCount, 0);
    expect(samples(merged)).toBeGreaterThanOrEqual(Math.max(samples(a), samples(b)));

    const reloaded = await saveAndReload(host, path);
    const after = await divesOldestFirst(reloaded);
    expect(after).toHaveLength(dives.length - 1);
    const again = await reloaded.getDive(after.find((dive) => dive.when === merged.when)!.id);
    expect(again.dcs.map((dc) => dc.model)).toEqual(merged.dcs.map((dc) => dc.model));
    expect(samples(again)).toBe(samples(merged));
  });
});

describe('trips', () => {
  it('stays in the trip both dives were in', async () => {
    const { host, path } = await freshLogbook('trip-same.ssrf', INTERVALS);
    const dives = await divesOldestFirst(host);
    const trip = await host.createTrip(dives.map((dive) => dive.id), 'Red Sea');

    const preview = await host.previewMerge([dives[0].id, dives[1].id]);
    expect(preview.dive.tripId).toBe(trip.id);

    const result = await host.mergeDives([dives[0].id, dives[1].id]);
    expect(result.trips).toBe(1);
    const after = (await host.listTrips())[0];
    expect(after.id).toBe(trip.id);
    expect(after.diveCount).toBe(3);

    const reloaded = await saveAndReload(host, path);
    const trips = await reloaded.listTrips();
    expect(trips).toHaveLength(1);
    expect(trips[0].location).toBe('Red Sea');
    expect(trips[0].diveCount).toBe(3);
  });

  it('keeps a trip whose only dive was merged, when the other dive has none', async () => {
    const { host, path } = await freshLogbook('trip-one.ssrf', INTERVALS);
    const dives = await divesOldestFirst(host);
    const trip = await host.createTrip([dives[1].id], 'Red Sea');

    const result = await host.mergeDives([dives[0].id, dives[1].id]);
    expect(result.trips).toBe(1);
    expect((await host.getDive(result.id)).tripId).toBe(trip.id);

    const reloaded = await saveAndReload(host, path);
    const after = await divesOldestFirst(reloaded);
    expect(after[0].tripLocation).toBe('Red Sea');
  });

  it('ends the trip left without dives when each dive had its own', async () => {
    const { host, path } = await freshLogbook('trip-two.ssrf', INTERVALS);
    const dives = await divesOldestFirst(host);
    await host.createTrip([dives[0].id], 'Morning');
    await host.createTrip([dives[1].id], 'Afternoon');
    await host.updateTrip((await host.listTrips()).find((t) => t.location === 'Morning')!.id, {
      notes: 'Boat',
    });
    await host.updateTrip((await host.listTrips()).find((t) => t.location === 'Afternoon')!.id, {
      notes: 'Shore',
    });

    // Both have a location and notes, so the core takes the earlier one.
    const preview = await host.previewMerge([dives[0].id, dives[1].id]);
    expect(preview.dive.tripLocation).toBe('Morning');

    const result = await host.mergeDives([dives[0].id, dives[1].id]);
    expect(result.trips).toBe(1);

    const reloaded = await saveAndReload(host, path);
    const trips = await reloaded.listTrips();
    expect(trips.map((trip) => trip.location)).toEqual(['Morning']);
    expect(trips[0].diveCount).toBe(1);
    expect(trips[0].notes).toBe('Boat');
  });
});

describe('sites', () => {
  it('takes the first site, and leaves the second in the logbook', async () => {
    const { host, path } = await freshLogbook('site-two.ssrf', INTERVALS);
    const dives = await divesOldestFirst(host);
    const north = (await host.upsertDiveSite({ name: 'North Wall' })).uuid;
    const south = (await host.upsertDiveSite({ name: 'South Wall' })).uuid;
    await host.updateDive(dives[0].id, { siteUuid: north });
    await host.updateDive(dives[1].id, { siteUuid: south });

    const preview = await host.previewMerge([dives[0].id, dives[1].id]);
    expect(preview.dive.siteName).toBe('North Wall');

    const result = await host.mergeDives([dives[0].id, dives[1].id]);
    const count = async (h: SsrfHost, uuid: number) =>
      (await h.listDiveSites()).find((site) => site.uuid === uuid)?.diveCount;
    expect(await count(host, north)).toBe(1);
    expect(await count(host, south)).toBe(0);
    expect((await host.getDive(result.id)).siteUuid).toBe(north);

    const reloaded = await saveAndReload(host, path);
    expect(await count(reloaded, north)).toBe(1);
    expect(await count(reloaded, south)).toBe(0);
  });

  it('takes the site of the other dive when the first has none', async () => {
    const { host } = await freshLogbook('site-one.ssrf', INTERVALS);
    const dives = await divesOldestFirst(host);
    const site = (await host.upsertDiveSite({ name: 'South Wall' })).uuid;
    await host.updateDive(dives[0].id, { siteUuid: 0 });
    await host.updateDive(dives[1].id, { siteUuid: site });
    const result = await host.mergeDives([dives[0].id, dives[1].id]);
    expect((await host.getDive(result.id)).siteUuid).toBe(site);
  });

  it('gives a site without GPS the location of the other dive', async () => {
    const { host, path } = await freshLogbook('site-gps.ssrf', INTERVALS);
    const dives = await divesOldestFirst(host);
    const bare = (await host.upsertDiveSite({ name: 'Bare' })).uuid;
    const placed = (
      await host.upsertDiveSite({ name: 'Placed', latUdeg: 28_000_000, lonUdeg: 34_000_000 })
    ).uuid;
    await host.updateDive(dives[0].id, { siteUuid: bare });
    await host.updateDive(dives[1].id, { siteUuid: placed });

    await host.mergeDives([dives[0].id, dives[1].id]);

    const reloaded = await saveAndReload(host, path);
    const site = (await reloaded.listDiveSites()).find((s) => s.uuid === bare)!;
    expect(site.latUdeg).toBe(28_000_000);
    expect(site.lonUdeg).toBe(34_000_000);
  });
});

describe('the file', () => {
  it('is a fixed point after a merge: saving and loading again changes nothing', async () => {
    const { host, path } = await freshLogbook('fixed-point.ssrf', INTERVALS);
    const dives = await divesOldestFirst(host);
    await host.mergeDives([dives[1].id, dives[2].id]);

    const once = await saveAndReload(host, path);
    const onceXml = readFileSync(path, 'utf8');
    const twicePath = join(workDir, 'fixed-point-2.ssrf');
    const twice = await saveAndReload(once, twicePath);
    expect(readFileSync(twicePath, 'utf8')).toBe(onceXml);
    expect(await snapshotLog(twice)).toEqual(await snapshotLog(once));
  });

  it('leaves in memory what the file holds', async () => {
    const { host, path } = await freshLogbook('memory.ssrf', closeSample());
    await host.mergeDives((await neighbours(host, 95)).ids);
    const inMemory = await snapshotLog(host);
    const reloaded = await saveAndReload(host, path);
    expect(await snapshotLog(reloaded)).toEqual(inMemory);
  });

  it('writes the merged dive as desktop Subsurface expects it', async () => {
    const { host, path } = await freshLogbook('xml.ssrf', INTERVALS);
    const dives = await divesOldestFirst(host);
    await host.mergeDives([dives[0].id, dives[1].id]);
    await host.saveToXML(path);
    const xml = readFileSync(path, 'utf8');
    expect(xml.match(/<dive /g)).toHaveLength(3);
    expect(xml).toMatch(/^<divelog program='subsurface' version='3'>/);
    // Well-formed all the way through: a new process parses what was written.
    writeFileSync(join(workDir, 'copy.ssrf'), xml);
    const copy = track(new SsrfHost());
    await copy.loadFromXML(join(workDir, 'copy.ssrf'));
    expect(await copy.listDives()).toHaveLength(3);
  });
});
