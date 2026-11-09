// AI-generated (Claude)
// Presentation model of trips: what the list, the dive detail, the trip detail
// and the trip picker say and offer.
//
// Pure functions only - no React, no native module. The trips themselves, and
// what happens to one that loses its last dive, are the core's business (see
// modules/ssrf-core/cpp/API.md). Totals come out of statistics.cpp; nothing is
// aggregated here.

import { formatDate, sortDivesNewestFirst, tripTitle } from './dive-list';
import type { DiveSummary, StatsSummary, Trip, TripPatch } from './index';
import { formatDepth, formatTemperature, type Units } from './units';
import { formatTotalTime } from './statistics';

export { tripTitle };

export function diveCountText(count: number): string {
  return `${count} ${count === 1 ? 'dive' : 'dives'}`;
}

/** "12 Mar 2024", or "12 Mar 2024 to 15 Mar 2024" for a trip over several days. */
export function tripDateText(trip: Trip, locale?: string): string {
  const first = formatDate(trip.when, locale);
  const last = formatDate(trip.lastDiveWhen, locale);
  return first === last ? first : `${first} to ${last}`;
}

/** "3 dives - 12 Mar 2024", the same line a section header of the list has. */
export function tripSubtitle(trip: Trip, locale?: string): string {
  return `${diveCountText(trip.diveCount)} - ${tripDateText(trip, locale)}`;
}

// --- Ordering and search ---------------------------------------------------

/** Seconds between the span of the dives and the trip; 0 when they overlap. */
function gapToTrip(trip: Trip, from: number, to: number): number {
  if (to < trip.when) {
    return trip.when - to;
  }
  return from > trip.lastDiveWhen ? from - trip.lastDiveWhen : 0;
}

/**
 * The trips a set of dives can go to, the one closest in time first: that is
 * nearly always the one meant, and the trip above or below in the list is among
 * the first. A trip holding all of the dives already is left out. Equally close
 * trips go newest first, the order of the dive list.
 */
export function nearestTrips(trips: readonly Trip[], dives: readonly DiveSummary[]): Trip[] {
  if (dives.length === 0) {
    return [...trips].sort((a, b) => b.when - a.when || b.id - a.id);
  }
  const whens = dives.map((dive) => dive.when);
  const from = Math.min(...whens);
  const to = Math.max(...whens);
  const onlyTrip = dives.every((dive) => dive.tripId === dives[0].tripId) ? dives[0].tripId : 0;
  return trips
    .filter((trip) => trip.id !== onlyTrip)
    .sort(
      (a, b) =>
        gapToTrip(a, from, to) - gapToTrip(b, from, to) || b.when - a.when || b.id - a.id,
    );
}

/** Every word has to appear in the trip's location or its dates. */
export function searchTrips(trips: readonly Trip[], query: string, locale?: string): Trip[] {
  const words = query.toLowerCase().split(/\s+/).filter((word) => word !== '');
  return trips.filter((trip) => {
    const text = `${trip.location}\n${tripDateText(trip, locale)}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

/** What the picker says when it has no trip to list. */
export function emptyPickerText(hasCandidates: boolean, searching: boolean): string {
  if (searching && hasCandidates) {
    return 'No trip matches.';
  }
  return 'No other trips yet. A new trip starts with these dives.';
}

// --- Trips above and below -------------------------------------------------

export type AdjacentTrips = {
  /** The trip of the next newer dive: the one above in the list. */
  above?: Trip;
  /** The trip of the next older dive: the one below in the list. */
  below?: Trip;
};

/**
 * For each dive outside a trip, the trips of its neighbours in the list. These
 * are the legacy app's "add to trip above" and "below", looked at across the
 * whole log so that a search narrowing the list does not change what is on offer.
 */
export function adjacentTripsByDive(
  dives: readonly DiveSummary[],
  trips: readonly Trip[],
): Map<number, AdjacentTrips> {
  const byId = new Map(trips.map((trip) => [trip.id, trip]));
  const sorted = sortDivesNewestFirst(dives);
  const out = new Map<number, AdjacentTrips>();
  sorted.forEach((dive, index) => {
    if (dive.tripId !== 0) {
      return;
    }
    const above = byId.get(sorted[index - 1]?.tripId ?? 0);
    const below = byId.get(sorted[index + 1]?.tripId ?? 0);
    if (above || below) {
      // Between two dives of one trip the two offers are the same offer.
      out.set(dive.id, above?.id === below?.id ? { above } : { above, below });
    }
  });
  return out;
}

// --- What a dive offers ----------------------------------------------------

export type TripAction =
  | { kind: 'open'; label: string; symbol: 'suitcase'; tripId: number }
  | { kind: 'new'; label: string; symbol: 'plus' }
  | { kind: 'pick'; label: string; symbol: 'text.badge.plus' }
  | { kind: 'add'; label: string; symbol: 'arrow.up' | 'arrow.down'; tripId: number }
  | { kind: 'remove'; label: string; symbol: 'minus.circle' };

/** The trip actions of one dive, in the order a menu shows them. */
export function tripActionsFor(dive: DiveSummary, adjacent?: AdjacentTrips): TripAction[] {
  if (dive.tripId !== 0) {
    return [
      { kind: 'open', label: 'View Trip', symbol: 'suitcase', tripId: dive.tripId },
      { kind: 'pick', label: 'Move to Trip', symbol: 'text.badge.plus' },
      { kind: 'remove', label: 'Remove from Trip', symbol: 'minus.circle' },
    ];
  }
  const actions: TripAction[] = [];
  if (adjacent?.above) {
    actions.push({
      kind: 'add',
      label: `Add to ${tripTitle(adjacent.above.location)}`,
      symbol: 'arrow.up',
      tripId: adjacent.above.id,
    });
  }
  if (adjacent?.below) {
    actions.push({
      kind: 'add',
      label: `Add to ${tripTitle(adjacent.below.location)}`,
      symbol: 'arrow.down',
      tripId: adjacent.below.id,
    });
  }
  actions.push(
    { kind: 'pick', label: 'Add to Trip', symbol: 'text.badge.plus' },
    { kind: 'new', label: 'New Trip', symbol: 'plus' },
  );
  return actions;
}

/** The picker's title: dives in a trip move, dives outside one are added. */
export function tripPickerTitle(dives: readonly DiveSummary[]): string {
  return dives.some((dive) => dive.tripId !== 0) ? 'Move to Trip' : 'Add to Trip';
}

// --- Trip summary ----------------------------------------------------------

export type TripSummaryRow = { label: string; value: string };

/**
 * The summary rows of a trip. Dates and count are the trip's own, the rest are
 * the core's statistics - which skip invalid dives, as they do everywhere; a
 * figure the dives do not carry is left out rather than shown as zero.
 */
export function tripSummaryRows(
  trip: Trip,
  stats: StatsSummary | undefined,
  units: Units,
  locale?: string,
): TripSummaryRow[] {
  const rows: TripSummaryRow[] = [
    { label: 'Dates', value: tripDateText(trip, locale) },
    { label: 'Dives', value: String(trip.diveCount) },
  ];
  const total = stats?.total;
  if (!total) {
    return rows;
  }
  if (total.totalTimeSec > 0) {
    rows.push({ label: 'Total time', value: formatTotalTime(total.totalTimeSec) });
  }
  if (total.maxDepthMm > 0) {
    rows.push({ label: 'Deepest', value: formatDepth(total.maxDepthMm, units) });
  }
  if (total.avgDepthMm > 0) {
    rows.push({ label: 'Average depth', value: formatDepth(total.avgDepthMm, units) });
  }
  if (total.minTempMkelvin > 0) {
    rows.push({ label: 'Coldest water', value: formatTemperature(total.minTempMkelvin, units) });
  }
  return rows;
}

/** The line under the summary when the totals do not cover every dive. */
export function tripSummaryFooter(trip: Trip, stats: StatsSummary | undefined): string | undefined {
  if (!stats || stats.matched >= trip.diveCount) {
    return undefined;
  }
  const skipped = trip.diveCount - stats.matched;
  return `Totals leave out ${diveCountText(skipped)} marked invalid.`;
}

// --- Editor ----------------------------------------------------------------

export type TripDraft = { location: string; notes: string };

export function tripDraftFrom(trip: Trip): TripDraft {
  return { location: trip.location, notes: trip.notes };
}

/** The smallest patch, so an untouched field is not written back. */
export function buildTripPatch(trip: Trip, draft: TripDraft): TripPatch {
  const patch: TripPatch = {};
  const location = draft.location.trim();
  const notes = draft.notes.trim();
  if (location !== trip.location.trim()) {
    patch.location = location;
  }
  if (notes !== trip.notes.trim()) {
    patch.notes = notes;
  }
  return patch;
}

// --- Route parameter -------------------------------------------------------

/** The picker takes its dives as "1,2,3" in a route parameter. */
export function formatDiveIds(ids: readonly number[]): string {
  return ids.join(',');
}

export function parseDiveIds(param: string | string[] | undefined): number[] {
  const text = Array.isArray(param) ? param.join(',') : (param ?? '');
  return text
    .split(',')
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);
}
