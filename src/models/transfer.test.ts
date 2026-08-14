// AI-generated (Claude)
import { describe, expect, it } from 'vitest';

import { describeImport, exportFileName, fileExtension, isLogbookName } from './transfer';

const result = (partial: Partial<Parameters<typeof describeImport>[0]>) =>
  describeImport({ added: 0, merged: 0, failed: 0, dives: 0, sites: 0, ...partial });

describe('describeImport', () => {
  it('names what was added', () => {
    expect(result({ added: 3, dives: 21 })).toBe('3 dives added. The logbook now holds 21 dives.');
  });

  it('says a single dive in the singular', () => {
    expect(result({ added: 1, dives: 1 })).toBe('1 dive added. The logbook now holds 1 dive.');
  });

  // Importing the same file twice is a no-op by design; without a word for it
  // that reads as a silent failure.
  it('reports dives the logbook already had', () => {
    expect(result({ merged: 2, dives: 18 })).toBe(
      '2 dives already in the logbook. The logbook now holds 18 dives.',
    );
  });

  it('reports unreadable files inside an archive', () => {
    expect(result({ added: 4, failed: 1, dives: 4 })).toBe(
      '4 dives added, 1 file could not be read. The logbook now holds 4 dives.',
    );
  });

  it('has something to say when nothing happened', () => {
    expect(result({})).toBe('Nothing to import.');
  });
});

describe('file names', () => {
  it('reads the extension case-insensitively', () => {
    expect(fileExtension('TestDiveDM3.SDE')).toBe('sde');
    expect(fileExtension('logbook')).toBe('');
  });

  it('treats .ssrf and .xml as whole logbooks', () => {
    expect(isLogbookName('dives.ssrf')).toBe(true);
    expect(isLogbookName('Dive_2013-02-02-1614.xml')).toBe(true);
    expect(isLogbookName('suunto_ocean_air.json')).toBe(false);
    expect(isLogbookName('TestDiveDM3.SDE')).toBe(false);
  });

  it('dates the exported file', () => {
    expect(exportFileName(new Date(2026, 7, 14))).toBe('subsurface-2026-08-14.ssrf');
  });
});
