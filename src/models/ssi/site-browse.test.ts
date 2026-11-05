// AI-generated (Claude)
import { describe, expect, it } from 'vitest';
import {
  browseSsiSites,
  fitSsiSitesCamera,
  groupSsiSites,
  hasSsiPosition,
  parseSsiSiteDetail,
  recentSsiSiteIds,
  ssiPlainText,
} from './site-browse';
import type { SsiSite } from './sites';
const sites: SsiSite[] = [
  { id: 1, name: 'Blue Hole', country: 'Egypt', lat: 28, lon: 34 },
  { id: 2, name: 'Lake', country: 'Austria', lat: 47, lon: 15 },
  { id: 3, name: 'Unmapped', country: '', lat: 0, lon: 0 },
];
describe('SSI site browsing', () => {
  it('sorts by distance, keeping unmapped sites searchable at the end', () => {
    expect(browseSsiSites(sites, '', { lat: 47.1, lon: 15 }).map((s) => s.id)).toEqual([2, 1, 3]);
    expect(browseSsiSites(sites, 'AUSTRIA', null).map((s) => s.id)).toEqual([2]);
  });
  it('does not cap catalogue searches at the old picker limit', () => {
    const many = Array.from({ length: 100 }, (_, id) => ({ ...sites[0], id }));
    expect(browseSsiSites(many, 'Blue', null)).toHaveLength(100);
  });
  it('gets recency from SSI dive dates, ignores deleted dives and deduplicates', () => {
    const ids = recentSsiSiteIds([
      { odin_user_log_date: '2026-01-01', odin_user_log_dive_sites_id: 1 },
      { odin_user_log_date: '2026-03-01', odin_user_log_dive_sites_id: 2 },
      { odin_user_log_date: '2026-04-01', odin_user_log_dive_sites_id: 1 },
      {
        odin_user_log_date: '2026-05-01',
        odin_user_log_dive_sites_id: 3,
        odin_user_log_deleted: true,
      },
    ]);
    expect(ids).toEqual([1, 2]);
    expect(browseSsiSites(sites, '', null, ids).map((s) => s.id)).toEqual([1, 2]);
    expect(browseSsiSites(sites, '', null, [])).toEqual([]);
  });
  it('keeps every positioned site reachable in world clusters', () => {
    const many = Array.from({ length: 10000 }, (_, id) => ({ ...sites[id % 2], id }));
    const groups = groupSsiSites(many, { lat: 0, lon: 0, latitudeDelta: 180, longitudeDelta: 360 });
    expect(groups.length).toBeLessThan(400);
    expect(groups.flatMap((g) => g.sites)).toHaveLength(many.length);
  });
  it('includes sites across the date line but excludes invalid/unmapped sites', () => {
    const groups = groupSsiSites([{ ...sites[0], lat: 10, lon: -179 }, sites[2]], {
      lat: 10,
      lon: 179,
      latitudeDelta: 10,
      longitudeDelta: 10,
    });
    expect(groups.flatMap((g) => g.sites).map((s) => s.id)).toEqual([1]);
    expect(hasSsiPosition({ lat: 91, lon: 1 })).toBe(false);
  });
  it('parses the live endpoint array shape and rejects mismatched sites', () => {
    expect(
      parseSsiSiteDetail([{ dive_site_id: 2, dive_site_name: 'Lake' }], 2)?.dive_site_name,
    ).toBe('Lake');
    expect(parseSsiSiteDetail([], 2)).toBeNull();
    expect(parseSsiSiteDetail({ authenticated: false }, 2)).toBeNull();
    expect(parseSsiSiteDetail([{ dive_site_id: 1 }], 2)).toBeNull();
    expect(ssiPlainText('<p>Rock &amp; reef</p>Entry<br/>Shore')).toBe(
      'Rock & reef\n\nEntry\nShore',
    );
  });
});

describe('fitSsiSitesCamera', () => {
  const located = (lat: number, lon: number): SsiSite => ({ ...sites[0], lat, lon });

  it('centres on the located sites and ignores unknown positions', () => {
    const camera = fitSsiSitesCamera([located(10, 20), located(20, 40), located(0, 0)]);
    expect(camera).toMatchObject({ latitude: 15, longitude: 30 });
  });

  it('has no camera when no site is located', () => {
    expect(fitSsiSitesCamera([located(0, 0)])).toBeNull();
  });
});

describe('browseSsiSites by name', () => {
  it('ignores the whitespace around catalogue names', () => {
    const named = (name: string): SsiSite => ({ ...sites[0], name });
    const sorted = browseSsiSites([named('Beta'), named('  Gamma'), named('\tAlpha')], '', null);
    expect(sorted.map((s) => s.name.trim())).toEqual(['Alpha', 'Beta', 'Gamma']);
  });
});
