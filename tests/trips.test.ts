// AI-generated (Claude)
// Trip management, driven through the real C++ bindings.
//
// As with editing, a change only counts once it is in the SSRF file, so each
// case mutates, saves and loads the file in a fresh process. What the file looks
// like is checked too: desktop Subsurface reads it with this same parser, but it
// is the XML that has to stay as it expects.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { DiveSummary, Trip } from '../src/models';
import { DIVES_DIR, fixture, tempDir } from './harness/fixtures';
import { SsrfHost } from './harness/ssrf-host';

const SAMPLE = fixture('abitofeverything.ssrf');
/** Every dive of the sample is in a trip; these three dives are in none. */
const LOOSE = fixture('test40-42.xml');

let workDir: string;
const open: SsrfHost[] = [];

function track(host: SsrfHost): SsrfHost {
  open.push(host);
  return host;
}

/** The sample saved once and reloaded, for the reason given in editing.test.ts. */
async function freshLogbook(name: string, source = SAMPLE): Promise<{ host: SsrfHost; path: string }> {
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

/** What identifies a trip across a load: ids do not survive one, dive times do. */
async function tripShape(host: SsrfHost) {
  const dives = await host.listDives();
  const trips = await host.listTrips();
  return trips.map((trip) => ({
    location: trip.location,
    notes: trip.notes,
    when: trip.when,
    lastDiveWhen: trip.lastDiveWhen,
    dives: dives.filter((dive) => dive.tripId === trip.id).map((dive) => dive.when),
  }));
}

function looseDives(dives: DiveSummary[]): DiveSummary[] {
  return dives.filter((dive) => dive.tripId === 0);
}

function diveIn(dives: DiveSummary[], trip: Trip): DiveSummary[] {
  return dives.filter((dive) => dive.tripId === trip.id);
}

beforeAll(() => {
  workDir = tempDir('ssrf-trips-');
});

afterAll(async () => {
  await Promise.all(open.map((host) => host.close().catch(() => undefined)));
});

describe('reading trips', () => {
  it('lists the trips of a file with their dives and span', async () => {
    const { host } = await freshLogbook('read.ssrf');
    const trips = await host.listTrips();
    const dives = await host.listDives();
    expect(trips.length).toBe(11);
    // Three trips in the sample have no location: they are trips all the same.
    expect(trips.filter((trip) => trip.location === '').length).toBe(3);
    for (const trip of trips) {
      const own = diveIn(dives, trip);
      expect(own.length).toBe(trip.diveCount);
      expect(trip.when).toBe(Math.min(...own.map((dive) => dive.when)));
      expect(trip.lastDiveWhen).toBe(Math.max(...own.map((dive) => dive.when)));
    }
    expect(trips.map((trip) => trip.when)).toEqual(
      [...trips.map((trip) => trip.when)].sort((a, b) => a - b),
    );
  });

  it('gives a dive outside a trip the trip id 0', async () => {
    const host = track(new SsrfHost());
    await host.loadFromXML(LOOSE);
    expect((await host.listTrips()).length).toBe(0);
    for (const dive of await host.listDives()) {
      expect(dive.tripId).toBe(0);
    }
  });

  it('computes a trip\'s totals in the core', async () => {
    const { host } = await freshLogbook('stats.ssrf');
    const trip = (await host.listTrips()).find((candidate) => candidate.location === 'Koror, Palau')!;
    const stats = await host.getStatistics({ tripId: trip.id });
    const own = diveIn(await host.listDives(), trip).filter((dive) => !dive.invalid);
    expect(stats.matched).toBe(own.length);
    expect(stats.total.totalTimeSec).toBe(own.reduce((sum, dive) => sum + dive.durationSec, 0));
    expect(stats.total.maxDepthMm).toBe(Math.max(...own.map((dive) => dive.maxDepthMm)));
  });
});

describe('createTrip', () => {
  it('names the trip after the site of the oldest dive and round-trips', async () => {
    const { host, path } = await freshLogbook('create.ssrf', LOOSE);
    const loose = looseDives(await host.listDives()).filter((dive) => dive.siteName !== '');
    expect(loose.length).toBeGreaterThanOrEqual(1);
    const dive = loose[0];
    const before = (await host.listTrips()).length;

    const trip = await host.createTrip([dive.id]);
    expect(trip.location).toBe(dive.siteName);
    expect(trip.diveCount).toBe(1);
    expect(trip.when).toBe(dive.when);
    expect((await host.listTrips()).length).toBe(before + 1);
    expect((await host.getDive(dive.id)).tripId).toBe(trip.id);

    const shape = await tripShape(host);
    const next = await saveAndReload(host, path);
    expect(await tripShape(next)).toEqual(shape);
    expect(readFileSync(path, 'utf8')).toContain(`<trip date=`);
  });

  it('takes several dives, whatever order they are named in', async () => {
    const { host, path } = await freshLogbook('create-many.ssrf', LOOSE);
    const loose = looseDives(await host.listDives());
    expect(loose.length).toBeGreaterThanOrEqual(2);
    const [older, newer] = [loose[0], loose[1]];
    const trip = await host.createTrip([newer.id, older.id, newer.id], 'Weekend');
    expect(trip.location).toBe('Weekend');
    expect(trip.diveCount).toBe(2);
    expect(trip.when).toBe(older.when);
    expect(trip.lastDiveWhen).toBe(newer.when);
    const next = await saveAndReload(host, path);
    const reloaded = (await next.listTrips()).find((candidate) => candidate.location === 'Weekend');
    expect(reloaded?.diveCount).toBe(2);
  });

  it('moves a dive out of the trip it was in', async () => {
    const { host } = await freshLogbook('create-move.ssrf');
    const source = (await host.listTrips()).find((trip) => trip.diveCount >= 2)!;
    const [moved] = diveIn(await host.listDives(), source);
    const trip = await host.createTrip([moved.id]);
    const after = await host.listTrips();
    expect(after.find((candidate) => candidate.id === source.id)?.diveCount).toBe(source.diveCount - 1);
    expect(after.find((candidate) => candidate.id === trip.id)?.diveCount).toBe(1);
  });

  it('changes nothing when one of the ids is stale', async () => {
    const { host } = await freshLogbook('create-stale.ssrf', LOOSE);
    const [dive] = looseDives(await host.listDives());
    const shape = await tripShape(host);
    await expect(host.createTrip([dive.id, 999999])).rejects.toThrow(/no dive with id 999999/);
    await expect(host.createTrip([])).rejects.toThrow(/diveIds/);
    expect(await tripShape(host)).toEqual(shape);
  });
});

describe('addDivesToTrip', () => {
  it('adds a dive to any trip, re-ordering the trip table when it starts earlier', async () => {
    const { host, path } = await freshLogbook('add.ssrf');
    const [oldest] = await host.listDives();
    await host.removeDivesFromTrip([oldest.id]);
    const trips = await host.listTrips();
    const last = trips[trips.length - 1];
    const loose = (await host.listDives()).find((dive) => dive.id === oldest.id)!;
    expect(loose.when).toBeLessThan(trips[0].when);

    const updated = await host.addDivesToTrip([loose.id], last.id);
    expect(updated.diveCount).toBe(last.diveCount + 1);
    expect(updated.when).toBe(loose.when);
    expect(updated.lastDiveWhen).toBe(last.lastDiveWhen);
    const order = (await host.listTrips()).map((trip) => trip.when);
    expect(order).toEqual([...order].sort((a, b) => a - b));

    const shape = await tripShape(host);
    const next = await saveAndReload(host, path);
    expect(await tripShape(next)).toEqual(shape);
  });

  it('drops the trip a move took the last dive from', async () => {
    const { host, path } = await freshLogbook('add-last.ssrf');
    const trips = await host.listTrips();
    const single = trips.find((trip) => trip.diveCount === 1)!;
    const target = trips.find((trip) => trip.id !== single.id)!;
    const [dive] = diveIn(await host.listDives(), single);

    await host.addDivesToTrip([dive.id], target.id);
    const after = await host.listTrips();
    expect(after.length).toBe(trips.length - 1);
    expect(after.some((trip) => trip.id === single.id)).toBe(false);
    const next = await saveAndReload(host, path);
    expect((await next.listTrips()).length).toBe(trips.length - 1);
  });

  it('is a no-op for a dive already in the trip', async () => {
    const { host } = await freshLogbook('add-noop.ssrf');
    const trip = (await host.listTrips()).find((candidate) => candidate.diveCount >= 2)!;
    const [dive] = diveIn(await host.listDives(), trip);
    expect((await host.addDivesToTrip([dive.id], trip.id)).diveCount).toBe(trip.diveCount);
  });

  it('rejects a trip that does not exist', async () => {
    const { host } = await freshLogbook('add-stale.ssrf');
    const [dive] = await host.listDives();
    await expect(host.addDivesToTrip([dive.id], 123)).rejects.toThrow(/no trip with id 123/);
  });
});

describe('removeDivesFromTrip', () => {
  it('leaves the rest of the trip and marks the dive not to be grouped again', async () => {
    const { host, path } = await freshLogbook('remove.ssrf');
    const trips = await host.listTrips();
    const trip = trips.find((candidate) => candidate.diveCount >= 2)!;
    const [dive] = diveIn(await host.listDives(), trip);

    const result = await host.removeDivesFromTrip([dive.id]);
    expect(result.trips).toBe(trips.length);
    const removed = await host.getDive(dive.id);
    expect(removed.tripId).toBe(0);
    expect(removed.tripLocation).toBe('');
    expect(removed.notrip).toBe(true);

    const next = await saveAndReload(host, path);
    expect((await next.listTrips()).find((c) => c.when === trip.when || c.lastDiveWhen === trip.lastDiveWhen)?.diveCount).toBe(
      trip.diveCount - 1,
    );
    const reloaded = (await next.listDives()).find((c) => c.when === dive.when)!;
    expect(reloaded.tripId).toBe(0);
    expect((await next.getDive(reloaded.id)).notrip).toBe(true);
    // Desktop Subsurface reads this flag to keep the dive out of autogrouping.
    expect(readFileSync(path, 'utf8')).toContain(`tripflag='NOTRIP'`);
  });

  it('removes the trip with its last dive, location and notes included', async () => {
    const { host, path } = await freshLogbook('remove-last.ssrf');
    const trips = await host.listTrips();
    const trip = trips.find((candidate) => candidate.diveCount === 1 && candidate.location !== '')!;
    await host.updateTrip(trip.id, { notes: 'gone soon' });
    const [dive] = diveIn(await host.listDives(), trip);

    expect((await host.removeDivesFromTrip([dive.id])).trips).toBe(trips.length - 1);
    await expect(host.updateTrip(trip.id, { notes: 'x' })).rejects.toThrow(/no trip/);
    const next = await saveAndReload(host, path);
    expect((await next.listTrips()).length).toBe(trips.length - 1);
    expect(readFileSync(path, 'utf8')).not.toContain('gone soon');
    expect((await next.listDives()).find((c) => c.when === dive.when)).toBeDefined();
  });

  it('ungroups a whole trip when given all of its dives', async () => {
    const { host } = await freshLogbook('remove-all.ssrf');
    const trips = await host.listTrips();
    const trip = trips.find((candidate) => candidate.diveCount >= 2)!;
    const dives = diveIn(await host.listDives(), trip);
    const before = (await host.listDives()).length;
    await host.removeDivesFromTrip(dives.map((dive) => dive.id));
    expect((await host.listTrips()).length).toBe(trips.length - 1);
    expect((await host.listDives()).length).toBe(before);
  });

  it('ignores a dive that is in no trip', async () => {
    const { host } = await freshLogbook('remove-none.ssrf', LOOSE);
    const trips = await host.listTrips();
    const [loose] = looseDives(await host.listDives());
    expect((await host.removeDivesFromTrip([loose.id])).trips).toBe(trips.length);
    expect((await host.getDive(loose.id)).notrip).toBe(false);
  });
});

describe('updateTrip', () => {
  it('edits location and notes separately and round-trips awkward text', async () => {
    const { host, path } = await freshLogbook('update.ssrf');
    const trip = (await host.listTrips()).find((candidate) => candidate.location === 'Koror, Palau')!;
    const notes = `Line one & <two>\n"quoted" 'text' - Zürich`;
    const location = `Rock & "Roll" <Bay>`;

    expect((await host.updateTrip(trip.id, { notes })).location).toBe('Koror, Palau');
    expect((await host.updateTrip(trip.id, { location })).notes).toBe(notes);

    const next = await saveAndReload(host, path);
    const reloaded = (await next.listTrips()).find((candidate) => candidate.when === trip.when)!;
    expect(reloaded.location).toBe(location);
    expect(reloaded.notes).toBe(notes);
    const [dive] = diveIn(await next.listDives(), reloaded);
    expect(dive.tripLocation).toBe(location);
  });

  it('clears a field set to the empty string, and the trip stays a trip', async () => {
    const { host, path } = await freshLogbook('update-clear.ssrf');
    const trip = (await host.listTrips()).find((candidate) => candidate.location === 'At Home')!;
    expect((await host.updateTrip(trip.id, { location: '' })).location).toBe('');
    const next = await saveAndReload(host, path);
    const reloaded = (await next.listTrips()).find((candidate) => candidate.when === trip.when)!;
    expect(reloaded.location).toBe('');
    expect(reloaded.diveCount).toBe(trip.diveCount);
  });
});

describe('round trip over the fixtures', () => {
  const files = existsSync(DIVES_DIR)
    ? readdirSync(DIVES_DIR).filter((name) => /\.(ssrf|xml)$/.test(name))
    : [];

  it('keeps created and edited trips in every fixture that has two dives', async () => {
    let exercised = 0;
    for (const name of files) {
      const host = track(new SsrfHost());
      const path = join(workDir, `sweep-${name}.ssrf`);
      try {
        await host.loadFromXML(fixture(name));
        await host.saveToXML(path);
        await host.loadFromXML(path);
      } catch {
        await host.close();
        continue; // Not a logbook of its own; round-trip.test.ts covers these.
      }
      const dives = await host.listDives();
      if (dives.length < 2) {
        await host.close();
        continue;
      }
      exercised++;
      const created = await host.createTrip([dives[0].id], 'Sweep');
      await host.updateTrip(created.id, { notes: 'Sweep notes' });
      await host.addDivesToTrip([dives[1].id], created.id);
      const shape = await tripShape(host);
      const next = await saveAndReload(host, path);
      expect(await tripShape(next), name).toEqual(shape);
      await next.close();
      await host.close();
    }
    expect(exercised).toBeGreaterThan(10);
  });
});
