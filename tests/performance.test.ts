// AI-generated (Claude)
// Large-log performance (task 12, step 3).
//
// The budgets below are deliberately loose: this runs on a host build under
// vitest, not on a phone, so the numbers are there to catch a *regression in
// shape* - a per-dive cost that turns quadratic, a list that walks every
// sample, a profile that is rebuilt from the whole log - rather than to
// benchmark a device. What the test really asserts is that the work per dive
// stays flat as the log grows, which is the thing that makes a 600-dive log
// feel the same as a 30-dive one.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { writeLargeLog, timed } from './harness/large-log';
import { SsrfHost } from './harness/ssrf-host';
import { groupDivesByTrip, sortDivesNewestFirst, toDiveRow } from '../src/models/dive-list';
import { buildProfilePlot, windowPoints } from '../src/models/profile-plot';
import { depthHistogram, divesOverTime, summaryTiles } from '../src/models/statistics';
import type { DiveSummary } from '../src/models';

const LARGE = 600;

describe('a large logbook', () => {
  const host = new SsrfHost();
  let dives: DiveSummary[] = [];
  let loadMs = 0;

  beforeAll(async () => {
    await host.configure();
    const path = writeLargeLog(LARGE);
    const load = await timed(() => host.loadFromXML(path));
    loadMs = load.ms;
    expect(load.value.dives).toBe(LARGE);
    dives = await host.listDives();
  });

  afterAll(async () => {
    await host.close();
  });

  it('parses in a time that scales with the file, not with its square', async () => {
    // A tenth of the dives should not take a tenth of the time by accident:
    // what matters is that the per-dive cost does not grow with the log.
    const small = writeLargeLog(LARGE / 10);
    const smallLoad = await timed(() => host.loadFromXML(small));
    const perDiveSmall = smallLoad.ms / (LARGE / 10);
    const perDiveLarge = loadMs / LARGE;
    expect(perDiveLarge).toBeLessThan(perDiveSmall * 3);

    // Put the large log back for the tests that follow. Dive ids are handed out
    // per load, so the cached summaries have to be re-read with it.
    await host.loadFromXML(writeLargeLog(LARGE));
    dives = await host.listDives();
  });

  it('lists every dive in one call, without the samples', async () => {
    const listed = await timed(() => host.listDives());
    expect(listed.value).toHaveLength(LARGE);
    // The summary is what the list screen renders; it must not carry profiles,
    // or scrolling would drag the whole log through the bridge.
    expect(JSON.stringify(listed.value).length).toBeLessThan(LARGE * 1500);
    expect(listed.ms).toBeLessThan(2000);
  });

  it('groups and formats the list far below a frame budget', () => {
    const grouped = groupDivesByTrip(sortDivesNewestFirst(dives));
    const started = performance.now();
    for (let pass = 0; pass < 10; pass += 1) {
      for (const section of grouped) {
        for (const dive of section.dives) {
          toDiveRow(dive, 'metric');
        }
      }
    }
    const perPass = (performance.now() - started) / 10;
    // Ten passes over the whole log; a real frame formats a screenful.
    expect(perPass).toBeLessThan(100);
  });

  it('opens one dive profile without touching the rest of the log', async () => {
    const middle = dives[Math.floor(dives.length / 2)];
    const profile = await timed(() => host.getProfile(middle.id));
    expect(profile.value.entry.length).toBeGreaterThan(0);
    expect(profile.ms).toBeLessThan(1000);

    const dive = await host.getDive(middle.id);
    const built = await timed(async () => buildProfilePlot(profile.value, dive.events));
    expect(built.ms).toBeLessThan(100);

    // Drawing thins the series to a few hundred points whatever the sample
    // count is, which is what keeps a zoom cheap.
    const thinned = windowPoints(built.value.depth, 0, built.value.maxSec, 600);
    expect(thinned.length).toBeLessThanOrEqual(600);
  });

  it('computes statistics over the whole log in one call', async () => {
    const stats = await timed(() => host.getStatistics());
    expect(stats.value.matched).toBe(LARGE);
    expect(stats.ms).toBeLessThan(2000);

    const started = performance.now();
    summaryTiles(stats.value);
    divesOverTime(stats.value);
    depthHistogram(stats.value);
    expect(performance.now() - started).toBeLessThan(50);
  });
});
