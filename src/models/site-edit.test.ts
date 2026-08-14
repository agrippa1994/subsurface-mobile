// AI-generated (Claude)
// Unit tests for the dive-site editor model. Pure TypeScript: no native module.
import { describe, expect, it } from 'vitest';

import type { DiveSite } from './index';
import {
  buildSiteInput,
  distanceMeters,
  findDuplicateSites,
  findNearbySites,
  formatCoordinateInput,
  formatCoordinates,
  isEmptySiteInput,
  parseCoordinates,
  siteDraftFrom,
  sortSitesByName,
  toSiteRow,
  validateSiteDraft,
  type SiteDraft,
} from './site-edit';

function site(overrides: Partial<DiveSite> = {}): DiveSite {
  return {
    uuid: 1,
    name: 'Blue Hole',
    latUdeg: 47_376_900,
    lonUdeg: 8_541_700,
    hasGps: true,
    description: 'Wall',
    notes: '',
    diveCount: 3,
    taxonomy: [],
    ...overrides,
  };
}

function draft(overrides: Partial<SiteDraft> = {}): SiteDraft {
  return {
    uuid: 1,
    name: 'Blue Hole',
    description: 'Wall',
    notes: '',
    latUdeg: 47_376_900,
    lonUdeg: 8_541_700,
    ...overrides,
  };
}

describe('coordinate formatting', () => {
  it('shows hemispheres rather than signs', () => {
    expect(formatCoordinates(47_376_900, 8_541_700)).toBe('47.3769N 8.5417E');
    expect(formatCoordinates(-17_713_100, -149_432_800)).toBe('17.7131S 149.4328W');
  });

  it('seeds the input field so editing round-trips', () => {
    const text = formatCoordinateInput(47_376_900, 8_541_700);
    expect(text).toBe('47.376900, 8.541700');
    expect(parseCoordinates(text)).toEqual({ latUdeg: 47_376_900, lonUdeg: 8_541_700 });
  });

  it('is empty for a site with no position', () => {
    expect(formatCoordinateInput(null, null)).toBe('');
  });
});

describe('coordinate parsing', () => {
  it('reads decimal degrees', () => {
    expect(parseCoordinates('47.3769, 8.5417')).toEqual({ latUdeg: 47_376_900, lonUdeg: 8_541_700 });
    expect(parseCoordinates('47.3769 8.5417')).toEqual({ latUdeg: 47_376_900, lonUdeg: 8_541_700 });
    expect(parseCoordinates('-17.7131, -149.4328')).toEqual({
      latUdeg: -17_713_100,
      lonUdeg: -149_432_800,
    });
  });

  it('reads hemisphere letters on either side', () => {
    expect(parseCoordinates('N47.3769 E8.5417')).toEqual({
      latUdeg: 47_376_900,
      lonUdeg: 8_541_700,
    });
    expect(parseCoordinates('17.7131 S, 149.4328 W')).toEqual({
      latUdeg: -17_713_100,
      lonUdeg: -149_432_800,
    });
  });

  it('reads degrees and decimal minutes', () => {
    const parsed = parseCoordinates("N 47 22.614' E 8 32.502'");
    expect(parsed).not.toBeNull();
    expect(parsed!.latUdeg).toBeCloseTo(47_376_900, -3);
    expect(parsed!.lonUdeg).toBeCloseTo(8_541_700, -3);
  });

  it('reads degrees, minutes and seconds', () => {
    const parsed = parseCoordinates('47 22 36.84 N, 8 32 30.12 E');
    expect(parsed).not.toBeNull();
    expect(parsed!.latUdeg).toBeCloseTo(47_376_900, -3);
    expect(parsed!.lonUdeg).toBeCloseTo(8_541_700, -3);
  });

  it('reads a decimal comma when it is unambiguous', () => {
    expect(parseCoordinates('47,3769 8,5417')).toEqual({
      latUdeg: 47_376_900,
      lonUdeg: 8_541_700,
    });
  });

  it('rejects what it cannot read, rather than guessing', () => {
    expect(parseCoordinates('')).toBeNull();
    expect(parseCoordinates('somewhere nice')).toBeNull();
    expect(parseCoordinates('47.3769')).toBeNull();
    expect(parseCoordinates('47.3769, 8.5417, 12')).toBeNull();
    expect(parseCoordinates('91.0, 8.5')).toBeNull();
    expect(parseCoordinates('47.0, 181.0')).toBeNull();
    expect(parseCoordinates('47 61.0 N, 8 30.0 E')).toBeNull();
  });
});

describe('validation', () => {
  it('requires a name', () => {
    expect(validateSiteDraft(draft({ name: '  ' }))).toEqual({
      ok: false,
      message: 'A dive site needs a name.',
    });
    expect(validateSiteDraft(draft())).toEqual({ ok: true });
  });

  it('requires both halves of a position', () => {
    const result = validateSiteDraft(draft({ lonUdeg: null }));
    expect(result.ok).toBe(false);
  });

  it('accepts a site with no position at all', () => {
    expect(validateSiteDraft(draft({ latUdeg: null, lonUdeg: null }))).toEqual({ ok: true });
  });
});

describe('upsert input', () => {
  it('sends everything for a new site', () => {
    const input = buildSiteInput(
      draft({ uuid: 0, name: 'New Reef', description: '', notes: 'nice' })
    );
    expect(input).toEqual({
      name: 'New Reef',
      description: '',
      notes: 'nice',
      latUdeg: 47_376_900,
      lonUdeg: 8_541_700,
    });
    expect(input.uuid).toBeUndefined();
  });

  it('sends only what changed for an existing site', () => {
    const original = site();
    const input = buildSiteInput(siteDraftFrom(original), original);
    expect(input).toEqual({ uuid: 1 });
    expect(isEmptySiteInput(input)).toBe(true);

    const renamed = buildSiteInput({ ...siteDraftFrom(original), name: 'Blue Hole North' }, original);
    expect(renamed).toEqual({ uuid: 1, name: 'Blue Hole North' });
    expect(isEmptySiteInput(renamed)).toBe(false);
  });

  it('expresses a cleared position as 0/0', () => {
    const original = site();
    const input = buildSiteInput(
      { ...siteDraftFrom(original), latUdeg: null, lonUdeg: null },
      original
    );
    expect(input).toEqual({ uuid: 1, latUdeg: 0, lonUdeg: 0 });
  });

  it('adds a position to a site that had none', () => {
    const original = site({ hasGps: false, latUdeg: 0, lonUdeg: 0 });
    const input = buildSiteInput({ ...siteDraftFrom(original), latUdeg: 1000, lonUdeg: 2000 }, original);
    expect(input).toEqual({ uuid: 1, latUdeg: 1000, lonUdeg: 2000 });
  });
});

describe('duplicates', () => {
  const sites = [
    site({ uuid: 1, name: 'Blue Hole' }),
    site({ uuid: 2, name: 'blue hole', latUdeg: 47_376_910, lonUdeg: 8_541_710 }),
    site({ uuid: 3, name: 'Far Away', latUdeg: 10_000_000, lonUdeg: 10_000_000 }),
  ];

  it('finds same-named sites, excluding the one being edited', () => {
    expect(findDuplicateSites(draft({ uuid: 1 }), sites).map((s) => s.uuid)).toEqual([2]);
  });

  it('finds sites within the radius, nearest first', () => {
    expect(findNearbySites(draft({ uuid: 0 }), sites).map((s) => s.uuid)).toEqual([1, 2]);
    expect(findNearbySites(draft({ uuid: 1 }), sites).map((s) => s.uuid)).toEqual([2]);
  });

  it('finds nothing without a position', () => {
    expect(findNearbySites(draft({ latUdeg: null, lonUdeg: null }), sites)).toEqual([]);
  });

  it('measures distance', () => {
    // One degree of latitude is about 111 km anywhere on the globe.
    expect(distanceMeters(0, 0, 1, 0)).toBeCloseTo(111_195, -2);
  });
});

describe('rows', () => {
  it('renders a site with a position', () => {
    expect(toSiteRow(site())).toEqual({
      uuid: 1,
      title: 'Blue Hole',
      subtitle: '47.3769N 8.5417E',
      countText: '3 dives',
      hasGps: true,
    });
  });

  it('names the unnamed and admits to having no position', () => {
    const row = toSiteRow(site({ name: '', hasGps: false, diveCount: 1 }));
    expect(row.title).toBe('Unnamed site');
    expect(row.subtitle).toBe('No position');
    expect(row.countText).toBe('1 dive');
  });

  it('sorts by name', () => {
    const sorted = sortSitesByName([site({ uuid: 2, name: 'Zoo' }), site({ uuid: 1, name: 'Arch' })]);
    expect(sorted.map((s) => s.name)).toEqual(['Arch', 'Zoo']);
  });
});
