// AI-generated (Claude)
// Unit tests for assembling the SSI catalogue. No network: a fake listing below
// behaves the way `get_divesites_global` was measured to behave.
import { describe, expect, it } from 'vitest';
import type { Site } from 'divessi-client';

import {
  changesSinceCreated,
  fetchAllSsiSites,
  fetchSsiSiteChanges,
  isSsiCatalogueShort,
  MAX_SITES_PAGES,
  mergeSsiSites,
  SITES_PAGE_SIZE,
  type SitesPageRequest,
} from './site-catalogue';
import type { SsiSite } from './sites';

function liveRow(id: number): Site {
  return { odin_dive_sites_id: id, odin_dive_sites_name: `Site ${id}` };
}

function deletedRow(id: number): Site {
  return { odin_dive_sites_id: id, odin_dive_sites_deleted: 1 as unknown as boolean };
}

function ssiSite(id: number, name = `Site ${id}`): SsiSite {
  return { id, name, lat: 0, lon: 0, country: '' };
}

/** Two listings sharing `offset`, each cut to `limit`, as the real endpoint does. */
function fakeListing(live: Site[], deleted: Site[]) {
  const requests: SitesPageRequest[] = [];
  const fetchPage = async (request: SitesPageRequest) => {
    requests.push(request);
    const { offset, limit } = request;
    return [...live.slice(offset, offset + limit), ...deleted.slice(offset, offset + limit)];
  };
  return { fetchPage, requests };
}

const ids = (count: number, from = 1) => Array.from({ length: count }, (_, i) => from + i);

describe('fetchAllSsiSites', () => {
  it('advances by the page size, not by the rows received', async () => {
    // Every page carries 2 * SITES_PAGE_SIZE rows; stepping by that loses sites.
    const live = ids(SITES_PAGE_SIZE * 2 + 5).map(liveRow);
    const deleted = ids(SITES_PAGE_SIZE * 10, 1_000_000).map(deletedRow);
    const { fetchPage, requests } = fakeListing(live, deleted);

    const { sites } = await fetchAllSsiSites(fetchPage);

    expect(sites.map((site) => site.id)).toEqual(live.map((row) => row.odin_dive_sites_id));
    expect(requests.map((request) => request.offset)).toEqual([
      0,
      SITES_PAGE_SIZE,
      SITES_PAGE_SIZE * 2,
      SITES_PAGE_SIZE * 3,
    ]);
    expect(requests.every((request) => request.last_sync === 0)).toBe(true);
    expect(requests.every((request) => request.limit === SITES_PAGE_SIZE)).toBe(true);
  });

  it('stops once the live rows run out, leaving the long deleted listing unread', async () => {
    const { fetchPage, requests } = fakeListing(
      [liveRow(1)],
      ids(SITES_PAGE_SIZE * 50, 1_000_000).map(deletedRow)
    );
    const { sites, deletedIds } = await fetchAllSsiSites(fetchPage);
    expect(requests).toHaveLength(2);
    expect(sites).toHaveLength(1);
    expect(deletedIds).toHaveLength(SITES_PAGE_SIZE * 2);
  });

  it('keeps going past a short page that still has live rows', async () => {
    const pages: Site[][] = [[liveRow(1)], [liveRow(2)], []];
    let call = 0;
    const { sites } = await fetchAllSsiSites(async () => pages[call++]);
    expect(sites.map((site) => site.id)).toEqual([1, 2]);
  });

  it('refuses a listing with no live sites at all', async () => {
    const { fetchPage } = fakeListing([], [deletedRow(1)]);
    await expect(fetchAllSsiSites(fetchPage)).rejects.toThrow('came back empty');
  });

  it('gives up on a listing that never ends', async () => {
    let calls = 0;
    const endless = async () => {
      calls++;
      return [liveRow(1)];
    };
    await expect(fetchAllSsiSites(endless)).rejects.toThrow('did not end');
    expect(calls).toBe(MAX_SITES_PAGES);
  });

  it('passes a failed page on rather than returning a partial list', async () => {
    let call = 0;
    const failing = async () => {
      if (call++ === 1) {
        throw new Error('HTTP 500');
      }
      return [liveRow(1)];
    };
    await expect(fetchAllSsiSites(failing)).rejects.toThrow('HTTP 500');
  });
});

describe('fetchSsiSiteChanges', () => {
  it('reads every deletion, past the point where live rows ran out', async () => {
    const { fetchPage, requests } = fakeListing(
      [liveRow(1)],
      ids(SITES_PAGE_SIZE + 3, 1_000_000).map(deletedRow)
    );
    const { sites, deletedIds } = await fetchSsiSiteChanges(fetchPage, 1_785_000_000);
    expect(sites).toHaveLength(1);
    expect(deletedIds).toHaveLength(SITES_PAGE_SIZE + 3);
    expect(requests.map((request) => request.offset)).toEqual([
      0,
      SITES_PAGE_SIZE,
      SITES_PAGE_SIZE * 2,
    ]);
    expect(requests.every((request) => request.last_sync === 1_785_000_000)).toBe(true);
  });

  it('accepts no changes at all', async () => {
    const { fetchPage } = fakeListing([], []);
    expect(await fetchSsiSiteChanges(fetchPage, 1)).toEqual({ sites: [], deletedIds: [] });
  });
});

describe('changesSinceCreated', () => {
  it('is in epoch seconds, a day before the stamp', () => {
    expect(changesSinceCreated('2026-11-05 10:39:59')).toBe(
      Date.UTC(2026, 10, 4, 10, 39, 59) / 1000
    );
  });

  it('is null for anything else', () => {
    for (const created of [undefined, null, 1785000000, '', 'yesterday', '2026-13-45 99:99:99']) {
      expect(changesSinceCreated(created)).toBeNull();
    }
  });
});

describe('mergeSsiSites', () => {
  it('adds new sites after the ZIP and de-duplicates by id', () => {
    const merged = mergeSsiSites(
      [ssiSite(1), ssiSite(2)],
      [{ sites: [ssiSite(3), ssiSite(1)], deletedIds: [] }]
    );
    expect(merged.map((site) => site.id)).toEqual([1, 2, 3]);
  });

  it('lets the fresher read win, keeping the position', () => {
    const merged = mergeSsiSites(
      [ssiSite(1, 'Old'), ssiSite(2)],
      [{ sites: [ssiSite(1, 'New')], deletedIds: [] }]
    );
    expect(merged.map((site) => site.name)).toEqual(['New', 'Site 2']);
  });

  it('removes sites a read marks deleted, including ones the ZIP held', () => {
    const merged = mergeSsiSites(
      [ssiSite(1), ssiSite(2)],
      [
        { sites: [ssiSite(3)], deletedIds: [] },
        { sites: [], deletedIds: [1, 3, 99] },
      ]
    );
    expect(merged.map((site) => site.id)).toEqual([2]);
  });

  it('applies reads in order, so a later read can restore a deleted site', () => {
    const merged = mergeSsiSites(
      [],
      [
        { sites: [], deletedIds: [1] },
        { sites: [ssiSite(1)], deletedIds: [] },
      ]
    );
    expect(merged.map((site) => site.id)).toEqual([1]);
  });

  it('keeps ZIP sites the list does not mention, such as private ones', () => {
    const merged = mergeSsiSites([ssiSite(1)], [{ sites: [ssiSite(2)], deletedIds: [] }]);
    expect(merged.map((site) => site.id)).toEqual([1, 2]);
  });
});

describe('isSsiCatalogueShort', () => {
  it('tolerates small drift but not a truncated walk', () => {
    expect(isSsiCatalogueShort(36810, 36768)).toBe(false);
    expect(isSsiCatalogueShort(36000, 36768)).toBe(false);
    expect(isSsiCatalogueShort(24656, 36768)).toBe(true);
  });

  it('cannot judge without a total', () => {
    expect(isSsiCatalogueShort(1, undefined)).toBe(false);
  });
});
