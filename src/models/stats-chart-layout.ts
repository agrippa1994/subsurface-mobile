// AI-generated (Claude)
// Geometry of a statistics chart: where marks and labels go for a given size, and
// what is under a finger. Pure, so that label collisions and hit testing are tested
// without a canvas. The Skia side only draws what comes out of here.
//
// Marks are grouped per series as flat arrays, and the canvas draws each series as
// one path: a monthly chart over twenty years is 240 rectangles, and a React element
// for each is what would make it stutter.

import { binLabel, foldSeries, monthYear, type ChartSelection } from './stats-chart';
import type { StatsAxis, StatsChart, StatsChartItem } from './index';

export type Plot = { left: number; top: number; width: number; height: number };

export type TickLabel = { at: number; text: string };

export type BarMark = {
  x: number;
  y: number;
  width: number;
  height: number;
  item: number;
  series: number;
  /** Round the end away from the baseline; only the top of a stack has one. */
  rounded: boolean;
};

export type BoxMark = {
  item: number;
  center: number;
  width: number;
  top: number;
  bottom: number;
  median: number;
  whiskerTop: number;
  whiskerBottom: number;
};

export type PieMark = {
  item: number;
  /** Radians clockwise from twelve o'clock. */
  from: number;
  to: number;
};

export type QuartileMark = { item: number; x: number; width: number; ys: number[] };

export type ChartScene = {
  chart: StatsChart;
  plot: Plot;
  xLabels: TickLabel[];
  /** Whether xLabels sit on a tick (a histogram's bounds) or under a slot. */
  yLabels: TickLabel[];
  yGrid: number[];
  bars: BarMark[][];
  boxes: BoxMark[];
  pie: { cx: number; cy: number; r: number; slices: PieMark[] } | null;
  points: { x: number; y: number }[];
  line: { x1: number; y1: number; x2: number; y2: number } | null;
  band: { x: number; low: number; high: number }[];
  quartiles: QuartileMark[];
  meanX: number | null;
  medianX: number | null;
  /** Largest number of bars of a series: the labels above bars only fit up to a point. */
  barWidth: number;
};

const PAD = { top: 10, right: 12, bottomLabels: 20, bottomTitle: 18 };
/** Roughly one digit at the 11 pt the axis labels are set in. */
const CHAR_WIDTH = 6.1;
const MIN_LABEL_GAP = 8;

/** Least distance, in points, within which a tap belongs to a dot. */
export const DOT_HIT_RADIUS = 28;

// --- Axes ------------------------------------------------------------------------

export type AxisScale = { min: number; max: number; ticks: number[]; decimals: number };

/**
 * A round scale that holds [low, high], with at most `maxTicks` steps. The bounds only
 * move outwards: a bar never pokes out, and a scale that starts at zero stays there.
 */
export function niceScale(low: number, high: number, maxTicks = 5, integer = false): AxisScale {
  if (!Number.isFinite(low) || !Number.isFinite(high)) {
    return { min: 0, max: 1, ticks: [0, 1], decimals: 0 };
  }
  if (low === high) {
    const pad = low === 0 ? 1 : Math.abs(low) * 0.1;
    return niceScale(low === 0 ? 0 : low - pad, high + pad, maxTicks, integer);
  }
  const raw = (high - low) / Math.max(1, maxTicks - 1);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * magnitude);
  const nice = candidates.find((step) => step >= raw) ?? magnitude * 10;
  const step = integer ? Math.max(1, Math.ceil(nice)) : nice;
  const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9) + (step / 10 ** Math.floor(Math.log10(step)) === 2.5 ? 1 : 0));
  const round = (value: number) => Number(value.toFixed(Math.min(decimals + 1, 8)));
  const min = round(Math.floor(low / step + 1e-9) * step);
  const max = round(Math.ceil(high / step - 1e-9) * step);
  const ticks: number[] = [];
  for (let i = 0; min + i * step <= max + step / 2; i += 1) {
    ticks.push(round(min + i * step));
  }
  return { min, max, ticks, decimals };
}

function estimateWidth(text: string): number {
  return text.length * CHAR_WIDTH;
}

/**
 * Takes every n-th label, n as low as keeps neighbours from touching: thinning rather
 * than rotating, since a skipped label reads better than a slanted one, and it is what
 * the desktop's axis does.
 */
export function thinLabels(labels: TickLabel[]): TickLabel[] {
  if (labels.length <= 1) {
    return labels;
  }
  const widest = labels.reduce((acc, label) => Math.max(acc, estimateWidth(label.text)), 0);
  const spacing = Math.abs(labels[labels.length - 1].at - labels[0].at) / (labels.length - 1);
  const every = spacing > 0 ? Math.max(1, Math.ceil((widest + MIN_LABEL_GAP) / spacing)) : labels.length;
  return labels.filter((_, index) => index % every === 0);
}

/** Thinning for a histogram: its preferred ticks (a date axis' years) go first. */
function thinHistogramLabels(items: StatsChartItem[], at: (value: number) => number): TickLabel[] {
  const all = items.map((item) => ({ at: at(item.from), text: item.tick ?? '', prefer: item.prefer ?? true }));
  const preferred = all.filter((label) => label.prefer);
  const thinnedPreferred = thinLabels(preferred.length > 0 ? preferred : all);
  if (preferred.length > 0 && preferred.length < all.length && thinnedPreferred.length === preferred.length) {
    // Room for every preferred tick; try the others between them only if all fit.
    const thinnedAll = thinLabels(all);
    if (thinnedAll.length === all.length) {
      return thinnedAll;
    }
  }
  return thinnedPreferred;
}

function yearOrMonthLabels(min: number, max: number, at: (value: number) => number): TickLabel[] {
  const span = max - min;
  const out: TickLabel[] = [];
  if (span >= 365 * 2) {
    const first = monthYear(min).year + 1;
    const last = monthYear(max).year;
    for (let year = first; year <= last; year += 1) {
      out.push({ at: at(Date.UTC(year, 0, 1) / 86400000), text: String(year) });
    }
    return out.length > 0 ? thinLabels(out) : [{ at: at(min), text: String(monthYear(min).year) }];
  }
  const start = new Date(min * 86400000);
  for (
    let date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    date.getTime() / 86400000 <= max;
    date = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
  ) {
    const days = date.getTime() / 86400000;
    const { month, year } = monthYear(days);
    out.push({ at: at(days), text: date.getUTCMonth() === 0 ? String(year) : month });
  }
  return out.length > 0 ? thinLabels(out) : [{ at: at(min), text: monthYear(min).month }];
}

function plotFor(width: number, height: number, yLabelTexts: string[], hasXTitle: boolean): Plot {
  const widest = yLabelTexts.reduce((acc, text) => Math.max(acc, estimateWidth(text)), 0);
  const left = Math.ceil(widest) + 8;
  const bottom = PAD.bottomLabels + (hasXTitle ? PAD.bottomTitle : 0);
  return {
    left,
    top: PAD.top,
    width: Math.max(10, width - left - PAD.right),
    height: Math.max(10, height - PAD.top - bottom),
  };
}

// --- The scene --------------------------------------------------------------------

function emptyScene(chart: StatsChart): ChartScene {
  return {
    chart,
    plot: { left: 0, top: 0, width: 0, height: 0 },
    xLabels: [],
    yLabels: [],
    yGrid: [],
    bars: [],
    boxes: [],
    pie: null,
    points: [],
    line: null,
    band: [],
    quartiles: [],
    meanX: null,
    medianX: null,
    barWidth: 0,
  };
}

/** The chart as drawn: fewer series than it came with, if there were too many for the palette. */
export function drawableChart(chart: StatsChart): StatsChart {
  return foldSeries(chart);
}

export function buildScene(input: StatsChart, width: number, height: number): ChartScene {
  const chart = input;
  if (width <= 0 || height <= 0 || chart.family === 'empty') {
    return emptyScene(chart);
  }
  switch (chart.family) {
    case 'bar':
      return barScene(chart, width, height);
    case 'box':
      return boxScene(chart, width, height);
    case 'pie':
      return pieScene(chart, width, height);
    case 'scatter':
      return scatterScene(chart, width, height);
    default:
      return emptyScene(chart);
  }
}

function numericBounds(axis: StatsAxis | undefined): { min: number; max: number; integer: boolean; decimals: number } {
  if (axis && (axis.kind === 'value' || axis.kind === 'count')) {
    return {
      min: axis.min ?? 0,
      max: axis.max ?? 1,
      integer: axis.kind === 'count',
      decimals: axis.decimals,
    };
  }
  return { min: 0, max: 1, integer: false, decimals: 0 };
}

function yScale(axis: StatsAxis | undefined): AxisScale {
  const bounds = numericBounds(axis);
  return niceScale(bounds.min, bounds.max, 5, bounds.integer);
}

function formatTick(value: number, scale: AxisScale): string {
  return value.toFixed(scale.decimals);
}

function catDomain(items: StatsChartItem[]): { min: number; max: number } {
  return { min: items[0]?.from ?? 0, max: items[items.length - 1]?.to ?? 1 };
}

function categoryLabels(items: StatsChartItem[], at: (value: number) => number): TickLabel[] {
  return thinLabels(items.map((item) => ({ at: at((item.from + item.to) / 2), text: binLabel(item.label) })));
}

function barScene(chart: StatsChart, width: number, height: number): ChartScene {
  const items = chart.items ?? [];
  const scale = yScale(chart.valAxis);
  const plot = plotFor(width, height, scale.ticks.map((t) => formatTick(t, scale)), Boolean(chart.catAxis?.title));
  const domain = catDomain(items);
  const toX = (value: number) => plot.left + ((value - domain.min) / (domain.max - domain.min || 1)) * plot.width;
  const toY = (value: number) => plot.top + plot.height - ((value - scale.min) / (scale.max - scale.min || 1)) * plot.height;
  const baseline = toY(Math.max(scale.min, Math.min(scale.max, 0)));

  const seriesCount = Math.max(1, chart.series?.length ?? 1);
  const bars: BarMark[][] = Array.from({ length: seriesCount }, () => []);
  let barWidth = 0;
  items.forEach((item, index) => {
    const left = toX(item.from);
    const slot = toX(item.to) - left;
    const gap = slot >= 4 ? 2 : 0;
    if (item.segments) {
      if (chart.stacked) {
        let stacked = 0;
        let top = -1;
        item.segments.forEach((segment, series) => {
          if (segment.count > 0) {
            top = series;
          }
        });
        item.segments.forEach((segment, series) => {
          if (segment.count <= 0) {
            return;
          }
          const y1 = toY(stacked);
          const y2 = toY(stacked + segment.count);
          stacked += segment.count;
          bars[series].push({
            x: left + gap / 2,
            y: y2,
            width: Math.max(1, slot - gap),
            // A surface gap between stacked segments, where there is room for one.
            height: Math.max(1, y1 - y2 - (series === top || y1 - y2 < 4 ? 0 : 1)),
            item: index,
            series,
            rounded: series === top,
          });
        });
        barWidth = Math.max(barWidth, slot - gap);
      } else {
        const each = (slot - gap) / seriesCount;
        item.segments.forEach((segment, series) => {
          if (segment.count <= 0) {
            return;
          }
          const y2 = toY(segment.count);
          bars[series].push({
            x: left + gap / 2 + each * series,
            y: y2,
            width: Math.max(1, each - (each >= 4 ? 1 : 0)),
            height: Math.max(1, baseline - y2),
            item: index,
            series,
            rounded: true,
          });
        });
        barWidth = Math.max(barWidth, each);
      }
      return;
    }
    const value = item.value ?? null;
    if (value === null || value === 0) {
      barWidth = Math.max(barWidth, slot - gap);
      return;
    }
    const y = toY(value);
    bars[0].push({
      x: left + gap / 2,
      y: Math.min(y, baseline),
      width: Math.max(1, slot - gap),
      height: Math.max(1, Math.abs(baseline - y)),
      item: index,
      series: 0,
      rounded: value > 0,
    });
    barWidth = Math.max(barWidth, slot - gap);
  });

  let xLabels: TickLabel[];
  if (chart.histogram) {
    xLabels = thinHistogramLabels(items, toX);
  } else {
    xLabels = categoryLabels(items, toX);
  }

  const inDomain = (value: number | null | undefined) =>
    value === null || value === undefined || value < domain.min || value > domain.max ? null : toX(value);

  return {
    ...emptyScene(chart),
    plot,
    xLabels,
    yLabels: scale.ticks.map((tick) => ({ at: toY(tick), text: formatTick(tick, scale) })),
    yGrid: scale.ticks.map(toY),
    bars,
    meanX: chart.histogram ? inDomain(chart.mean) : null,
    medianX: chart.histogram ? inDomain(chart.median) : null,
    barWidth,
  };
}

function boxScene(chart: StatsChart, width: number, height: number): ChartScene {
  const items = chart.items ?? [];
  const scale = yScale(chart.valAxis);
  const plot = plotFor(width, height, scale.ticks.map((t) => formatTick(t, scale)), Boolean(chart.catAxis?.title));
  const domain = catDomain(items);
  const toX = (value: number) => plot.left + ((value - domain.min) / (domain.max - domain.min || 1)) * plot.width;
  const toY = (value: number) => plot.top + plot.height - ((value - scale.min) / (scale.max - scale.min || 1)) * plot.height;
  const boxes: BoxMark[] = [];
  items.forEach((item, index) => {
    if (!item.box) {
      return;
    }
    const left = toX(item.from);
    const slot = toX(item.to) - left;
    boxes.push({
      item: index,
      center: left + slot / 2,
      width: Math.max(2, Math.min(slot * 0.7, 44)),
      top: toY(item.box.q3),
      bottom: toY(item.box.q1),
      median: toY(item.box.q2),
      whiskerTop: toY(item.box.max),
      whiskerBottom: toY(item.box.min),
    });
  });
  return {
    ...emptyScene(chart),
    plot,
    xLabels: chart.histogram ? thinHistogramLabels(items, toX) : categoryLabels(items, toX),
    yLabels: scale.ticks.map((tick) => ({ at: toY(tick), text: formatTick(tick, scale) })),
    yGrid: scale.ticks.map(toY),
    boxes,
  };
}

function pieScene(chart: StatsChart, width: number, height: number): ChartScene {
  const items = chart.items ?? [];
  const total = items.reduce((acc, item) => acc + item.count, 0) || 1;
  const r = Math.max(10, Math.min(width, height) / 2 - 8);
  const slices: PieMark[] = items.map((item, index) => ({
    item,
    index,
  })).map(({ item, index }) => ({
    item: index,
    from: (item.from / total) * 2 * Math.PI,
    to: (item.to / total) * 2 * Math.PI,
  }));
  return {
    ...emptyScene(chart),
    plot: { left: 0, top: 0, width, height },
    pie: { cx: width / 2, cy: height / 2, r, slices },
  };
}

function scatterScene(chart: StatsChart, width: number, height: number): ChartScene {
  const points = chart.points ?? { x: [], y: [], dives: [] };
  const scale = yScale(chart.valAxis);
  const catAxis = chart.catAxis;
  const items = chart.items ?? [];

  const plot = plotFor(width, height, scale.ticks.map((t) => formatTick(t, scale)), Boolean(catAxis?.title));
  const toY = (value: number) => plot.top + plot.height - ((value - scale.min) / (scale.max - scale.min || 1)) * plot.height;

  let toX: (value: number) => number;
  let xLabels: TickLabel[];
  if (catAxis?.kind === 'category') {
    const domain = catDomain(items);
    toX = (value) => plot.left + ((value - domain.min) / (domain.max - domain.min || 1)) * plot.width;
    xLabels = categoryLabels(items, toX);
  } else if (catAxis?.kind === 'date') {
    // A margin of a few days, so the first and last dots are not cut by the edge.
    const margin = Math.max(5, (catAxis.max - catAxis.min) * 0.02);
    const min = catAxis.min - margin;
    const max = catAxis.max + margin;
    toX = (value) => plot.left + ((value - min) / (max - min || 1)) * plot.width;
    xLabels = yearOrMonthLabels(min, max, toX);
  } else {
    const bounds = numericBounds(catAxis);
    const xScale = niceScale(bounds.min, bounds.max, 5, false);
    toX = (value) => plot.left + ((value - xScale.min) / (xScale.max - xScale.min || 1)) * plot.width;
    xLabels = thinLabels(xScale.ticks.map((tick) => ({ at: toX(tick), text: formatTick(tick, xScale) })));
  }

  const drawn = points.x.map((x, index) => ({ x: toX(x), y: toY(points.y[index]) }));

  const quartiles: QuartileMark[] = [];
  items.forEach((item, index) => {
    if (!item.quartiles) {
      return;
    }
    const left = toX(item.from);
    const slot = toX(item.to) - left;
    quartiles.push({
      item: index,
      x: left + slot / 2,
      width: Math.min(slot * 0.7, 36),
      ys: [toY(item.quartiles.q1), toY(item.quartiles.q2), toY(item.quartiles.q3)],
    });
  });

  const regression = chart.regression ?? null;
  const clampY = (value: number) => Math.max(plot.top, Math.min(plot.top + plot.height, value));
  const line = regression
    ? {
        x1: toX(regression.fromX),
        y1: clampY(toY(regression.a * regression.fromX + regression.b)),
        x2: toX(regression.toX),
        y2: clampY(toY(regression.a * regression.toX + regression.b)),
      }
    : null;
  const band = (regression?.band ?? []).map((sample) => ({
    x: toX(sample.x),
    low: clampY(toY(sample.low)),
    high: clampY(toY(sample.high)),
  }));

  return {
    ...emptyScene(chart),
    plot,
    xLabels,
    yLabels: scale.ticks.map((tick) => ({ at: toY(tick), text: formatTick(tick, scale) })),
    yGrid: scale.ticks.map(toY),
    points: drawn,
    line,
    band,
    quartiles,
  };
}

// --- Hit testing --------------------------------------------------------------------

export function hitTest(scene: ChartScene, x: number, y: number): ChartSelection {
  const { chart } = scene;
  if (chart.family === 'pie') {
    return hitPie(scene, x, y);
  }
  if (chart.family === 'scatter') {
    return hitDot(scene, x, y);
  }
  if (chart.family === 'box') {
    return hitSlot(scene, x);
  }
  if (chart.family === 'bar') {
    return hitBars(scene, x, y);
  }
  return null;
}

function hitSlot(scene: ChartScene, x: number): ChartSelection {
  const items = scene.chart.items ?? [];
  const { plot } = scene;
  if (items.length === 0 || x < plot.left - 4 || x > plot.left + plot.width + 4) {
    return null;
  }
  const domain = catDomain(items);
  const value = domain.min + ((x - plot.left) / plot.width) * (domain.max - domain.min);
  const clamped = Math.max(domain.min, Math.min(domain.max, value));
  const index = items.findIndex((item) => clamped >= item.from && clamped <= item.to);
  return index >= 0 ? { kind: 'item', item: index, segment: null } : null;
}

function hitBars(scene: ChartScene, x: number, y: number): ChartSelection {
  const slot = hitSlot(scene, x);
  if (!slot || slot.kind !== 'item') {
    return null;
  }
  const item = scene.chart.items?.[slot.item];
  if (!item?.segments) {
    return slot;
  }
  // Within the column, the exact segment if the finger is on one, else the whole.
  for (const marks of scene.bars) {
    for (const mark of marks) {
      if (mark.item !== slot.item) {
        continue;
      }
      const onX = scene.chart.stacked || (x >= mark.x - 1 && x <= mark.x + mark.width + 1);
      if (onX && y >= mark.y - 2 && y <= mark.y + mark.height + 2) {
        return { kind: 'item', item: slot.item, segment: mark.series };
      }
    }
  }
  return slot;
}

function hitPie(scene: ChartScene, x: number, y: number): ChartSelection {
  const pie = scene.pie;
  if (!pie) {
    return null;
  }
  const dx = x - pie.cx;
  const dy = y - pie.cy;
  if (dx * dx + dy * dy > pie.r * pie.r) {
    return null;
  }
  // Clockwise from twelve.
  let angle = Math.atan2(dx, -dy);
  if (angle < 0) {
    angle += 2 * Math.PI;
  }
  const slice = pie.slices.find((s) => angle >= s.from && angle < s.to);
  return slice ? { kind: 'item', item: slice.item, segment: null } : null;
}

function hitDot(scene: ChartScene, x: number, y: number): ChartSelection {
  let best = -1;
  let bestDistance = DOT_HIT_RADIUS * DOT_HIT_RADIUS;
  scene.points.forEach((point, index) => {
    const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  if (best >= 0) {
    return { kind: 'point', point: best };
  }
  // Between the dots of a categorical chart, a tap means the group.
  return scene.chart.catAxis?.kind === 'category' ? hitSlot(scene, x) : null;
}

/** The band of a confidence area as a closed outline, top edge then bottom edge. */
export function bandOutline(band: ChartScene['band']): { x: number; y: number }[] {
  return [...band.map((b) => ({ x: b.x, y: b.high })), ...[...band].reverse().map((b) => ({ x: b.x, y: b.low }))];
}
