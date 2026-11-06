// AI-generated (Claude)
// Presentation model of the dive list.
//
// Pure functions only - no React, no native module. The native module owns the
// dives (see modules/ssrf-core/cpp/API.md); this file only decides how the rows
// it hands over are ordered, grouped and rendered, which is what the vitest
// suite can check without a device.

import type { DiveSummary } from './index';
import { formatDepth, formatDuration, type UnitSystem } from './units';

/** Section label used for dives that belong to no trip. */
export const NO_TRIP_LABEL = 'Not in a trip';

/** Title of a trip nobody has named: a dive without a site starts one. */
export const UNTITLED_TRIP_LABEL = 'Untitled trip';

/** A trip's location as a title. */
export function tripTitle(location: string): string {
  const trimmed = location.trim();
  return trimmed === '' ? UNTITLED_TRIP_LABEL : trimmed;
}

export type DiveTripSection = {
  /** Stable within one loaded log. */
  key: string;
  /** The trip this section shows, 0 for a run of dives outside any trip. */
  tripId: number;
  title: string;
  /** Unix seconds of the newest and oldest dive in the section. */
  newestWhen: number;
  oldestWhen: number;
  dives: DiveSummary[];
};

/** Newest dive first, ties broken by dive number so the order is total. */
export function sortDivesNewestFirst(dives: readonly DiveSummary[]): DiveSummary[] {
  return [...dives].sort((a, b) => b.when - a.when || b.number - a.number || b.id - a.id);
}

/**
 * Groups dives into trip sections.
 *
 * A trip gets one section however its dives fall in time: its place is that of
 * its newest dive, and every dive of the trip is in it - the same tree desktop
 * Subsurface shows. Two trips with one location stay two sections, and a trip
 * with no location is still a trip. A dive added from the trip picker can lie
 * outside the trip's former date range, so a trip need not be contiguous.
 *
 * Dives without a trip fall into runs of their own, ended by the next trip that
 * starts; a dive of a trip already listed does not end a run.
 *
 * Input order does not matter; the result is newest-first, and so is every
 * section.
 */
export function groupDivesByTrip(dives: readonly DiveSummary[]): DiveTripSection[] {
  const sorted = sortDivesNewestFirst(dives);
  const sections: DiveTripSection[] = [];
  const trips = new Map<number, DiveTripSection>();
  let run: DiveTripSection | null = null;

  for (const dive of sorted) {
    const existing = dive.tripId !== 0 ? trips.get(dive.tripId) : run;
    if (existing) {
      existing.dives.push(dive);
      existing.oldestWhen = dive.when;
      continue;
    }

    const section: DiveTripSection = {
      key: dive.tripId !== 0 ? `trip-${dive.tripId}` : `dive-${dive.id}`,
      tripId: dive.tripId,
      title: dive.tripId !== 0 ? tripTitle(dive.tripLocation) : NO_TRIP_LABEL,
      newestWhen: dive.when,
      oldestWhen: dive.when,
      dives: [dive],
    };
    sections.push(section);
    if (dive.tripId !== 0) {
      trips.set(dive.tripId, section);
      run = null;
    } else {
      run = section;
    }
  }

  return sections;
}

// --- Row rendering ---------------------------------------------------------

export type DiveRow = {
  id: number;
  /** Site name, falling back to the trip location and then to a placeholder. */
  title: string;
  /** Local date of the dive, e.g. "12 Mar 2024". */
  dateText: string;
  /** Local time of the dive, e.g. "09:14". */
  timeText: string;
  /** The line under the title: date and time, e.g. "12 Mar 2024, 09:14". */
  subtitle: string;
  /** "#12" or an empty string when the dive is unnumbered. */
  numberText: string;
  /**
   * The dive number for the list's leading badge, e.g. "12". The badge is
   * always drawn so the rows line up; an unnumbered dive shows "-".
   */
  badgeText: string;
  /** e.g. "20.1 m", or an empty string when the depth is unknown. */
  depthText: string;
  /** e.g. "42:15", or an empty string when the duration is unknown. */
  durationText: string;
  /** 0-5, as stored; the UI draws the stars. */
  rating: number;
  invalid: boolean;
  /**
   * What VoiceOver reads for the row. The visual row is glanceable shorthand -
   * "#12", a run of stars, "20.1 m - 42:15" - which a screen reader would
   * either spell out or skip, so the same facts are written out here as a
   * sentence and set as the row's accessibility label.
   */
  accessibilityLabel: string;
};

/**
 * `dive::when` is not a UTC instant: the core stores the wall-clock time the
 * dive was logged at as if it were UTC (`utc_mktime()` on the local fields -
 * parse-xml for SSRF `time='...'`, libdivecomputer and the Suunto JSON importer
 * alike), and desktop Subsurface reads it back with the UTC calendar. Formatting
 * it in the phone's zone would shift every dive by the phone's offset, so it is
 * formatted in UTC: a dive at 15:25 in Egypt reads 15:25 wherever the phone is.
 */
export function formatDate(when: number, locale?: string): string {
  return new Date(when * 1000).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatTime(when: number, locale?: string): string {
  return new Date(when * 1000).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

export function diveRowTitle(dive: DiveSummary): string {
  const site = dive.siteName.trim();
  if (site !== '') {
    return site;
  }
  const trip = dive.tripLocation.trim();
  return trip !== '' ? trip : 'Unnamed dive';
}

export function toDiveRow(
  dive: DiveSummary,
  system: UnitSystem = 'metric',
  locale?: string
): DiveRow {
  const depthText = dive.maxDepthMm > 0 ? formatDepth(dive.maxDepthMm, system) : '';
  const durationText = dive.durationSec > 0 ? formatDuration(dive.durationSec) : '';

  const title = diveRowTitle(dive);
  const dateText = formatDate(dive.when, locale);
  const timeText = formatTime(dive.when, locale);

  const spoken: string[] = [title, `${dateText} at ${timeText}`];
  if (dive.number > 0) {
    spoken.push(`dive number ${dive.number}`);
  }
  if (depthText !== '') {
    spoken.push(`maximum depth ${depthText}`);
  }
  if (dive.durationSec > 0) {
    spoken.push(`duration ${spokenDuration(dive.durationSec)}`);
  }
  if (dive.rating > 0) {
    spoken.push(`rated ${Math.round(dive.rating)} of 5`);
  }
  if (dive.invalid) {
    spoken.push('marked invalid');
  }

  return {
    id: dive.id,
    title,
    dateText,
    timeText,
    subtitle: `${dateText}, ${timeText}`,
    numberText: dive.number > 0 ? `#${dive.number}` : '',
    badgeText: dive.number > 0 ? String(dive.number) : '-',
    depthText,
    durationText,
    rating: dive.rating,
    invalid: dive.invalid,
    accessibilityLabel: spoken.join(', '),
  };
}

/**
 * A row of a list that is already about one site, where the site name would
 * repeat on every row: the date leads instead, over the trip it belonged to.
 */
export function toSiteDiveRow(
  dive: DiveSummary,
  system: UnitSystem = 'metric',
  locale?: string
): DiveRow {
  const row = toDiveRow(dive, system, locale);
  return { ...row, title: row.subtitle, subtitle: dive.tripLocation.trim() };
}

/** "42 minutes" rather than "42:15", which VoiceOver reads as a time of day. */
function spokenDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const minuteText = `${rest} ${rest === 1 ? 'minute' : 'minutes'}`;
  if (hours === 0) {
    return minuteText;
  }
  const hourText = `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return rest === 0 ? hourText : `${hourText} ${minuteText}`;
}

/** "3 dives - 12 Mar 2024" or, for a range, "... - 12-15 Mar 2024". */
export function sectionSubtitle(section: DiveTripSection, locale?: string): string {
  const count = `${section.dives.length} ${section.dives.length === 1 ? 'dive' : 'dives'}`;
  const newest = formatDate(section.newestWhen, locale);
  const oldest = formatDate(section.oldestWhen, locale);
  return newest === oldest ? `${count} - ${newest}` : `${count} - ${oldest} to ${newest}`;
}

// --- Search ----------------------------------------------------------------

export type DiveSearchEntry = {
  dive: DiveSummary;
  /** Everything the dive can be found by, lowercased, one field per line. */
  text: string;
};

/**
 * Precomputes what each dive can be searched by: site, trip, buddy, dive guide,
 * the dive number, and its date written several ways ("12 Mar 2024", "March",
 * "2024-03-12" and the locale's numeric form, e.g. "12/03/2024"). Building
 * this once per dive list keeps a keystroke from re-formatting every date.
 */
export function buildDiveSearchIndex(
  dives: readonly DiveSummary[],
  locale?: string
): DiveSearchEntry[] {
  return dives.map((dive) => {
    const date = new Date(dive.when * 1000);
    const fields = [
      dive.siteName,
      dive.tripLocation,
      dive.buddy,
      dive.diveguide,
      dive.number > 0 ? `#${dive.number}` : '',
      formatDate(dive.when, locale),
      date.toLocaleDateString(locale, { month: 'long', timeZone: 'UTC' }),
      date.toISOString().slice(0, 10),
      date.toLocaleDateString(locale, { timeZone: 'UTC' }),
    ];
    return { dive, text: fields.join('\n').toLowerCase() };
  });
}

/**
 * The dives matching a free-text query. Every whitespace-separated word has to
 * appear somewhere in the dive's searchable fields, so "anna 2024" finds the
 * dives with Anna in 2024. A blank query matches everything. Input order is
 * kept.
 */
export function searchDives(index: readonly DiveSearchEntry[], query: string): DiveSummary[] {
  const words = query.toLowerCase().split(/\s+/).filter((word) => word !== '');
  if (words.length === 0) {
    return index.map((entry) => entry.dive);
  }
  return index
    .filter((entry) => words.every((word) => entry.text.includes(word)))
    .map((entry) => entry.dive);
}

/** "1 dive found", "12 of 340 dives". */
export function searchResultsText(found: number, total: number): string {
  if (found === total) {
    return `${found} ${found === 1 ? 'dive' : 'dives'} found`;
  }
  return `${found} of ${total} ${total === 1 ? 'dive' : 'dives'}`;
}

/** Five slots, filled according to the dive's 0-5 rating. */
export function ratingStars(rating: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return '*'.repeat(filled);
}

/**
 * Stand-in rows for the loading skeleton. The views draw them redacted, so only
 * the length of each text matters: it sets the width of the grey bar. The
 * lengths vary a little so the skeleton reads as a list rather than a pattern.
 */
export function skeletonRows(count = 8): DiveRow[] {
  const titles = ['Placeholder site', 'Reef', 'A longer dive site name', 'House reef north'];
  return Array.from({ length: count }, (_, i) => ({
    id: -1 - i,
    title: titles[i % titles.length],
    dateText: '12 Mar 2024',
    timeText: '09:14',
    subtitle: '12 Mar 2024, 09:14',
    numberText: '',
    badgeText: '000',
    depthText: '20.1 m',
    durationText: '42:15',
    rating: 0,
    invalid: false,
    accessibilityLabel: '',
  }));
}
