// AI-generated (Claude)
// Unit tests for the statistics presentation model. Pure TypeScript: the
// numbers come from a synthetic summary, so what is checked here is the
// labelling, bucket trimming, gap filling and axis maths - the module-driven
// side (that the numbers themselves are right) is tests/statistics.test.ts.

import { describe, expect, it } from 'vitest';

import type { Stats, StatsDurationBin, StatsMonth, StatsSummary } from './index';
import {
  countAxis,
  depthHistogram,
  divesOverTime,
  durationHistogram,
  filterYears,
  formatTotalTime,
  isFiltered,
  pickGranularity,
  summaryTiles,
  toStatsFilter,
} from './statistics';

function stats(partial: Partial<Stats> = {}): Stats {
  return {
    period: 0,
    selectionSize: 0,
    totalTimeSec: 0,
    totalAverageDepthTimeSec: 0,
    shortestTimeSec: 0,
    longestTimeSec: 0,
    maxDepthMm: 0,
    minDepthMm: 0,
    avgDepthMm: 0,
    combinedMaxDepthMm: 0,
    maxSacMlPerMin: 0,
    minSacMlPerMin: 0,
    avgSacMlPerMin: 0,
    totalSacTimeSec: 0,
    maxTempMkelvin: 0,
    minTempMkelvin: 0,
    combinedTempMkelvin: 0,
    combinedCount: 0,
    isYear: false,
    isTrip: false,
    location: '',
    ...partial,
  };
}

function durationBins(counts: number[]): StatsDurationBin[] {
  return counts.map((dives, index) => ({
    fromMin: index * 10,
    toMin: index === counts.length - 1 ? null : (index + 1) * 10,
    dives,
    totalTimeSec: dives * (index * 10 + 5) * 60,
  }));
}

function summary(partial: Partial<StatsSummary> = {}): StatsSummary {
  return {
    total: stats(),
    matched: 0,
    yearly: [],
    monthly: [],
    byTrip: [],
    byType: [],
    byDepth: [],
    byTemp: [],
    timeline: [],
    byDuration: durationBins([0]),
    siteCount: 0,
    ...partial,
  };
}

function month(year: number, m: number, dives: number): StatsMonth {
  return { year, month: m, dives, totalTimeSec: dives * 2400, maxDepthMm: 30000 };
}

describe('summaryTiles', () => {
  const filled = summary({
    total: stats({
      selectionSize: 4,
      totalTimeSec: 3 * 3600 + 25 * 60,
      maxDepthMm: 42500,
      avgDepthMm: 18000,
      minTempMkelvin: 278150,
      maxTempMkelvin: 300150,
    }),
    matched: 4,
    siteCount: 3,
  });

  it('renders the headline numbers', () => {
    const tiles = summaryTiles(filled);
    expect(tiles.map((tile) => [tile.label, tile.value])).toEqual([
      ['Dives', '4'],
      ['Total time', '3 h 25 min'],
      ['Max depth', '42.5 m'],
      ['Dive sites', '3'],
    ]);
    expect(tiles[1].detail).toBe('avg 51:15');
    expect(tiles[2].detail).toBe('avg 18 m');
    expect(tiles[3].detail).toBe('5 C to 27 C');
  });

  it('converts to imperial', () => {
    const tiles = summaryTiles(filled, 'imperial');
    expect(tiles[2].value).toBe('139 ft');
    expect(tiles[3].detail).toBe('41 F to 80.6 F');
  });

  it('stays readable with no dives at all', () => {
    const tiles = summaryTiles(summary());
    expect(tiles.map((tile) => tile.value)).toEqual(['0', '0 min', '-', '0']);
    expect(tiles.every((tile) => tile.detail === '')).toBe(true);
  });

  it('names the matched count when invalid dives were dropped', () => {
    const tiles = summaryTiles(summary({ total: stats({ selectionSize: 4 }), matched: 5 }));
    expect(tiles[0].detail).toBe('5 matched');
  });
});

describe('formatTotalTime', () => {
  it('is hours and minutes, unlike a single dive duration', () => {
    expect(formatTotalTime(0)).toBe('0 min');
    expect(formatTotalTime(45 * 60)).toBe('45 min');
    expect(formatTotalTime(3600)).toBe('1 h 0 min');
    expect(formatTotalTime(48709)).toBe('13 h 32 min');
  });
});

describe('divesOverTime', () => {
  it('fills the months with no dives', () => {
    const bars = divesOverTime(
      summary({ timeline: [month(2024, 1, 2), month(2024, 4, 1)] }),
      'month'
    );
    expect(bars.map((bar) => bar.value)).toEqual([2, 0, 0, 1]);
    expect(bars.map((bar) => bar.label)).toEqual(['2024', 'Feb', 'Mar', 'Apr']);
    expect(bars[1].caption).toBe('Feb 2024: 0 dives');
    expect(bars[3].caption).toBe('Apr 2024: 1 dive');
  });

  it('crosses a year boundary', () => {
    const bars = divesOverTime(
      summary({ timeline: [month(2023, 11, 1), month(2024, 2, 3)] }),
      'month'
    );
    expect(bars.map((bar) => bar.key)).toEqual(['2023-11', '2023-12', '2024-1', '2024-2']);
    expect(bars.map((bar) => bar.label)).toEqual(['Nov', 'Dec', '2024', 'Feb']);
  });

  it('switches to years once the span passes two years', () => {
    const wide = summary({
      timeline: [month(2019, 1, 1), month(2024, 6, 2)],
      yearly: [stats({ period: 2019, selectionSize: 1 }), stats({ period: 2024, selectionSize: 2 })],
    });
    expect(pickGranularity(wide)).toBe('year');
    expect(divesOverTime(wide)).toEqual([
      { key: '2019', label: '2019', value: 1, caption: '2019: 1 dive' },
      { key: '2024', label: '2024', value: 2, caption: '2024: 2 dives' },
    ]);
  });

  it('keeps months for a span of exactly two years', () => {
    expect(pickGranularity(summary({ timeline: [month(2023, 1, 1), month(2024, 12, 1)] }))).toBe(
      'month'
    );
  });

  it('is empty without dives', () => {
    expect(divesOverTime(summary())).toEqual([]);
    expect(pickGranularity(summary())).toBe('month');
  });
});

describe('histograms', () => {
  const buckets = summary({
    // Entry 0 is the core's combined total; the rest are 10 m buckets.
    byDepth: [
      stats({ selectionSize: 6 }),
      stats({ selectionSize: 2 }),
      stats({ selectionSize: 0 }),
      stats({ selectionSize: 4 }),
      stats({ selectionSize: 0 }),
      stats({ selectionSize: 0 }),
    ],
    byDuration: durationBins([0, 1, 3, 0, 0]),
  });

  it('drops the combined bucket and trims the trailing empty ones', () => {
    const bars = depthHistogram(buckets);
    expect(bars.map((bar) => bar.value)).toEqual([2, 0, 4]);
    expect(bars.map((bar) => bar.label)).toEqual(['10', '20', '30']);
    expect(bars[2].caption).toBe('20 to 30: 4 dives');
  });

  it('converts the depth bounds without moving the cuts', () => {
    expect(depthHistogram(buckets, 'imperial').map((bar) => bar.label)).toEqual(['33', '66', '98']);
  });

  it('labels the open-ended duration bucket', () => {
    const bars = durationHistogram(summary({ byDuration: durationBins([0, 1, 0, 0, 2]) }));
    expect(bars.map((bar) => bar.label)).toEqual(['10', '20', '30', '40', '40+']);
    expect(bars[4].caption).toBe('over 40 min: 2 dives');
    expect(bars[0].value).toBe(0);
  });

  it('trims duration buckets from the end but keeps the leading empty ones', () => {
    expect(durationHistogram(buckets).map((bar) => bar.label)).toEqual(['10', '20', '30']);
    expect(durationHistogram(summary())).toEqual([]);
  });
});

describe('countAxis', () => {
  it('rounds the top up to a whole step', () => {
    expect(countAxis([{ key: 'a', label: 'a', value: 7, caption: '' }])).toEqual({
      max: 8,
      ticks: [0, 2, 4, 6, 8],
    });
  });

  it('keeps small charts on whole dives', () => {
    const axis = countAxis([{ key: 'a', label: 'a', value: 3, caption: '' }]);
    expect(axis.max).toBe(3);
    expect(axis.ticks).toEqual([0, 1, 2, 3]);
  });

  it('never returns a zero range', () => {
    expect(countAxis([])).toEqual({ max: 1, ticks: [0, 1] });
    expect(countAxis([{ key: 'a', label: 'a', value: 0, caption: '' }]).max).toBe(1);
  });
});

describe('filters', () => {
  it('turns a year into UTC bounds', () => {
    const filter = toStatsFilter({ year: 2013, siteUuid: null });
    expect(filter).toEqual({ fromWhen: 1356998400, toWhen: 1388534399 });
    expect(new Date(filter!.fromWhen! * 1000).toISOString()).toBe('2013-01-01T00:00:00.000Z');
    expect(new Date(filter!.toWhen! * 1000).toISOString()).toBe('2013-12-31T23:59:59.000Z');
  });

  it('passes the site uuid through and omits an empty filter', () => {
    expect(toStatsFilter({ year: null, siteUuid: 42 })).toEqual({ siteUuid: 42 });
    expect(toStatsFilter({ year: null, siteUuid: null })).toBeUndefined();
    expect(isFiltered({ year: null, siteUuid: null })).toBe(false);
    expect(isFiltered({ year: null, siteUuid: 42 })).toBe(true);
  });

  it('offers the years newest first', () => {
    const years = filterYears(
      summary({
        yearly: [stats({ period: 2019 }), stats({ period: 2024 }), stats({ period: 0 })],
      })
    );
    expect(years).toEqual([2024, 2019]);
  });
});
