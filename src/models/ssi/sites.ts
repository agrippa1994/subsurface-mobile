// AI-generated (Claude)
// SSI's dive-site catalogue, and the two lookups the sync screen does on it.
//
// SSI has no site-search endpoint: its app ships the whole catalogue as a ZIP
// (see src/lib/ssi/site-cache.ts) and searches it locally. That dump is ~36 000
// sites and 18 MB of JSON with two dozen fields each, most of which we never
// look at, so it is reduced to `SsiSite` once at download time and only the
// reduction is kept. Both lookups below are linear scans over that array - at
// this size that is well under a frame, and an index would have to be rebuilt
// on every refresh anyway.
//
// This file stays free of the file system and the network so vitest can cover
// the matching rules directly.

import { distanceMeters } from '../site-edit';

/** One catalogue entry, reduced to the fields the picker shows or matches on. */
export type SsiSite = {
  id: number;
  name: string;
  /** Decimal degrees, unlike the core's own sites, which are microdegrees. */
  lat: number;
  lon: number;
  /** Often empty in the real data, so never the only thing shown for a site. */
  country: string;
};

/** Shortest query that searches. One letter would match most of the catalogue. */
export const MIN_QUERY_LENGTH = 2;

/** As many hits as the picker shows. The scan stops once it has them. */
export const MAX_RESULTS = 20;

/**
 * How far a dive's own position may be from a catalogue site for that site to
 * be offered as the obvious answer. Beyond this the diver picks by name: a
 * "nearest" site tens of kilometres away is a wrong guess, not a helpful one.
 */
export const NEAREST_MAX_METERS = 5000;

/**
 * The rows of the raw dump we keep. Everything else in the file - aliases,
 * addresses, animal ids, currents - is dropped on the floor.
 */
export type RawSsiSite = {
  odin_dive_sites_id?: unknown;
  odin_dive_sites_name?: unknown;
  odin_dive_sites_lat?: unknown;
  odin_dive_sites_lon?: unknown;
  odin_dive_sites_meta_country?: unknown;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Reduces the downloaded catalogue. Entries without a usable id or a string
 * name are dropped rather than defaulted: an unnamed site cannot be searched
 * for or shown, and `odin_dive_sites_name` is genuinely not always a string in
 * the real dump. Sites without a position are kept - they are still findable by
 * name - with 0/0 standing in, which `nearestSsiSite` skips.
 */
export function reduceSsiSites(raw: readonly RawSsiSite[]): SsiSite[] {
  const sites: SsiSite[] = [];

  for (const entry of raw) {
    if (!isFiniteNumber(entry.odin_dive_sites_id)) {
      continue;
    }
    if (typeof entry.odin_dive_sites_name !== 'string' || entry.odin_dive_sites_name === '') {
      continue;
    }

    sites.push({
      id: entry.odin_dive_sites_id,
      name: entry.odin_dive_sites_name,
      lat: isFiniteNumber(entry.odin_dive_sites_lat) ? entry.odin_dive_sites_lat : 0,
      lon: isFiniteNumber(entry.odin_dive_sites_lon) ? entry.odin_dive_sites_lon : 0,
      country:
        typeof entry.odin_dive_sites_meta_country === 'string'
          ? entry.odin_dive_sites_meta_country
          : '',
    });
  }

  return sites;
}

/**
 * Case-insensitive substring match on the site name, capped at MAX_RESULTS.
 *
 * Matches that start with the query come first, because a diver typing "blue"
 * means "Blue Hole" long before "The Great Blue Wall". Within each group the
 * catalogue's own order is kept.
 */
export function searchSsiSites(sites: readonly SsiSite[], query: string): SsiSite[] {
  const needle = query.trim().toLocaleLowerCase();
  if (needle.length < MIN_QUERY_LENGTH) {
    return [];
  }

  const prefix: SsiSite[] = [];
  const contains: SsiSite[] = [];

  for (const site of sites) {
    const name = site.name.toLocaleLowerCase();
    if (name.startsWith(needle)) {
      prefix.push(site);
    } else if (name.includes(needle)) {
      contains.push(site);
    }
    if (prefix.length >= MAX_RESULTS) {
      break;
    }
  }

  return [...prefix, ...contains].slice(0, MAX_RESULTS);
}

export type NearestSsiSite = { site: SsiSite; distanceMeters: number };

/**
 * The closest catalogue site to a position, or null when the closest one is
 * further off than NEAREST_MAX_METERS.
 */
export function nearestSsiSite(
  sites: readonly SsiSite[],
  lat: number,
  lon: number
): NearestSsiSite | null {
  let best: SsiSite | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const site of sites) {
    if (site.lat === 0 && site.lon === 0) {
      continue;
    }
    const distance = distanceMeters(lat, lon, site.lat, site.lon);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = site;
    }
  }

  return best !== null && bestDistance <= NEAREST_MAX_METERS
    ? { site: best, distanceMeters: bestDistance }
    : null;
}

/** How a site reads under its name in the picker. */
export function describeSsiSite(site: SsiSite): string {
  if (site.country !== '') {
    return site.country;
  }
  return site.lat === 0 && site.lon === 0
    ? 'No position'
    : `${site.lat.toFixed(4)}, ${site.lon.toFixed(4)}`;
}
