// AI-generated (Claude)
// Configurable statistics through the real bindings.
//
// stats/statsvariables.cpp and stats/statsstate.cpp are compiled unchanged, so the
// binning and aggregation are the desktop's by construction. What needs pinning is
// everything around that: the QString stand-in they compile against, and the plot
// functions ported out of statsview.cpp. So the expectations are worked out here
// from each dive's own values, by hand, and upstream's formulas are quoted where one
// is what is being checked. Numbers a desktop build reported are not among them: the
// machine that wrote this has no Qt. See docs/tasks/PROGRESS.md.

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type {
  Dive,
  DiveSummary,
  StatsChart,
  StatsChartConfig,
  StatsChartConfigInput,
  StatsChartItem,
} from '../src/models';
import { fixture } from './harness/fixtures';
import { writeLargeLog } from './harness/large-log';
import { SsrfHost } from './harness/ssrf-host';

let host: SsrfHost;
let dives: DiveSummary[];

beforeAll(async () => {
  host = new SsrfHost();
  await host.loadFromXML(fixture('abitofeverything.ssrf'));
  dives = await host.listDives();
});

afterAll(async () => {
  await host.close();
});

async function chart(config: StatsChartConfigInput, extra = {}): Promise<StatsChart> {
  const result = await host.statsChart({ config, ...extra });
  return result.chart!;
}

const years = () => [...new Set(dives.map(yearOf))].sort((a, b) => a - b);

function yearOf(dive: DiveSummary): number {
  return new Date(dive.when * 1000).getUTCFullYear();
}

function metres(mm: number): number {
  return mm / 1000;
}

function mean(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function items(result: StatsChart): StatsChartItem[] {
  return result.items ?? [];
}

// StatsVariable::quartiles() in statsvariables.cpp, written out over a sorted list.
function quartiles(sorted: number[]) {
  const s = sorted.length;
  const at = (i: number) => sorted[i];
  const q1 = (i: number) => (3 * at(i) + at(i + 1)) / 4;
  const q2 = (i: number) => (at(i) + at(i + 1)) / 2;
  const q3 = (i: number) => (at(i) + 3 * at(i + 1)) / 4;
  const low = at(0);
  const high = at(s - 1);
  const f = Math.floor;
  switch (s % 4) {
    case 0:
      return { min: low, q1: q3(f(s / 4) - 1), q2: q2(f(s / 2) - 1), q3: q1(s - f(s / 4) - 1), max: high };
    case 1:
      return { min: low, q1: at(f(s / 4)), q2: at(f(s / 2)), q3: at(s - f(s / 4) - 1), max: high };
    case 2:
      return { min: low, q1: q1(f(s / 4)), q2: q2(f(s / 2) - 1), q3: q3(s - f(s / 4) - 2), max: high };
    default:
      return { min: low, q1: q2(f(s / 4)), q2: at(f(s / 2)), q3: q2(s - f(s / 4) - 2), max: high };
  }
}

describe('the configuration', () => {
  it('starts where StatsState starts: dives per year', async () => {
    const result = await host.statsChart();
    expect(result.config.var1).toBe('Date');
    expect(result.config.var2).toBeNull();
    expect(result.config.chart).toEqual({ type: 'HistogramCount', subtype: 'Vertical' });
    expect(result.dives).toBe(18);
  });

  it('offers the 29 variables of the desktop, and var2 without var1', async () => {
    const { options } = await host.statsChart();
    expect(options.var1).toHaveLength(29);
    expect(options.var2).toHaveLength(28);
    expect(options.var2.map((v) => v.name)).not.toContain('Date');
    expect(options.var1.find((v) => v.name === 'SAC')).toMatchObject({ type: 'numeric', unit: 'ℓ/min' });
    expect(options.var1.find((v) => v.name === 'Date')?.type).toBe('continuous');
    expect(options.var1.find((v) => v.name === 'Tags')?.type).toBe('discrete');
  });

  it('never leaves an invalid combination, from any starting point', async () => {
    const { options } = await host.statsChart();
    const names = options.var1.map((v) => v.name);
    for (const var1 of names) {
      for (const var2 of [null, ...names]) {
        const result = await host.statsChart({ config: { var1, var2 } });
        // var1 against itself falls back to none, exactly as validate() does.
        expect(result.config.var2).toBe(var1 === var2 ? null : var2);
        expect(result.config.chart.type).not.toBe('Invalid');
        expect(result.options.charts.filter((c) => c.selected)).toHaveLength(1);
        expect(result.chart).toBeDefined();
      }
    }
  });

  it('keeps every chart it offers, and survives being read back', async () => {
    const { options } = await host.statsChart();
    for (const var1 of options.var1.map((v) => v.name)) {
      for (const var2 of [null, 'SAC', 'Dive mode', 'Date']) {
        const first = await host.statsChart({ config: { var1, var2 } });
        for (const offered of first.options.charts) {
          const chosen = await host.statsChart({
            config: first.config,
            change: { kind: 'chart', value: { type: offered.type, subtype: offered.subtype } },
          });
          expect(chosen.config.chart).toEqual({ type: offered.type, subtype: offered.subtype });
          // The persisted form replays to itself: otherwise a relaunch moves the chart.
          const again = await host.statsChart({ config: chosen.config });
          expect(again.config).toEqual(chosen.config);
        }
      }
    }
  });

  it('constrains the choices as statsstate.cpp does', async () => {
    const scatter = await host.statsChart({ config: { var1: 'Max. Depth', var2: 'SAC', binner1: 0 } });
    expect(scatter.config.chart.type).toBe('ScatterPlot');
    // Operations need a binned first variable.
    expect(scatter.options.operations).toEqual([]);
    expect(scatter.options.binners2).toEqual([]);

    const binned = await host.statsChart({ config: scatter.config, change: { kind: 'binner1', value: 1 } });
    expect(binned.config.chart.type).not.toBe('ScatterPlot');
    expect(binned.options.binners1).toEqual(['none', 'in 5 m steps', 'in 10 m steps', 'in 20 m steps']);
    expect(binned.options.operations.map((o) => o.key)).toEqual([
      'Invalid',
      'Median',
      'Mean',
      'TimeWeightedMean',
      'Min',
      'Max',
    ]);

    // An operation and a binner on the second variable rule each other out.
    const withOperation = await host.statsChart({
      config: binned.config,
      change: { kind: 'operation', value: 'Mean' },
    });
    expect(['DiscreteValue', 'HistogramValue']).toContain(withOperation.config.chart.type);
    const withBinner = await host.statsChart({
      config: withOperation.config,
      change: { kind: 'binner2', value: 1 },
    });
    expect(withBinner.config.operation).toBe('Invalid');

    // An unbinned first variable needs a numeric second one, and is given one.
    const unbinned = await host.statsChart({
      config: { var1: 'Max. Depth', var2: 'Dive mode' },
      change: { kind: 'binner1', value: 0 },
    });
    expect(unbinned.config.var2).toBe('Mean Depth');
  });

  it('marks what it does not recommend, and allows it', async () => {
    // A numeric first variable in a categorical chart.
    const result = await host.statsChart({ config: { var1: 'Max. Depth' } });
    const types = result.options.charts.map((c) => [c.type, c.warning]);
    expect(types).toContainEqual(['HistogramCount', false]);
    expect(types).toContainEqual(['DiscreteCount', true]);
    const chosen = await host.statsChart({
      config: result.config,
      change: { kind: 'chart', value: { type: 'DiscreteCount', subtype: 'Vertical' } },
    });
    expect(chosen.config.chart.type).toBe('DiscreteCount');
  });

  it('falls back on a name it does not know, as after an upstream rename', async () => {
    const result = await host.statsChart({ config: { var1: 'Not a variable', var2: 'Nor this' } });
    expect(result.config.var1).toBe('Date');
    expect(result.config.var2).toBeNull();
  });

  it('refuses a change it does not know', async () => {
    await expect(
      host.statsChart({ change: { kind: 'nonsense', value: 1 } as never }),
    ).rejects.toThrow(/unknown statistics change/);
  });

  it('remembers the sort mode, the features and the binner', async () => {
    const config: StatsChartConfigInput = {
      var1: 'Dive site',
      var2: 'Max. Depth',
      operation: 'Mean',
      chart: { type: 'DiscreteValue', subtype: 'Horizontal' },
      sort: 'Value',
    };
    const result = await host.statsChart({ config });
    expect(result.config.sort).toBe('Value');
    expect(result.config.operation).toBe('Mean');
    const off = await host.statsChart({
      config: result.config,
      change: { kind: 'feature', value: { key: 'labels', on: false } },
    });
    expect(off.config.features.labels).toBe(false);
    const again = await host.statsChart({ config: off.config });
    expect(again.config.features.labels).toBe(false);
    expect(again.config.sort).toBe('Value');
  });
});

describe('counts', () => {
  it('bins dives per year as listDives dates them, with the empty years', async () => {
    const result = await chart({ var1: 'Date', binner1: 1 });
    expect(result.family).toBe('bar');
    expect(result.histogram).toBe(true);

    const expected = new Map<number, number>();
    for (const dive of dives) {
      expected.set(yearOf(dive), (expected.get(yearOf(dive)) ?? 0) + 1);
    }
    const list = years();
    expect(items(result).map((item) => item.label)).toEqual(
      Array.from({ length: list[list.length - 1] - list[0] + 1 }, (_, i) => String(list[0] + i)),
    );
    for (const item of items(result)) {
      expect(item.count).toBe(expected.get(Number(item.label)) ?? 0);
      expect(item.total).toBe(18);
    }
    // Bounds are days since 1970: 2010 starts at 14610 - 1 from the core's rounding of
    // the year's start, and each bin ends where the next begins.
    expect(items(result)[0].to).toBe(items(result)[1].from);
    expect(items(result).reduce((acc, item) => acc + (item.dives?.length ?? 0), 0)).toBe(18);
  });

  it('gives the ids of the dives behind a bar', async () => {
    const result = await chart({ var1: 'Date', binner1: 1 });
    const busiest = [...items(result)].sort((a, b) => b.count - a.count)[0];
    const expected = dives.filter((dive) => yearOf(dive) === Number(busiest.label)).map((d) => d.id);
    expect([...busiest.dives!].sort()).toEqual([...expected].sort());
  });

  it('counts a dive once for each buddy, as desktop does', async () => {
    const result = await chart({
      var1: 'People',
      chart: { type: 'DiscreteCount', subtype: 'Horizontal' },
    });
    const counts = new Map<string, number>();
    for (const dive of dives) {
      const people = new Set(
        [...dive.buddy.split(','), ...dive.diveguide.split(',')].map((p) => p.trim()).filter(Boolean),
      );
      people.forEach((person) => counts.set(person, (counts.get(person) ?? 0) + 1));
    }
    expect(result.horizontal).toBe(true);
    expect(new Map(items(result).map((item) => [item.label, item.count]))).toEqual(counts);
    const total = [...counts.values()].reduce((acc, n) => acc + n, 0);
    expect(items(result)[0].total).toBe(total);
  });

  it('sorts by count when asked, and by bin otherwise', async () => {
    const byBin = await chart({ var1: 'Dive site', chart: { type: 'DiscreteCount', subtype: 'Horizontal' } });
    const byCount = await chart({
      var1: 'Dive site',
      chart: { type: 'DiscreteCount', subtype: 'Horizontal' },
      sort: 'Count',
    });
    const counts = items(byCount).map((item) => item.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(items(byBin).length).toBe(items(byCount).length);
  });

  it('marks mean and median on a numeric histogram', async () => {
    const result = await chart({ var1: 'Max. Depth', binner1: 2 });
    const depths = dives.map((d) => metres(d.maxDepthMm)).sort((a, b) => a - b);
    expect(result.mean).toBeCloseTo(mean(depths), 6);
    expect(result.median).toBeCloseTo(quartiles(depths).q2, 6);
    // 10 m bins, with their bounds on the axis.
    for (const item of items(result)) {
      expect(item.to - item.from).toBe(10);
      expect(item.count).toBe(depths.filter((d) => d >= item.from && d < item.to).length);
    }
  });
});

describe('operations', () => {
  it('computes each operation per year from the dives themselves', async () => {
    const results = await chart({
      var1: 'Date',
      binner1: 1,
      var2: 'Max. Depth',
      operation: 'Mean',
      chart: { type: 'HistogramValue', subtype: 'Vertical' },
    });
    expect(results.title).toBe('Max. Depth (Mean)');
    for (const item of items(results)) {
      const of = dives.filter((dive) => yearOf(dive) === Number(item.label));
      if (of.length === 0) {
        expect(item.value).toBeNull();
        continue;
      }
      const depths = of.map((d) => metres(d.maxDepthMm)).sort((a, b) => a - b);
      const seconds = of.reduce((acc, d) => acc + d.durationSec, 0);
      expect(item.value).toBeCloseTo(mean(depths), 6);
      expect(item.operations!.mean).toBeCloseTo(mean(depths), 6);
      expect(item.operations!.sum).toBeCloseTo(depths.reduce((a, d) => a + d, 0), 6);
      expect(item.operations!.min).toBeCloseTo(depths[0], 6);
      expect(item.operations!.max).toBeCloseTo(depths[depths.length - 1], 6);
      expect(item.operations!.median).toBeCloseTo(quartiles(depths).q2, 6);
      expect(item.operations!.timeWeightedMean).toBeCloseTo(
        of.reduce((acc, d) => acc + metres(d.maxDepthMm) * d.durationSec, 0) / seconds,
        6,
      );
    }
  });

  it('agrees with the core statistics on the mean depth of a year', async () => {
    // Two routes through C++: statistics.cpp, and the desktop's chart variables.
    const summary = await host.getStatistics();
    const results = await chart({
      var1: 'Date',
      binner1: 1,
      var2: 'Mean Depth',
      operation: 'TimeWeightedMean',
      chart: { type: 'HistogramValue', subtype: 'Vertical' },
    });
    for (const year of summary.yearly) {
      const item = items(results).find((candidate) => candidate.label === String(year.period))!;
      expect(item.count).toBe(year.selectionSize);
      expect(metres(year.avgDepthMm)).toBeCloseTo(item.value!, 0);
    }
  });

  it('sorts by the value of the operation', async () => {
    const results = await chart({
      var1: 'Dive site',
      var2: 'Max. Depth',
      operation: 'Max',
      chart: { type: 'DiscreteValue', subtype: 'Horizontal' },
      sort: 'Value',
    });
    const values = items(results).map((item) => item.value!);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it('leaves a bin without a value empty rather than zero', async () => {
    const full = await Promise.all(dives.map((d) => host.getDive(d.id)));
    const results = await chart({
      var1: 'Date',
      binner1: 1,
      var2: 'SAC',
      operation: 'Median',
      chart: { type: 'HistogramValue', subtype: 'Vertical' },
    });
    for (const item of items(results)) {
      const of: Dive[] = full.filter((d) => yearOf(d as unknown as DiveSummary) === Number(item.label));
      const sacs = of.map((d) => d.sac).filter((sac) => sac > 0);
      if (sacs.length === 0) {
        expect(item.value).toBeNull();
      } else {
        expect(item.value).toBeCloseTo(quartiles(sacs.map((s) => s / 1000).sort((a, b) => a - b)).q2, 2);
      }
    }
  });
});

describe('stacked and grouped bars', () => {
  it('splits each year by dive mode, adding up to the year', async () => {
    const result = await chart({
      var1: 'Date',
      binner1: 1,
      var2: 'Dive mode',
      chart: { type: 'HistogramStacked', subtype: 'VerticalStacked' },
    });
    expect(result.stacked).toBe(true);
    expect(result.series).toEqual(['Open circuit', 'CCR']);
    for (const item of items(result)) {
      const of = dives.filter((dive) => yearOf(dive) === Number(item.label));
      expect(item.segments!.map((s) => s.count)).toEqual([
        of.filter((d) => d.divemode === 0).length,
        of.filter((d) => d.divemode === 1).length,
      ]);
      expect(item.count).toBe(of.length);
      expect(item.segments!.flatMap((s) => s.dives).sort()).toEqual(of.map((d) => d.id).sort());
    }
    const maxYear = Math.max(...items(result).map((item) => item.count));
    expect(result.valAxis).toMatchObject({ kind: 'count', max: maxYear });
  });

  it('scales a grouped axis to the tallest group, not the tallest stack', async () => {
    const result = await chart({
      var1: 'Dive mode',
      var2: 'Dive site',
      chart: { type: 'DiscreteBar', subtype: 'VerticalGrouped' },
    });
    expect(result.stacked).toBe(false);
    const largest = Math.max(...items(result).flatMap((item) => item.segments!.map((s) => s.count)));
    expect(result.valAxis).toMatchObject({ max: largest });
  });
});

describe('pie', () => {
  it('keeps slices above 5% and adds up to the whole', async () => {
    const result = await chart({ var1: 'Dive mode', chart: { type: 'Pie', subtype: 'Pie' } });
    expect(result.family).toBe('pie');
    const total = items(result).reduce((acc, item) => acc + item.count, 0);
    expect(total).toBe(18);
    expect(items(result)[0].from).toBe(0);
    expect(items(result)[items(result).length - 1].to).toBe(18);
  });

  it('folds the small slices into a list, never a pie of the rest alone', async () => {
    const log = new SsrfHost();
    try {
      await log.loadFromXML(writeLargeLog(120));
      const offered = (await log.statsChart({ config: { var1: 'Dive #' } })).options.binners1;
      const fives = offered.indexOf('in 5 steps');
      expect(fives).toBeGreaterThan(0);
      const { chart: pie } = await log.statsChart({
        config: { var1: 'Dive #', binner1: fives, chart: { type: 'Pie', subtype: 'Pie' } },
      });
      // 24 bins of 5 dives, each under 5%: min_slices keeps five, the rest are "other".
      const slices = items(pie!);
      expect(slices.map((item) => item.count)).toEqual([5, 5, 5, 5, 5, 95]);
      const other = slices[5];
      expect(other.label).toBe('other (19 items)');
      expect(other.other).toHaveLength(19);
      expect(other.other!.reduce((acc, row) => acc + row.count, 0)).toBe(95);
      expect(new Set(other.dives).size).toBe(95);
      expect(pie!.series).toHaveLength(6);
    } finally {
      await log.close();
    }
  }, 60000);

  it('sorts its slices by count on the desktop default for a category', async () => {
    const result = await host.statsChart({ config: { var1: 'People', chart: { type: 'Pie', subtype: 'Pie' } } });
    const counts = items(result.chart!).map((item) => item.count);
    expect(result.config.sort).toBe('Bin');
    expect(counts.reduce((a, c) => a + c, 0)).toBe(16);
    const sorted = await host.statsChart({ config: { ...result.config, sort: 'Count' } });
    const byCount = items(sorted.chart!).map((item) => item.count);
    expect(byCount).toEqual([...byCount].sort((a, b) => b - a));
  });
});

describe('box plots', () => {
  it('computes quartiles per bin as StatsVariable::quartiles does', async () => {
    const result = await chart({
      var1: 'Date',
      binner1: 1,
      var2: 'Max. Depth',
      chart: { type: 'HistogramBox', subtype: 'Box' },
    });
    expect(result.family).toBe('box');
    let checked = 0;
    for (const item of items(result)) {
      const depths = dives
        .filter((dive) => yearOf(dive) === Number(item.label))
        .map((d) => metres(d.maxDepthMm))
        .sort((a, b) => a - b);
      if (depths.length === 0) {
        expect(item.box).toBeNull();
        continue;
      }
      const expected = quartiles(depths);
      for (const key of ['min', 'q1', 'q2', 'q3', 'max'] as const) {
        expect(item.box![key]).toBeCloseTo(expected[key], 6);
      }
      expect(item.count).toBe(depths.length);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(2);
  });

  it('covers a categorical first variable too', async () => {
    const result = await chart({
      var1: 'Dive mode',
      var2: 'Max. Depth',
      chart: { type: 'DiscreteBox', subtype: 'Box' },
    });
    expect(result.family).toBe('box');
    expect(result.histogram).toBe(false);
    expect(result.catAxis?.kind).toBe('category');
    expect(items(result).reduce((acc, item) => acc + item.count, 0)).toBe(18);
  });
});

describe('scatter', () => {
  it('pairs depth with temperature per dive', async () => {
    const result = await chart({ var1: 'Max. Depth', binner1: 0, var2: 'Mean Depth' });
    expect(result.family).toBe('scatter');
    const { x, y, dives: ids } = result.points!;
    expect(x).toHaveLength(ids.length);
    expect(y).toHaveLength(ids.length);
    ids.forEach((id, i) => {
      const dive = dives.find((d) => d.id === id)!;
      expect(x[i]).toBeCloseTo(metres(dive.maxDepthMm), 6);
      expect(y[i]).toBeCloseTo(metres(dive.meanDepthMm), 6);
    });
    expect([...x]).toEqual([...x].sort((a, b) => a - b));
  });

  it('fits the line of statsview.cpp, checked by least squares', async () => {
    const result = await chart({ var1: 'Max. Depth', binner1: 0, var2: 'SAC' });
    const { x, y } = result.points!;
    const n = x.length;
    expect(n).toBe(12);
    const ax = mean(x);
    const ay = mean(y);
    const sxy = x.reduce((acc, xi, i) => acc + (xi - ax) * (y[i] - ay), 0);
    const sxx = x.reduce((acc, xi) => acc + (xi - ax) ** 2, 0);
    const syy = y.reduce((acc, yi) => acc + (yi - ay) ** 2, 0);
    const a = sxy / sxx;
    const b = ay - a * ax;
    const res = x.reduce((acc, xi, i) => acc + (y[i] - a * xi - b) ** 2, 0);

    const reg = result.regression!;
    expect(reg.a).toBeCloseTo(a, 8);
    expect(reg.b).toBeCloseTo(b, 8);
    expect(reg.r2).toBeCloseTo(1 - res / syy, 8);
    expect(reg.n).toBe(n);
    expect(reg.fromX).toBe(x[0]);
    expect(reg.toX).toBe(x[n - 1]);

    // The area of regressionitem.cpp: narrowest at the mean of x.
    const half = (px: number) =>
      1.96 * Math.sqrt((res / (n - 2)) * (1 / n + ((px - ax) ** 2 / (n - 1)) * ((n - 2) / sxx)));
    expect(reg.band).toHaveLength(51);
    for (const point of reg.band) {
      expect(point.high - point.low).toBeCloseTo(2 * half(point.x), 6);
      expect((point.high + point.low) / 2).toBeCloseTo(a * point.x + b, 6);
    }
  });

  it('draws no line through a fit that is not significant', async () => {
    const result = await chart({ var1: 'Dive #', binner1: 0, var2: 'Air temperature' });
    expect(result.family).toBe('scatter');
    const { x, y } = result.points!;
    const ax = mean(x);
    const ay = mean(y);
    const sxy = x.reduce((acc, xi, i) => acc + (xi - ax) * (y[i] - ay), 0);
    const sxx = x.reduce((acc, xi) => acc + (xi - ax) ** 2, 0);
    const syy = y.reduce((acc, yi) => acc + (yi - ay) ** 2, 0);
    const t = (sxy / sxx) / Math.sqrt(((syy - (sxy * sxy) / sxx) / (x.length - 2)) / sxx);
    // Whichever way this log falls, the line follows the t test of statsview.cpp.
    if (Math.abs(t) < 1.96) {
      expect(result.regression).toBeNull();
    }
  });

  it('puts dates on the first axis as days since 1970', async () => {
    const result = await chart({ var1: 'Date', binner1: 0, var2: 'Max. Depth' });
    expect(result.family).toBe('scatter');
    expect(result.catAxis?.kind).toBe('date');
    const { x, dives: ids } = result.points!;
    const dive = dives.find((d) => d.id === ids[0])!;
    expect(x[0]).toBeCloseTo(dive.when / 86400, 6);
  });

  it('gives quartile markers on a categorical first variable', async () => {
    const result = await chart({
      var1: 'Dive mode',
      var2: 'Max. Depth',
      chart: { type: 'DiscreteScatter', subtype: 'Dots' },
    });
    const open = items(result)[0];
    const depths = dives
      .filter((d) => d.divemode === 0)
      .map((d) => metres(d.maxDepthMm))
      .sort((a, b) => a - b);
    const expected = quartiles(depths);
    expect(open.quartiles!.q1).toBeCloseTo(expected.q1, 6);
    expect(open.quartiles!.q2).toBeCloseTo(expected.q2, 6);
    expect(open.quartiles!.q3).toBeCloseTo(expected.q3, 6);
    expect(result.points!.x.filter((x) => x === 0)).toHaveLength(depths.length);
  });
});

describe('units', () => {
  it('bins in feet, and labels in them, when imperial', async () => {
    const metric = await host.statsChart({ config: { var1: 'Max. Depth', binner1: 2 } });
    const imperial = await host.statsChart({ config: { var1: 'Max. Depth', binner1: 2 }, imperial: true });
    expect(metric.options.binners1[2]).toBe('in 10 m steps');
    expect(imperial.options.binners1[2]).toBe('in 30 ft steps');
    expect(imperial.options.var1.find((v) => v.name === 'SAC')?.unit).toBe('cuft/min');
    // Same dives, cut differently.
    const count = (c: StatsChart) => items(c).reduce((acc, item) => acc + item.count, 0);
    expect(count(imperial.chart!)).toBe(18);
    expect(imperial.chart!.catAxis).toMatchObject({ title: 'Max. Depth [ft]' });
    expect(imperial.chart!.mean).toBeCloseTo((metric.chart!.mean! * 1000) / 304.8, 1);
  });

  it('leaves the preference as it found it', async () => {
    const before = await host.statsChart({ config: { var1: 'Max. Depth', binner1: 2 } });
    await host.statsChart({ config: { var1: 'Max. Depth', binner1: 2 }, imperial: true });
    const after = await host.statsChart({ config: { var1: 'Max. Depth', binner1: 2 } });
    expect(after).toEqual(before);
  });
});

describe('the filter', () => {
  const y2013 = { fromWhen: 1356998400, toWhen: 1388534399 };

  it('narrows the chart to what getStatistics counts', async () => {
    const result = await host.statsChart({ config: { var1: 'Dive mode' }, filter: y2013 });
    const summary = await host.getStatistics(y2013);
    expect(result.dives).toBe(summary.matched);
    expect(items(result.chart!).reduce((acc, item) => acc + item.count, 0)).toBe(summary.matched);
  });

  it('gives an empty chart when nothing matches, keeping the options', async () => {
    const result = await host.statsChart({
      config: { var1: 'Dive mode' },
      filter: { fromWhen: 1, toWhen: 2 },
    });
    expect(result.dives).toBe(0);
    expect(result.chart?.family).toBe('empty');
    expect(result.options.var1).toHaveLength(29);
  });

  it('gives an empty chart for a variable no dive has', async () => {
    // SAC against depth with no dive matching leaves nothing to fit either.
    const result = await host.statsChart({
      config: { var1: 'Max. Depth', binner1: 0, var2: 'SAC' },
      filter: { fromWhen: 1, toWhen: 2 },
    });
    expect(result.chart?.family).toBe('empty');
  });

  it('leaves out planned dives only when asked', async () => {
    const log = new SsrfHost();
    try {
      await log.loadFromXML(fixture('abitofeverything.ssrf'));
      await log.savePlan({
        when: 1700000000,
        cylinders: [{ o2Permille: 210, hePermille: 0, sizeMl: 12000, pressureMbar: 232000 }],
        segments: [{ depthMm: 20000, durationSec: 1200, cylinder: 0 }],
      } as never);
      const listed = await log.listDives();
      const planned = listed.filter((d) => d.planned).length;
      // The fixture holds one planned dive already.
      expect(planned).toBe(2);
      const all = await log.statsChart({ config: { var1: 'Dive mode' } });
      const without = await log.statsChart({ config: { var1: 'Dive mode' }, filter: { excludePlanned: true } });
      expect(all.dives).toBe(listed.length);
      expect(without.dives).toBe(listed.length - planned);
      const summary = await log.getStatistics({ excludePlanned: true });
      expect(summary.matched).toBe(listed.length - planned);
    } finally {
      await log.close();
    }
  });
});

describe('around it', () => {
  it('reads: leaves the undo history alone', async () => {
    const before = await host.historyState();
    await host.statsChart({ config: { var1: 'Dive mode' } });
    expect(await host.historyState()).toEqual(before);
  });

  it('follows the log after a change', async () => {
    const log = new SsrfHost();
    try {
      await log.loadFromXML(fixture('abitofeverything.ssrf'));
      const first = await log.listDives();
      await log.deleteDive(first[0].id);
      const after = await log.statsChart({ config: { var1: 'Date', binner1: 1 } });
      expect(after.dives).toBe(17);
      await log.undo();
      expect((await log.statsChart({ config: { var1: 'Date', binner1: 1 } })).dives).toBe(18);
    } finally {
      await log.close();
    }
  });

  it('answers on an empty log', async () => {
    const log = new SsrfHost();
    try {
      const result = await log.statsChart();
      expect(result.dives).toBe(0);
      expect(result.chart?.family).toBe('empty');
      expect(result.config.var1).toBe('Date');
    } finally {
      await log.close();
    }
  });

  it('never trips over any fixture, on any variable', async () => {
    const log = new SsrfHost();
    const dir = join(fixture('abitofeverything.ssrf'), '..');
    const files = readdirSync(dir).filter((name) => /\.(ssrf|xml)$/.test(name));
    try {
      const { options } = await log.statsChart();
      const names = options.var1.map((v) => v.name);
      let charted = 0;
      for (const name of files) {
        try {
          await log.loadFromXML(join(dir, name));
        } catch {
          continue; // Files the core refuses are round-trip.test.ts's business.
        }
        for (const var1 of names) {
          for (const var2 of [null, 'SAC', 'Dive site']) {
            const result = await log.statsChart({ config: { var1, var2 } });
            expect(result.chart).toBeDefined();
            charted += 1;
          }
        }
      }
      expect(charted).toBeGreaterThan(1000);
      // The core logs what it finds odd in a file; a sanitizer report is what must not appear.
      expect(log.diagnostics).not.toMatch(/AddressSanitizer|runtime error/);
    } finally {
      await log.close();
    }
  }, 120000);
});

describe('on a large log', () => {
  const LARGE = 5000;
  let log: SsrfHost;
  let baseline: StatsChartConfig;

  beforeAll(async () => {
    log = new SsrfHost();
    await log.loadFromXML(writeLargeLog(LARGE));
    baseline = (await log.statsChart()).config;
  }, 120000);

  afterAll(async () => {
    await log.close();
  });

  async function timed(config: StatsChartConfigInput) {
    const started = performance.now();
    const result = await log.statsChart({ config });
    return { result, ms: performance.now() - started };
  }

  it('answers well within an interaction, and stays small enough for the bridge', async () => {
    expect(baseline.var1).toBe('Date');
    for (const config of [
      { var1: 'Max. Depth', binner1: 0, var2: 'SAC' },
      { var1: 'Date', binner1: 3 },
      { var1: 'Date', binner1: 3, var2: 'Dive mode', chart: { type: 'HistogramStacked', subtype: 'VerticalStacked' } },
      { var1: 'Dive #', binner1: 0, var2: 'Max. Depth' },
    ] as StatsChartConfigInput[]) {
      const { result, ms } = await timed(config);
      expect(result.dives).toBe(LARGE);
      // -O0 macOS host binary; a generous bound that a shape regression would break.
      expect(ms).toBeLessThan(1500);
      expect(JSON.stringify(result).length).toBeLessThan(1_000_000);
    }
  });
});

describe('subsurface.xml, the repo\'s large real log', () => {
  it('charts every dive per month and SAC against depth', async () => {
    const log = new SsrfHost();
    try {
      await log.loadFromXML(join(fixture('abitofeverything.ssrf'), '../../../subsurface.xml'));
      const listed = await log.listDives();
      const perMonth = await log.statsChart({ config: { var1: 'Date', binner1: 3 } });
      const counted = items(perMonth.chart!).reduce((acc, item) => acc + item.count, 0);
      expect(perMonth.dives).toBe(listed.filter((d) => !d.invalid).length);
      expect(counted).toBe(perMonth.dives);
      const sac = await log.statsChart({ config: { var1: 'Max. Depth', binner1: 0, var2: 'SAC' } });
      expect(sac.chart?.family).toBe('scatter');
    } finally {
      await log.close();
    }
  }, 60000);
});
