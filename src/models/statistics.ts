// AI-generated (Claude)
// Presentation model of the statistics screen.
//
// Pure functions only - no React, no native module. Every number here comes out
// of `getStatistics()`, i.e. out of the core's statistics.cpp plus the two
// buckets the bindings add (timeline, byDuration); nothing is aggregated in
// TypeScript, so the totals match desktop Subsurface by construction. This file
// only decides labels, bucket trimming and axis scales, which is what the
// vitest suite can check without a device.

import type { StatsFilter, StatsSummary } from './index';
import {
  formatDepth,
  formatDuration,
  formatTemperature,
  mmToFeet,
  mmToMeters,
  type UnitSystem,
} from './units';

/** Depth bucket width in `StatsSummary.byDepth`. `STATS_DEPTH_BUCKET` in core/statistics.h. */
export const DEPTH_BUCKET_M = 10;

/** One tile in the summary row. */
export type StatTile = {
  key: string;
  label: string;
  value: string;
  /** Secondary line, empty when there is nothing useful to add. */
  detail: string;
};

/** One bar of a chart. `value` is what is drawn, `label` what sits on the axis. */
export type StatBar = {
  key: string;
  label: string;
  value: number;
  /** Full text for the accessibility label and the tooltip, e.g. "20-30 m: 4 dives". */
  caption: string;
};

export type ChartGranularity = 'month' | 'year';

// --- Summary tiles ---------------------------------------------------------

/**
 * The headline numbers: dives, bottom time, depth and how many distinct sites
 * they were spread over. `matched` is the filter's own count, and equals
 * `total.selectionSize` except that the latter drops dives flagged invalid.
 */
export function summaryTiles(summary: StatsSummary, system: UnitSystem = 'metric'): StatTile[] {
  const { total } = summary;
  const dives = total.selectionSize;

  return [
    {
      key: 'dives',
      label: 'Dives',
      value: String(dives),
      detail: summary.matched === dives ? '' : `${summary.matched} matched`,
    },
    {
      key: 'time',
      label: 'Total time',
      value: formatTotalTime(total.totalTimeSec),
      detail: dives > 0 ? `avg ${formatDuration(Math.round(total.totalTimeSec / dives))}` : '',
    },
    {
      key: 'depth',
      label: 'Max depth',
      value: dives > 0 ? formatDepth(total.maxDepthMm, system) : '-',
      detail: total.avgDepthMm > 0 ? `avg ${formatDepth(total.avgDepthMm, system)}` : '',
    },
    {
      key: 'sites',
      label: 'Dive sites',
      value: String(summary.siteCount),
      detail: temperatureRange(summary, system),
    },
  ];
}

/** Bottom time is hours-and-minutes, not the `h:mm:ss` a single dive gets. */
export function formatTotalTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.round((total % 3600) / 60);
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

function temperatureRange(summary: StatsSummary, system: UnitSystem): string {
  const { minTempMkelvin, maxTempMkelvin } = summary.total;
  if (minTempMkelvin <= 0 || maxTempMkelvin <= 0) {
    return '';
  }
  return `${formatTemperature(minTempMkelvin, system)} to ${formatTemperature(maxTempMkelvin, system)}`;
}

// --- Dives over time -------------------------------------------------------

/**
 * Months up to two years, calendar years beyond that - a bar per month over a
 * fifteen-year logbook is unreadable on a phone. `timeline` skips months with
 * no dives, so the gaps are filled here: a chart of dives over time has to show
 * the empty months, otherwise a break in diving looks like continuous activity.
 */
export function pickGranularity(summary: StatsSummary): ChartGranularity {
  return spanInMonths(summary) > 24 ? 'year' : 'month';
}

function spanInMonths(summary: StatsSummary): number {
  const { timeline } = summary;
  if (timeline.length === 0) {
    return 0;
  }
  const first = timeline[0];
  const last = timeline[timeline.length - 1];
  return (last.year - first.year) * 12 + (last.month - first.month) + 1;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function divesOverTime(
  summary: StatsSummary,
  granularity: ChartGranularity = pickGranularity(summary)
): StatBar[] {
  if (summary.timeline.length === 0) {
    return [];
  }

  if (granularity === 'year') {
    // The core's yearly buckets already carry the full year in `period`.
    return summary.yearly.map((year) => ({
      key: String(year.period),
      label: String(year.period),
      value: year.selectionSize,
      caption: `${year.period}: ${diveCount(year.selectionSize)}`,
    }));
  }

  const counts = new Map<string, number>();
  for (const entry of summary.timeline) {
    counts.set(`${entry.year}-${entry.month}`, entry.dives);
  }

  const first = summary.timeline[0];
  const last = summary.timeline[summary.timeline.length - 1];
  const bars: StatBar[] = [];
  for (let y = first.year, m = first.month; y < last.year || (y === last.year && m <= last.month); ) {
    const key = `${y}-${m}`;
    const label = m === 1 ? String(y) : MONTH_NAMES[m - 1];
    bars.push({
      key,
      label,
      value: counts.get(key) ?? 0,
      caption: `${MONTH_NAMES[m - 1]} ${y}: ${diveCount(counts.get(key) ?? 0)}`,
    });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return bars;
}

// --- Distributions ---------------------------------------------------------

/**
 * Depth histogram off the core's 10 m buckets. Entry 0 is the combined total
 * and is dropped; trailing empty buckets are trimmed so a 30 m logbook is not
 * drawn against a 300 m axis. Bucket bounds stay metric even in imperial mode,
 * because that is how the core cut them - the labels convert, the cuts cannot.
 */
export function depthHistogram(summary: StatsSummary, system: UnitSystem = 'metric'): StatBar[] {
  const buckets = trimTrailingEmpty(summary.byDepth.slice(1), (b) => b.selectionSize);
  return buckets.map((bucket, index) => {
    const from = index * DEPTH_BUCKET_M;
    const to = from + DEPTH_BUCKET_M;
    const label = depthBoundLabel(to, system);
    return {
      key: `depth-${from}`,
      label,
      value: bucket.selectionSize,
      caption: `${depthBoundLabel(from, system)} to ${label}: ${diveCount(bucket.selectionSize)}`,
    };
  });
}

function depthBoundLabel(meters: number, system: UnitSystem): string {
  const mm = meters * 1000;
  return system === 'imperial' ? `${Math.round(mmToFeet(mm))}` : `${Math.round(mmToMeters(mm))}`;
}

/** Unit shown once on the depth axis, since the bounds themselves are bare. */
export function depthAxisUnit(system: UnitSystem = 'metric'): string {
  return system === 'imperial' ? 'ft' : 'm';
}

/**
 * Duration histogram off the bindings' 10-minute buckets. The last bucket is
 * open-ended ("180+"); trailing empty buckets are trimmed the same way.
 */
export function durationHistogram(summary: StatsSummary): StatBar[] {
  const buckets = trimTrailingEmpty(summary.byDuration, (b) => b.dives);
  return buckets.map((bucket) => {
    const label = bucket.toMin === null ? `${bucket.fromMin}+` : String(bucket.toMin);
    const range =
      bucket.toMin === null
        ? `over ${bucket.fromMin} min`
        : `${bucket.fromMin} to ${bucket.toMin} min`;
    return {
      key: `duration-${bucket.fromMin}`,
      label,
      value: bucket.dives,
      caption: `${range}: ${diveCount(bucket.dives)}`,
    };
  });
}

function trimTrailingEmpty<T>(buckets: readonly T[], count: (bucket: T) => number): T[] {
  let end = buckets.length;
  while (end > 0 && count(buckets[end - 1]) === 0) {
    end -= 1;
  }
  return buckets.slice(0, end);
}

function diveCount(n: number): string {
  return `${n} ${n === 1 ? 'dive' : 'dives'}`;
}

// --- Axis ------------------------------------------------------------------

/**
 * Y axis for a count chart: 0 to a round number at or above the tallest bar,
 * with at most `maxTicks` labelled steps. Returns 0..1 for an empty chart so a
 * caller never divides by zero.
 */
export function countAxis(bars: readonly StatBar[], maxTicks = 5): { max: number; ticks: number[] } {
  const peak = bars.reduce((acc, bar) => Math.max(acc, bar.value), 0);
  if (peak <= 0) {
    return { max: 1, ticks: [0, 1] };
  }

  const rawStep = peak / (maxTicks - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) ?? magnitude * 10;
  const max = Math.ceil(peak / step) * step;

  const ticks: number[] = [];
  for (let value = 0; value <= max + step / 2; value += step) {
    ticks.push(Math.round(value));
  }
  return { max, ticks };
}

// --- Filters ---------------------------------------------------------------

export type StatsFilterInput = {
  /** Calendar year, or null for every year. */
  year: number | null;
  /** Dive site uuid, or null for every site. Uuids are stable across loads. */
  siteUuid: number | null;
};

export const NO_FILTER: StatsFilterInput = { year: null, siteUuid: null };

/**
 * Turns the screen's filter state into the module's `StatsFilter`. The module
 * recomputes every number from it - nothing is filtered in JS, which is also
 * what keeps the totals identical to desktop's.
 */
export function toStatsFilter(input: StatsFilterInput): StatsFilter | undefined {
  const filter: StatsFilter = {};
  if (input.year !== null) {
    // Dive timestamps are UTC seconds, so the year bounds are UTC too.
    filter.fromWhen = Date.UTC(input.year, 0, 1) / 1000;
    filter.toWhen = Date.UTC(input.year + 1, 0, 1) / 1000 - 1;
  }
  if (input.siteUuid !== null) {
    filter.siteUuid = input.siteUuid;
  }
  return Object.keys(filter).length > 0 ? filter : undefined;
}

/**
 * Years offered by the year picker, newest first. Must be given an *unfiltered*
 * summary: `yearly` describes what the current filter matched, so feeding it
 * back would leave the picker with the one year already selected.
 */
export function filterYears(summary: StatsSummary): number[] {
  return summary.yearly
    .map((year) => year.period)
    .filter((year) => year > 0)
    .sort((a, b) => b - a);
}

export function isFiltered(input: StatsFilterInput): boolean {
  return input.year !== null || input.siteUuid !== null;
}
