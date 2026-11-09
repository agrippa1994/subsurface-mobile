// AI-generated (Claude)
// Tests for what the widgets show (src/models/widgets.ts).
//
// Hand-built summaries cover the arithmetic; the last block drives the real
// bindings over the host harness with the sample logbook, so the props are
// checked against a dive list and a profile the core actually produced.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { join } from 'node:path';

import type { DiveSummary, PlotEntry } from './index';
import { DiveMode } from './index';
import {
  buildWidgetSnapshot,
  diveEndInstant,
  downsampleProfile,
  formatDiveMinutes,
  formatTotalHours,
  latestDive,
  type WidgetSnapshotInput,
} from './widgets';
import { SsrfHost } from '../../tests/harness/ssrf-host';
import { REPO_ROOT } from '../../tests/harness/fixtures';
import { IMPERIAL_UNITS, METRIC_UNITS } from './units';

// Dates read as tests/setup-device-clock.ts sets the device: en-GB, 24-hour.
const links = { url: (path: string) => `subsurface://${path.replace(/^\//, '')}` };

function summary(overrides: Partial<DiveSummary> & { id: number }): DiveSummary {
  return {
    number: 0,
    when: 0,
    durationSec: 0,
    maxDepthMm: 0,
    meanDepthMm: 0,
    waterTempMkelvin: 0,
    rating: 0,
    visibility: 0,
    siteUuid: 0,
    siteName: '',
    tripId: 0,
    tripLocation: '',
    buddy: '',
    diveguide: '',
    suit: '',
    tags: [],
    cylinderDescriptions: [],
    weightDescriptions: [],
    divemode: DiveMode.OC,
    dcModel: '',
    planned: false,
    invalid: false,
    ...overrides,
  };
}

function entry(sec: number, depthMm: number): PlotEntry {
  return { sec, depthMm } as PlotEntry;
}

/** Wall clock seconds of a UTC calendar date, the form the core stores. */
function wall(year: number, month: number, day: number, hour = 10): number {
  return Date.UTC(year, month - 1, day, hour) / 1000;
}

// 2026-11-09 12:00 UTC, with the phone on UTC.
const NOW = Date.UTC(2026, 10, 9, 12);

function input(
  dives: DiveSummary[],
  overrides: Partial<WidgetSnapshotInput> = {},
): WidgetSnapshotInput {
  return {
    dives,
    units: METRIC_UNITS,
    now: NOW,
    timezoneOffsetMinutes: 0,
    links,
    ...overrides,
  };
}

describe('formatting', () => {
  it('writes dive minutes the way a dive is talked about', () => {
    expect(formatDiveMinutes(47 * 60 + 20)).toBe('47 min');
    expect(formatDiveMinutes(60 * 60)).toBe('1 h');
    expect(formatDiveMinutes(72 * 60)).toBe('1 h 12 min');
    expect(formatDiveMinutes(-5)).toBe('0 min');
  });

  it('gives total hours one decimal below ten, none above', () => {
    expect(formatTotalHours(0)).toBe('0 h');
    expect(formatTotalHours(7.5 * 3600)).toBe('7.5 h');
    expect(formatTotalHours(184.4 * 3600)).toBe('184 h');
  });
});

describe('diveEndInstant', () => {
  it('reads the stored wall clock in the phone zone', () => {
    // 10:00 wall clock, 50 min long, phone two hours east of UTC (offset -120):
    // the dive ended 10:50 local, which is 08:50 UTC.
    const dive = { when: wall(2026, 11, 1), durationSec: 50 * 60 };
    expect(diveEndInstant(dive, -120, NOW)).toBe(Date.UTC(2026, 10, 1, 8, 50));
  });

  it('never lies in the future', () => {
    const dive = { when: wall(2026, 11, 9, 13), durationSec: 3600 };
    expect(diveEndInstant(dive, 0, NOW)).toBe(NOW);
  });
});

describe('downsampleProfile', () => {
  it('keeps a short profile as it is, depths negative in the display unit', () => {
    const points = downsampleProfile([entry(0, 0), entry(60, 10_000), entry(120, 0)], METRIC_UNITS);
    expect(points).toEqual([
      { x: 0, y: -0 },
      { x: 1, y: -10 },
      { x: 2, y: -0 },
    ]);
    expect(downsampleProfile([entry(60, 10_000)], IMPERIAL_UNITS)[0].y).toBe(-33);
  });

  it('thins a long profile without losing the deepest point or the ends', () => {
    const entries = Array.from({ length: 1000 }, (_, i) =>
      entry(i * 10, i === 537 ? 40_000 : 10_000 + (i % 7) * 100),
    );
    entries[0] = entry(0, 0);
    entries[999] = entry(9990, 0);
    const points = downsampleProfile(entries, METRIC_UNITS, 48);
    expect(points).toHaveLength(48);
    expect(points[0]).toEqual({ x: 0, y: -0 });
    expect(points[47]).toEqual({ x: 166.5, y: -0 });
    expect(Math.min(...points.map((p) => p.y))).toBe(-40);
  });

  it('is empty for no samples', () => {
    expect(downsampleProfile([], METRIC_UNITS)).toEqual([]);
  });
});

describe('buildWidgetSnapshot', () => {
  const dives = [
    summary({
      id: 1,
      number: 10,
      when: wall(2025, 6, 2),
      durationSec: 40 * 60,
      maxDepthMm: 32_000,
      meanDepthMm: 15_000,
      siteUuid: 7,
      siteName: 'Blue Hole',
    }),
    summary({
      id: 2,
      number: 11,
      when: wall(2026, 3, 14),
      durationSec: 55 * 60,
      maxDepthMm: 18_400,
      meanDepthMm: 11_000,
      siteUuid: 8,
      siteName: 'Canyon',
    }),
    summary({
      id: 3,
      number: 12,
      when: wall(2026, 11, 8),
      durationSec: 47 * 60,
      maxDepthMm: 21_300,
      meanDepthMm: 12_000,
      waterTempMkelvin: 297_650,
      rating: 4,
      buddy: 'Alex',
      siteUuid: 8,
      siteName: 'Canyon',
    }),
    // Neither of these happened, so no widget counts them.
    summary({ id: 4, number: 13, when: wall(2026, 11, 9, 9), planned: true, maxDepthMm: 60_000 }),
    summary({ id: 5, number: 14, when: wall(2026, 11, 9, 8), invalid: true, maxDepthMm: 55_000 }),
  ];

  it('shows the newest dive that was dived', () => {
    expect(latestDive(dives)?.id).toBe(3);
    const { lastDive } = buildWidgetSnapshot(
      input(dives, { lastProfile: [entry(0, 0), entry(600, 21_300), entry(2820, 0)] }),
    );
    expect(lastDive).toMatchObject({
      hasDive: true,
      numberText: 'Dive 12',
      title: 'Canyon',
      dateText: '8 Nov 2026',
      depthText: '21.3 m',
      durationText: '47 min',
      temperatureText: '24.5 C',
      buddyText: 'Alex',
      rating: 4,
      profileMaxDepth: 21.3,
      depthUnit: 'm',
      url: `subsurface://dives/at/${wall(2026, 11, 8)}`,
    });
    expect(lastDive.endedAt).toBe((wall(2026, 11, 8) + 47 * 60) * 1000);
  });

  it('totals each period from the dives in it', () => {
    const { totals } = buildWidgetSnapshot(input(dives));
    expect(totals.totalDives).toBe(3);
    expect(totals.periods.all).toMatchObject({
      label: 'All dives',
      dives: 3,
      hoursText: '2.4 h',
      deepestText: '32 m',
      deepestWhere: 'Blue Hole, 2 Jun 2025',
      longestText: '55 min',
      averageDepthText: '12.7 m',
      sites: 2,
    });
    expect(totals.periods.year).toMatchObject({ label: '2026', dives: 2, deepestText: '21.3 m' });
    // June 2025 is more than twelve months before November 2026.
    expect(totals.periods.last12).toMatchObject({ label: 'Last 12 months', dives: 2 });
    expect(totals).toMatchObject({ previousMilestone: 0, nextMilestone: 50 });
  });

  it('counts dives per month over the last twelve, oldest first', () => {
    const { activity } = buildWidgetSnapshot(input(dives));
    // The device region's names (date-format.ts): en-GB spells September "Sept".
    expect(activity.months.map((m) => m.label)).toEqual([
      'Dec',
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sept',
      'Oct',
      'Nov',
    ]);
    expect(activity.months.map((m) => m.dives)).toEqual([0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1]);
    expect(activity).toMatchObject({
      thisYear: 2,
      lastYear: 1,
      yearLabel: '2026',
      hoursText: '1.7 h',
      busiestText: 'Nov, 1 dive',
    });
  });

  it('counts the surface interval from the end of the last dive', () => {
    const { surfaceInterval } = buildWidgetSnapshot(input(dives, { timezoneOffsetMinutes: 60 }));
    expect(surfaceInterval).toMatchObject({
      hasDive: true,
      title: 'Canyon',
      numberText: 'Dive 12',
      endedAt: (wall(2026, 11, 8) + 47 * 60) * 1000 + 60 * 60_000,
    });
  });

  it('formats in the chosen unit system', () => {
    const { lastDive, totals } = buildWidgetSnapshot(input(dives, { units: IMPERIAL_UNITS }));
    expect(lastDive.depthText).toBe('70 ft');
    expect(lastDive.temperatureText).toBe('76.1 F');
    expect(lastDive.depthUnit).toBe('ft');
    expect(totals.periods.all.deepestText).toBe('105 ft');
  });

  it('puts the milestone at the next fifty', () => {
    const many = Array.from({ length: 123 }, (_, i) =>
      summary({ id: i + 1, number: i + 1, when: wall(2020, 1, 1) + i * 86400, durationSec: 1800 }),
    );
    const { totals } = buildWidgetSnapshot(input(many));
    expect(totals).toMatchObject({ totalDives: 123, previousMilestone: 100, nextMilestone: 150 });
  });

  it('has something to say about an empty logbook', () => {
    const snapshot = buildWidgetSnapshot(input([]));
    expect(snapshot.lastDive).toMatchObject({ hasDive: false, title: 'No dives yet', profile: [] });
    expect(snapshot.lastDive.url).toBe('subsurface://dives');
    expect(snapshot.surfaceInterval.hasDive).toBe(false);
    expect(snapshot.totals.periods.all).toMatchObject({
      dives: 0,
      deepestText: '-',
      deepestWhere: '',
    });
    expect(snapshot.activity.busiestText).toBe('');
  });

  it('stays small enough to hand to WidgetKit', () => {
    const long = Array.from({ length: 5000 }, (_, i) => entry(i * 2, 15_000));
    const snapshot = buildWidgetSnapshot(input(dives, { lastProfile: long }));
    expect(snapshot.lastDive.profile).toHaveLength(48);
    expect(JSON.stringify(snapshot).length).toBeLessThan(8000);
  });
});

describe('the bundled sample logbook', () => {
  const SAMPLE = join(REPO_ROOT, 'assets/sample/sample-log.ssrf');
  let host: SsrfHost;
  let dives: DiveSummary[];
  let profile: PlotEntry[];

  beforeAll(async () => {
    host = new SsrfHost();
    await host.loadFromXML(SAMPLE);
    dives = await host.listDives();
    const latest = latestDive(dives);
    profile = latest ? (await host.getProfile(latest.id)).entry : [];
  });

  afterAll(async () => {
    await host?.close();
  });

  it('builds every widget from what the core returns', () => {
    const snapshot = buildWidgetSnapshot(input(dives, { lastProfile: profile }));
    const latest = latestDive(dives)!;
    expect(snapshot.lastDive.hasDive).toBe(true);
    expect(snapshot.lastDive.url).toBe(`subsurface://dives/at/${latest.when}`);
    expect(snapshot.lastDive.profile.length).toBeGreaterThan(1);
    expect(snapshot.lastDive.profile.length).toBeLessThanOrEqual(48);
    // The miniature keeps the dive's deepest sample.
    const deepestSample = Math.max(...profile.map((e) => e.depthMm)) / 1000;
    expect(snapshot.lastDive.profileMaxDepth).toBeCloseTo(deepestSample, 1);
    expect(snapshot.totals.periods.all.dives).toBe(
      dives.filter((d) => !d.planned && !d.invalid).length,
    );
  });
});
