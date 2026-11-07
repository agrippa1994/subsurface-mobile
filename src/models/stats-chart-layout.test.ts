// AI-generated (Claude)
import { describe, expect, it } from 'vitest';

import type { StatsChart, StatsChartItem } from './index';
import { bandOutline, buildScene, hitTest, niceScale, thinLabels } from './stats-chart-layout';

function counts(values: number[], partial: Partial<StatsChart> = {}): StatsChart {
  return {
    family: 'bar',
    title: '',
    horizontal: false,
    stacked: false,
    histogram: false,
    catAxis: { kind: 'category', title: 'x' },
    valAxis: { kind: 'count', title: 'n', min: 0, max: Math.max(...values), decimals: 0, unit: '' },
    items: values.map((value, index) => ({
      from: index - 0.5,
      to: index + 0.5,
      label: `label ${index}`,
      full: `label ${index}`,
      count: value,
      value,
      dives: [],
    })),
    ...partial,
  };
}

describe('niceScale', () => {
  it('starts at zero when asked to, and holds the top', () => {
    const scale = niceScale(0, 37, 5, true);
    expect(scale.min).toBe(0);
    expect(scale.max).toBeGreaterThanOrEqual(37);
    expect(scale.ticks[0]).toBe(0);
    expect(scale.ticks[scale.ticks.length - 1]).toBe(scale.max);
    expect(scale.ticks.length).toBeLessThanOrEqual(6);
  });

  it('keeps whole steps for a count even with one dive', () => {
    const scale = niceScale(0, 1, 5, true);
    expect(scale.ticks).toEqual([0, 1]);
  });

  it('reaches below zero for a negative minimum', () => {
    const scale = niceScale(-12.4, 30, 5);
    expect(scale.min).toBeLessThanOrEqual(-12.4);
    expect(scale.ticks).toContain(0);
  });

  it('survives a flat or broken range', () => {
    expect(niceScale(5, 5).max).toBeGreaterThan(5);
    expect(niceScale(0, 0).max).toBeGreaterThan(0);
    expect(niceScale(NaN, 2)).toEqual({ min: 0, max: 1, ticks: [0, 1], decimals: 0 });
  });

  it('gives no tick a floating point tail', () => {
    for (const tick of niceScale(0.1, 0.7).ticks) {
      expect(String(tick).length).toBeLessThan(6);
    }
  });
});

describe('labels never collide', () => {
  const overlap = (labels: { at: number; text: string }[]) =>
    labels.some((label, i) => i > 0 && label.at - labels[i - 1].at < label.text.length * 6.1);

  it('thins rather than overlaps', () => {
    const labels = Array.from({ length: 100 }, (_, i) => ({ at: i * 3.5, text: `2010 Q${i % 4}` }));
    const thinned = thinLabels(labels);
    expect(thinned.length).toBeLessThan(100);
    expect(overlap(thinned)).toBe(false);
  });

  it('holds on a phone, for any bin count', () => {
    for (const n of [1, 2, 5, 12, 30, 80, 240, 1000]) {
      const scene = buildScene(counts(Array.from({ length: n }, (_, i) => i % 7)), 360, 300);
      expect(overlap(scene.xLabels)).toBe(false);
      expect(scene.xLabels.length).toBeGreaterThan(0);
    }
  });

  it('keeps preferred ticks on a histogram, the years of a date axis', () => {
    const items: StatsChartItem[] = Array.from({ length: 120 }, (_, i) => ({
      from: i * 30,
      to: (i + 1) * 30,
      label: 'b',
      full: 'b',
      count: 1,
      value: 1,
      tick: i % 12 === 0 ? String(2010 + i / 12) : 'Jan',
      prefer: i % 12 === 0,
      dives: [],
    }));
    const scene = buildScene(
      {
        ...counts([1]),
        histogram: true,
        items,
        catAxis: { kind: 'histogram', title: 'x', lastLabel: '2020', lastBound: 3600 },
      },
      360,
      300,
    );
    expect(scene.xLabels.every((label) => label.text.startsWith('20'))).toBe(true);
  });
});

describe('bars', () => {
  it('draws one mark per non-empty bin inside the plot', () => {
    const scene = buildScene(counts([4, 0, 2]), 360, 300);
    expect(scene.bars[0]).toHaveLength(2);
    for (const mark of scene.bars[0]) {
      expect(mark.x).toBeGreaterThanOrEqual(scene.plot.left);
      expect(mark.x + mark.width).toBeLessThanOrEqual(scene.plot.left + scene.plot.width + 0.001);
      expect(mark.y).toBeGreaterThanOrEqual(scene.plot.top - 0.001);
      expect(mark.y + mark.height).toBeCloseTo(scene.plot.top + scene.plot.height, 3);
    }
  });

  it('keeps a mark visible at hundreds of bins, and fits them in', () => {
    const scene = buildScene(counts(Array.from({ length: 500 }, () => 1)), 360, 300);
    expect(scene.bars[0]).toHaveLength(500);
    expect(scene.bars[0].every((mark) => mark.width >= 1)).toBe(true);
    const last = scene.bars[0][499];
    expect(last.x).toBeLessThanOrEqual(scene.plot.left + scene.plot.width);
  });

  it('stacks segments on each other, with only the top rounded', () => {
    const chart = counts([0], {
      stacked: true,
      series: ['a', 'b'],
      valAxis: { kind: 'count', title: '', min: 0, max: 3, decimals: 0, unit: '' },
      items: [
        {
          from: -0.5,
          to: 0.5,
          label: 'x',
          full: 'x',
          count: 3,
          segments: [
            { count: 2, dives: [1, 2] },
            { count: 1, dives: [3] },
          ],
        },
      ],
    });
    const scene = buildScene(chart, 360, 300);
    const [a] = scene.bars[0];
    const [b] = scene.bars[1];
    expect(b.y + b.height).toBeLessThanOrEqual(a.y + 1);
    expect(a.rounded).toBe(false);
    expect(b.rounded).toBe(true);
    expect(hitTest(scene, a.x + 2, a.y + a.height / 2)).toEqual({ kind: 'item', item: 0, segment: 0 });
    expect(hitTest(scene, b.x + 2, b.y + b.height / 2)).toEqual({ kind: 'item', item: 0, segment: 1 });
    // Above the stack: the whole column.
    expect(hitTest(scene, a.x + 2, scene.plot.top - 5)).toEqual({ kind: 'item', item: 0, segment: null });
  });

  it('puts grouped bars side by side, and tells them apart', () => {
    const chart = counts([0], {
      series: ['a', 'b'],
      valAxis: { kind: 'count', title: '', min: 0, max: 2, decimals: 0, unit: '' },
      items: [
        {
          from: -0.5,
          to: 0.5,
          label: 'x',
          full: 'x',
          count: 3,
          segments: [
            { count: 2, dives: [1, 2] },
            { count: 1, dives: [3] },
          ],
        },
      ],
    });
    const scene = buildScene(chart, 360, 300);
    const [a] = scene.bars[0];
    const [b] = scene.bars[1];
    expect(a.x + a.width).toBeLessThanOrEqual(b.x);
    expect(hitTest(scene, b.x + 1, b.y + 2)).toEqual({ kind: 'item', item: 0, segment: 1 });
  });

  it('hangs a negative value below the zero line', () => {
    const chart = counts([0], {
      valAxis: { kind: 'value', title: '', min: -10, max: 10, decimals: 0, unit: '' },
      items: [
        { from: 0, to: 1, label: 'a', full: 'a', count: 1, value: -5 },
        { from: 1, to: 2, label: 'b', full: 'b', count: 1, value: 5 },
      ],
    });
    const scene = buildScene(chart, 360, 300);
    const [down, up] = scene.bars[0];
    expect(down.y).toBeCloseTo(up.y + up.height, 3);
    expect(down.rounded).toBe(false);
  });

  it('leaves a bin with no value empty', () => {
    const chart = counts([0], {
      valAxis: { kind: 'value', title: '', min: 0, max: 10, decimals: 0, unit: '' },
      items: [{ from: 0, to: 1, label: 'a', full: 'a', count: 0, value: null }],
    });
    expect(buildScene(chart, 360, 300).bars[0]).toHaveLength(0);
  });

  it('puts mean and median markers on a histogram, not outside it', () => {
    const chart = counts([0], {
      histogram: true,
      mean: 15,
      median: 99,
      catAxis: { kind: 'histogram', title: '', lastLabel: '20', lastBound: 20 },
      items: [
        { from: 0, to: 10, label: '0', full: '0', count: 1, value: 1, tick: '0', dives: [] },
        { from: 10, to: 20, label: '10', full: '10', count: 1, value: 1, tick: '10', dives: [] },
      ],
    });
    const scene = buildScene(chart, 360, 300);
    expect(scene.meanX).toBeCloseTo(scene.plot.left + scene.plot.width * 0.75, 3);
    expect(scene.medianX).toBeNull();
  });

  it('selects the bin under the finger, and nothing off the plot', () => {
    const scene = buildScene(counts([4, 2, 1, 7]), 360, 300);
    const [, second] = scene.bars[0];
    expect(hitTest(scene, second.x + 1, scene.plot.top + 2)).toEqual({ kind: 'item', item: 1, segment: null });
    expect(hitTest(scene, scene.plot.left - 40, 100)).toBeNull();
    expect(hitTest(scene, scene.plot.left + scene.plot.width + 40, 100)).toBeNull();
  });
});

describe('pie', () => {
  const pie: StatsChart = {
    family: 'pie',
    title: '',
    horizontal: false,
    stacked: false,
    histogram: false,
    items: [
      { from: 0, to: 3, label: 'a', full: 'a', count: 3, total: 4, dives: [] },
      { from: 3, to: 4, label: 'b', full: 'b', count: 1, total: 4, dives: [] },
    ],
  };

  it('fills the circle from twelve o\'clock, and selects clockwise', () => {
    const scene = buildScene(pie, 300, 300);
    const { cx, cy, r } = scene.pie!;
    expect(scene.pie!.slices[0].from).toBe(0);
    expect(scene.pie!.slices[1].to).toBeCloseTo(2 * Math.PI, 6);
    // Right of the centre is a quarter of the way round: the 75% slice.
    expect(hitTest(scene, cx + r / 2, cy)).toEqual({ kind: 'item', item: 0, segment: null });
    // Left of it, at three quarters of the way: the rest. Just past, since a slice
    // ends where the next begins.
    expect(hitTest(scene, cx - r / 2, cy - 1)).toEqual({ kind: 'item', item: 1, segment: null });
    // Outside the circle, nothing.
    expect(hitTest(scene, cx + r + 5, cy)).toBeNull();
  });
});

describe('box', () => {
  it('orders whisker, box and median from the top down, and stays in its slot', () => {
    const chart: StatsChart = {
      family: 'box',
      title: '',
      horizontal: false,
      stacked: false,
      histogram: false,
      catAxis: { kind: 'category', title: 'x' },
      valAxis: { kind: 'value', title: '', min: 0, max: 40, decimals: 0, unit: '' },
      items: [
        { from: -0.5, to: 0.5, label: 'a', full: 'a', count: 2, box: { min: 5, q1: 10, q2: 20, q3: 30, max: 35 } },
        { from: 0.5, to: 1.5, label: 'b', full: 'b', count: 0, box: null },
      ],
    };
    const scene = buildScene(chart, 360, 300);
    expect(scene.boxes).toHaveLength(1);
    const [box] = scene.boxes;
    expect(box.whiskerTop).toBeLessThan(box.top);
    expect(box.top).toBeLessThan(box.median);
    expect(box.median).toBeLessThan(box.bottom);
    expect(box.bottom).toBeLessThan(box.whiskerBottom);
    expect(hitTest(scene, box.center, box.median)).toEqual({ kind: 'item', item: 0, segment: null });
  });
});

describe('scatter', () => {
  const n = 5000;
  const scatter: StatsChart = {
    family: 'scatter',
    title: '',
    horizontal: false,
    stacked: false,
    histogram: false,
    catAxis: { kind: 'value', title: 'x', min: 0, max: 100, decimals: 0, unit: '' },
    valAxis: { kind: 'value', title: 'y', min: 0, max: 50, decimals: 0, unit: '' },
    points: {
      x: Array.from({ length: n }, (_, i) => (i / n) * 100),
      y: Array.from({ length: n }, (_, i) => (i % 50) + 0.5),
      dives: Array.from({ length: n }, (_, i) => i),
    },
    regression: {
      a: 0.5,
      b: 0,
      r2: 0.5,
      n,
      fromX: 0,
      toX: 100,
      band: [
        { x: 0, low: -1, high: 1 },
        { x: 100, low: 49, high: 51 },
      ],
    },
  };

  it('lays out and hit-tests thousands of dots within a frame', () => {
    const started = performance.now();
    const scene = buildScene(scatter, 360, 300);
    const hit = hitTest(scene, scene.points[42].x, scene.points[42].y);
    expect(performance.now() - started).toBeLessThan(16);
    expect(scene.points).toHaveLength(n);
    expect(hit?.kind).toBe('point');
  });

  it('selects the nearest dot, within reach, and nothing far away', () => {
    const small: StatsChart = {
      ...scatter,
      regression: null,
      points: { x: [10, 90], y: [10, 40], dives: [1, 2] },
    };
    const scene = buildScene(small, 360, 300);
    const [a, b] = scene.points;
    expect(hitTest(scene, a.x + 3, a.y + 3)).toEqual({ kind: 'point', point: 0 });
    expect(hitTest(scene, b.x - 3, b.y)).toEqual({ kind: 'point', point: 1 });
    expect(hitTest(scene, (a.x + b.x) / 2, (a.y + b.y) / 2)).toBeNull();
  });

  it('keeps the line and area on the plot when they run off it', () => {
    const scene = buildScene(scatter, 360, 300);
    const { plot, band, line } = scene;
    for (const sample of band) {
      expect(sample.high).toBeGreaterThanOrEqual(plot.top);
      expect(sample.low).toBeLessThanOrEqual(plot.top + plot.height);
    }
    expect(line!.y1).toBeLessThanOrEqual(plot.top + plot.height);
    expect(bandOutline(band)).toHaveLength(4);
  });

  it('labels a date axis by year over years, by month within one', () => {
    const dated = (from: number, to: number): StatsChart => ({
      ...scatter,
      regression: null,
      catAxis: { kind: 'date', title: 'Date', min: from, max: to },
      points: { x: [from, to], y: [1, 2], dives: [1, 2] },
    });
    const years = buildScene(dated(14610, 18000), 360, 300).xLabels.map((l) => l.text);
    expect(years.every((text) => /^\d{4}$/.test(text))).toBe(true);
    const months = buildScene(dated(14610, 14700), 360, 300).xLabels.map((l) => l.text);
    expect(months.some((text) => /^[A-Z][a-z]{2}$/.test(text))).toBe(true);
  });

  it('marks quartiles in the middle of their slot', () => {
    const chart: StatsChart = {
      ...scatter,
      regression: undefined,
      catAxis: { kind: 'category', title: 'x' },
      points: { x: [0], y: [10], dives: [1] },
      items: [
        { from: -0.5, to: 0.5, label: 'a', full: 'a', count: 1, quartiles: { q1: 5, q2: 10, q3: 15 }, dives: [1] },
      ],
    };
    const scene = buildScene(chart, 360, 300);
    expect(scene.quartiles[0].x).toBeCloseTo(scene.plot.left + scene.plot.width / 2, 3);
    expect(scene.quartiles[0].ys[0]).toBeGreaterThan(scene.quartiles[0].ys[2]);
    // Off a dot, a tap in a categorical slot means the group.
    expect(hitTest(scene, scene.plot.left + 2, scene.plot.top + scene.plot.height - 1)).toEqual({
      kind: 'item',
      item: 0,
      segment: null,
    });
  });
});

describe('nothing to draw', () => {
  it('is an empty scene at no size, or with no data', () => {
    const empty: StatsChart = { family: 'empty', title: '', horizontal: false, stacked: false, histogram: false };
    expect(buildScene(empty, 360, 300).bars).toEqual([]);
    expect(buildScene(counts([1]), 0, 300).bars).toEqual([]);
    expect(hitTest(buildScene(empty, 360, 300), 10, 10)).toBeNull();
  });
});
