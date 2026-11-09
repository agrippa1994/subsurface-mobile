// AI-generated (Claude)
// What SSI's divers logged at a site, from `get_divesite_details`.
//
// The field guide leaves all of this unspecified, so the shapes below are as
// measured in November 2026. Most fields are JSON text holding numbers as strings,
// keyed by month ("7") or by category. Sites with few dives simply lack months.
//
// Units are inferred, not documented: depth and visibility read as metres, time
// as minutes and temperature as Celsius, which is what real sites' values fit
// (Lake Constance: 25 deep, 46 long, water 6 to 12).
//
// This file stays free of the network so vitest can cover the parsing directly.

import type { SiteDetail } from 'divessi-client';

import type { StatBar } from '../statistics';
import { celsiusToMkelvin, metersToMm, mkelvinToFahrenheit, mmToFeet, type Units } from '../units';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export type SsiSiteMonth = {
  /** 1 to 12. */
  month: number;
  dives: number;
  waterC: number | null;
  airC: number | null;
  visibilityM: number | null;
};

/** How many dives reported a lookup code. */
export type SsiCodeCount = { id: number; count: number };

export type SsiSiteWildlife = {
  id: number;
  /** 1 to 12. Empty when SSI lists the animal without saying when. */
  months: number[];
};

export type SsiSiteInsights = {
  avgDepthM: number | null;
  avgMinutes: number | null;
  rating: number | null;
  ratingCount: number | null;
  totalDives: number | null;
  divers: number | null;
  water: 'Fresh water' | 'Salt water' | 'Artificial' | null;
  /** January first, always twelve. */
  months: SsiSiteMonth[];
  /** How many ratings gave 1 to 5 stars, in that order. */
  ratingCounts: number[];
  /** Named kinds of diving with at least one dive, most dived first. */
  diveTypes: { label: string; dives: number }[];
  /** Lookup ids describing the site's environment. */
  environmentIds: number[];
  /** Lookup ids of the experience levels the site suits. */
  levelIds: number[];
  current: SsiCodeCount[];
  entry: SsiCodeCount[];
  wildlife: SsiSiteWildlife[];
};

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** An average over no dives comes back as 0, which is not a measurement. */
function toAverage(value: unknown): number | null {
  const parsed = toNumber(value);
  return parsed === 0 ? null : parsed;
}

function toObject(value: unknown): Record<string, unknown> {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return {};
    }
  }
  return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

function toCodeCounts(value: unknown): SsiCodeCount[] {
  return Object.entries(toObject(value)).flatMap(([id, raw]) => {
    const count = toNumber(raw);
    return count !== null && count > 0 && Number.isFinite(Number(id))
      ? [{ id: Number(id), count }]
      : [];
  });
}

function toIds(value: unknown): number[] {
  return Array.isArray(value) ? value.flatMap((id) => toNumber(id) ?? []) : [];
}

/** `{ "22": { "month_5": 1 } }`, or just the ids when the months are missing. */
function toWildlife(selected: unknown, sightings: unknown): SsiSiteWildlife[] {
  const entries = Object.entries(toObject(selected));
  if (entries.length === 0) {
    let ids: unknown = sightings;
    if (typeof sightings === 'string') {
      try {
        ids = JSON.parse(sightings);
      } catch {
        return [];
      }
    }
    return toIds(ids).map((id) => ({ id, months: [] }));
  }
  return entries.flatMap(([id, months]) => {
    const parsed = Number(id);
    if (!Number.isFinite(parsed)) return [];
    return [
      {
        id: parsed,
        months: Object.keys(toObject(months)).flatMap((key) => {
          const match = /^month_(\d+)$/.exec(key);
          return match ? [Number(match[1])] : [];
        }),
      },
    ];
  });
}

const DIVE_TYPES: Record<string, string> = {
  scuba: 'Scuba',
  frd: 'Freediving',
  xr: 'Extended range',
  ccr: 'Closed circuit rebreather',
  scr: 'Semi-closed rebreather',
};

const WATER: Record<string, SsiSiteInsights['water']> = {
  fresh: 'Fresh water',
  salt: 'Salt water',
  artificial: 'Artificial',
};

export function parseSsiSiteInsights(detail: SiteDetail): SsiSiteInsights {
  const conditions = toObject(detail.temp_month_avg);
  const logged = toObject(detail.avg_logged_dives_per_month);

  const months = MONTHS.map((_, index) => {
    const key = String(index + 1);
    const row = toObject(conditions[key]);
    return {
      month: index + 1,
      // The two sources disagree by a dive or so; only this one counts them all.
      dives: toNumber(toObject(logged[key]).dives) ?? toNumber(row.dives) ?? 0,
      waterC: toAverage(row.avgWaterTemp),
      airC: toAverage(row.avgAirTemp),
      visibilityM: toAverage(row.avgVis),
    };
  });

  const stars = toObject(detail.avg_log_rating_details);
  const types = toObject(detail.diveType);
  // Sent by the server but absent from the declared model.
  const extra = detail as { environment?: unknown; wildlife_selected?: unknown };

  return {
    avgDepthM: toAverage(detail.avg_max_depth_logged),
    avgMinutes: toAverage(detail.avg_divetime_logged),
    rating: toAverage(detail.avg_log_rating),
    ratingCount: toAverage(detail.avg_log_rating_dives),
    totalDives: toAverage(detail.total_logged_dives),
    divers: toAverage(detail.dives_logged_by_divers),
    water: WATER[detail.bow ?? ''] ?? null,
    months,
    ratingCounts: [1, 2, 3, 4, 5].map((star) => toNumber(stars[star]) ?? 0),
    diveTypes: Object.entries(DIVE_TYPES)
      .map(([key, label]) => ({ label, dives: toNumber(types[key]) ?? 0 }))
      .filter((type) => type.dives > 0)
      .sort((a, b) => b.dives - a.dives),
    environmentIds: toIds(extra.environment),
    levelIds: toIds(toObject(detail.odin_dive_sites_content).level),
    current: toCodeCounts(detail.current),
    entry: toCodeCounts(detail.entryTypes),
    wildlife: toWildlife(extra.wildlife_selected, detail.sightings),
  };
}

/** The ids a table has a name for, de-duplicated by name, in the site's order. */
export function ssiLabels(ids: readonly number[], names: ReadonlyMap<number, string>): string[] {
  return [...new Set(ids.flatMap((id) => names.get(id) ?? []))];
}

export type SsiShareRow = { label: string; count: number; percent: number };

/**
 * Named categories with their share of all reports, largest first. The share is
 * of everything reported, so a code without a name does not inflate the others.
 */
export function ssiShareRows(
  counts: readonly SsiCodeCount[],
  names: ReadonlyMap<number, string>
): SsiShareRow[] {
  const total = counts.reduce((sum, { count }) => sum + count, 0);
  return counts
    .flatMap(({ id, count }) => {
      const label = names.get(id);
      return label ? [{ label, count, percent: Math.round((count / total) * 100) }] : [];
    })
    .sort((a, b) => b.count - a.count);
}

/**
 * When an animal is seen: "All year", "May to September", or a list when the
 * months are not one run. The run may cross the new year.
 */
export function ssiMonthRange(months: readonly number[]): string {
  const seen = [...new Set(months)].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
  if (seen.length === 0) return '';
  if (seen.length === 12) return 'All year';
  const has = (month: number) => seen.includes(month);
  const starts = seen.filter((month) => !has(month === 1 ? 12 : month - 1));
  const name = (month: number) => MONTHS[month - 1];
  if (starts.length !== 1) return seen.map((month) => name(month).slice(0, 3)).join(', ');
  if (seen.length === 1) return name(seen[0]);
  const last = seen.filter((month) => !has(month === 12 ? 1 : month + 1))[0];
  return `${name(starts[0])} to ${name(last)}`;
}

export function formatSsiDepth(meters: number, units: Units): string {
  return units.depth === 'ft'
    ? `${Math.round(mmToFeet(metersToMm(meters)))} ft`
    : `${Math.round(meters * 10) / 10} m`;
}

function temperature(celsius: number, units: Units): number {
  return units.temperature === 'F'
    ? Math.round(mkelvinToFahrenheit(celsiusToMkelvin(celsius)) * 10) / 10
    : Math.round(celsius * 10) / 10;
}

function diveCount(dives: number): string {
  return `${dives.toLocaleString()} ${dives === 1 ? 'dive' : 'dives'}`;
}

/**
 * Twelve bars from one monthly average, or none when no month has one. BarChart
 * draws upward from zero, so a below-freezing month has no bar; its caption still
 * gives the real number.
 */
function monthBars(
  months: readonly SsiSiteMonth[],
  read: (month: SsiSiteMonth) => number | null,
  convert: (value: number) => number,
  unit: string
): StatBar[] {
  if (months.every((month) => read(month) === null)) {
    return [];
  }
  return months.map((month) => {
    const name = MONTHS[month.month - 1];
    const value = read(month);
    const shown = value === null ? null : convert(value);
    return {
      key: String(month.month),
      label: name.charAt(0),
      value: Math.max(0, shown ?? 0),
      caption:
        shown === null
          ? `${name}: no data`
          : `${name}: ${shown} ${unit}, from ${diveCount(month.dives)}`,
    };
  });
}

export function ssiTemperatureUnit(units: Units): string {
  return units.temperature === 'F' ? 'F' : 'C';
}

export function ssiLengthUnit(units: Units): string {
  return units.depth === 'ft' ? 'ft' : 'm';
}

export function ssiWaterTemperatureBars(months: readonly SsiSiteMonth[], units: Units) {
  const unit = ssiTemperatureUnit(units);
  return monthBars(months, (m) => m.waterC, (c) => temperature(c, units), unit);
}

export function ssiAirTemperatureBars(months: readonly SsiSiteMonth[], units: Units) {
  const unit = ssiTemperatureUnit(units);
  return monthBars(months, (m) => m.airC, (c) => temperature(c, units), unit);
}

export function ssiVisibilityBars(months: readonly SsiSiteMonth[], units: Units) {
  return monthBars(
    months,
    (m) => m.visibilityM,
    (meters) => (units.depth === 'ft' ? Math.round(mmToFeet(metersToMm(meters))) : meters),
    ssiLengthUnit(units)
  );
}

export function ssiMonthlyDiveBars(months: readonly SsiSiteMonth[]): StatBar[] {
  if (months.every((month) => month.dives === 0)) {
    return [];
  }
  return months.map((month) => {
    const name = MONTHS[month.month - 1];
    return {
      key: String(month.month),
      label: name.charAt(0),
      value: month.dives,
      caption: `${name}: ${diveCount(month.dives)}`,
    };
  });
}

export function ssiRatingBars(counts: readonly number[]): StatBar[] {
  if (counts.every((count) => count === 0)) {
    return [];
  }
  return counts.map((count, index) => {
    const stars = index + 1;
    return {
      key: String(stars),
      label: String(stars),
      value: count,
      caption: `${stars} ${stars === 1 ? 'star' : 'stars'}: ${count.toLocaleString()} ${
        count === 1 ? 'rating' : 'ratings'
      }`,
    };
  });
}
