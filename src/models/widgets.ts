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
import { shortMonthName } from './date-format';
import { depthInUnit, formatDepth, formatTemperature, type Units } from './units';
import { t } from '@/i18n';

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
  /**
   * The words the layout shows, in the app's language. The layout runs in the
   * widget extension, which cannot load the translations, so they travel with
   * the props.
   */
  text: {
    /** The Lock Screen line: "18.2 m, 47 min at Blue Hole", or "No dives yet". */
    inline: string;
    rating: string;
    maxDepth: string;
    duration: string;
    water: string;
    buddy: string;
  };
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
  /** "dive" or "dives", after the big count. */
  divesWord: string;
  /** "12 dives" */
  countText: string;
  /** "12 dives, 18 h underwater" */
  inlineText: string;
  /** "18 h, deepest 32.1 m" */
  summaryText: string;
  /** "18 h underwater" */
  underwaterText: string;
  /** "Deepest 32.1 m" */
  deepestLine: string;
  /** "4 sites" */
  sitesText: string;
  /** "Deepest dive: Blue Hole, 12 Mar 2024", "" with none. */
  deepestDiveText: string;
};

export type TotalsWidgetProps = {
  periods: Record<TotalsPeriodKey, TotalsPeriod>;
  /** Total logged dives, whatever the period. */
  totalDives: number;
  /** The next round dive count (50, 100, 150, ...), for the milestone gauge. */
  nextMilestone: number;
  previousMilestone: number;
  url: string;
  /** Words for the layout; see `LastDiveWidgetProps.text`. */
  text: {
    underwater: string;
    deepest: string;
    longest: string;
    avgDepth: string;
    diveSites: string;
    /** "Next milestone: 150 dives" */
    milestone: string;
    /** "27 to go" */
    toGo: string;
  };
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
  /** Words for the layout; see `LastDiveWidgetProps.text`. */
  text: {
    caption: string;
    /** "in 2026", after this year's count. */
    inYear: string;
    /** Against last year: "3 more than last year". */
    comparison: string;
    /** "42 h in 12 months" */
    hoursIn12: string;
    none: string;
    lastYear: string;
    months12: string;
    busiest: string;
  };
};

export type SurfaceIntervalWidgetProps = {
  hasDive: boolean;
  /** Approximate end of the last dive, ms since the epoch. */
  endedAt: number;
  title: string;
  dateText: string;
  numberText: string;
  url: string;
  /** Words for the layout; see `LastDiveWidgetProps.text`. */
  text: {
    caption: string;
    title: string;
    /** "since Blue Hole" */
    since: string;
    empty: string;
    noDives: string;
  };
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
  /** One unit per quantity, as everywhere in the app. */
  units: Units;
  /** Now, ms since the epoch. */
  now: number;
  /** `Date#getTimezoneOffset()` of the phone now, minutes (positive west of UTC). */
  timezoneOffsetMinutes: number;
  links: WidgetLinks;
};


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
  units: Units,
  maxPoints = MAX_PROFILE_POINTS,
): WidgetProfilePoint[] {
  if (entries.length === 0) {
    return [];
  }
  const toDepth = (mm: number) =>
    units.depth === 'ft' ? Math.round(depthInUnit(mm, units)) : Math.round(depthInUnit(mm, units) * 10) / 10;
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
  return dive.number > 0 ? t('widgets.diveNumber', { number: dive.number }) : '';
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
    title: t('widgets.noDives'),
    dateText: t('widgets.noDivesDetail'),
    depthText: '-',
    durationText: '-',
    temperatureText: '',
    buddyText: '',
    rating: 0,
    profile: [],
    profileMaxDepth: 0,
    depthUnit: input.units.depth,
    endedAt: input.now,
    url: input.links.url('/dives'),
    text: lastDiveText(t('widgets.noDives')),
  };
}

/** The labels of the last dive widget, around its one-line summary. */
function lastDiveText(inline: string): LastDiveWidgetProps['text'] {
  return {
    inline,
    rating: t('widgets.rating'),
    maxDepth: t('dive.field.maxDepth'),
    duration: t('dive.field.duration'),
    water: t('dive.field.water'),
    buddy: t('dive.field.buddy'),
  };
}

function lastDiveProps(
  dive: DiveSummary | undefined,
  input: WidgetSnapshotInput,
): LastDiveWidgetProps {
  if (!dive) {
    return emptyLastDive(input);
  }
  const profile = input.lastProfile ? downsampleProfile(input.lastProfile, input.units) : [];
  return {
    hasDive: true,
    numberText: numberText(dive),
    title: diveRowTitle(dive),
    dateText: formatDate(dive.when),
    depthText: formatDepth(dive.maxDepthMm, input.units),
    durationText: formatDiveMinutes(dive.durationSec),
    temperatureText:
      dive.waterTempMkelvin > 0 ? formatTemperature(dive.waterTempMkelvin, input.units) : '',
    buddyText: dive.buddy.trim(),
    rating: Math.max(0, Math.min(5, Math.round(dive.rating))),
    profile,
    profileMaxDepth: profile.reduce((deepest, point) => Math.max(deepest, -point.y), 0),
    depthUnit: input.units.depth,
    endedAt: diveEndInstant(dive, input.timezoneOffsetMinutes, input.now),
    url: diveUrl(dive, input.links),
    text: lastDiveText(
      t('widgets.inline', {
        depth: formatDepth(dive.maxDepthMm, input.units),
        duration: formatDiveMinutes(dive.durationSec),
        title: diveRowTitle(dive),
      }),
    ),
  };
}

function totalsFor(
  label: string,
  dives: readonly DiveSummary[],
  units: Units,
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
  const hoursText = formatTotalHours(seconds);
  const deepestText = deepest ? formatDepth(deepest.maxDepthMm, units) : '-';
  const deepestWhere = deepest ? `${diveRowTitle(deepest)}, ${formatDate(deepest.when)}` : '';
  const countText = t('common.diveCount', { count: dives.length });
  return {
    label,
    dives: dives.length,
    hoursText,
    deepestText,
    deepestWhere,
    longestText: longest ? formatDiveMinutes(longest.durationSec) : '-',
    averageDepthText: depthCount > 0 ? formatDepth(depthSum / depthCount, units) : '-',
    sites: sites.size,
    divesWord: t('widgets.divesWord', { count: dives.length }),
    countText,
    inlineText: t('widgets.inlineTotals', { dives: countText, hours: hoursText }),
    summaryText: t('widgets.summary', { hours: hoursText, deepest: deepestText }),
    underwaterText: t('widgets.underwaterText', { hours: hoursText }),
    deepestLine: t('widgets.deepestLine', { depth: deepestText }),
    sitesText: t('widgets.sites', { count: sites.size }),
    deepestDiveText: deepestWhere === '' ? '' : t('widgets.deepestDive', { where: deepestWhere }),
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
      all: totalsFor(t('widgets.allDives'), dives, input.units),
      year: totalsFor(String(today.year), thisYear, input.units),
      last12: totalsFor(t('widgets.last12Months'), last12, input.units),
    },
    totalDives: total,
    previousMilestone,
    nextMilestone: previousMilestone + MILESTONE_STEP,
    url: input.links.url('/statistics'),
    text: {
      underwater: t('widgets.underwater'),
      deepest: t('widgets.deepest'),
      longest: t('widgets.longest'),
      avgDepth: t('widgets.avgDepth'),
      diveSites: t('ui.diveSites'),
      milestone: t('widgets.milestone', { count: previousMilestone + MILESTONE_STEP }),
      toGo: t('widgets.toGo', { count: previousMilestone + MILESTONE_STEP - total }),
    },
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
    return { label: shortMonthName(month + 1), dives: count };
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
      ? t('widgets.busiest', { month: busiest.label, dives: t('common.diveCount', { count: busiest.dives }) })
      : '',
    url: input.links.url('/statistics'),
    text: {
      caption: t('widgets.activity'),
      inYear: t('widgets.inYear', { year: today.year }),
      comparison:
        thisYear === lastYear
          ? t('widgets.sameAsLastYear', { count: lastYear })
          : thisYear > lastYear
            ? t('widgets.moreThanLastYear', { count: thisYear - lastYear })
            : t('widgets.fewerThanLastYear', { count: lastYear - thisYear }),
      hoursIn12: t('widgets.hoursIn12', { hours: formatTotalHours(seconds) }),
      none: t('widgets.noneIn12'),
      lastYear: t('widgets.lastYear'),
      months12: t('widgets.months12'),
      busiest: t('widgets.busiestLabel'),
    },
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
      title: t('widgets.noDives'),
      dateText: '',
      numberText: '',
      url: input.links.url('/dives'),
      text: surfaceIntervalText(''),
    };
  }
  return {
    hasDive: true,
    endedAt: diveEndInstant(dive, input.timezoneOffsetMinutes, input.now),
    title: diveRowTitle(dive),
    dateText: formatDate(dive.when),
    numberText: numberText(dive),
    url: diveUrl(dive, input.links),
    text: surfaceIntervalText(t('widgets.since', { title: diveRowTitle(dive) })),
  };
}

function surfaceIntervalText(since: string): SurfaceIntervalWidgetProps['text'] {
  return {
    caption: t('widgets.surfaceIntervalCaption'),
    title: t('widgets.surfaceInterval'),
    since,
    empty: t('widgets.nextDive'),
    noDives: t('widgets.noDives'),
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
