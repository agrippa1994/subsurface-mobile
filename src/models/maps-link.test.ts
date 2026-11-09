// AI-generated (Claude)
import { describe, expect, it } from 'vitest';

import { mapsAppName, mapsLink } from './maps-link';

const SITE = { name: 'Blue Hole, Dahab', hasGps: true, latUdeg: 28572080, lonUdeg: 34537270 };

describe('mapsLink', () => {
  it('opens Apple Maps with a named pin on iOS', () => {
    expect(mapsLink(SITE, 'ios')).toBe(
      'https://maps.apple.com/?ll=28.572080,34.537270&q=Blue%20Hole%2C%20Dahab',
    );
  });

  it('hands Android a geo: URI with a labelled pin', () => {
    expect(mapsLink(SITE, 'android')).toBe(
      'geo:28.572080,34.537270?q=28.572080,34.537270(Blue%20Hole%2C%20Dahab)',
    );
  });

  it('keeps the sign of southern and western coordinates', () => {
    expect(mapsLink({ ...SITE, latUdeg: -8340000, lonUdeg: -115500000 }, 'ios')).toContain(
      'll=-8.340000,-115.500000',
    );
  });

  it('names an unnamed site, and offers nothing without a position', () => {
    expect(mapsLink({ ...SITE, name: '  ' }, 'ios')).toContain('q=Dive%20site');
    expect(mapsLink({ ...SITE, hasGps: false }, 'ios')).toBeNull();
  });

  it('says which app it opens', () => {
    expect(mapsAppName('ios')).toBe('Apple Maps');
    expect(mapsAppName('android')).toBe('Maps');
  });
});
