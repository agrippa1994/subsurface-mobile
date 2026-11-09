// AI-generated (Claude)
// What the undo history says, in a diver's words.
//
// The bindings report the facts of a change (cpp/bindings/history.cpp); the wording is
// here, so that it is plain data to test. A kind with no case below is a mutation
// nobody has written words for yet: it still undoes, under a general label.

import type { HistoryEntry, HistoryState } from './index';

export type HistoryDirection = 'undo' | 'redo';

/** updateDive filed under this: a tag the SSI upload adds, not an edit of the diver's. */
export const SSI_TAG_KIND = 'ssiSyncTag';

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function capitalized(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

/** "Dive 42", or the site for a dive with no number. */
function diveName(entry: HistoryEntry): string {
  if (entry.diveNumber) {
    return `Dive ${entry.diveNumber}`;
  }
  return entry.diveSite ? `Dive at ${entry.diveSite}` : 'Dive';
}

function mergedName(entry: HistoryEntry): string {
  const numbers = entry.diveNumbers ?? [];
  return numbers.length >= 2
    ? `Dives ${numbers.slice(0, -1).join(', ')} and ${numbers[numbers.length - 1]}`
    : 'Dives';
}

function siteName(entry: HistoryEntry, capital: boolean): string {
  const name = entry.siteName?.trim() ?? '';
  const noun = capital ? 'Dive Site' : 'dive site';
  return name === '' ? noun : `${noun} ${name}`;
}

function tripName(entry: HistoryEntry, capital: boolean): string {
  const location = entry.tripLocation?.trim() ?? '';
  const noun = capital ? 'Trip' : 'trip';
  return location === '' ? noun : `${noun} ${location}`;
}

function diveCountName(entry: HistoryEntry, capital: boolean): string {
  const count = entry.diveCount ?? 0;
  const noun = capital ? 'Dive' : 'dive';
  return count === 1 ? noun : plural(count, noun);
}

function added(entry: HistoryEntry): number {
  return Math.max(0, entry.divesAfter - entry.divesBefore);
}

/** Names the change, for a menu: "Delete Dive 42" reads after "Undo". */
export function changeTitle(entry: HistoryEntry): string {
  switch (entry.kind) {
    case 'addDive':
      return 'Add Dive';
    case 'updateDive':
      return `Edit ${diveName(entry)}`;
    case 'deleteDive':
      return `Delete ${diveName(entry)}`;
    case 'mergeDives':
      return `Merge ${mergedName(entry)}`;
    case 'makeFirstDiveComputer':
      return `Change First Computer of ${diveName(entry)}`;
    case SSI_TAG_KIND:
      return `Mark ${diveName(entry)} as Synced to SSI`;
    case 'upsertDiveSite':
      return `${entry.isNew ? 'Add' : 'Edit'} ${siteName(entry, true)}`;
    case 'deleteDiveSite':
      return `Delete ${siteName(entry, true)}`;
    case 'createTrip':
      return `New ${tripName(entry, true)}`;
    case 'addDivesToTrip':
      return `Move ${diveCountName(entry, true)} to ${tripName(entry, true)}`;
    case 'removeDivesFromTrip':
      return `Remove ${diveCountName(entry, true)} from Trip`;
    case 'updateTrip':
      return `Edit ${tripName(entry, true)}`;
    case 'ungroupDives':
      return 'Ungroup All Trips';
    case 'importFile':
    case 'importSuunto':
      return added(entry) > 0 ? `Import ${plural(added(entry), 'Dive')}` : 'Import';
    case 'dcDownloadAccept':
      return added(entry) > 0 ? `Download ${plural(added(entry), 'Dive')}` : 'Download';
    case 'savePlan':
      return 'Add Planned Dive';
    default:
      return 'Change to the Logbook';
  }
}

/** Says it happened, for the toast: "Dive 42 deleted". */
export function changeDone(entry: HistoryEntry): string {
  switch (entry.kind) {
    case 'addDive':
      return 'Dive added';
    case 'updateDive':
      return `${diveName(entry)} updated`;
    case 'deleteDive':
      return `${diveName(entry)} deleted`;
    case 'mergeDives':
      return `${mergedName(entry)} merged`;
    case 'makeFirstDiveComputer': {
      const model = entry.computerModel?.trim() ?? '';
      return model === ''
        ? `First computer of ${diveName(entry)} changed`
        : `${model} is now first on ${diveName(entry)}`;
    }
    case SSI_TAG_KIND:
      return `${diveName(entry)} marked as synced to SSI`;
    case 'upsertDiveSite':
      return `${capitalized(siteName(entry, false))} ${entry.isNew ? 'added' : 'updated'}`;
    case 'deleteDiveSite':
      return `${capitalized(siteName(entry, false))} deleted${
        entry.siteDives ? `, ${plural(entry.siteDives, 'dive')} without a site` : ''
      }`;
    case 'createTrip':
      return `${capitalized(tripName(entry, false))} created`;
    case 'addDivesToTrip':
      return `${capitalized(diveCountName(entry, false))} moved to ${tripName(entry, false)}`;
    case 'removeDivesFromTrip':
      return `${capitalized(diveCountName(entry, false))} removed from trip`;
    case 'updateTrip':
      return `${capitalized(tripName(entry, false))} updated`;
    case 'ungroupDives':
      return 'All trips ungrouped';
    case 'importFile':
    case 'importSuunto':
      return added(entry) > 0 ? `${plural(added(entry), 'dive')} imported` : 'Logbook updated from the file';
    case 'dcDownloadAccept':
      return added(entry) > 0
        ? `${plural(added(entry), 'dive')} downloaded`
        : 'Logbook updated from the dive computer';
    case 'savePlan':
      return 'Planned dive added';
    default:
      return 'Logbook changed';
  }
}

export function undoTitle(entry: HistoryEntry): string {
  return `Undo ${changeTitle(entry)}`;
}

export function redoTitle(entry: HistoryEntry): string {
  return `Redo ${changeTitle(entry)}`;
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
        actionLabel: 'Undo',
        actionAccessibilityLabel: undoTitle(entry),
        announcement: `${message}. Undo is available.`,
      };
    }
    case 'undo': {
      const entry = state.redo;
      if (!entry) {
        return null;
      }
      const message = `Undid ${changeTitle(entry)}`;
      return {
        key: state.revision,
        message,
        action: 'redo',
        actionLabel: 'Redo',
        actionAccessibilityLabel: redoTitle(entry),
        announcement: `${message}. Redo is available.`,
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
