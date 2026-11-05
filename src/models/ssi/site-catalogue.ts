// AI-generated (Claude)
// How the full SSI site catalogue is assembled.
//
// `/APP_CACHE_SITES.zip` holds only SSI's locked and private sites - roughly two
// thirds of the catalogue. The rest come from `get_divesites_global`, and their
// timestamps go back to 2020, so a delta from the ZIP's build date cannot reach
// them: they need a full walk from `last_sync: 0`.
//
// What that endpoint does, as measured in November 2026 (none of it documented):
// - One response holds up to `limit` live rows plus up to `limit` deleted rows,
//   drawn from two independent listings that share `offset`.
// - `offset` therefore advances by `limit`, not by the rows received. Stepping by
//   the row count skips half the live sites without any error.
// - The deleted listing is about nine times longer than the live one, so a full
//   walk stops once the live rows run out rather than reading all of it.
// - `last_sync` is in epoch seconds. A value in milliseconds is an HTTP 500.
//
// This file stays free of the file system and the network so vitest can cover
// the paging and merge rules directly. site-cache.ts supplies the fetcher.

import type { Site } from 'divessi-client';

import { isDeletedSsiSite, reduceSsiSites, type SsiSite } from './sites';

/** The server's own default. One page took about 1.4 s and under a megabyte. */
export const SITES_PAGE_SIZE = 1000;

/**
 * A full walk is 38 pages today. Past this the server is ignoring `offset`, and
 * giving up beats looping for the rest of the app's life.
 */
export const MAX_SITES_PAGES = 100;

/**
 * `created` in the ZIP has no time zone, and `last_sync` is compared in the
 * server's. A day covers any offset; re-reading a few changes costs nothing.
 */
const CREATED_MARGIN_SECONDS = 24 * 60 * 60;

/**
 * How much of the ZIP's `divesites_total` the result must reach. It is not exact
 * - sites come and go between the two reads - but falling well short means the
 * paging contract changed, and a catalogue marked complete is never fetched again.
 */
const MIN_TOTAL_RATIO = 0.95;

/**
 * How many sites must share identical coordinates for that position to count as
 * a placeholder. SSI's list has country and region centre points holding up to
 * 220 unrelated sites each - Chichi Bay in the middle of Germany. Sites this
 * crowded look like one wrong marker on the map and a wrong nearest-site guess.
 */
export const PLACEHOLDER_MIN_SITES = 5;

export type SitesPageRequest = { last_sync: number; offset: number; limit: number };

/** One page of raw rows: unvalidated, because the wire disagrees with the types. */
export type SitesPageFetcher = (request: SitesPageRequest) => Promise<readonly Site[]>;

/** One read of the endpoint, reduced page by page so raw rows are not kept. */
export type SiteChanges = { sites: SsiSite[]; deletedIds: number[] };

function appendPage(changes: SiteChanges, rows: readonly Site[]): void {
  changes.sites.push(...reduceSsiSites(rows));
  for (const row of rows) {
    if (isDeletedSsiSite(row) && typeof row.odin_dive_sites_id === 'number') {
      changes.deletedIds.push(row.odin_dive_sites_id);
    }
  }
}

async function readPages(
  fetchPage: SitesPageFetcher,
  lastSync: number,
  isLastPage: (rows: readonly Site[]) => boolean
): Promise<SiteChanges> {
  const changes: SiteChanges = { sites: [], deletedIds: [] };
  for (let page = 0; page < MAX_SITES_PAGES; page++) {
    const rows = await fetchPage({
      last_sync: lastSync,
      offset: page * SITES_PAGE_SIZE,
      limit: SITES_PAGE_SIZE,
    });
    appendPage(changes, rows);
    if (isLastPage(rows)) {
      return changes;
    }
  }
  throw new Error('The dive site list did not end.');
}

/**
 * Every live site. Ends on the first page with no live rows, not the first short
 * one: that costs one small request and survives the server filtering a page.
 */
export async function fetchAllSsiSites(fetchPage: SitesPageFetcher): Promise<SiteChanges> {
  const changes = await readPages(fetchPage, 0, (rows) => rows.every(isDeletedSsiSite));
  if (changes.sites.length === 0) {
    // The ZIP alone would otherwise be stored as if the walk had succeeded.
    throw new Error('The dive site list came back empty.');
  }
  return changes;
}

/** Everything changed since `lastSync`, including every deletion. Usually one page. */
export function fetchSsiSiteChanges(
  fetchPage: SitesPageFetcher,
  lastSync: number
): Promise<SiteChanges> {
  return readPages(fetchPage, lastSync, (rows) => rows.length === 0);
}

/**
 * The `last_sync` that catches everything since the ZIP was built, from its
 * `created` header ("2026-11-05 10:39:59"). Null when that is missing or unreadable.
 */
export function changesSinceCreated(created: unknown): number | null {
  if (typeof created !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(created)) {
    return null;
  }
  const milliseconds = Date.parse(`${created.replace(' ', 'T')}Z`);
  return Number.isNaN(milliseconds)
    ? null
    : Math.floor(milliseconds / 1000) - CREATED_MARGIN_SECONDS;
}

/**
 * The ZIP's sites with each read applied on top, oldest read first: a later read
 * wins, and the same read's deletion wins over its own live row. De-duplicated by
 * id, keeping each site's first position so existing search order stays put.
 */
export function mergeSsiSites(
  base: readonly SsiSite[],
  reads: readonly SiteChanges[]
): SsiSite[] {
  const merged = new Map(base.map((site) => [site.id, site]));
  for (const { sites, deletedIds } of reads) {
    for (const site of sites) {
      merged.set(site.id, site);
    }
    for (const id of deletedIds) {
      merged.delete(id);
    }
  }
  return [...merged.values()];
}

/**
 * Removes sites at placeholder positions. Sites without a position (0/0) stay:
 * nothing shows them as being anywhere, and they remain findable by name.
 */
export function removePlaceholderSites(sites: readonly SsiSite[]): SsiSite[] {
  const key = (site: SsiSite) => `${site.lat},${site.lon}`;
  const counts = new Map<string, number>();
  for (const site of sites) {
    counts.set(key(site), (counts.get(key(site)) ?? 0) + 1);
  }
  return sites.filter(
    (site) =>
      (site.lat === 0 && site.lon === 0) || (counts.get(key(site)) ?? 0) < PLACEHOLDER_MIN_SITES
  );
}

/**
 * Whether a merged catalogue falls well short of the total the ZIP announced.
 * Judge it before removing placeholders, which that total still counts.
 */
export function isSsiCatalogueShort(count: number, announcedTotal: unknown): boolean {
  return typeof announcedTotal === 'number' && count < announcedTotal * MIN_TOTAL_RATIO;
}
