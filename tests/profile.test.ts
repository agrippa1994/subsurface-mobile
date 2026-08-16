// AI-generated (Claude)
// Profile sanity: the plotted profile is what the dive detail screen draws
// (task 08), so it has to agree with the dive summary it belongs to.
//
// The Suunto databases are the v1 import path, hence the emphasis on them.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { join } from 'node:path';

import type { PlotInfo } from '../src/models';
import { fixture, REPO_ROOT } from './harness/fixtures';
import { SsrfHost } from './harness/ssrf-host';

let host: SsrfHost;

beforeAll(() => {
  host = new SsrfHost();
});

afterAll(async () => {
  await host.close();
});

function maxDepth(profile: PlotInfo): number {
  return profile.entry.reduce((max, e) => Math.max(max, e.depthMm), 0);
}

/** Stands in for "how much deco this plot shows": deeper and longer both raise it. */
function ceilingSum(profile: PlotInfo): number {
  return profile.entry.reduce((sum, e) => sum + Math.max(0, e.ceilingMm), 0);
}

const SAMPLE_LOG = join(REPO_ROOT, 'assets/sample/sample-log.ssrf');

describe('Suunto import', () => {
  it('imports a DM4 database', async () => {
    await host.clear();
    const result = await host.importSuunto(fixture('TestDiveDM4.db'));
    expect(result.added).toBe(1);
    expect(result.failed).toBe(0);
    expect(await host.listDives()).toHaveLength(1);
  });

  it('imports a DM5 database', async () => {
    await host.clear();
    const result = await host.importSuunto(fixture('TestDiveDM5.db'));
    expect(result.added).toBe(4);
    expect(result.failed).toBe(0);
    expect(await host.listDives()).toHaveLength(4);
  });

  it('merges rather than duplicates on a second import', async () => {
    await host.clear();
    await host.importSuunto(fixture('TestDiveDM5.db'));
    const again = await host.importSuunto(fixture('TestDiveDM5.db'));
    expect(again.added).toBe(0);
    expect(again.merged).toBe(4);
    expect(await host.listDives()).toHaveLength(4);
  });

  it('rejects a file that is not a Suunto database', async () => {
    await expect(host.importSuunto(fixture('test29.xml'))).rejects.toThrow();
  });
});

describe('profiles of imported dives', () => {
  beforeAll(async () => {
    await host.clear();
    await host.importSuunto(fixture('TestDiveDM5.db'));
  });

  it('agree with the dive summary', async () => {
    const dives = await host.listDives();
    expect(dives.length).toBeGreaterThan(0);

    for (const dive of dives) {
      const profile = await host.getProfile(dive.id);
      expect(profile.entry.length).toBeGreaterThan(1);

      // plot_info carries the dive's own maximum, so the y axis is scaled to
      // the depth the app displays.
      expect(profile.maxDepthMm).toBe(dive.maxDepthMm);
      // The deepest plotted sample can fall short of it: a Suunto records its
      // max depth in the dive header at a finer resolution than the sample
      // interval, so the peak lands between two samples. It must never
      // overshoot, and must be within a sample's worth of descent.
      expect(maxDepth(profile)).toBeLessThanOrEqual(dive.maxDepthMm);
      expect(dive.maxDepthMm - maxDepth(profile)).toBeLessThan(1000);

      // The plot runs to the end of the dive. It may extend past it: the
      // surface interval after the last sample is plotted too.
      const lastSec = profile.entry[profile.entry.length - 1].sec;
      expect(lastSec).toBeGreaterThanOrEqual(dive.durationSec);
      expect(profile.maxtimeSec).toBeGreaterThanOrEqual(dive.durationSec);
    }
  });

  it('are monotonic in time and plausible in depth', async () => {
    const [dive] = await host.listDives();
    const profile = await host.getProfile(dive.id);

    let previous = -1;
    for (const entry of profile.entry) {
      expect(entry.sec).toBeGreaterThanOrEqual(previous);
      expect(entry.depthMm).toBeGreaterThanOrEqual(0);
      // Nothing in these fixtures is a 2 km dive; catches unit confusion.
      expect(entry.depthMm).toBeLessThan(2000000);
      previous = entry.sec;
    }
  });

  it('carry one pressure block per cylinder per sample', async () => {
    const [dive] = await host.listDives();
    const profile = await host.getProfile(dive.id);
    const expected = profile.nr * profile.nrCylinders;

    expect(profile.entry).toHaveLength(profile.nr);
    expect(profile.pressures.sensor).toHaveLength(expected);
    expect(profile.pressures.interpolated).toHaveLength(expected);
  });
});

describe('profiles of parsed logbooks', () => {
  it('are non-empty for every dive in abitofeverything.ssrf', async () => {
    await host.loadFromXML(fixture('abitofeverything.ssrf'));
    const dives = await host.listDives();

    for (const dive of dives) {
      const profile = await host.getProfile(dive.id);
      expect(profile.entry.length).toBeGreaterThan(0);
      expect(profile.nr).toBe(profile.entry.length);
      // Hand-entered dives get a fabricated profile (fake_dc), so even those
      // have something to draw.
      expect(maxDepth(profile)).toBeGreaterThan(0);
    }
  });

  it('report gas pressures for a dive that recorded them', async () => {
    await host.loadFromXML(fixture('abitofeverything.ssrf'));
    const dives = await host.listDives();
    const zenobia = dives.find((d) => d.number === 94)!;
    const profile = await host.getProfile(zenobia.id);

    expect(profile.nrCylinders).toBeGreaterThan(0);
    const readings = profile.pressures.sensor.filter((p) => p > 0);
    expect(readings.length).toBeGreaterThan(0);
    // Cylinder pressures are millibar: a full tank is around 200000.
    expect(Math.max(...readings)).toBeGreaterThan(50000);
    expect(Math.max(...readings)).toBeLessThan(500000);
  });

  // The deco ceiling is the one thing on the profile the user's own settings
  // change (Settings > Decompression), so the arguments have to reach set_gf().
  it('plots a deeper ceiling for stricter gradient factors', async () => {
    await host.loadFromXML(SAMPLE_LOG);
    const dives = await host.listDives();

    let compared = 0;
    for (const dive of dives) {
      const relaxed = ceilingSum(await host.getProfile(dive.id, 0, { gfLow: 90, gfHigh: 95 }));
      const strict = ceilingSum(await host.getProfile(dive.id, 0, { gfLow: 10, gfHigh: 20 }));
      if (strict === 0) {
        continue;
      }
      expect(strict).toBeGreaterThan(relaxed);
      compared += 1;
    }
    expect(compared).toBeGreaterThan(0);
  });

  it('defaults to the core preferences when no gradient factors are given', async () => {
    await host.loadFromXML(SAMPLE_LOG);
    const [dive] = await host.listDives();

    const implicit = await host.getProfile(dive.id);
    const explicit = await host.getProfile(dive.id, 0, { gfLow: 30, gfHigh: 75 });
    expect(ceilingSum(implicit)).toBe(ceilingSum(explicit));
  });

  it('rejects a divecomputer index that does not exist', async () => {
    await host.loadFromXML(fixture('test29.xml'));
    const [dive] = await host.listDives();
    await expect(host.getProfile(dive.id, 99)).rejects.toThrow();
  });
});
