// AI-generated (Claude)
// What the home screen and Lock Screen widgets show.
//
// A widget runs in its own process and cannot reach the native module, the
// query cache or anything else the app holds: it renders the props it was last
// handed and nothing more (see src/widgets/). This file turns the dive list
// into those props. Everything is formatted here, in the app, so the widget
// only lays out strings - its layout function cannot import a formatter.
//
// Kept free of React Native and expo imports so it runs in the Node test suite.

import { diveRowTitle, formatDate, sortDivesNewestFirst } from './dive-list';
import type { DiveSummary, PlotEntry } from './index';
import { formatDepth, formatTemperature, mmToFeet, mmToMeters, type UnitSystem } from './units';

/** One point of the miniature profile: minutes in, depth below the surface (negative). */
export type WidgetProfilePoint = { x: number; y: number };

export type LastDiveWidgetProps = {
  /** False on an empty logbook; every other field is then a placeholder. */
  hasDive: boolean;
  /** "Dive 248", or "" for an unnumbered dive. */
  numberText: string;
  title: string;
  dateText: string;
  depthText: string;
  durationText: string;
  /** "" when the dive has no water temperature. */
  temperatureText: string;
  buddyText: string;
  /** 0 (unrated) to 5, drawn as stars. */
  rating: number;
  /** Down to ~48 points, so the payload stays small. Empty when there is no profile. */
  profile: WidgetProfilePoint[];
  /** Deepest point of `profile`, as a positive number in the display unit. */
  profileMaxDepth: number;
  depthUnit: 'm' | 'ft';
  /** Approximate end of the dive as a real instant, ms since the epoch. See `diveEndInstant`. */
  endedAt: number;
  /** Opens this dive in the app. */
  url: string;
};

export type TotalsPeriodKey = 'all' | 'year' | 'last12';

export type TotalsPeriod = {
  /** "All dives", "2026", "Last 12 months". */
  label: string;
  dives: number;
  /** Total bottom time, e.g. "184 h" or "7.5 h". */
  hoursText: string;
  deepestText: string;
  /** "" when there are no dives in the period. */
  deepestWhere: string;
  longestText: string;
  averageDepthText: string;
  sites: number;
};

export type TotalsWidgetProps = {
  periods: Record<TotalsPeriodKey, TotalsPeriod>;
  /** Total logged dives, whatever the period. */
  totalDives: number;
  /** The next round dive count (50, 100, 150, ...), for the milestone gauge. */
  nextMilestone: number;
  previousMilestone: number;
  url: string;
};

export type ActivityMonth = {
  /** "Jan", "Feb", ... */
  label: string;
  dives: number;
};

export type ActivityWidgetProps = {
  /** The last twelve months, oldest first, the current month last. */
  months: ActivityMonth[];
  thisYear: number;
  lastYear: number;
  yearLabel: string;
  /** Hours underwater in the last twelve months, e.g. "42 h". */
  hoursText: string;
  /** The busiest month of the twelve, "" when none had a dive. */
  busiestText: string;
  url: string;
};

export type SurfaceIntervalWidgetProps = {
  hasDive: boolean;
  /** Approximate end of the last dive, ms since the epoch. */
  endedAt: number;
  title: string;
  dateText: string;
  numberText: string;
  url: string;
};

/** Every widget's props, computed in one pass over the dive list. */
export type WidgetSnapshot = {
  lastDive: LastDiveWidgetProps;
  totals: TotalsWidgetProps;
  activity: ActivityWidgetProps;
  surfaceInterval: SurfaceIntervalWidgetProps;
};

export type WidgetLinks = {
  /** Builds a deep link into this build of the app, `path` starting with "/". */
  url: (path: string) => string;
};

export type WidgetSnapshotInput = {
  dives: readonly DiveSummary[];
  /** The newest dive's profile, if it has one. */
  lastProfile?: readonly PlotEntry[] | null;
  unitSystem: UnitSystem;
  /** Now, ms since the epoch. */
  now: number;
  /** `Date#getTimezoneOffset()` of the phone now, minutes (positive west of UTC). */
  timezoneOffsetMinutes: number;
  links: WidgetLinks;
  locale?: string;
};

const MONTH_LABELS = [
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

const MAX_PROFILE_POINTS = 48;
const MILESTONE_STEP = 50;

/**
 * The dives a widget counts: ones that happened. A planned dive was never
 * dived, and a dive marked invalid is one the diver chose to leave out.
 */
export function countedDives(dives: readonly DiveSummary[]): DiveSummary[] {
  return dives.filter((dive) => !dive.planned && !dive.invalid);
}

/**
 * When a dive ended, as a real instant.
 *
 * The core stores a dive's start as the wall clock where it was dived, written
 * as if it were UTC (see `formatDate` in dive-list.ts), and keeps no time zone.
 * The surface interval wants an instant, so this assumes the dive was in the
 * phone's current zone - true for the dive that matters, the one just done. A
 * result in the future (an old dive across a zone change, a clock gone wrong)
 * is held at `now` so no widget counts down.
 */
export function diveEndInstant(
  dive: Pick<DiveSummary, 'when' | 'durationSec'>,
  timezoneOffsetMinutes: number,
  now: number,
): number {
  const instant = (dive.when + dive.durationSec) * 1000 + timezoneOffsetMinutes * 60_000;
  return Math.min(instant, now);
}

/** Minutes, the way a dive is talked about: "47 min", "1 h 12 min". */
export function formatDiveMinutes(seconds: number): string {
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Hours to a precision that means something at the size: "7.5 h" below ten, "184 h" above. */
export function formatTotalHours(seconds: number): string {
  const hours = seconds / 3600;
  if (hours <= 0) {
    return '0 h';
  }
  return hours < 10 ? `${Math.round(hours * 10) / 10} h` : `${Math.round(hours)} h`;
}

/**
 * Thins a profile out to at most `maxPoints`, keeping the deepest sample of each
 * stretch so the miniature does not lose the dive's maximum.
 */
export function downsampleProfile(
  entries: readonly PlotEntry[],
  unitSystem: UnitSystem,
  maxPoints = MAX_PROFILE_POINTS,
): WidgetProfilePoint[] {
  if (entries.length === 0) {
    return [];
  }
  const toDepth = (mm: number) =>
    unitSystem === 'imperial' ? Math.round(mmToFeet(mm)) : Math.round(mmToMeters(mm) * 10) / 10;
  const toPoint = (entry: PlotEntry): WidgetProfilePoint => ({
    x: Math.round((entry.sec / 60) * 10) / 10,
    // Negative, so a chart that fills from zero draws the dive hanging below the surface.
    y: -toDepth(Math.max(0, entry.depthMm)),
  });

  if (entries.length <= maxPoints) {
    return entries.map(toPoint);
  }

  // First and last are kept as they are: the descent starts and the ascent ends
  // at the surface, and a profile that does not reach it looks cut off.
  const inner = maxPoints - 2;
  const span = (entries.length - 2) / inner;
  const points: WidgetProfilePoint[] = [toPoint(entries[0])];
  for (let bucket = 0; bucket < inner; bucket++) {
    const start = 1 + Math.floor(bucket * span);
    const end = Math.max(start + 1, 1 + Math.floor((bucket + 1) * span));
    let deepest = entries[start];
    for (let i = start + 1; i < end && i < entries.length - 1; i++) {
      if (entries[i].depthMm > deepest.depthMm) {
        deepest = entries[i];
      }
    }
    points.push(toPoint(deepest));
  }
  points.push(toPoint(entries[entries.length - 1]));
  return points;
}

/** The dive's own wall clock year and month, read the way `formatDate` reads it. */
function wallMonth(when: number): { year: number; month: number } {
  const date = new Date(when * 1000);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

/** Today on the phone's wall clock, in the same UTC-as-local form a dive is stored in. */
function wallNow(now: number, timezoneOffsetMinutes: number): { year: number; month: number } {
  const date = new Date(now - timezoneOffsetMinutes * 60_000);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

function monthIndex({ year, month }: { year: number; month: number }): number {
  return year * 12 + month;
}

function numberText(dive: DiveSummary): string {
  return dive.number > 0 ? `Dive ${dive.number}` : '';
}

function diveUrl(dive: DiveSummary, links: WidgetLinks): string {
  // By start time rather than id: ids are process-local and the widget outlives
  // the process (see src/app/(tabs)/dives/at/[when].tsx).
  return links.url(`/dives/at/${dive.when}`);
}

function emptyLastDive(input: WidgetSnapshotInput): LastDiveWidgetProps {
  return {
    hasDive: false,
    numberText: '',
    title: 'No dives yet',
    dateText: 'Import or download a dive to see it here.',
    depthText: '-',
    durationText: '-',
    temperatureText: '',
    buddyText: '',
    rating: 0,
    profile: [],
    profileMaxDepth: 0,
    depthUnit: input.unitSystem === 'imperial' ? 'ft' : 'm',
    endedAt: input.now,
    url: input.links.url('/dives'),
  };
}

function lastDiveProps(
  dive: DiveSummary | undefined,
  input: WidgetSnapshotInput,
): LastDiveWidgetProps {
  if (!dive) {
    return emptyLastDive(input);
  }
  const profile = input.lastProfile ? downsampleProfile(input.lastProfile, input.unitSystem) : [];
  return {
    hasDive: true,
    numberText: numberText(dive),
    title: diveRowTitle(dive),
    dateText: formatDate(dive.when, input.locale),
    depthText: formatDepth(dive.maxDepthMm, input.unitSystem),
    durationText: formatDiveMinutes(dive.durationSec),
    temperatureText:
      dive.waterTempMkelvin > 0 ? formatTemperature(dive.waterTempMkelvin, input.unitSystem) : '',
    buddyText: dive.buddy.trim(),
    rating: Math.max(0, Math.min(5, Math.round(dive.rating))),
    profile,
    profileMaxDepth: profile.reduce((deepest, point) => Math.max(deepest, -point.y), 0),
    depthUnit: input.unitSystem === 'imperial' ? 'ft' : 'm',
    endedAt: diveEndInstant(dive, input.timezoneOffsetMinutes, input.now),
    url: diveUrl(dive, input.links),
  };
}

function totalsFor(
  label: string,
  dives: readonly DiveSummary[],
  unitSystem: UnitSystem,
  locale: string | undefined,
): TotalsPeriod {
  let seconds = 0;
  let depthSum = 0;
  let depthCount = 0;
  let deepest: DiveSummary | undefined;
  let longest: DiveSummary | undefined;
  const sites = new Set<number>();
  for (const dive of dives) {
    seconds += dive.durationSec;
    if (dive.meanDepthMm > 0) {
      depthSum += dive.meanDepthMm;
      depthCount++;
    }
    if (!deepest || dive.maxDepthMm > deepest.maxDepthMm) {
      deepest = dive;
    }
    if (!longest || dive.durationSec > longest.durationSec) {
      longest = dive;
    }
    if (dive.siteUuid !== 0) {
      sites.add(dive.siteUuid);
    }
  }
  return {
    label,
    dives: dives.length,
    hoursText: formatTotalHours(seconds),
    deepestText: deepest ? formatDepth(deepest.maxDepthMm, unitSystem) : '-',
    deepestWhere: deepest ? `${diveRowTitle(deepest)}, ${formatDate(deepest.when, locale)}` : '',
    longestText: longest ? formatDiveMinutes(longest.durationSec) : '-',
    averageDepthText: depthCount > 0 ? formatDepth(depthSum / depthCount, unitSystem) : '-',
    sites: sites.size,
  };
}

function totalsProps(dives: readonly DiveSummary[], input: WidgetSnapshotInput): TotalsWidgetProps {
  const today = wallNow(input.now, input.timezoneOffsetMinutes);
  const thisMonth = monthIndex(today);
  const thisYear = dives.filter((dive) => wallMonth(dive.when).year === today.year);
  const last12 = dives.filter((dive) => thisMonth - monthIndex(wallMonth(dive.when)) < 12);
  const total = dives.length;
  const previousMilestone = Math.floor(total / MILESTONE_STEP) * MILESTONE_STEP;
  return {
    periods: {
      all: totalsFor('All dives', dives, input.unitSystem, input.locale),
      year: totalsFor(String(today.year), thisYear, input.unitSystem, input.locale),
      last12: totalsFor('Last 12 months', last12, input.unitSystem, input.locale),
    },
    totalDives: total,
    previousMilestone,
    nextMilestone: previousMilestone + MILESTONE_STEP,
    url: input.links.url('/statistics'),
  };
}

function activityProps(
  dives: readonly DiveSummary[],
  input: WidgetSnapshotInput,
): ActivityWidgetProps {
  const today = wallNow(input.now, input.timezoneOffsetMinutes);
  const current = monthIndex(today);
  const counts = new Array<number>(12).fill(0);
  let seconds = 0;
  let thisYear = 0;
  let lastYear = 0;
  for (const dive of dives) {
    const month = wallMonth(dive.when);
    const age = current - monthIndex(month);
    // A dive dated after today (a clock set wrong) is left out of the bars.
    if (age >= 0 && age < 12) {
      counts[11 - age]++;
      seconds += dive.durationSec;
    }
    if (month.year === today.year) {
      thisYear++;
    } else if (month.year === today.year - 1) {
      lastYear++;
    }
  }
  const months = counts.map((count, index) => {
    const month = (((current - 11 + index) % 12) + 12) % 12;
    return { label: MONTH_LABELS[month], dives: count };
  });
  const busiest = months.reduce<ActivityMonth | null>(
    (best, month) => (month.dives > 0 && (!best || month.dives >= best.dives) ? month : best),
    null,
  );
  return {
    months,
    thisYear,
    lastYear,
    yearLabel: String(today.year),
    hoursText: formatTotalHours(seconds),
    busiestText: busiest
      ? `${busiest.label}, ${busiest.dives} ${busiest.dives === 1 ? 'dive' : 'dives'}`
      : '',
    url: input.links.url('/statistics'),
  };
}

function surfaceIntervalProps(
  dive: DiveSummary | undefined,
  input: WidgetSnapshotInput,
): SurfaceIntervalWidgetProps {
  if (!dive) {
    return {
      hasDive: false,
      endedAt: input.now,
      title: 'No dives yet',
      dateText: '',
      numberText: '',
      url: input.links.url('/dives'),
    };
  }
  return {
    hasDive: true,
    endedAt: diveEndInstant(dive, input.timezoneOffsetMinutes, input.now),
    title: diveRowTitle(dive),
    dateText: formatDate(dive.when, input.locale),
    numberText: numberText(dive),
    url: diveUrl(dive, input.links),
  };
}

/** The dive the "last dive" widgets show: the newest one that was dived. */
export function latestDive(dives: readonly DiveSummary[]): DiveSummary | undefined {
  return sortDivesNewestFirst(countedDives(dives))[0];
}

export function buildWidgetSnapshot(input: WidgetSnapshotInput): WidgetSnapshot {
  const dives = countedDives(input.dives);
  const latest = sortDivesNewestFirst(dives)[0];
  return {
    lastDive: lastDiveProps(latest, input),
    totals: totalsProps(dives, input),
    activity: activityProps(dives, input),
    surfaceInterval: surfaceIntervalProps(latest, input),
  };
}
