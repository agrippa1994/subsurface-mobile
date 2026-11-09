// AI-generated (Claude)
// Presentation of the configurable statistics.
//
// Every number comes from `statsChart`, and through it from the desktop's
// stats/statsvariables.cpp; which choices exist comes from its stats/statsstate.cpp.
// This file decides what to call them, on a phone: words for the builder, presets,
// readouts and what VoiceOver says. The one thing it adds up is folding a series past
// the eighth colour into "Other" (foldSeries), which moves nothing but where a bar
// segment is drawn. Geometry is in stats-chart-layout.ts.

import type {
  StatsAxis,
  StatsChart,
  StatsChartChange,
  StatsChartConfig,
  StatsChartConfigInput,
  StatsChartItem,
  StatsChartOption,
  StatsChartOptions,
  StatsChartSubtype,
  StatsChartType,
  StatsFeature,
  StatsOperationName,
  StatsSegment,
  StatsSortMode,
  StatsVariableOption,
} from './index';
import { formatDayNumber, shortMonthName } from './date-format';

// --- Names ---------------------------------------------------------------------

/** Upstream's rating and visibility bins are a row of star emoji. */
const STAR = /\u{1F31F}/gu;

/** A bin as it is written and read: upstream leaves an unnamed one empty. */
export function binLabel(label: string): string {
  const stars = label.match(STAR)?.length ?? 0;
  if (stars > 0) {
    return `${stars} ${stars === 1 ? 'star' : 'stars'}`;
  }
  return label.trim() === '' ? 'Not set' : label;
}

export function diveCount(n: number): string {
  return `${n} ${n === 1 ? 'dive' : 'dives'}`;
}

/** Upstream's value labels: "%L1" with the variable's decimals. */
export function formatStat(value: number, decimals: number, unit = ''): string {
  const text = value.toFixed(Math.max(0, decimals));
  return unit ? `${text} ${unit}` : text;
}

function percent(count: number, total: number): string {
  return total > 0 ? `${((count * 100) / total).toFixed(1)}%` : '';
}

function numericAxis(axis: StatsAxis | undefined): { decimals: number; unit: string } {
  return axis && (axis.kind === 'value' || axis.kind === 'count')
    ? { decimals: axis.decimals, unit: axis.unit }
    : { decimals: 0, unit: '' };
}

/** A date axis counts days since 1970, as upstream's date variable does. */
export function formatDay(days: number): string {
  return formatDayNumber(days);
}

export function monthYear(days: number): { month: string; year: number } {
  const date = new Date(days * 86400 * 1000);
  return { month: shortMonthName(date.getUTCMonth() + 1), year: date.getUTCFullYear() };
}

// --- The variable pickers -----------------------------------------------------------

export type VariableGroup = { title: string; variables: StatsVariableOption[] };

/**
 * Twenty-nine variables are a lot for a phone in one list, so they come in groups. The
 * names are upstream's, and the order within a group follows `stats_variables`; a
 * variable a submodule bump adds lands in Other rather than getting lost.
 */
const GROUPS: { title: string; names: string[] }[] = [
  { title: 'When', names: ['Date', 'Month of year', 'Day of week', 'Dive #'] },
  { title: 'Depth and time', names: ['Max. Depth', 'Mean Depth', 'Duration', 'NDL / Deco time'] },
  { title: 'Air and gas', names: ['SAC', 'Gas type', 'O₂ (max)', 'O₂ (bottom gas)', 'He (max)'] },
  { title: 'Conditions', names: ['Water temperature', 'Air temperature', 'Visibility', 'Rating'] },
  { title: 'People', names: ['People', 'Buddies', 'Dive guides'] },
  { title: 'Place', names: ['Dive site', 'Dive trip', 'Tags'] },
  {
    title: 'Equipment',
    names: ['Dive mode', 'Suit type', 'Cylinder type', 'Weight', 'Weightsystem', 'Dive computer'],
  },
];

export function groupVariables(variables: readonly StatsVariableOption[]): VariableGroup[] {
  const byName = new Map(variables.map((variable) => [variable.name, variable]));
  const out: VariableGroup[] = [];
  const placed = new Set<string>();
  for (const group of GROUPS) {
    const members = group.names.flatMap((name) => {
      const variable = byName.get(name);
      if (variable) {
        placed.add(name);
      }
      return variable ? [variable] : [];
    });
    if (members.length > 0) {
      out.push({ title: group.title, variables: members });
    }
  }
  const rest = variables.filter((variable) => !placed.has(variable.name));
  if (rest.length > 0) {
    out.push({ title: 'Other', variables: rest });
  }
  return out;
}

/** Variables a dive can hold several values of: a dive counts once per value. */
const SEVERAL_PER_DIVE = new Set([
  'People',
  'Buddies',
  'Dive guides',
  'Tags',
  'Gas type',
  'Weightsystem',
  'Cylinder type',
  'Dive computer',
]);

/**
 * First variables whose bins are names, as many as there are names: these read better
 * as rows than as a row of columns no label fits under. Short fixed lists such as
 * Month of year or Dive mode are fine standing up.
 */
const MANY_NAMES = new Set([
  ...SEVERAL_PER_DIVE,
  'Dive site',
  'Dive trip',
  'Suit type',
]);

/** The horizontal form of a chart, for when that is the better fit on a phone. */
const HORIZONTAL: Partial<Record<StatsChartSubtype, StatsChartSubtype>> = {
  Vertical: 'Horizontal',
  VerticalGrouped: 'HorizontalGrouped',
  VerticalStacked: 'HorizontalStacked',
};

/**
 * After a change of variable: StatsState keeps the subtype it had if it still can, and
 * that is a vertical one to begin with. If the new variable is a list of names and a
 * horizontal form is on offer, this returns it, so a chart of 80 dive sites does not
 * open as 80 columns. The user can still choose otherwise, and a change of anything
 * else leaves the form alone.
 */
export function phoneFriendlyChart(
  change: StatsChartChange,
  config: StatsChartConfig,
  options: StatsChartOptions,
): { type: StatsChartType; subtype: StatsChartSubtype } | null {
  if (change.kind !== 'var1' && change.kind !== 'var2') {
    return null;
  }
  if (!MANY_NAMES.has(config.var1)) {
    return null;
  }
  const horizontal = HORIZONTAL[config.chart.subtype];
  if (!horizontal) {
    return null;
  }
  return options.charts.some((c) => c.type === config.chart.type && c.subtype === horizontal)
    ? { type: config.chart.type, subtype: horizontal }
    : null;
}

// --- The builder's words ------------------------------------------------------------

/** The first binner of a continuous variable is upstream's "none": a value per dive. */
export function binnerLabel(name: string): string {
  if (name === 'none') {
    return 'Every dive on its own';
  }
  return name
    .replace(/^in /, 'In ')
    .replace(/^Yearly$/, 'Per year')
    .replace(/^Quarterly$/, 'Per quarter')
    .replace(/^Monthly$/, 'Per month');
}

/** The second variable's binners, where "none" means something else. */
export function secondBinnerLabel(name: string): string {
  return name === 'none' ? 'No steps' : binnerLabel(name);
}

const OPERATION_LABELS: Record<StatsOperationName, string> = {
  Invalid: 'Show the spread',
  Median: 'Median',
  Mean: 'Mean',
  TimeWeightedMean: 'Mean, weighted by dive time',
  Sum: 'Total',
  Min: 'Lowest',
  Max: 'Highest',
};

export function operationLabel(key: StatsOperationName): string {
  return OPERATION_LABELS[key];
}

const SORT_LABELS: Record<StatsSortMode, string> = {
  Bin: 'In order',
  Count: 'Most dives first',
  Value: 'Lowest value first',
};

export function sortLabel(key: StatsSortMode): string {
  return SORT_LABELS[key];
}

const FEATURE_LABELS: Record<StatsFeature, string> = {
  labels: 'Values on the chart',
  legend: 'Legend',
  median: 'Median marker',
  mean: 'Mean marker',
  quartiles: 'Quartile markers',
  regression: 'Trend line',
  confidence: 'Confidence area',
};

export function featureLabel(key: StatsFeature): string {
  return FEATURE_LABELS[key];
}

/** A chart in the picker, by what it looks like. */
export function chartOptionLabel(option: StatsChartOption): string {
  const form = chartFormName(option.type, option.subtype);
  return option.warning ? `${form}, not ideal for this data` : form;
}

function chartFormName(type: StatsChartType, subtype: StatsChartSubtype): string {
  switch (type) {
    case 'ScatterPlot':
      return 'Scatter plot';
    case 'Pie':
      return 'Pie';
    case 'DiscreteScatter':
      return 'Dots per group';
    case 'DiscreteBox':
      return 'Box plot per group';
    case 'HistogramBox':
      return 'Box plot on a scale';
    case 'HistogramCount':
    case 'HistogramValue':
      return subtype === 'Horizontal' ? 'Histogram, as rows' : 'Histogram';
    case 'HistogramStacked':
      return subtype === 'HorizontalStacked' ? 'Stacked histogram, as rows' : 'Stacked histogram';
    default:
      break;
  }
  switch (subtype) {
    case 'VerticalGrouped':
      return 'Grouped columns';
    case 'VerticalStacked':
      return 'Stacked columns';
    case 'HorizontalGrouped':
      return 'Grouped rows';
    case 'HorizontalStacked':
      return 'Stacked rows';
    case 'Horizontal':
      return 'Rows';
    default:
      return 'Columns';
  }
}

export function chartOptionKey(option: { type: StatsChartType; subtype: StatsChartSubtype }): string {
  return `${option.type}/${option.subtype}`;
}

// --- What the chart shows, in plain words ---------------------------------------------

/** A date binned per year reads "year" rather than "Date group". */
function binWord(config: StatsChartConfig, options?: StatsChartOptions | null): string | null {
  const binner = options?.binners1[config.binner1];
  return config.var1 !== 'Date' || !binner
    ? null
    : ({ Yearly: 'year', Quarterly: 'quarter', Monthly: 'month' } as Record<string, string>)[binner] ?? null;
}

/** "Dives by Dive site", "Median SAC by year": the screen's headline. */
export function chartHeadline(config: StatsChartConfig, options?: StatsChartOptions | null): string {
  const { var2, operation } = config;
  const var1 = binWord(config, options) ?? config.var1;
  switch (config.chart.type) {
    case 'ScatterPlot':
      return `${var2} against ${var1}`;
    case 'DiscreteValue':
    case 'HistogramValue':
      return `${operationLabel(operation)} ${var2} by ${var1}`;
    case 'DiscreteBox':
    case 'HistogramBox':
    case 'DiscreteScatter':
      return `${var2} by ${var1}`;
    case 'DiscreteBar':
    case 'HistogramStacked':
      return `Dives by ${var1} and ${var2}`;
    case 'Pie':
      return `Share of dives by ${var1}`;
    default:
      return `Dives by ${var1}`;
  }
}

/**
 * What the current choices will draw, for someone who has not seen this kind of chart
 * before. It says what a mark is and how it is cut: this and the options are all the
 * builder has to go on, so nothing here looks at the data, except the regression.
 */
export function chartDescription(
  config: StatsChartConfig,
  chart?: StatsChart,
  options?: StatsChartOptions | null,
): string {
  const { var1, var2 } = config;
  const period = binWord(config, options);
  const group = period ?? `${var1} group`;
  const several = SEVERAL_PER_DIVE.has(var1)
    ? ` A dive with several ${var1 === 'People' ? 'people' : 'values'} counts once for each.`
    : '';
  switch (config.chart.type) {
    case 'ScatterPlot': {
      const parts = [`Each dot is one dive, with ${var1} across and ${var2} up.`];
      if (chart?.regression && (config.features.regression || config.features.confidence)) {
        const line = config.features.regression ? 'The line is the trend' : 'The band follows the trend';
        parts.push(`${line}, explaining ${Math.round(chart.regression.r2 * 100)}% of the spread.`);
      } else if (chart && chart.family === 'scatter' && chart.regression === null) {
        parts.push('There is no trend strong enough to draw.');
      }
      return parts.join(' ');
    }
    case 'DiscreteValue':
    case 'HistogramValue':
      return `Each bar is the ${operationPhrase(config.operation)} of ${var2} over the dives of one ${group}, among dives that have a value.`;
    case 'DiscreteBox':
    case 'HistogramBox':
      return `Each box covers the middle half of ${var2} in one ${group}, with a line at the median. The whiskers reach the lowest and highest values.`;
    case 'DiscreteScatter':
      return `Each dot is one dive, grouped by ${period ?? var1}, with its ${var2} up. The bars mark the quartiles of each group.`;
    case 'DiscreteBar':
      return config.chart.subtype.endsWith('Stacked')
        ? `The dives of each ${group}, split by ${var2}.${several}`
        : `Side by side, the dives of each ${group}, for every ${var2}.${several}`;
    case 'HistogramStacked':
      return `The dives of each ${group}, split by ${var2}.${several}`;
    case 'Pie':
      return `The share of dives per ${period ?? var1}. Small groups fold into one slice.${several}`;
    case 'HistogramCount':
      return period ? `How many dives fall into each ${period}.` : `How many dives fall into each ${var1} step.`;
    default:
      return `How many dives there are for each ${period ?? (var1 === 'People' ? 'person' : var1)}.${several}`;
  }
}

function operationPhrase(operation: StatsOperationName): string {
  switch (operation) {
    case 'Median':
      return 'median';
    case 'Mean':
      return 'mean';
    case 'TimeWeightedMean':
      return 'dive-time weighted mean';
    case 'Sum':
      return 'total';
    case 'Min':
      return 'lowest value';
    case 'Max':
      return 'highest value';
    default:
      return 'value';
  }
}

export function chartEmptyText(config: StatsChartConfig, dives: number): string {
  if (dives === 0) {
    return 'No dives match the filter.';
  }
  const missing = config.var2 ?? config.var1;
  return `None of these ${diveCount(dives)} has a value for ${missing}. Try another variable, or a wider filter.`;
}

// --- Presets ---------------------------------------------------------------------

export type StatsPreset = {
  key: string;
  title: string;
  detail: string;
  /** An SF Symbol; see src/components/symbol.tsx. */
  icon: string;
  config: StatsChartConfigInput;
};

/**
 * Useful questions, each an ordinary configuration. tests/stats-chart-presets.test.ts
 * holds the binner indices against upstream's lists: 0 is "none" for a continuous
 * variable, then its steps.
 */
export const STATS_PRESETS: readonly StatsPreset[] = [
  {
    key: 'sac-depth',
    title: 'Does depth change my air use?',
    detail: 'SAC against maximum depth',
    icon: 'wind',
    config: { var1: 'Max. Depth', binner1: 0, var2: 'SAC' },
  },
  {
    key: 'depth-temperature',
    title: 'How cold does it get with depth?',
    detail: 'Water temperature against maximum depth',
    icon: 'thermometer.medium',
    config: { var1: 'Max. Depth', binner1: 0, var2: 'Water temperature' },
  },
  {
    key: 'year-mode',
    title: 'How much do I dive, and how?',
    detail: 'Dives per year by dive mode',
    icon: 'chart.bar.fill',
    config: {
      var1: 'Date',
      binner1: 1,
      var2: 'Dive mode',
      chart: { type: 'HistogramStacked', subtype: 'VerticalStacked' },
    },
  },
  {
    key: 'sac-year',
    title: 'Is my air use improving?',
    detail: 'Median SAC per year',
    icon: 'chart.line.downtrend.xyaxis',
    config: {
      var1: 'Date',
      binner1: 1,
      var2: 'SAC',
      operation: 'Median',
      chart: { type: 'HistogramValue', subtype: 'Vertical' },
    },
  },
  {
    key: 'sites',
    title: 'Where do I dive most?',
    detail: 'Dives per dive site',
    icon: 'mappin.and.ellipse',
    config: {
      var1: 'Dive site',
      chart: { type: 'DiscreteCount', subtype: 'Horizontal' },
      sort: 'Count',
    },
  },
  {
    key: 'people',
    title: 'Who do I dive with?',
    detail: 'Dives per buddy and guide',
    icon: 'person.2.fill',
    config: {
      var1: 'People',
      chart: { type: 'DiscreteCount', subtype: 'Horizontal' },
      sort: 'Count',
    },
  },
  {
    key: 'depth-histogram',
    title: 'How deep do I go?',
    detail: 'Dives per 5 m or 15 ft of maximum depth',
    icon: 'arrow.down.to.line',
    config: {
      var1: 'Max. Depth',
      binner1: 1,
      chart: { type: 'HistogramCount', subtype: 'Vertical' },
      features: {
        labels: false,
        legend: true,
        median: true,
        mean: true,
        quartiles: true,
        regression: true,
        confidence: true,
      },
    },
  },
  {
    key: 'duration-depth',
    title: 'Do deeper dives run shorter?',
    detail: 'Duration against maximum depth',
    icon: 'timer',
    config: { var1: 'Max. Depth', binner1: 0, var2: 'Duration' },
  },
  {
    key: 'temperature-month',
    title: 'Which months are warmest?',
    detail: 'Water temperature per month of the year',
    icon: 'calendar',
    config: {
      var1: 'Month of year',
      var2: 'Water temperature',
      chart: { type: 'DiscreteBox', subtype: 'Box' },
    },
  },
  {
    key: 'gases',
    title: 'What do I breathe?',
    detail: 'Share of dives per gas',
    icon: 'circle.hexagongrid',
    config: {
      var1: 'Gas type',
      chart: { type: 'Pie', subtype: 'Pie' },
      sort: 'Count',
    },
  },
  {
    key: 'weekday',
    title: 'Which days do I dive?',
    detail: 'Dives per day of the week',
    icon: 'calendar.day.timeline.left',
    config: { var1: 'Day of week', chart: { type: 'DiscreteCount', subtype: 'Vertical' } },
  },
];

/** The chart a configuration is first asked for when there is none yet. */
export const DEFAULT_STATS_CONFIG: StatsChartConfigInput = STATS_PRESETS[0].config;

/**
 * Reads a saved configuration. Its content is checked by the bindings, which complete
 * or correct anything they do not recognise; this only guards the shape.
 */
export function parseStatsConfig(raw: unknown): StatsChartConfig | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const config = raw as Partial<StatsChartConfig>;
  return typeof config.var1 === 'string' && typeof config.chart === 'object' && config.chart !== null
    ? (config as StatsChartConfig)
    : null;
}

// --- Series beyond the palette ---------------------------------------------------------

/** The palette's size: more would need a hue nobody could tell from another. */
export const MAX_SERIES = 8;

const OTHER_LABEL = (n: number) => `Other (${n})`;

/**
 * Keeps the largest series and folds the rest into a last "Other". A pie comes with its
 * own "other" already, but can still have up to twenty slices.
 */
export function foldSeries(chart: StatsChart): StatsChart {
  const series = chart.series;
  if (!series || series.length <= MAX_SERIES || !chart.items) {
    return chart;
  }
  return chart.family === 'pie' ? foldPie(chart) : foldSegments(chart, series);
}

function foldSegments(chart: StatsChart, series: string[]): StatsChart {
  const totals = series.map((_, index) => {
    let total = 0;
    for (const item of chart.items!) {
      total += item.segments?.[index]?.count ?? 0;
    }
    return { index, total };
  });
  const kept = new Set(
    [...totals]
      .sort((a, b) => b.total - a.total || a.index - b.index)
      .slice(0, MAX_SERIES - 1)
      .map((entry) => entry.index),
  );
  const folded = series.length - kept.size;
  const names = [...series.filter((_, index) => kept.has(index)), OTHER_LABEL(folded)];
  const items = chart.items!.map((item) => {
    const segments: StatsSegment[] = [];
    const rest: number[] = [];
    let restCount = 0;
    item.segments?.forEach((segment, index) => {
      if (kept.has(index)) {
        segments.push(segment);
      } else {
        restCount += segment.count;
        rest.push(...segment.dives);
      }
    });
    segments.push({ count: restCount, dives: [...new Set(rest)] });
    return { ...item, segments };
  });
  return { ...chart, series: names, items };
}

function foldPie(chart: StatsChart): StatsChart {
  const slices = chart.items!;
  const kept = new Set(
    slices
      .map((item, index) => ({ index, count: item.count, other: item.other !== undefined }))
      .filter((entry) => !entry.other)
      .sort((a, b) => b.count - a.count || a.index - b.index)
      .slice(0, MAX_SERIES - 1)
      .map((entry) => entry.index),
  );
  const items: StatsChartItem[] = [];
  const other: { name: string; count: number }[] = [];
  const dives: number[] = [];
  let at = 0;
  slices.forEach((item, index) => {
    if (kept.has(index)) {
      items.push({ ...item, from: at, to: at + item.count });
      at += item.count;
    } else {
      if (item.other) {
        other.push(...item.other);
      } else {
        other.push({ name: item.full, count: item.count });
      }
      dives.push(...(item.dives ?? []));
    }
  });
  const count = other.reduce((acc, row) => acc + row.count, 0);
  const label = `other (${other.length} items)`;
  items.push({
    label,
    full: label,
    from: at,
    to: at + count,
    count,
    total: slices[0].total,
    other,
    dives: [...new Set(dives)],
  });
  return { ...chart, items, series: items.map((item) => item.label) };
}

// --- Rows: the table under a chart, and a horizontal chart itself -----------------------

export type StatRow = {
  key: string;
  label: string;
  /** What the row reads, with its unit. */
  value: string;
  detail: string;
  /** Bar length against the largest row: 0 to 1. Null for a row without one. */
  fraction: number | null;
  /** Below zero when a value axis reaches under it. */
  negative: boolean;
  /** Stacked and grouped: each series' share of the whole bar. */
  segments: { series: number; fraction: number }[];
  /** The swatch of a pie slice. */
  series: number | null;
  dives: number[];
  accessibilityLabel: string;
};

export function chartRows(chart: StatsChart): StatRow[] {
  const items = chart.items ?? [];
  if (chart.family === 'bar') {
    return barRows(chart, items);
  }
  if (chart.family === 'pie') {
    return items.map((item, index) => pieRow(item, index));
  }
  if (chart.family === 'box') {
    return items.flatMap((item, index) => boxRow(chart, item, index));
  }
  if (chart.family === 'scatter') {
    return items.flatMap((item, index) => quartileRow(chart, item, index));
  }
  return [];
}

function barRows(chart: StatsChart, items: StatsChartItem[]): StatRow[] {
  const { decimals, unit } = numericAxis(chart.valAxis);
  const counting = chart.valAxis?.kind === 'count';
  const stacked = items.some((item) => item.segments);
  const peak = items.reduce(
    (acc, item) =>
      Math.max(
        acc,
        Math.abs(
          stacked ? (chart.stacked ? item.count : Math.max(0, ...item.segments!.map((s) => s.count))) : (item.value ?? 0),
        ),
      ),
    0,
  );
  return items.map((item, index) => {
    const label = binLabel(item.full);
    const value = item.value ?? null;
    if (item.segments) {
      const dives = [...new Set(item.segments.flatMap((segment) => segment.dives))];
      const detail = (chart.series ?? [])
        .flatMap((name, series) => {
          const count = item.segments![series]?.count ?? 0;
          return count > 0 ? [`${binLabel(name)}: ${count}`] : [];
        })
        .join(', ');
      return {
        key: `${index}`,
        label,
        value: diveCount(item.count),
        detail,
        fraction: peak > 0 ? item.count / peak : 0,
        negative: false,
        segments: item.segments.map((segment, series) => ({
          series,
          fraction: peak > 0 ? segment.count / peak : 0,
        })),
        series: null,
        dives,
        accessibilityLabel: `${label}: ${diveCount(item.count)}${detail ? `. ${detail}` : ''}`,
      };
    }
    const text = counting
      ? diveCount(item.count)
      : value === null
        ? 'No value'
        : formatStat(value, decimals, unit);
    const share = counting && item.total ? percent(item.count, item.total) : '';
    const detail = counting ? share : item.count > 0 ? diveCount(item.count) : '';
    return {
      key: `${index}`,
      label,
      value: text,
      detail,
      fraction: value === null || peak === 0 ? 0 : Math.abs(value) / peak,
      negative: value !== null && value < 0,
      segments: [],
      series: null,
      dives: item.dives ?? [],
      accessibilityLabel: `${label}: ${text}${detail ? `, ${detail}` : ''}`,
    };
  });
}

function pieRow(item: StatsChartItem, index: number): StatRow {
  const label = binLabel(item.full);
  const share = percent(item.count, item.total ?? 0);
  return {
    key: `${index}`,
    label,
    value: diveCount(item.count),
    detail: share,
    fraction: null,
    negative: false,
    segments: [],
    series: index,
    dives: item.dives ?? [],
    accessibilityLabel: `${label}: ${diveCount(item.count)}, ${share}`,
  };
}

function boxRow(chart: StatsChart, item: StatsChartItem, index: number): StatRow[] {
  if (!item.box) {
    return [];
  }
  const { decimals, unit } = numericAxis(chart.valAxis);
  const label = binLabel(item.full);
  const value = `${formatStat(item.box.q2, decimals, unit)} median`;
  const detail = `${formatStat(item.box.min, decimals)} to ${formatStat(item.box.max, decimals, unit)}, ${diveCount(item.count)}`;
  return [
    {
      key: `${index}`,
      label,
      value,
      detail,
      fraction: null,
      negative: false,
      segments: [],
      series: null,
      dives: item.dives ?? [],
      accessibilityLabel: `${label}: ${value}, ${detail}`,
    },
  ];
}

function quartileRow(chart: StatsChart, item: StatsChartItem, index: number): StatRow[] {
  if (!item.quartiles) {
    return [];
  }
  const { decimals, unit } = numericAxis(chart.valAxis);
  const label = binLabel(item.full);
  const value = `${formatStat(item.quartiles.q2, decimals, unit)} median`;
  const detail = diveCount(item.count);
  return [
    {
      key: `${index}`,
      label,
      value,
      detail,
      fraction: null,
      negative: false,
      segments: [],
      series: null,
      dives: item.dives ?? [],
      accessibilityLabel: `${label}: ${value}, ${detail}`,
    },
  ];
}

// --- Selection readout -------------------------------------------------------------

export type ChartSelection =
  | { kind: 'item'; item: number; segment: number | null }
  | { kind: 'point'; point: number }
  | null;

export type SelectionReadout = {
  title: string;
  lines: { label: string; value: string }[];
  dives: number[];
};

export function selectionReadout(chart: StatsChart, selection: ChartSelection): SelectionReadout | null {
  if (!selection) {
    return null;
  }
  if (selection.kind === 'point') {
    return pointReadout(chart, selection.point);
  }
  const item = chart.items?.[selection.item];
  if (!item) {
    return null;
  }
  const title = binLabel(item.full);
  if (item.segments) {
    return segmentReadout(chart, item, title, selection.segment);
  }
  if (item.box) {
    return boxReadout(chart, item, title);
  }
  if (chart.family === 'pie') {
    return {
      title,
      lines: [
        { label: 'Dives', value: String(item.count) },
        { label: 'Share', value: percent(item.count, item.total ?? 0) },
        ...(item.other ?? []).slice(0, 6).map((row) => ({ label: binLabel(row.name), value: String(row.count) })),
      ],
      dives: item.dives ?? [],
    };
  }
  if (item.quartiles) {
    const { decimals, unit } = numericAxis(chart.valAxis);
    return {
      title,
      lines: [
        { label: 'Dives', value: String(item.count) },
        { label: 'First quartile', value: formatStat(item.quartiles.q1, decimals, unit) },
        { label: 'Median', value: formatStat(item.quartiles.q2, decimals, unit) },
        { label: 'Third quartile', value: formatStat(item.quartiles.q3, decimals, unit) },
      ],
      dives: item.dives ?? [],
    };
  }
  const { decimals, unit } = numericAxis(chart.valAxis);
  if (item.operations) {
    const ops = item.operations;
    const line = (label: string, value: number | null) =>
      value === null ? [] : [{ label, value: formatStat(value, decimals, unit) }];
    return {
      title,
      lines: [
        { label: 'Dives', value: String(item.count) },
        ...line('Median', ops.median),
        ...line('Mean', ops.mean),
        ...line('Mean, by dive time', ops.timeWeightedMean),
        ...line('Lowest', ops.min),
        ...line('Highest', ops.max),
      ],
      dives: item.dives ?? [],
    };
  }
  return {
    title,
    lines: [
      { label: 'Dives', value: String(item.count) },
      ...(item.total ? [{ label: 'Share', value: percent(item.count, item.total) }] : []),
    ],
    dives: item.dives ?? [],
  };
}

function segmentReadout(
  chart: StatsChart,
  item: StatsChartItem,
  title: string,
  segment: number | null,
): SelectionReadout {
  const names = chart.series ?? [];
  const chosen = segment === null ? null : item.segments?.[segment];
  if (segment !== null && chosen) {
    return {
      title: `${title}, ${binLabel(names[segment] ?? '')}`,
      lines: [
        { label: 'Dives', value: String(chosen.count) },
        { label: 'Share of the bar', value: percent(chosen.count, item.count) },
      ],
      dives: chosen.dives,
    };
  }
  return {
    title,
    lines: [
      { label: 'Dives', value: String(item.count) },
      ...(item.segments ?? []).flatMap((s, series) =>
        s.count > 0 ? [{ label: binLabel(names[series] ?? ''), value: String(s.count) }] : [],
      ),
    ],
    dives: [...new Set((item.segments ?? []).flatMap((s) => s.dives))],
  };
}

function boxReadout(chart: StatsChart, item: StatsChartItem, title: string): SelectionReadout {
  const { decimals, unit } = numericAxis(chart.valAxis);
  const box = item.box!;
  return {
    title,
    lines: [
      { label: 'Dives', value: String(item.count) },
      { label: 'Highest', value: formatStat(box.max, decimals, unit) },
      { label: 'Third quartile', value: formatStat(box.q3, decimals, unit) },
      { label: 'Median', value: formatStat(box.q2, decimals, unit) },
      { label: 'First quartile', value: formatStat(box.q1, decimals, unit) },
      { label: 'Lowest', value: formatStat(box.min, decimals, unit) },
    ],
    dives: item.dives ?? [],
  };
}

function pointReadout(chart: StatsChart, index: number): SelectionReadout | null {
  const points = chart.points;
  if (!points || index < 0 || index >= points.dives.length) {
    return null;
  }
  const y = numericAxis(chart.valAxis);
  const x = chart.catAxis;
  const xText =
    x?.kind === 'date'
      ? formatDay(points.x[index])
      : x?.kind === 'category'
        ? binLabel(chart.items?.[Math.round(points.x[index])]?.full ?? '')
        : formatStat(points.x[index], numericAxis(x).decimals, numericAxis(x).unit);
  return {
    title: 'One dive',
    lines: [
      { label: axisName(x), value: xText },
      { label: axisName(chart.valAxis), value: formatStat(points.y[index], y.decimals, y.unit) },
    ],
    dives: [points.dives[index]],
  };
}

/** The readout's title for a dot, once its dive is known. */
export function dotTitle(siteName: string, when: number): string {
  const date = formatDay(when / 86400);
  return siteName.trim() === '' ? date : `${siteName}, ${date}`;
}

/** An axis title without its unit, which the value carries. */
function axisName(axis: StatsAxis | undefined): string {
  return (axis?.title ?? '').replace(/ \[[^\]]*\]$/, '');
}

// --- What VoiceOver says --------------------------------------------------------------

/**
 * A chart's summary. VoiceOver cannot walk a canvas, so this says what it shows and
 * where it peaks, and the rows below it carry the values one at a time.
 */
export function chartSummary(
  config: StatsChartConfig,
  chart: StatsChart,
  dives: number,
  options?: StatsChartOptions | null,
): string {
  const head = chartHeadline(config, options);
  if (chart.family === 'empty') {
    return `${head}. ${chartEmptyText(config, dives)}`;
  }
  if (chart.family === 'scatter' && chart.catAxis?.kind !== 'category') {
    const n = chart.points?.dives.length ?? 0;
    const trend = chart.regression
      ? ` The trend ${chart.regression.a >= 0 ? 'rises' : 'falls'}, explaining ${Math.round(chart.regression.r2 * 100)}% of the spread.`
      : ' There is no clear trend.';
    return `${head}. Scatter plot of ${diveCount(n)}.${trend}`;
  }
  const rows = chartRows(chart);
  const peak = largestRow(chart);
  return `${head}. ${rows.length} ${rows.length === 1 ? 'group' : 'groups'}, ${diveCount(dives)}.${peak ? ` Largest: ${peak}.` : ''}`;
}

function largestRow(chart: StatsChart): string | null {
  const items = chart.items ?? [];
  const measure = (item: StatsChartItem) =>
    chart.family === 'box' ? (item.box?.q2 ?? -Infinity) : (item.value ?? item.count);
  const best = items.reduce<StatsChartItem | null>(
    (acc, item) => (acc === null || measure(item) > measure(acc) ? item : acc),
    null,
  );
  if (!best) {
    return null;
  }
  const { decimals, unit } = numericAxis(chart.valAxis);
  const counting = chart.valAxis?.kind === 'count' || chart.family === 'pie';
  const value = counting ? diveCount(best.count) : formatStat(measure(best), decimals, unit);
  return `${binLabel(best.full)}, ${value}`;
}
