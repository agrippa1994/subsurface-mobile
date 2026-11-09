// AI-generated (Claude)
// Statistics driven through the real bindings.
//
// The acceptance criterion for task 09 is that the summary totals match a hand
// count of a known logbook, so the expectations here are counted off
// subsurface/dives/abitofeverything.ssrf - the same file the app ships as its
// sample - and cross-checked against what listDives() reports dive by dive.
// The aggregation itself never runs in TypeScript: `sumOf` exists only to have
// something independent to compare the C++ totals against.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { DiveSummary, StatsSummary } from '../src/models';
import {
  depthHistogram,
  divesOverTime,
  durationHistogram,
  sacOverTime,
  summaryTiles,
} from '../src/models/statistics';
import { fixture } from './harness/fixtures';
import { SsrfHost } from './harness/ssrf-host';
import { METRIC_UNITS } from '../src/models/units';

let host: SsrfHost;
let dives: DiveSummary[];
let summary: StatsSummary;

beforeAll(async () => {
  host = new SsrfHost();
  await host.loadFromXML(fixture('abitofeverything.ssrf'));
  dives = await host.listDives();
  summary = await host.getStatistics();
});

afterAll(async () => {
  await host.close();
});

function sumOf(rows: DiveSummary[], pick: (dive: DiveSummary) => number): number {
  return rows.reduce((acc, dive) => acc + pick(dive), 0);
}

function yearOf(dive: DiveSummary): number {
  return new Date(dive.when * 1000).getUTCFullYear();
}

describe('abitofeverything.ssrf - hand-counted totals', () => {
  it('counts every dive in the file', () => {
    // 18 <dive> elements, none flagged invalid.
    expect(dives).toHaveLength(18);
    expect(summary.matched).toBe(18);
    expect(summary.total.selectionSize).toBe(18);
  });

  it('totals bottom time and depth exactly as the dives do', () => {
    expect(summary.total.totalTimeSec).toBe(sumOf(dives, (dive) => dive.durationSec));
    expect(summary.total.maxDepthMm).toBe(Math.max(...dives.map((dive) => dive.maxDepthMm)));
    // <depth max='70.0 m' /> on the deepest dive of the file.
    expect(summary.total.maxDepthMm).toBe(70000);
  });

  it('counts the distinct dive sites, not the sites in the file', async () => {
    // 26 sites are defined in the file; 14 dives carry a divesiteid, spread
    // over 12 distinct sites. Counted by uuid, not by name: two of the sites
    // share a name, which is why the dive rows alone cannot answer this.
    const sites = await host.listDiveSites();
    expect(sites).toHaveLength(26);
    expect(sites.filter((site) => site.diveCount > 0)).toHaveLength(12);
    expect(summary.siteCount).toBe(12);
    // 13, not 14: one of the referenced sites has an empty name.
    expect(dives.filter((dive) => dive.siteName !== '')).toHaveLength(13);
  });

  it('splits the dives by year the way the dates do', () => {
    const byYear = new Map<number, number>();
    for (const dive of dives) {
      byYear.set(yearOf(dive), (byYear.get(yearOf(dive)) ?? 0) + 1);
    }
    expect(summary.yearly.map((year) => [year.period, year.selectionSize])).toEqual([
      [2010, 1],
      [2011, 7],
      [2012, 1],
      [2013, 4],
      [2014, 4],
      [2020, 1],
    ]);
    expect(summary.yearly.map((year) => [year.period, year.selectionSize])).toEqual(
      [...byYear.entries()].sort((a, b) => a[0] - b[0])
    );
  });
});

describe('the buckets the bindings add', () => {
  it('puts every dive in exactly one duration bucket', () => {
    expect(summary.byDuration.reduce((acc, bin) => acc + bin.dives, 0)).toBe(dives.length);
    expect(summary.byDuration.reduce((acc, bin) => acc + bin.totalTimeSec, 0)).toBe(
      summary.total.totalTimeSec
    );

    for (const dive of dives) {
      const minutes = Math.floor(dive.durationSec / 60);
      const bin = summary.byDuration.find(
        (candidate) =>
          minutes >= candidate.fromMin && (candidate.toMin === null || minutes < candidate.toMin)
      );
      expect(bin, `no bucket for ${minutes} min`).toBeDefined();
    }

    // 10-minute buckets up to an open-ended one at 180 min.
    expect(summary.byDuration[0].fromMin).toBe(0);
    expect(summary.byDuration[summary.byDuration.length - 1]).toMatchObject({
      fromMin: 180,
      toMin: null,
    });
  });

  it('puts every dive in exactly one month of the timeline, in order', () => {
    expect(summary.timeline.reduce((acc, entry) => acc + entry.dives, 0)).toBe(dives.length);

    let previous = 0;
    for (const entry of summary.timeline) {
      const key = entry.year * 12 + entry.month;
      expect(key).toBeGreaterThan(previous);
      previous = key;
      expect(entry.month).toBeGreaterThanOrEqual(1);
      expect(entry.month).toBeLessThanOrEqual(12);
    }

    for (const dive of dives) {
      const date = new Date(dive.when * 1000);
      const entry = summary.timeline.find(
        (candidate) =>
          candidate.year === date.getUTCFullYear() && candidate.month === date.getUTCMonth() + 1
      );
      expect(entry, `no timeline entry for dive ${dive.id}`).toBeDefined();
    }
  });

  it('lines the core monthly buckets up with the timeline', () => {
    // sacOverTime takes the year of monthly[i] from timeline[i].
    expect(summary.monthly).toHaveLength(summary.timeline.length);
    summary.monthly.forEach((month, index) => {
      expect(month.period).toBe(summary.timeline[index].month);
      expect(month.selectionSize).toBe(summary.timeline[index].dives);
    });
  });

  it('averages SAC only over the dives that have one', async () => {
    // The list rows carry no SAC; it is on the full dive.
    const full = await Promise.all(dives.map((dive) => host.getDive(dive.id)));
    const sacs = full.map((dive) => dive.sac).filter((sac) => sac > 100);
    expect(sacs.length).toBeGreaterThan(0);
    expect(summary.total.minSacMlPerMin).toBe(Math.min(...sacs));
    expect(summary.total.maxSacMlPerMin).toBe(Math.max(...sacs));
    expect(summary.total.avgSacMlPerMin).toBeGreaterThanOrEqual(summary.total.minSacMlPerMin);
    expect(summary.total.avgSacMlPerMin).toBeLessThanOrEqual(summary.total.maxSacMlPerMin);
    expect(sacOverTime(summary, METRIC_UNITS).length).toBeGreaterThan(0);
  });

  it('agrees with the core on the yearly totals', () => {
    for (const year of summary.yearly) {
      const months = summary.timeline.filter((entry) => entry.year === year.period);
      expect(months.reduce((acc, entry) => acc + entry.dives, 0)).toBe(year.selectionSize);
    }
  });
});

describe('filters recompute in the module', () => {
  it('narrows to one year', async () => {
    // 2013-01-01T00:00:00Z .. 2013-12-31T23:59:59Z
    const filtered = await host.getStatistics({ fromWhen: 1356998400, toWhen: 1388534399 });
    const expected = dives.filter((dive) => yearOf(dive) === 2013);

    expect(expected).toHaveLength(4);
    expect(filtered.matched).toBe(4);
    expect(filtered.total.selectionSize).toBe(4);
    expect(filtered.total.totalTimeSec).toBe(sumOf(expected, (dive) => dive.durationSec));
    expect(filtered.yearly.map((year) => year.period)).toEqual([2013]);
    expect(filtered.timeline.every((entry) => entry.year === 2013)).toBe(true);
  });

  it('narrows to one dive site', async () => {
    const sites = await host.listDiveSites();
    const busiest = [...sites].sort((a, b) => b.diveCount - a.diveCount)[0];
    expect(busiest.diveCount).toBeGreaterThan(0);

    const filtered = await host.getStatistics({ siteUuid: busiest.uuid });
    expect(filtered.matched).toBe(busiest.diveCount);
    expect(filtered.total.selectionSize).toBe(busiest.diveCount);
    expect(filtered.siteCount).toBe(1);
  });

  it('comes back empty for a range with no dives, and the charts follow', async () => {
    const filtered = await host.getStatistics({ fromWhen: 0, toWhen: 1 });
    expect(filtered.matched).toBe(0);
    expect(filtered.total.selectionSize).toBe(0);
    expect(filtered.siteCount).toBe(0);
    expect(filtered.timeline).toEqual([]);
    expect(divesOverTime(filtered)).toEqual([]);
    expect(depthHistogram(filtered, METRIC_UNITS)).toEqual([]);
    expect(durationHistogram(filtered)).toEqual([]);
    expect(sacOverTime(filtered, METRIC_UNITS)).toEqual([]);
    expect(summaryTiles(filtered, METRIC_UNITS).map((tile) => tile.value)).toEqual(['0', '0 min', '-', '-', '0', '-']);
  });

  it('restores the full picture once the filter is dropped', async () => {
    const again = await host.getStatistics();
    expect(again.matched).toBe(18);
    expect(again.total.totalTimeSec).toBe(summary.total.totalTimeSec);
  });
});

describe('a single-dive logbook', () => {
  it('renders without a degenerate axis', async () => {
    const single = new SsrfHost();
    try {
      await single.loadFromXML(fixture('test15.xml'));
      const one = await single.getStatistics();
      expect(one.matched).toBe(1);
      expect(one.timeline).toHaveLength(1);
      expect(divesOverTime(one)).toHaveLength(1);
      expect(depthHistogram(one, METRIC_UNITS).reduce((acc, bar) => acc + bar.value, 0)).toBe(1);
      expect(durationHistogram(one).reduce((acc, bar) => acc + bar.value, 0)).toBe(1);
      expect(summaryTiles(one, METRIC_UNITS)[0].value).toBe('1');
    } finally {
      await single.close();
    }
  });
});

describe("the legacy dive summary's periods", () => {
  /**
   * The start of a period, worked out apart from the bindings: QDateTime::addMonths
   * on the wall clock, keeping the day and clamping it to the shorter month.
   */
  function monthsBefore(now: number, months: number): number {
    const date = new Date(now * 1000);
    const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    return (
      Date.UTC(
        target.getUTCFullYear(),
        target.getUTCMonth(),
        Math.min(date.getUTCDate(), lastDay),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
      ) / 1000
    );
  }

  // A week after the newest 2014 dive: the 2020 dive lies in the future of it,
  // which a period counts too, as the legacy one did (it has no upper bound).
  const newest2014 = () => Math.max(...dives.filter((dive) => yearOf(dive) === 2014).map((d) => d.when));

  for (const months of [1, 3, 6, 12]) {
    it(`counts the dives after ${months} month(s) back, as the core decides`, async () => {
      const now = newest2014() + 7 * 86400;
      const start = monthsBefore(now, months);
      const result = await host.getStatistics({ recentMonths: months, nowWhen: now });
      const expected = dives.filter((dive) => dive.when > start);
      expect(result.periodStartWhen).toBe(start);
      expect(result.matched).toBe(expected.length);
      expect(result.total.totalTimeSec).toBe(sumOf(expected, (dive) => dive.durationSec));
      expect(result.firstWhen).toBe(Math.min(...expected.map((dive) => dive.when)));
      expect(result.lastWhen).toBe(Math.max(...expected.map((dive) => dive.when)));
    });
  }

  it('clamps the day to the shorter month, as addMonths does', async () => {
    // 31 March 2014, noon, less one month: 28 February.
    const now = Date.UTC(2014, 2, 31, 12) / 1000;
    const result = await host.getStatistics({ recentMonths: 1, nowWhen: now });
    expect(result.periodStartWhen).toBe(Date.UTC(2014, 1, 28, 12) / 1000);
  });

  it('crosses a year boundary', async () => {
    const now = Date.UTC(2014, 1, 10) / 1000;
    const result = await host.getStatistics({ recentMonths: 6, nowWhen: now });
    expect(result.periodStartWhen).toBe(Date.UTC(2013, 7, 10) / 1000);
  });

  it('reports first and last dive, nitrox and deep dives over everything', () => {
    expect(summary.firstWhen).toBe(Math.min(...dives.map((dive) => dive.when)));
    expect(summary.lastWhen).toBe(Math.max(...dives.map((dive) => dive.when)));
    expect(summary.deepDives).toBe(dives.filter((dive) => dive.maxDepthMm > 39000).length);
    expect(summary.nitroxDives).toBeGreaterThan(0);
    expect(summary.periodStartWhen).toBe(0);
  });

  it('refuses a period out of range', async () => {
    await expect(host.getStatistics({ recentMonths: -1 })).rejects.toThrow(/recentMonths/);
  });
});
