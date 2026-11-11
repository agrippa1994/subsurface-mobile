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
import { t } from '@/i18n';

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
  return t('common.minutesShort', { minutes: Math.ceil(seconds / 60) });
}

function actionDetail(other: DiveSummary | undefined, kind: MergeAction['kind'], gap: number) {
  const relation =
    gap === 0
      ? t('merge.overlaps')
      : kind === 'next'
        ? t('merge.startsAfter', { gap: gapText(gap) })
        : t('merge.endedBefore', { gap: gapText(gap) });
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
      label: t('merge.withNext'),
      symbol: 'arrow.triangle.merge',
      otherId: own.next.laterId,
      detail: actionDetail(divesById.get(own.next.laterId), 'next', own.next.surfaceIntervalSec),
    });
  }
  if (own?.previous) {
    actions.push({
      kind: 'previous',
      label: t('merge.withPrevious'),
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
function nameDive(dive: DiveSummary, units: Units): string {
  const row = toDiveRow(dive, units);
  const name = `${row.title}, ${row.subtitle}`;
  return dive.number > 0 ? t('merge.numbered', { number: dive.number, name }) : name;
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
): MergeConfirmation {
  const merged = preview.dive;
  const ordered = [...dives].sort((a, b) => a.when - b.when || a.id - b.id);
  const lines = [ordered.map((dive) => nameDive(dive, units)).join('\n')];

  const figures = t('merge.figures', {
    depth: formatDepth(merged.maxDepthMm, units),
    duration: formatDuration(merged.durationSec),
  });
  if (merged.dcs.length > 1) {
    lines.push(t('merge.becomeOneComputers', { figures, count: merged.dcs.length }));
  } else if (preview.surfaceIntervalSec > 0) {
    lines.push(t('merge.becomeOneInterval', { figures, gap: gapText(preview.surfaceIntervalSec) }));
  } else {
    lines.push(t('merge.becomeOne', { figures }));
  }
  lines.push(t('merge.combined'));

  const otherSites = new Set(
    ordered
      .filter((dive) => dive.siteUuid !== 0 && dive.siteUuid !== merged.siteUuid)
      .map((dive) => dive.siteName.trim() || t('merge.otherSite')),
  );
  for (const site of otherSites) {
    lines.push(t('merge.staysAt', { site: merged.siteName.trim(), other: site }));
  }

  const tripIds = new Set(ordered.map((dive) => dive.tripId));
  if (merged.tripId !== 0 && tripIds.size > 1) {
    lines.push(t('merge.goesInTrip', { trip: tripTitle(merged.tripLocation) }));
  }
  const ending = trips.filter(
    (trip) =>
      trip.id !== merged.tripId &&
      trip.diveCount === ordered.filter((dive) => dive.tripId === trip.id).length &&
      // A trip with neither has nothing to lose.
      (trip.location.trim() !== '' || trip.notes.trim() !== ''),
  );
  for (const trip of ending) {
    lines.push(t('merge.tripEnds', { trip: tripTitle(trip.location) }));
  }

  if (preview.renumberedDives > 0) {
    lines.push(t('merge.renumbered', { count: preview.renumberedDives }));
  }

  return { title: t('merge.confirmTitle'), message: lines.join('\n\n'), confirmLabel: t('merge.confirm') };
}
