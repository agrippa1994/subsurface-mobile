// AI-generated (Claude)
// Tests for the profile presentation model.
//
// The interesting cases need a real plot_info, so most of this drives the
// bindings over the host harness: a Suunto import (the dive the task 08
// acceptance is about) and a hand-checked logbook fixture.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { join } from 'node:path';

import type { Dive, PlotInfo } from './index';
import {
  buildProfilePlot,
  depthTicks,
  EMPTY_PROFILE_PLOT,
  nearestSampleIndex,
  profileSummary,
  readoutAt,
  temperatureValue,
  timeTicks,
  windowPoints,
  type Point,
} from './profile-plot';
import { SsrfHost } from '../../tests/harness/ssrf-host';
import { fixture, REPO_ROOT } from '../../tests/harness/fixtures';

describe('depthTicks', () => {
  it('places metric gridlines at round metres', () => {
    // 45 m deep: a 10 m step keeps the count at or under six.
    expect(depthTicks(45000, 'metric').map((t) => t.label)).toEqual(['10', '20', '30', '40']);
  });

  it('places imperial gridlines at round feet', () => {
    const ticks = depthTicks(45000, 'imperial');
    expect(ticks.map((t) => t.label)).toEqual(['30', '60', '90', '120']);
    // The tick value stays in millimetres - 30 ft is 9144 mm.
    expect(ticks[0].value).toBeCloseTo(9144, 0);
  });

  it('widens the step rather than crowd the axis', () => {
    expect(depthTicks(120000, 'metric').length).toBeLessThanOrEqual(6);
    expect(depthTicks(6000, 'metric').map((t) => t.label)).toEqual(['5']);
  });

  it('returns nothing for a dive with no depth', () => {
    expect(depthTicks(0, 'metric')).toEqual([]);
  });
});

describe('timeTicks', () => {
  it('labels round minutes', () => {
    expect(timeTicks(45 * 60).map((t) => t.label)).toEqual(['10', '20', '30', '40']);
  });

  it('keeps a long dive under the tick budget', () => {
    expect(timeTicks(6 * 3600).length).toBeLessThanOrEqual(6);
  });

  it('returns nothing for an empty profile', () => {
    expect(timeTicks(0)).toEqual([]);
  });
});

describe('buildProfilePlot', () => {
  it('handles a profile with no samples', () => {
    const empty = {
      nr: 0,
      nrCylinders: 0,
      maxtimeSec: 0,
      maxDepthMm: 0,
      entry: [],
      pressures: { sensor: [], interpolated: [] },
    } as unknown as PlotInfo;
    expect(buildProfilePlot(empty)).toBe(EMPTY_PROFILE_PLOT);
  });
});

describe('windowPoints', () => {
  const points: Point[] = Array.from({ length: 100 }, (_, i) => ({ sec: i * 10, value: i }));

  it('keeps the points bracketing the window', () => {
    const windowed = windowPoints(points, 300, 400);
    expect(windowed[0].sec).toBeLessThanOrEqual(300);
    expect(windowed[windowed.length - 1].sec).toBeGreaterThanOrEqual(400);
  });

  it('returns everything when the window covers the series', () => {
    expect(windowPoints(points, 0, 1000)).toHaveLength(points.length);
  });

  it('thins to the requested budget', () => {
    const windowed = windowPoints(points, 0, 1000, 20);
    expect(windowed.length).toBeLessThanOrEqual(20);
    // Still in time order.
    for (let i = 1; i < windowed.length; i++) {
      expect(windowed[i].sec).toBeGreaterThanOrEqual(windowed[i - 1].sec);
    }
  });

  it('keeps a spike that plain stride sampling would drop', () => {
    const spiky: Point[] = Array.from({ length: 100 }, (_, i) => ({
      sec: i,
      value: i === 37 ? 999 : 1,
    }));
    const windowed = windowPoints(spiky, 0, 100, 10);
    expect(windowed.some((point) => point.value === 999)).toBe(true);
  });

  it('handles an empty series', () => {
    expect(windowPoints([], 0, 100)).toEqual([]);
  });
});

describe('profileSummary', () => {
  const plot = {
    ...EMPTY_PROFILE_PLOT,
    maxSec: 2535,
    maxDepthMm: 20100,
    depth: [
      { sec: 0, value: 0 },
      { sec: 600, value: 20100 },
      { sec: 2535, value: 0 },
    ],
    temperature: [{ sec: 600, value: 283150 }],
    temperatureRange: { min: 283150, max: 289150 },
  };

  it('describes the shape of the dive, not the drawing', () => {
    expect(profileSummary(plot, 'metric')).toBe(
      'Dive profile. maximum depth 20.1 m at 10:00, total time 42:15, ' +
        'water temperature 10 C to 16 C, no decompression obligation.'
    );
  });

  it('says when the dive went into deco', () => {
    const deco = { ...plot, ceiling: [{ sec: 900, value: 3000 }] };
    expect(profileSummary(deco)).toContain('the dive went into decompression');
  });

  it('says so rather than describing an empty chart', () => {
    expect(profileSummary(EMPTY_PROFILE_PLOT)).toBe(
      'Dive profile. This dive has no profile samples.'
    );
    // Even with both curves asked for: there is nothing to speak.
    const gf = { showGfNow: true, showGfSurface: true };
    expect(profileSummary(EMPTY_PROFILE_PLOT, 'metric', gf)).toBe(
      'Dive profile. This dive has no profile samples.'
    );
  });
});

describe('EMPTY_PROFILE_PLOT', () => {
  it('carries every series, so callers need no null checks', () => {
    expect(EMPTY_PROFILE_PLOT.gfNow).toEqual([]);
    expect(EMPTY_PROFILE_PLOT.gfSurface).toEqual([]);
    expect(EMPTY_PROFILE_PLOT.gfRange).toEqual({ min: 0, max: 0 });
  });
});

describe('temperatureValue', () => {
  it('converts to the displayed unit', () => {
    expect(temperatureValue(293150, 'metric')).toBeCloseTo(20, 6);
    expect(temperatureValue(293150, 'imperial')).toBeCloseTo(68, 6);
  });
});

describe('a Suunto-imported dive', () => {
  // TestDiveDM4.db is the DM4 fixture the task 05/06 suites already use; it is
  // the same dive the acceptance criteria compare against desktop Subsurface.
  let host: SsrfHost;
  let dive: Dive;
  let profile: PlotInfo;

  beforeAll(async () => {
    host = new SsrfHost();
    await host.importSuunto(fixture('TestDiveDM4.db'));
    const [summary] = await host.listDives();
    dive = await host.getDive(summary.id);
    profile = await host.getProfile(summary.id);
  });

  afterAll(async () => {
    await host?.close();
  });

  it('produces a depth curve covering the whole dive', () => {
    const plot = buildProfilePlot(profile, dive.dcs[0].events);
    expect(plot.depth.length).toBe(profile.entry.length);
    expect(plot.depth[0].sec).toBe(0);
    expect(plot.maxSec).toBeGreaterThan(0);
    // The depth axis covers both the plotted samples and the maximum the core
    // reports for the dive - they differ slightly, because plot_info's maxdepth
    // comes from the dive's own record, not from the interpolated samples.
    expect(plot.maxDepthMm).toBeGreaterThanOrEqual(Math.max(...plot.depth.map((p) => p.value)));
    expect(plot.maxDepthMm).toBeGreaterThanOrEqual(dive.maxDepthMm);
    // Time only moves forward.
    for (let i = 1; i < plot.depth.length; i++) {
      expect(plot.depth[i].sec).toBeGreaterThanOrEqual(plot.depth[i - 1].sec);
    }
  });

  it('keeps every event inside the plotted time range and on the depth curve', () => {
    const plot = buildProfilePlot(profile, dive.dcs[0].events);
    for (const event of plot.events) {
      expect(event.sec).toBeGreaterThanOrEqual(0);
      expect(event.sec).toBeLessThanOrEqual(plot.maxSec);
      expect(event.depthMm).toBeGreaterThanOrEqual(0);
      expect(event.depthMm).toBeLessThanOrEqual(plot.maxDepthMm);
    }
  });

  it('reads a sample back out for the scrubber', () => {
    const readout = readoutAt(profile, Math.round(profile.maxtimeSec / 2), 'metric');
    expect(readout).not.toBeNull();
    expect(readout!.depthText).toMatch(/ m$/);
    expect(readout!.timeText).toMatch(/^\d+:\d{2}/);
  });

  it('answers the scrubber in imperial too', () => {
    const readout = readoutAt(profile, 60, 'imperial');
    expect(readout!.depthText).toMatch(/ ft$/);
  });
});

describe('a logbook with temperature, pressure and deco', () => {
  const SAMPLE = join(REPO_ROOT, 'assets/sample/sample-log.ssrf');
  let host: SsrfHost;

  beforeAll(async () => {
    host = new SsrfHost();
    await host.loadFromXML(SAMPLE);
  });

  afterAll(async () => {
    await host?.close();
  });

  it('builds every series for every dive without going out of range', async () => {
    const summaries = await host.listDives();
    let sawTemperature = false;
    let sawPressure = false;
    let sawCeiling = false;

    for (const summary of summaries) {
      const dive = await host.getDive(summary.id);
      const profile = await host.getProfile(summary.id);
      const plot = buildProfilePlot(profile, dive.dcs[0]?.events ?? []);

      expect(plot.depth.length).toBe(profile.entry.length);
      expect(plot.pressures.length).toBeLessThanOrEqual(profile.nrCylinders);
      for (const series of plot.pressures) {
        expect(series.points.length).toBeGreaterThan(1);
        for (const point of series.points) {
          expect(point.value).toBeGreaterThan(0);
          expect(point.sec).toBeLessThanOrEqual(plot.maxSec);
        }
        sawPressure = true;
      }
      if (plot.temperature.length > 0) {
        sawTemperature = true;
        expect(plot.temperatureRange.min).toBeLessThanOrEqual(plot.temperatureRange.max);
        // Water, not absolute zero and not boiling.
        expect(plot.temperatureRange.min).toBeGreaterThan(250000);
        expect(plot.temperatureRange.max).toBeLessThan(330000);
      }
      if (plot.ceiling.length > 0) {
        sawCeiling = true;
        for (const point of plot.ceiling) {
          expect(point.value).toBeGreaterThan(0);
          // A ceiling is never deeper than the dive itself.
          expect(point.value).toBeLessThanOrEqual(plot.maxDepthMm);
        }
      }
    }

    expect(sawTemperature).toBe(true);
    expect(sawPressure).toBe(true);
    expect(sawCeiling).toBe(true);
  });

  // The two gradient factors reach TS in different units - current_gf is a
  // fraction of the M-value, surface_gf is already percent (profile.cpp:967 vs
  // :973). Getting that wrong is a silent 100x, so it is checked against the raw
  // entries rather than against a plausible-looking range.
  it('puts both gradient factors on one percent scale', async () => {
    const summaries = await host.listDives();
    let sawGfNow = false;
    let sawGfSurface = false;

    for (const summary of summaries) {
      const dive = await host.getDive(summary.id);
      const profile = await host.getProfile(summary.id);
      const plot = buildProfilePlot(profile, dive.dcs[0]?.events ?? []);

      const nowEntries = profile.entry.filter((entry) => entry.currentGf > 0);
      const surfaceEntries = profile.entry.filter((entry) => entry.surfaceGf > 0);
      expect(plot.gfNow.length).toBe(nowEntries.length);
      expect(plot.gfSurface.length).toBe(surfaceEntries.length);

      plot.gfNow.forEach((point, index) => {
        expect(point.sec).toBe(nowEntries[index].sec);
        expect(point.value).toBeCloseTo(nowEntries[index].currentGf * 100, 6);
        expect(point.value).toBeGreaterThan(0);
        sawGfNow = true;
      });
      plot.gfSurface.forEach((point, index) => {
        expect(point.sec).toBe(surfaceEntries[index].sec);
        // Not multiplied a second time.
        expect(point.value).toBeCloseTo(surfaceEntries[index].surfaceGf, 6);
        sawGfSurface = true;
      });

      // The M-value limit keeps a fixed height, and an excursion past it is
      // still inside the band.
      expect(plot.gfRange.min).toBe(0);
      expect(plot.gfRange.max).toBeGreaterThanOrEqual(100);
      for (const point of [...plot.gfNow, ...plot.gfSurface]) {
        expect(point.value).toBeLessThanOrEqual(plot.gfRange.max);
      }
    }

    expect(sawGfNow).toBe(true);
    expect(sawGfSurface).toBe(true);
  });

  it('reads both gradient factors out for the scrubber', async () => {
    const summaries = await host.listDives();
    for (const summary of summaries) {
      const profile = await host.getProfile(summary.id);
      const index = profile.entry.findIndex((entry) => entry.surfaceGf > 0);
      if (index < 0) {
        continue;
      }
      const entry = profile.entry[index];
      const readout = readoutAt(profile, entry.sec, 'metric');
      expect(readout!.gfSurfaceText).toBe(`${Math.round(entry.surfaceGf)}%`);
      expect(readout!.gfNowText).toBe(
        entry.currentGf > 0 ? `${Math.round(entry.currentGf * 100)}%` : null
      );
      return;
    }
    throw new Error('no sample in the fixture carries a surface gradient factor');
  });

  it('speaks a gradient factor only when its curve is shown', async () => {
    const [summary] = await host.listDives();
    const dive = await host.getDive(summary.id);
    const profile = await host.getProfile(summary.id);
    const plot = buildProfilePlot(profile, dive.dcs[0]?.events ?? []);

    expect(profileSummary(plot, 'metric')).not.toMatch(/gradient factor/);
    expect(profileSummary(plot, 'metric', { showGfSurface: true })).toMatch(
      /highest surface gradient factor \d+ percent/
    );
    expect(profileSummary(plot, 'metric', { showGfNow: true })).toMatch(
      /highest gradient factor at depth \d+ percent/
    );
  });

  it('finds the sample nearest a time', async () => {
    const [summary] = await host.listDives();
    const profile = await host.getProfile(summary.id);

    expect(nearestSampleIndex(profile, -100)).toBe(0);
    expect(nearestSampleIndex(profile, profile.maxtimeSec + 10000)).toBe(profile.entry.length - 1);

    // Whatever comes back is at least as close as its neighbours.
    const target = Math.round(profile.maxtimeSec * 0.37);
    const index = nearestSampleIndex(profile, target);
    const distance = Math.abs(profile.entry[index].sec - target);
    for (const neighbour of [index - 1, index + 1]) {
      if (neighbour >= 0 && neighbour < profile.entry.length) {
        expect(Math.abs(profile.entry[neighbour].sec - target)).toBeGreaterThanOrEqual(distance);
      }
    }
  });
});
