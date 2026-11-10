// AI-generated (Claude)
// surfaceGf golden tests: the live surface GF the dive list's card and the
// timeline screen show. The series has to start exactly where the profile's
// surface-GF line ends, fall on the surface, and be stricter at altitude.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { SurfaceGfSeries } from '../src/models';
import { fixture } from './harness/fixtures';
import { SsrfHost } from './harness/ssrf-host';

const GF = { gfLow: 30, gfHigh: 75 } as const;

let host: SsrfHost;

beforeAll(() => {
  host = new SsrfHost();
});

afterAll(async () => {
  await host.close();
});

async function open(name: string): Promise<void> {
  await host.clear();
  await host.loadFromXML(fixture(name));
}

async function lastSampleSurfaceGf(series: SurfaceGfSeries): Promise<number> {
  const profile = await host.getProfile(series.diveId, 0, GF);
  return profile.entry[profile.entry.length - 1].surfaceGf;
}

describe('surfaceGf at the end of the dive', () => {
  // Repetitive dives (residual nitrogen from the dive before) and single ones,
  // open circuit air and nitrox, several dive computers.
  const files = ['TestDiveDM5.xml', 'test29.xml', 'abitofeverything.ssrf', 'TwoTimesTwo.ssrf', 'ostc.xml'];

  for (const name of files) {
    it(`equals the last profile sample's surfaceGf in ${name}`, async () => {
      await open(name);
      const series = await host.surfaceGf(GF);
      const expected = await lastSampleSurfaceGf(series);
      expect(series.endSurfaceGf).toBeCloseTo(expected, 2);
      // Without an ambient pressure the series is against the dive's own.
      expect(series.ambientMbar).toBe(series.diveSurfaceMbar);
      expect(series.surfaceGf[0]).toBeCloseTo(expected, 2);
    });
  }

  it('starts from the tissues the earlier dives left behind', async () => {
    await open('TestDiveDM5.xml');
    const series = await host.surfaceGf(GF);
    // The latest of the four was dived 1:29 after the one before.
    expect(series.residualFromSec).toBe(5327);
  });

  it('defaults to the latest valid dive and takes any other by id', async () => {
    await open('TestDiveDM5.xml');
    const dives = await host.listDives();
    const latest = dives.reduce((a, b) => (a.when + a.durationSec >= b.when + b.durationSec ? a : b));
    const series = await host.surfaceGf(GF);
    expect(series.diveId).toBe(latest.id);
    expect(series.startWhen).toBeGreaterThanOrEqual(series.diveEndWhen);
    expect(series.startWhen - series.diveEndWhen).toBeLessThan(120);

    const first = dives.reduce((a, b) => (a.when <= b.when ? a : b));
    const older = await host.surfaceGf({ ...GF, id: first.id });
    expect(older.diveId).toBe(first.id);
    expect(older.endSurfaceGf).toBeCloseTo(await lastSampleSurfaceGf(older), 2);
  });
});

describe('surfaceGf on the surface', () => {
  beforeAll(async () => {
    await open('test29.xml');
  });

  it('never rises while the diver stays at one ambient pressure', async () => {
    const series = await host.surfaceGf(GF);
    expect(series.surfaceGf.length).toBeGreaterThan(60);
    for (let i = 1; i < series.surfaceGf.length; i++) {
      expect(series.surfaceGf[i]).toBeLessThanOrEqual(series.surfaceGf[i - 1]);
    }
    expect(series.surfaceGf[0]).toBeGreaterThan(0);
  });

  it('reports when it reaches 0 and when the tissues are clean', async () => {
    const series = await host.surfaceGf(GF);
    const zero = series.gfZeroSec;
    expect(zero).not.toBeNull();
    const zeroIndex = zero! / series.stepSec;
    expect(series.surfaceGf[zeroIndex]).toBe(0);
    expect(series.surfaceGf[zeroIndex - 1]).toBeGreaterThan(0);
    // Clean (every compartment within 2 % of equilibrium) takes the slow
    // compartments, far longer than GF 0.
    expect(series.cleanSec).not.toBeNull();
    expect(series.cleanSec!).toBeGreaterThan(zero!);
    expect(series.cleanSec!).toBeLessThan(72 * 3600);
    // The series runs an hour past clean.
    expect((series.surfaceGf.length - 1) * series.stepSec).toBe(series.cleanSec! + 3600);
  });

  it('is higher at altitude than at sea level for the same time', async () => {
    const sea = await host.surfaceGf({ ...GF, ambientMbar: 1013, horizonSec: 24 * 3600 });
    const high = await host.surfaceGf({ ...GF, ambientMbar: 800, horizonSec: 24 * 3600 });
    expect(high.surfaceGf).toHaveLength(sea.surfaceGf.length);
    expect(high.surfaceGf[0]).toBeGreaterThan(sea.surfaceGf[0]);
    for (let i = 0; i < sea.surfaceGf.length; i++) {
      if (sea.surfaceGf[i] > 0) {
        expect(high.surfaceGf[i]).toBeGreaterThan(sea.surfaceGf[i]);
      }
    }
    expect(high.gfZeroSec!).toBeGreaterThan(sea.gfZeroSec!);
  });

  it('does not depend on the gradient factors', async () => {
    // Surface GF is measured against the raw M-value (profile.cpp), and the
    // tissue loading does not depend on them either: they only decide the
    // ceiling. The app compares the value with gf high instead.
    const strict = await host.surfaceGf({ gfLow: 30, gfHigh: 60 });
    const loose = await host.surfaceGf({ gfLow: 30, gfHigh: 85 });
    expect(strict.surfaceGf[0]).toBeCloseTo(loose.surfaceGf[0], 2);
  });

  it('honours the step and the horizon', async () => {
    const series = await host.surfaceGf({ ...GF, stepSec: 300, horizonSec: 3600 });
    expect(series.stepSec).toBe(300);
    expect(series.surfaceGf).toHaveLength(13);
    expect(series.leadingCompartment).toHaveLength(13);
  });

  it('rejects an ambient pressure outside 500-1100 mbar', async () => {
    await expect(host.surfaceGf({ ...GF, ambientMbar: 1013250 })).rejects.toThrow(/ambientMbar/);
  });
});

describe('surfaceGf without dives', () => {
  it('fails rather than inventing a dive', async () => {
    await host.clear();
    await expect(host.surfaceGf(GF)).rejects.toThrow(/no dive/);
  });
});
