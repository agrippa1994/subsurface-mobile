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

export type DiveTripSection = {
  /** Stable within one loaded log: the id of the section's first dive. */
  key: string;
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
 * `listDives()` exposes a trip only through its location string, so trips are
 * reconstructed from *runs* of time-adjacent dives that share one location
 * rather than by bucketing on the string. A trip is contiguous in time by
 * construction in the core, so two separate visits to the same place stay two
 * sections instead of collapsing into one. Dives with no trip fall into runs of
 * their own, which is also why consecutive trip-less dives end up in a single
 * section.
 *
 * Input order does not matter; the result is newest-first, and so is every
 * section.
 */
export function groupDivesByTrip(dives: readonly DiveSummary[]): DiveTripSection[] {
  const sorted = sortDivesNewestFirst(dives);
  const sections: DiveTripSection[] = [];

  for (const dive of sorted) {
    const location = dive.tripLocation.trim();
    const title = location === '' ? NO_TRIP_LABEL : location;
    const previous = sections[sections.length - 1];

    if (previous && previous.title === title) {
      previous.dives.push(dive);
      previous.oldestWhen = dive.when;
      continue;
    }

    sections.push({
      key: String(dive.id),
      title,
      newestWhen: dive.when,
      oldestWhen: dive.when,
      dives: [dive],
    });
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
  /** "#12" or an empty string when the dive is unnumbered. */
  numberText: string;
  /** e.g. "20.1 m - 42:15". */
  detailText: string;
  /** 0-5, as stored; the UI draws the stars. */
  rating: number;
  invalid: boolean;
};

/**
 * Dive timestamps are Unix seconds in UTC (`dive::when`). Desktop Subsurface
 * shows them in the diver's own local time, which for a logbook read on a phone
 * means the device timezone - the same choice the mobile app has always made.
 */
function formatDate(when: number, locale?: string): string {
  return new Date(when * 1000).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(when: number, locale?: string): string {
  return new Date(when * 1000).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
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
  const parts: string[] = [];
  if (dive.maxDepthMm > 0) {
    parts.push(formatDepth(dive.maxDepthMm, system));
  }
  if (dive.durationSec > 0) {
    parts.push(formatDuration(dive.durationSec));
  }

  return {
    id: dive.id,
    title: diveRowTitle(dive),
    dateText: formatDate(dive.when, locale),
    timeText: formatTime(dive.when, locale),
    numberText: dive.number > 0 ? `#${dive.number}` : '',
    detailText: parts.join(' - '),
    rating: dive.rating,
    invalid: dive.invalid,
  };
}

/** "3 dives - 12 Mar 2024" or, for a range, "... - 12-15 Mar 2024". */
export function sectionSubtitle(section: DiveTripSection, locale?: string): string {
  const count = `${section.dives.length} ${section.dives.length === 1 ? 'dive' : 'dives'}`;
  const newest = formatDate(section.newestWhen, locale);
  const oldest = formatDate(section.oldestWhen, locale);
  return newest === oldest ? `${count} - ${newest}` : `${count} - ${oldest} to ${newest}`;
}

/** Five slots, filled according to the dive's 0-5 rating. */
export function ratingStars(rating: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return '*'.repeat(filled);
}
