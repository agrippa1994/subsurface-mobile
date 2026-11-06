// AI-generated (Claude)
import { describe, expect, it } from 'vitest';

import type { HistoryEntry, HistoryState } from './index';
import {
  changeDone,
  changeTitle,
  diveScreenOfEditor,
  historyToast,
  redoTitle,
  SSI_TAG_KIND,
  undoTitle,
} from './logbook-history';

function entry(fields: Partial<HistoryEntry>): HistoryEntry {
  return {
    kind: 'updateDive',
    serial: 1,
    divesBefore: 10,
    divesAfter: 10,
    tripsBefore: 0,
    tripsAfter: 0,
    ...fields,
  };
}

function state(fields: Partial<HistoryState>): HistoryState {
  return {
    canUndo: false,
    canRedo: false,
    undo: null,
    redo: null,
    undoDepth: 0,
    redoDepth: 0,
    bytes: 0,
    revision: 7,
    lastAction: 'none',
    ...fields,
  };
}

describe('labels', () => {
  it.each<[Partial<HistoryEntry>, string, string]>([
    [{ kind: 'updateDive', diveNumber: 42 }, 'Edit Dive 42', 'Dive 42 updated'],
    [{ kind: 'updateDive', diveSite: 'Lina' }, 'Edit Dive at Lina', 'Dive at Lina updated'],
    [{ kind: 'updateDive' }, 'Edit Dive', 'Dive updated'],
    [{ kind: 'deleteDive', diveNumber: 42 }, 'Delete Dive 42', 'Dive 42 deleted'],
    [{ kind: 'mergeDives', diveNumbers: [41, 42] }, 'Merge Dives 41 and 42', 'Dives 41 and 42 merged'],
    [{ kind: 'mergeDives', diveNumbers: [] }, 'Merge Dives', 'Dives merged'],
    [
      { kind: 'upsertDiveSite', isNew: true, siteName: 'Blue Hole' },
      'Add Dive Site Blue Hole',
      'Dive site Blue Hole added',
    ],
    [
      { kind: 'upsertDiveSite', isNew: false, siteName: 'Blue Hole' },
      'Edit Dive Site Blue Hole',
      'Dive site Blue Hole updated',
    ],
    [
      { kind: 'deleteDiveSite', siteName: 'Blue Hole', siteDives: 0 },
      'Delete Dive Site Blue Hole',
      'Dive site Blue Hole deleted',
    ],
    [
      { kind: 'deleteDiveSite', siteName: 'Blue Hole', siteDives: 3 },
      'Delete Dive Site Blue Hole',
      'Dive site Blue Hole deleted, 3 dives without a site',
    ],
    [{ kind: 'createTrip', tripLocation: '' }, 'New Trip', 'Trip created'],
    [{ kind: 'createTrip', tripLocation: 'Egypt' }, 'New Trip Egypt', 'Trip Egypt created'],
    [
      { kind: 'addDivesToTrip', diveCount: 2, tripLocation: 'Egypt' },
      'Move 2 Dives to Trip Egypt',
      '2 dives moved to trip Egypt',
    ],
    [
      { kind: 'addDivesToTrip', diveCount: 1, tripLocation: 'Egypt' },
      'Move Dive to Trip Egypt',
      'Dive moved to trip Egypt',
    ],
    [{ kind: 'removeDivesFromTrip', diveCount: 1 }, 'Remove Dive from Trip', 'Dive removed from trip'],
    [{ kind: 'updateTrip', tripLocation: 'Oman' }, 'Edit Trip Oman', 'Trip Oman updated'],
    [{ kind: 'ungroupDives' }, 'Ungroup All Trips', 'All trips ungrouped'],
    [{ kind: 'importFile', divesAfter: 22 }, 'Import 12 Dives', '12 dives imported'],
    [{ kind: 'importFile', divesAfter: 11 }, 'Import 1 Dive', '1 dive imported'],
    [{ kind: 'importFile' }, 'Import', 'Logbook updated from the file'],
    [{ kind: 'dcDownloadAccept', divesAfter: 13 }, 'Download 3 Dives', '3 dives downloaded'],
    [{ kind: 'dcDownloadAccept' }, 'Download', 'Logbook updated from the dive computer'],
    [{ kind: 'savePlan', divesAfter: 11 }, 'Add Planned Dive', 'Planned dive added'],
  ])('%j', (fields, title, done) => {
    expect(changeTitle(entry(fields))).toBe(title);
    expect(changeDone(entry(fields))).toBe(done);
  });

  it('has words for a mutation nobody has written words for', () => {
    const later = entry({ kind: 'deleteComputer' });
    expect(undoTitle(later)).toBe('Undo Change to the Logbook');
    expect(redoTitle(later)).toBe('Redo Change to the Logbook');
    expect(changeDone(later)).toBe('Logbook changed');
  });
});

describe('historyToast', () => {
  const deleted = entry({ kind: 'deleteDive', diveNumber: 42 });

  it('offers undo after a change', () => {
    expect(historyToast(state({ lastAction: 'change', undo: deleted }))).toEqual({
      key: 7,
      message: 'Dive 42 deleted',
      action: 'undo',
      actionLabel: 'Undo',
      actionAccessibilityLabel: 'Undo Delete Dive 42',
      announcement: 'Dive 42 deleted. Undo is available.',
    });
  });

  it('offers redo after an undo, and undo after a redo', () => {
    expect(historyToast(state({ lastAction: 'undo', redo: deleted }))).toMatchObject({
      message: 'Undid Delete Dive 42',
      action: 'redo',
      actionAccessibilityLabel: 'Redo Delete Dive 42',
    });
    expect(historyToast(state({ lastAction: 'redo', undo: deleted }))).toMatchObject({
      message: 'Dive 42 deleted',
      action: 'undo',
    });
  });

  it('shows nothing when the history was cleared, or for a change with its own screen', () => {
    expect(historyToast(state({ lastAction: 'clear' }))).toBeNull();
    expect(historyToast(state({ lastAction: 'none' }))).toBeNull();
    const tagged = entry({ kind: SSI_TAG_KIND, diveNumber: 42 });
    expect(historyToast(state({ lastAction: 'change', undo: tagged }))).toBeNull();
    expect(undoTitle(tagged)).toBe('Undo Mark Dive 42 as Synced to SSI');
  });
});

describe('diveScreenOfEditor', () => {
  it('stays in the stack the editor is in', () => {
    expect(diveScreenOfEditor('/dives/edit/12')).toBe('/dives/12');
    expect(diveScreenOfEditor('/sites/dive/edit/12')).toBe('/sites/dive/12');
  });
});
