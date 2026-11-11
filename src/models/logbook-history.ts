// AI-generated (Claude)
// What the undo history says, in a diver's words.
//
// The bindings report the facts of a change (cpp/bindings/history.cpp); the wording is
// here, so that it is plain data to test. A kind with no case below is a mutation
// nobody has written words for yet: it still undoes, under a general label.

import type { HistoryEntry, HistoryState } from './index';
import { t } from '@/i18n';

export type HistoryDirection = 'undo' | 'redo';

/** updateDive filed under this: a tag the SSI upload adds, not an edit of the diver's. */
export const SSI_TAG_KIND = 'ssiSyncTag';

function capitalized(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

/** "Dive 42", or the site for a dive with no number. */
function diveName(entry: HistoryEntry): string {
  if (entry.diveNumber) {
    return t('history.dive.number', { number: entry.diveNumber });
  }
  return entry.diveSite ? t('history.dive.atSite', { site: entry.diveSite }) : t('history.dive.plain');
}

function mergedName(entry: HistoryEntry): string {
  const numbers = entry.diveNumbers ?? [];
  return numbers.length >= 2
    ? t('history.dives.merged', { list: numbers.slice(0, -1).join(', '), last: numbers[numbers.length - 1] })
    : t('history.dives.plain');
}

/** In a menu title ("Dive Site Blue Hole") or inside a sentence ("dive site Blue Hole"). */
function siteName(entry: HistoryEntry, title: boolean): string {
  const name = entry.siteName?.trim() ?? '';
  if (name === '') {
    return title ? t('history.site.titlePlain') : t('history.site.inlinePlain');
  }
  return title ? t('history.site.title', { name }) : t('history.site.inline', { name });
}

function tripName(entry: HistoryEntry, title: boolean): string {
  const location = entry.tripLocation?.trim() ?? '';
  if (location === '') {
    return title ? t('history.trip.titlePlain') : t('history.trip.inlinePlain');
  }
  return title ? t('history.trip.title', { location }) : t('history.trip.inline', { location });
}

/** "Dive" for one, "3 Dives" for more. */
function diveCountName(entry: HistoryEntry, title: boolean): string {
  const count = entry.diveCount ?? 0;
  return title ? t('history.count.title', { count }) : t('history.count.inline', { count });
}

function added(entry: HistoryEntry): number {
  return Math.max(0, entry.divesAfter - entry.divesBefore);
}

/** Names the change, for a menu: "Delete Dive 42" reads after "Undo". */
export function changeTitle(entry: HistoryEntry): string {
  switch (entry.kind) {
    case 'addDive':
      return t('history.title.addDive');
    case 'updateDive':
      return t('history.title.updateDive', { dive: diveName(entry) });
    case 'deleteDive':
      return t('history.title.deleteDive', { dive: diveName(entry) });
    case 'mergeDives':
      return t('history.title.mergeDives', { dives: mergedName(entry) });
    case 'makeFirstDiveComputer':
      return t('history.title.makeFirstComputer', { dive: diveName(entry) });
    case SSI_TAG_KIND:
      return t('history.title.ssiTag', { dive: diveName(entry) });
    case 'upsertDiveSite':
      return entry.isNew
        ? t('history.title.addSite', { site: siteName(entry, true) })
        : t('history.title.editSite', { site: siteName(entry, true) });
    case 'deleteDiveSite':
      return t('history.title.deleteSite', { site: siteName(entry, true) });
    case 'createTrip':
      return t('history.title.createTrip', { trip: tripName(entry, true) });
    case 'addDivesToTrip':
      return t('history.title.addToTrip', { dives: diveCountName(entry, true), trip: tripName(entry, true) });
    case 'removeDivesFromTrip':
      return t('history.title.removeFromTrip', { dives: diveCountName(entry, true) });
    case 'updateTrip':
      return t('history.title.updateTrip', { trip: tripName(entry, true) });
    case 'ungroupDives':
      return t('history.title.ungroup');
    case 'importFile':
    case 'importSuunto':
      return added(entry) > 0 ? t('history.title.importCount', { count: added(entry) }) : t('history.title.import');
    case 'dcDownloadAccept':
      return added(entry) > 0
        ? t('history.title.downloadCount', { count: added(entry) })
        : t('history.title.download');
    case 'savePlan':
      return t('history.title.savePlan');
    default:
      return t('history.title.other');
  }
}

/** Says it happened, for the toast: "Dive 42 deleted". */
export function changeDone(entry: HistoryEntry): string {
  switch (entry.kind) {
    case 'addDive':
      return t('history.done.addDive');
    case 'updateDive':
      return t('history.done.updateDive', { dive: diveName(entry) });
    case 'deleteDive':
      return t('history.done.deleteDive', { dive: diveName(entry) });
    case 'mergeDives':
      return t('history.done.mergeDives', { dives: mergedName(entry) });
    case 'makeFirstDiveComputer': {
      const model = entry.computerModel?.trim() ?? '';
      return model === ''
        ? t('history.done.makeFirstComputer', { dive: diveName(entry) })
        : t('history.done.makeFirstComputerModel', { model, dive: diveName(entry) });
    }
    case SSI_TAG_KIND:
      return t('history.done.ssiTag', { dive: diveName(entry) });
    case 'upsertDiveSite': {
      const site = capitalized(siteName(entry, false));
      return entry.isNew ? t('history.done.siteAdded', { site }) : t('history.done.siteUpdated', { site });
    }
    case 'deleteDiveSite': {
      const site = capitalized(siteName(entry, false));
      return entry.siteDives
        ? t('history.done.siteDeletedDives', { site, count: entry.siteDives })
        : t('history.done.siteDeleted', { site });
    }
    case 'createTrip':
      return t('history.done.tripCreated', { trip: capitalized(tripName(entry, false)) });
    case 'addDivesToTrip':
      return t('history.done.movedToTrip', {
        dives: capitalized(diveCountName(entry, false)),
        trip: tripName(entry, false),
      });
    case 'removeDivesFromTrip':
      return t('history.done.removedFromTrip', { dives: capitalized(diveCountName(entry, false)) });
    case 'updateTrip':
      return t('history.done.tripUpdated', { trip: capitalized(tripName(entry, false)) });
    case 'ungroupDives':
      return t('history.done.ungrouped');
    case 'importFile':
    case 'importSuunto':
      return added(entry) > 0 ? t('history.done.imported', { count: added(entry) }) : t('history.done.importedNone');
    case 'dcDownloadAccept':
      return added(entry) > 0
        ? t('history.done.downloaded', { count: added(entry) })
        : t('history.done.downloadedNone');
    case 'savePlan':
      return t('history.done.savePlan');
    default:
      return t('history.done.other');
  }
}

export function undoTitle(entry: HistoryEntry): string {
  return t('history.undoTitle', { title: changeTitle(entry) });
}

export function redoTitle(entry: HistoryEntry): string {
  return t('history.redoTitle', { title: changeTitle(entry) });
}

/**
 * A change the diver did not make as such, with its own confirmation on screen, gets
 * no toast. It is still in the history, as what it is.
 */
function isQuiet(entry: HistoryEntry): boolean {
  return entry.kind === SSI_TAG_KIND;
}

export type HistoryToast = {
  /** A new one replaces the last, and starts its time over. */
  key: number;
  message: string;
  action: HistoryDirection;
  actionLabel: string;
  /** The action in full, for VoiceOver, where "Undo" alone says too little. */
  actionAccessibilityLabel: string;
  /** Spoken as it appears, since a screen reader user may be elsewhere on screen. */
  announcement: string;
};

/** What to show now that the history is `state`, or null for nothing. */
export function historyToast(state: HistoryState): HistoryToast | null {
  switch (state.lastAction) {
    case 'change':
    case 'redo': {
      const entry = state.undo;
      if (!entry || isQuiet(entry)) {
        return null;
      }
      const message = changeDone(entry);
      return {
        key: state.revision,
        message,
        action: 'undo',
        actionLabel: t('history.undo'),
        actionAccessibilityLabel: undoTitle(entry),
        announcement: t('history.undoAvailable', { message }),
      };
    }
    case 'undo': {
      const entry = state.redo;
      if (!entry) {
        return null;
      }
      const message = t('history.undid', { title: changeTitle(entry) });
      return {
        key: state.revision,
        message,
        action: 'redo',
        actionLabel: t('history.redo'),
        actionAccessibilityLabel: redoTitle(entry),
        announcement: t('history.redoAvailable', { message }),
      };
    }
    default:
      return null;
  }
}

/** The dive's own screen, given its editor's: where an undone delete goes back to. */
export function diveScreenOfEditor(editorPath: string): string {
  return editorPath.replace('/edit/', '/');
}
