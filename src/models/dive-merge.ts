// AI-generated (Claude)
// Presentation model of merging dives: which merges a dive offers, and what the
// question before one says.
//
// Pure functions only - no React, no native module. Which dives may merge and what
// the merged dive looks like are the core's business: the pairs and the preview
// come from the bindings (see modules/ssrf-core/cpp/API.md, mergeDives).

import { diveRowTitle, toDiveRow, tripTitle } from './dive-list';
import type { DiveSummary, MergePair, MergePreview, Trip } from './index';
import { formatDepth, formatDuration, type Units } from './units';

export type MergeAction = {
  kind: 'next' | 'previous';
  label: string;
  symbol: 'arrow.triangle.merge';
  otherId: number;
  /** The other dive and how far it is from this one, for a row with room for it. */
  detail: string;
};

type MergeNeighbours = { next?: MergePair; previous?: MergePair };

/** For each dive, the pairs it is part of. */
export function mergeNeighbours(pairs: readonly MergePair[]): Map<number, MergeNeighbours> {
  const out = new Map<number, MergeNeighbours>();
  for (const pair of pairs) {
    out.set(pair.earlierId, { ...out.get(pair.earlierId), next: pair });
    out.set(pair.laterId, { ...out.get(pair.laterId), previous: pair });
  }
  return out;
}

/** "5 min", rounded up: a gap of 20 seconds is still a gap. */
function gapText(seconds: number): string {
  return `${Math.ceil(seconds / 60)} min`;
}

function actionDetail(other: DiveSummary | undefined, kind: MergeAction['kind'], gap: number) {
  const relation =
    gap === 0
      ? 'Overlaps this dive'
      : kind === 'next'
        ? `Starts ${gapText(gap)} after this dive ends`
        : `Ended ${gapText(gap)} before this dive`;
  return other ? `${diveRowTitle(other)}. ${relation}` : relation;
}

/**
 * What one dive can merge with, the later dive first: the list runs newest first,
 * so that is the row above. Looked at across the whole log, so that a search
 * narrowing the list does not change what is on offer.
 */
export function mergeActionsFor(
  diveId: number,
  neighbours: ReadonlyMap<number, MergeNeighbours>,
  divesById: ReadonlyMap<number, DiveSummary>,
): MergeAction[] {
  const own = neighbours.get(diveId);
  const actions: MergeAction[] = [];
  if (own?.next) {
    actions.push({
      kind: 'next',
      label: 'Merge with Next Dive',
      symbol: 'arrow.triangle.merge',
      otherId: own.next.laterId,
      detail: actionDetail(divesById.get(own.next.laterId), 'next', own.next.surfaceIntervalSec),
    });
  }
  if (own?.previous) {
    actions.push({
      kind: 'previous',
      label: 'Merge with Previous Dive',
      symbol: 'arrow.triangle.merge',
      otherId: own.previous.earlierId,
      detail: actionDetail(
        divesById.get(own.previous.earlierId),
        'previous',
        own.previous.surfaceIntervalSec,
      ),
    });
  }
  return actions;
}

/** "Dive 12: Shark Reef, 12 Mar 2024, 09:14", with no number if it has none. */
function nameDive(dive: DiveSummary, units: Units, locale?: string): string {
  const row = toDiveRow(dive, units, locale);
  const name = `${row.title}, ${row.subtitle}`;
  return dive.number > 0 ? `Dive ${dive.number}: ${name}` : name;
}

export type MergeConfirmation = { title: string; message: string; confirmLabel: string };

/**
 * The question before a merge. There is no undo, so it names both dives and
 * everything that changes beyond them: a site or a trip the merged dive does not
 * keep, and numbers that move. `dives` are the dives being merged and `trips` all
 * trips; the preview says which of them the core keeps.
 */
export function mergeConfirmation(
  dives: readonly DiveSummary[],
  preview: MergePreview,
  trips: readonly Trip[],
  units: Units,
  locale?: string,
): MergeConfirmation {
  const merged = preview.dive;
  const ordered = [...dives].sort((a, b) => a.when - b.when || a.id - b.id);
  const lines = [ordered.map((dive) => nameDive(dive, units, locale)).join('\n')];

  const figures = `${formatDepth(merged.maxDepthMm, units)} deep, ${formatDuration(merged.durationSec)} long`;
  if (merged.dcs.length > 1) {
    lines.push(
      `They become one dive, ${figures}, keeping the recordings of ` +
        `${merged.dcs.length} dive computers.`,
    );
  } else if (preview.surfaceIntervalSec > 0) {
    lines.push(
      `They become one dive, ${figures}. Its profile keeps the ` +
        `${gapText(preview.surfaceIntervalSec)} on the surface between them.`,
    );
  } else {
    lines.push(`They become one dive, ${figures}.`);
  }
  lines.push('Notes, buddies, tags and cylinders are combined.');

  const otherSites = new Set(
    ordered
      .filter((dive) => dive.siteUuid !== 0 && dive.siteUuid !== merged.siteUuid)
      .map((dive) => dive.siteName.trim() || 'The other site'),
  );
  for (const site of otherSites) {
    lines.push(`It stays at ${merged.siteName.trim()}. ${site} stays in your sites without it.`);
  }

  const tripIds = new Set(ordered.map((dive) => dive.tripId));
  if (merged.tripId !== 0 && tripIds.size > 1) {
    lines.push(`It goes in the trip ${tripTitle(merged.tripLocation)}.`);
  }
  const ending = trips.filter(
    (trip) =>
      trip.id !== merged.tripId &&
      trip.diveCount === ordered.filter((dive) => dive.tripId === trip.id).length &&
      // A trip with neither has nothing to lose.
      (trip.location.trim() !== '' || trip.notes.trim() !== ''),
  );
  for (const trip of ending) {
    lines.push(`The trip ${tripTitle(trip.location)} ends, with its location and notes.`);
  }

  if (preview.renumberedDives > 0) {
    lines.push(
      preview.renumberedDives === 1
        ? '1 later dive gets a new number.'
        : `${preview.renumberedDives} later dives get a new number.`,
    );
  }

  return { title: 'Merge these dives?', message: lines.join('\n\n'), confirmLabel: 'Merge' };
}
