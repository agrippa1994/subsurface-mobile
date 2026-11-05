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
import { celsiusToMkelvin, metersToMm, mkelvinToFahrenheit, mmToFeet, type UnitSystem } from '../units';

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
  /** `get_vars` ids describing the site's environment. */
  environmentIds: number[];
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
  const environment: unknown = (detail as { environment?: unknown }).environment;

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
    environmentIds: Array.isArray(environment)
      ? environment.flatMap((id) => toNumber(id) ?? [])
      : [],
  };
}

const ENVIRONMENT_LABELS: Record<string, string> = {
  wall_drop_off: 'Wall or drop-off',
  cavern_cave: 'Cavern or cave',
};

function environmentLabel(option: string): string {
  const words = option.replace(/_/g, ' ');
  return ENVIRONMENT_LABELS[option] ?? words.charAt(0).toUpperCase() + words.slice(1);
}

/** Environment names by id, from the `bow_env` table in `get_vars`. */
export function parseSsiEnvironmentNames(vars: unknown): Map<number, string> {
  const names = new Map<number, string>();
  for (const options of Object.values(toObject(toObject(vars).bow_env))) {
    for (const option of Array.isArray(options) ? options : []) {
      const row = toObject(option);
      const id = toNumber(row.odin_dive_sites_vars_id);
      if (id !== null && typeof row.odin_dive_sites_vars_option === 'string') {
        names.set(id, environmentLabel(row.odin_dive_sites_vars_option));
      }
    }
  }
  return names;
}

/** The ids SSI has a name for, de-duplicated by name, in the site's order. */
export function ssiEnvironmentLabels(
  ids: readonly number[],
  names: ReadonlyMap<number, string>
): string[] {
  return [...new Set(ids.flatMap((id) => names.get(id) ?? []))];
}

export function formatSsiDepth(meters: number, system: UnitSystem): string {
  return system === 'imperial'
    ? `${Math.round(mmToFeet(metersToMm(meters)))} ft`
    : `${Math.round(meters * 10) / 10} m`;
}

function temperature(celsius: number, system: UnitSystem): number {
  return system === 'imperial'
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

export function ssiTemperatureUnit(system: UnitSystem): string {
  return system === 'imperial' ? 'F' : 'C';
}

export function ssiLengthUnit(system: UnitSystem): string {
  return system === 'imperial' ? 'ft' : 'm';
}

export function ssiWaterTemperatureBars(months: readonly SsiSiteMonth[], system: UnitSystem) {
  const unit = ssiTemperatureUnit(system);
  return monthBars(months, (m) => m.waterC, (c) => temperature(c, system), unit);
}

export function ssiAirTemperatureBars(months: readonly SsiSiteMonth[], system: UnitSystem) {
  const unit = ssiTemperatureUnit(system);
  return monthBars(months, (m) => m.airC, (c) => temperature(c, system), unit);
}

export function ssiVisibilityBars(months: readonly SsiSiteMonth[], system: UnitSystem) {
  return monthBars(
    months,
    (m) => m.visibilityM,
    (meters) => (system === 'imperial' ? Math.round(mmToFeet(metersToMm(meters))) : meters),
    ssiLengthUnit(system)
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
