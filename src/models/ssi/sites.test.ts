// AI-generated (Claude)
// Unit tests for the SSI dive-site catalogue model. Pure TypeScript: no
// download, no file system - the catalogue is passed in as an array.
import { describe, expect, it } from 'vitest';

import {
  describeSsiSite,
  MAX_RESULTS,
  nearestSsiSite,
  reduceSsiSites,
  searchSsiSites,
  type RawSsiSite,
  type SsiSite,
} from './sites';

function ssiSite(overrides: Partial<SsiSite> = {}): SsiSite {
  return { id: 1, name: 'Blue Hole', lat: 28.5721, lon: 34.5369, country: 'Egypt', ...overrides };
}

describe('reduceSsiSites', () => {
  it('keeps only the fields the picker needs', () => {
    const raw: RawSsiSite[] = [
      {
        odin_dive_sites_id: 20,
        odin_dive_sites_name: 'Uberlingen - Seezeichen 24',
        odin_dive_sites_lat: 47.7705,
        odin_dive_sites_lon: 9.1377,
        odin_dive_sites_meta_country: 'Germany',
      },
    ];

    expect(reduceSsiSites(raw)).toEqual([
      { id: 20, name: 'Uberlingen - Seezeichen 24', lat: 47.7705, lon: 9.1377, country: 'Germany' },
    ]);
  });

  it('drops entries with no id or no usable name', () => {
    const raw: RawSsiSite[] = [
      { odin_dive_sites_name: 'No id' },
      { odin_dive_sites_id: 2 },
      // The real dump genuinely carries non-string names.
      { odin_dive_sites_id: 3, odin_dive_sites_name: 12345 },
      { odin_dive_sites_id: 4, odin_dive_sites_name: '' },
      { odin_dive_sites_id: 5, odin_dive_sites_name: 'Keeper' },
    ];

    expect(reduceSsiSites(raw).map((site) => site.id)).toEqual([5]);
  });

  it('keeps a site with no position, defaulting it to 0/0', () => {
    const reduced = reduceSsiSites([{ odin_dive_sites_id: 7, odin_dive_sites_name: 'Quarry' }]);
    expect(reduced).toEqual([{ id: 7, name: 'Quarry', lat: 0, lon: 0, country: '' }]);
  });
});

describe('searchSsiSites', () => {
  const sites = [
    ssiSite({ id: 1, name: 'The Great Blue Wall' }),
    ssiSite({ id: 2, name: 'Blue Hole' }),
    ssiSite({ id: 3, name: 'Shark Reef' }),
    ssiSite({ id: 4, name: 'blue lagoon' }),
  ];

  it('needs at least two characters', () => {
    expect(searchSsiSites(sites, '')).toEqual([]);
    expect(searchSsiSites(sites, 'b')).toEqual([]);
    expect(searchSsiSites(sites, ' b ')).toEqual([]);
  });

  it('matches case-insensitively anywhere in the name', () => {
    expect(searchSsiSites(sites, 'REEF').map((site) => site.id)).toEqual([3]);
  });

  it('puts names starting with the query first', () => {
    expect(searchSsiSites(sites, 'blue').map((site) => site.id)).toEqual([2, 4, 1]);
  });

  it('caps the result count', () => {
    const many = Array.from({ length: MAX_RESULTS + 10 }, (_, i) =>
      ssiSite({ id: i, name: `Reef ${i}` })
    );
    expect(searchSsiSites(many, 'reef')).toHaveLength(MAX_RESULTS);
  });
});

describe('nearestSsiSite', () => {
  const blueHole = ssiSite({ id: 2, name: 'Blue Hole', lat: 28.5721, lon: 34.5369 });
  const bells = ssiSite({ id: 3, name: 'The Bells', lat: 28.5768, lon: 34.5333 });

  it('returns the closest site with its distance', () => {
    const nearest = nearestSsiSite([bells, blueHole], 28.5722, 34.537);
    expect(nearest?.site.id).toBe(2);
    expect(nearest?.distanceMeters).toBeLessThan(50);
  });

  it('returns null when nothing is within range', () => {
    // Lake Constance is a continent away from the Red Sea.
    expect(nearestSsiSite([blueHole, bells], 47.7705, 9.1377)).toBeNull();
  });

  it('ignores sites with no position', () => {
    const positionless = ssiSite({ id: 9, name: 'Quarry', lat: 0, lon: 0 });
    expect(nearestSsiSite([positionless], 0.001, 0.001)).toBeNull();
  });

  it('returns null for an empty catalogue', () => {
    expect(nearestSsiSite([], 28.5721, 34.5369)).toBeNull();
  });
});

describe('describeSsiSite', () => {
  it('prefers the country', () => {
    expect(describeSsiSite(ssiSite())).toBe('Egypt');
  });

  it('falls back to the position, which the real data often needs', () => {
    expect(describeSsiSite(ssiSite({ country: '' }))).toBe('28.5721, 34.5369');
  });

  it('says so when there is neither', () => {
    expect(describeSsiSite(ssiSite({ country: '', lat: 0, lon: 0 }))).toBe('No position');
  });
});
