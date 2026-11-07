// AI-generated (Claude)
import { describe, expect, it } from 'vitest';

import type { StatsChart, StatsChartConfig, StatsChartItem, StatsChartOptions } from './index';
import {
  binLabel,
  binnerLabel,
  chartDescription,
  chartEmptyText,
  chartHeadline,
  chartOptionLabel,
  chartRows,
  chartSummary,
  foldSeries,
  formatDay,
  groupVariables,
  MAX_SERIES,
  parseStatsConfig,
  phoneFriendlyChart,
  selectionReadout,
  STATS_PRESETS,
} from './stats-chart';

const features = {
  labels: true,
  legend: true,
  median: false,
  mean: false,
  quartiles: true,
  regression: true,
  confidence: true,
};

function config(partial: Partial<StatsChartConfig> = {}): StatsChartConfig {
  return {
    var1: 'Date',
    var2: null,
    binner1: 1,
    binner2: -1,
    operation: 'Invalid',
    chart: { type: 'HistogramCount', subtype: 'Vertical' },
    sort: 'Bin',
    features,
    ...partial,
  };
}

function bars(partial: Partial<StatsChart> = {}, items: Partial<StatsChartItem>[] = []): StatsChart {
  return {
    family: 'bar',
    title: 't',
    horizontal: false,
    stacked: false,
    histogram: false,
    valAxis: { kind: 'count', title: 'No. dives', min: 0, max: 10, decimals: 0, unit: '' },
    catAxis: { kind: 'category', title: 'x' },
    items: items.map((item, index) => ({
      from: index - 0.5,
      to: index + 0.5,
      label: `b${index}`,
      full: `b${index}`,
      count: 0,
      ...item,
    })),
    ...partial,
  };
}

const options = (charts: StatsChartOptions['charts']): StatsChartOptions => ({
  var1: [],
  var2: [],
  binners1: [],
  binners2: [],
  operations: [],
  sorts: [],
  charts,
  features: [],
});

describe('labels', () => {
  it('turns upstream star bins into words, and names an unnamed bin', () => {
    expect(binLabel('\u{1F31F}\u{1F31F}\u{1F31F}')).toBe('3 stars');
    expect(binLabel('\u{1F31F}')).toBe('1 star');
    expect(binLabel('')).toBe('Not set');
    expect(binLabel('  ')).toBe('Not set');
    expect(binLabel('Sund Rock')).toBe('Sund Rock');
  });

  it('says what an unbinned first variable means', () => {
    expect(binnerLabel('none')).toBe('Every dive on its own');
    expect(binnerLabel('in 5 m steps')).toBe('In 5 m steps');
    expect(binnerLabel('Yearly')).toBe('Per year');
  });

  it('marks a chart it does not recommend, without hiding it', () => {
    const option = { type: 'DiscreteCount', subtype: 'Vertical', name: 'n', subtypeName: 's', selected: false } as const;
    expect(chartOptionLabel({ ...option, warning: false })).toBe('Columns');
    expect(chartOptionLabel({ ...option, warning: true })).toBe('Columns, not ideal for this data');
  });

  it('reads a date axis in days since 1970', () => {
    expect(formatDay(18628)).toBe('1 Jan 2021');
  });
});

describe('grouping the variables', () => {
  it('places nothing twice and loses nothing, even a variable it has not heard of', () => {
    const groups = groupVariables([
      { name: 'SAC', type: 'numeric', unit: '' },
      { name: 'Date', type: 'continuous', unit: '' },
      { name: 'Brand new', type: 'numeric', unit: '' },
    ]);
    expect(groups.map((g) => g.title)).toEqual(['When', 'Air and gas', 'Other']);
    expect(groups.flatMap((g) => g.variables.map((v) => v.name)).sort()).toEqual(['Brand new', 'Date', 'SAC']);
  });
});

describe('a phone-friendly form', () => {
  const horizontal = { type: 'DiscreteCount', subtype: 'Horizontal', name: '', subtypeName: '', warning: false, selected: false } as const;

  it('turns a long list of names into rows when the variable changes', () => {
    const result = phoneFriendlyChart(
      { kind: 'var1', value: 'Dive site' },
      config({ var1: 'Dive site', chart: { type: 'DiscreteCount', subtype: 'Vertical' } }),
      options([horizontal]),
    );
    expect(result).toEqual({ type: 'DiscreteCount', subtype: 'Horizontal' });
  });

  it('leaves a short fixed list standing, and any other change alone', () => {
    expect(
      phoneFriendlyChart(
        { kind: 'var1', value: 'Month of year' },
        config({ var1: 'Month of year', chart: { type: 'DiscreteCount', subtype: 'Vertical' } }),
        options([horizontal]),
      ),
    ).toBeNull();
    expect(
      phoneFriendlyChart(
        { kind: 'chart', value: { type: 'DiscreteCount', subtype: 'Vertical' } },
        config({ var1: 'Dive site', chart: { type: 'DiscreteCount', subtype: 'Vertical' } }),
        options([horizontal]),
      ),
    ).toBeNull();
  });

  it('does nothing when the state offers no horizontal form', () => {
    expect(
      phoneFriendlyChart(
        { kind: 'var1', value: 'Dive site' },
        config({ var1: 'Dive site', chart: { type: 'DiscreteCount', subtype: 'Vertical' } }),
        options([]),
      ),
    ).toBeNull();
  });
});

describe('plain words', () => {
  it('names the chart by what it compares', () => {
    expect(chartHeadline(config({ var1: 'Max. Depth', var2: 'SAC', chart: { type: 'ScatterPlot', subtype: 'Dots' } }))).toBe(
      'SAC against Max. Depth',
    );
    expect(chartHeadline(config({ var2: 'SAC', operation: 'Median', chart: { type: 'HistogramValue', subtype: 'Vertical' } }))).toBe(
      'Median SAC by Date',
    );
    expect(chartHeadline(config())).toBe('Dives by Date');
  });

  it('says how a dive with several buddies counts', () => {
    expect(chartDescription(config({ var1: 'People', chart: { type: 'DiscreteCount', subtype: 'Horizontal' } }))).toContain(
      'counts once for each',
    );
  });

  it('reports the trend, or that there is none', () => {
    const scatter = config({ var1: 'Max. Depth', var2: 'SAC', chart: { type: 'ScatterPlot', subtype: 'Dots' } });
    const family = { family: 'scatter', title: '', horizontal: false, stacked: false, histogram: false } as const;
    expect(chartDescription(scatter, { ...family, regression: { a: 1, b: 0, r2: 0.82, n: 3, fromX: 0, toX: 1, band: [] } })).toContain('82%');
    expect(chartDescription(scatter, { ...family, regression: null })).toContain('no trend');
    expect(chartDescription(scatter)).not.toContain('trend');
  });

  it('tells no dives apart from no value', () => {
    expect(chartEmptyText(config({ var2: 'SAC' }), 0)).toBe('No dives match the filter.');
    expect(chartEmptyText(config({ var2: 'SAC' }), 3)).toContain('value for SAC');
  });
});

describe('rows', () => {
  it('reads a count with its share, sized against the largest', () => {
    const rows = chartRows(bars({}, [
      { count: 4, total: 10, value: 4, full: '2020', dives: [1, 2, 3, 4] },
      { count: 6, total: 10, value: 6, full: '2021', dives: [5, 6, 7, 8, 9, 10] },
    ]));
    expect(rows[0]).toMatchObject({ label: '2020', value: '4 dives', detail: '40.0%', fraction: 4 / 6 });
    expect(rows[1].fraction).toBe(1);
    expect(rows[0].accessibilityLabel).toBe('2020: 4 dives, 40.0%');
  });

  it('reads a value with its unit, and says when there is none', () => {
    const rows = chartRows(
      bars({ valAxis: { kind: 'value', title: 'SAC', min: 0, max: 20, decimals: 1, unit: 'l/min' } }, [
        { value: 15.25, count: 3, dives: [1, 2, 3] },
        { value: null, count: 0 },
      ]),
    );
    expect(rows[0].value).toBe('15.3 l/min');
    expect(rows[1]).toMatchObject({ value: 'No value', fraction: 0, detail: '' });
  });

  it('breaks a stack down by name', () => {
    const rows = chartRows(
      bars({ stacked: true, series: ['Open circuit', 'CCR'] }, [
        { count: 3, segments: [{ count: 2, dives: [1, 2] }, { count: 1, dives: [3] }] },
      ]),
    );
    expect(rows[0].detail).toBe('Open circuit: 2, CCR: 1');
    expect(rows[0].dives).toEqual([1, 2, 3]);
    expect(rows[0].segments.map((s) => s.fraction)).toEqual([2 / 3, 1 / 3]);
  });

  it('skips a box without values', () => {
    const rows = chartRows({
      family: 'box',
      title: '',
      horizontal: false,
      stacked: false,
      histogram: false,
      valAxis: { kind: 'value', title: '', min: 0, max: 1, decimals: 1, unit: 'm' },
      items: [
        { from: 0, to: 1, label: 'a', full: 'a', count: 0, box: null },
        { from: 1, to: 2, label: 'b', full: 'b', count: 2, box: { min: 1, q1: 2, q2: 3, q3: 4, max: 5 }, dives: [1, 2] },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe('3.0 m median');
  });
});

describe('the readout', () => {
  it('gives every operation of a bar', () => {
    const chart = bars({ valAxis: { kind: 'value', title: '', min: 0, max: 20, decimals: 1, unit: 'm' } }, [
      {
        value: 10,
        count: 2,
        dives: [1, 2],
        full: '2020',
        operations: { median: 10, mean: 11, timeWeightedMean: 12, sum: 22, min: 5, max: 17 },
      },
    ]);
    const readout = selectionReadout(chart, { kind: 'item', item: 0, segment: null })!;
    expect(readout.title).toBe('2020');
    expect(readout.lines).toContainEqual({ label: 'Median', value: '10.0 m' });
    expect(readout.lines).toContainEqual({ label: 'Highest', value: '17.0 m' });
    expect(readout.dives).toEqual([1, 2]);
  });

  it('narrows to the segment under the finger', () => {
    const chart = bars({ stacked: true, series: ['A', 'B'] }, [
      { count: 4, full: 'y', segments: [{ count: 1, dives: [1] }, { count: 3, dives: [2, 3, 4] }] },
    ]);
    const whole = selectionReadout(chart, { kind: 'item', item: 0, segment: null })!;
    expect(whole.dives).toEqual([1, 2, 3, 4]);
    const one = selectionReadout(chart, { kind: 'item', item: 0, segment: 1 })!;
    expect(one.title).toBe('y, B');
    expect(one.dives).toEqual([2, 3, 4]);
    expect(one.lines).toContainEqual({ label: 'Share of the bar', value: '75.0%' });
  });

  it('reads a dot in the units of its axes', () => {
    const chart: StatsChart = {
      family: 'scatter',
      title: '',
      horizontal: false,
      stacked: false,
      histogram: false,
      catAxis: { kind: 'value', title: 'Max. Depth [m]', min: 0, max: 1, decimals: 1, unit: 'm' },
      valAxis: { kind: 'value', title: 'SAC [l/min]', min: 0, max: 1, decimals: 0, unit: 'l/min' },
      points: { x: [20.5], y: [14.4], dives: [7] },
    };
    const readout = selectionReadout(chart, { kind: 'point', point: 0 })!;
    expect(readout.lines).toEqual([
      { label: 'Max. Depth', value: '20.5 m' },
      { label: 'SAC', value: '14 l/min' },
    ]);
    expect(readout.dives).toEqual([7]);
    expect(selectionReadout(chart, { kind: 'point', point: 3 })).toBeNull();
    expect(selectionReadout(chart, null)).toBeNull();
  });
});

describe('what VoiceOver hears', () => {
  it('summarises a chart in one breath, with its peak', () => {
    const chart = bars({}, [
      { count: 4, total: 10, value: 4, full: '2020' },
      { count: 6, total: 10, value: 6, full: '2021' },
    ]);
    expect(chartSummary(config(), chart, 10)).toBe('Dives by Date. 2 groups, 10 dives. Largest: 2021, 6 dives.');
  });

  it('says whether a scatter has a trend', () => {
    const scatter = config({ var1: 'Max. Depth', var2: 'SAC', chart: { type: 'ScatterPlot', subtype: 'Dots' } });
    const chart: StatsChart = {
      family: 'scatter',
      title: '',
      horizontal: false,
      stacked: false,
      histogram: false,
      catAxis: { kind: 'value', title: '', min: 0, max: 1, decimals: 0, unit: '' },
      points: { x: [1, 2], y: [1, 2], dives: [1, 2] },
      regression: null,
    };
    expect(chartSummary(scatter, chart, 2)).toContain('no clear trend');
    expect(
      chartSummary(scatter, { ...chart, regression: { a: -1, b: 0, r2: 0.5, n: 2, fromX: 0, toX: 1, band: [] } }, 2),
    ).toContain('falls, explaining 50%');
  });

  it('says why an empty chart is empty', () => {
    const chart: StatsChart = { family: 'empty', title: '', horizontal: false, stacked: false, histogram: false };
    expect(chartSummary(config(), chart, 0)).toContain('No dives match');
  });
});

describe('folding series past the palette', () => {
  const series = Array.from({ length: 10 }, (_, i) => `s${i}`);
  const segments = (counts: number[]) => counts.map((count, i) => ({ count, dives: count > 0 ? [i * 100 + count] : [] }));

  it('leaves a chart within the palette alone', () => {
    const chart = bars({ series: ['a', 'b'] }, [{ count: 1, segments: segments([1, 0]) }]);
    expect(foldSeries(chart)).toBe(chart);
  });

  it('keeps the largest, folding the rest without losing a dive', () => {
    const counts = [1, 9, 2, 8, 3, 7, 4, 6, 5, 10];
    const chart = bars({ stacked: true, series }, [{ count: 55, segments: segments(counts) }]);
    const folded = foldSeries(chart);
    expect(folded.series).toHaveLength(MAX_SERIES);
    expect(folded.series![MAX_SERIES - 1]).toBe('Other (3)');
    const after = folded.items![0].segments!;
    expect(after.reduce((acc, s) => acc + s.count, 0)).toBe(55);
    expect(after.flatMap((s) => s.dives)).toHaveLength(10);
    // 1, 2 and 3 are the smallest, and are what folded.
    expect(after[MAX_SERIES - 1].count).toBe(6);
    expect(folded.series).not.toContain('s0');
    expect(folded.series).toContain('s9');
  });

  it('folds a pie, joining the "other" it already has', () => {
    const slice = (count: number, from: number, other = false): StatsChartItem => ({
      label: `n${count}`,
      full: `n${count}`,
      from,
      to: from + count,
      count,
      total: 100,
      dives: [count],
      ...(other ? { other: [{ name: 'x', count }] } : {}),
    });
    const items = [20, 15, 12, 11, 10, 9, 8, 6, 5, 4].reduce<StatsChartItem[]>((acc, count, i) => {
      const from = acc.length > 0 ? acc[acc.length - 1].to : 0;
      return [...acc, slice(count, from, i === 9)];
    }, []);
    const chart: StatsChart = {
      family: 'pie',
      title: '',
      horizontal: false,
      stacked: false,
      histogram: false,
      items,
      series: items.map((i) => i.label),
    };
    const folded = foldSeries(chart);
    expect(folded.items).toHaveLength(MAX_SERIES);
    expect(folded.items!.reduce((acc, i) => acc + i.count, 0)).toBe(100);
    const other = folded.items![MAX_SERIES - 1];
    expect(other.other!.map((row) => row.count).sort((a, b) => a - b)).toEqual([4, 5, 6]);
    expect(other.to).toBe(100);
  });
});

describe('saved configuration', () => {
  it('reads what it wrote, and drops what is not one', () => {
    const saved = config();
    expect(parseStatsConfig(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(parseStatsConfig(null)).toBeNull();
    expect(parseStatsConfig({ var1: 3 })).toBeNull();
    expect(parseStatsConfig('Date')).toBeNull();
  });
});

describe('the presets', () => {
  it('have unique keys', () => {
    expect(new Set(STATS_PRESETS.map((p) => p.key)).size).toBe(STATS_PRESETS.length);
  });
});
