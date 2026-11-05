// AI-generated (Claude)
// Unit tests for SSI's lookup tables, with fixtures in the real responses' shapes.
import { describe, expect, it } from 'vitest';

import { parseSsiSiteLookups } from './site-lookups';

const divelogVars = {
  logbook_vars: {
    current: { '6': 'no_current', '9': 'ripping_current' },
    entry: { '21': 'shore', '22': 'boat' },
  },
  divesite_vars: { level: { '1': 'beginner' } },
  divesite_extended_vars: {
    fresh: { '185': 'lake', '231': 'cenote' },
    salt: { '164': 'wall_drop_off' },
  },
};
const wildlifeVars = {
  wildlife: {
    animal: [
      {
        id: 22,
        title_key: 'pike',
        latin: 'Esox lucius',
        images: { thumb: { url: 'https://my.divessi.com/pike/small' } },
      },
      { id: 256, title_key: 'lota_lota_key', latin: 'lota_lota', images: { thumb: { url: 'data:x' } } },
      { title_key: 'no id' },
    ],
  },
};
const translations = {
  eng: {
    no_current: 'No Current',
    shore: 'Shore/Beach',
    boat: 'Boat Dive',
    entry_boat: 'Boat',
    level_beginner: 'Beginner',
    lake: 'Lake',
    wall_drop_off: 'Wall/Drop Off',
    pike: 'Pike',
  },
};

describe('parseSsiSiteLookups', () => {
  const lookups = parseSsiSiteLookups(divelogVars, wildlifeVars, translations);

  it('turns codes into SSI display text', () => {
    expect(lookups.current.get(6)).toBe('No Current');
    expect(lookups.level.get(1)).toBe('Beginner');
    expect(lookups.environment.get(185)).toBe('Lake');
    expect(lookups.environment.get(164)).toBe('Wall/Drop Off');
  });

  it('prefers the short entry form, then the plain key', () => {
    expect(lookups.entry.get(22)).toBe('Boat');
    expect(lookups.entry.get(21)).toBe('Shore/Beach');
  });

  it('writes a label out from its key when SSI has no text', () => {
    expect(lookups.current.get(9)).toBe('Ripping current');
    expect(lookups.environment.get(231)).toBe('Cenote');
  });

  it('reads animals, rejecting a non-web thumbnail and rows without an id', () => {
    expect(lookups.wildlife.get(22)).toEqual({
      name: 'Pike',
      latin: 'Esox lucius',
      thumb: 'https://my.divessi.com/pike/small',
    });
    expect(lookups.wildlife.get(256)).toEqual({
      name: 'Lota lota key',
      latin: 'Lota lota',
      thumb: null,
    });
    expect(lookups.wildlife.size).toBe(2);
  });

  it('still names codes when translations failed', () => {
    const partial = parseSsiSiteLookups(divelogVars, null, null);
    expect(partial.current.get(6)).toBe('No current');
    expect(partial.wildlife.size).toBe(0);
  });

  it('gives empty tables when every source failed', () => {
    const empty = parseSsiSiteLookups(null, null, null);
    expect([empty.current.size, empty.entry.size, empty.level.size]).toEqual([0, 0, 0]);
  });
});
