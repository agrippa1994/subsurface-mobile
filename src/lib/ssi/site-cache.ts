// AI-generated (Claude)
// The on-device copy of SSI's dive-site catalogue.
//
// SSI has no site-search endpoint. Its app downloads the whole catalogue and
// searches it locally, so this app does the same - which also means site lookup
// keeps working on a boat with no signal, once the file is there.
//
// The catalogue comes in two parts: a 2.5 MB ZIP with about 24 600 sites, and
// about 38 pages of `get_divesites_global` for the 12 000 the ZIP leaves out
// (src/models/ssi/site-catalogue.ts) - a minute or so in all. That is the one
// genuinely expensive thing this app does, so it happens once: the result is
// reduced to the handful of fields the picker needs (src/models/ssi/sites.ts)
// and only the reduction is kept. Every later launch parses that file instead.
//
// Neither part needs authentication; they are fetched before the user has an account.

import type { Site, SitesResponse } from 'divessi-client';
import { File, Paths } from 'expo-file-system';
import { unzipSync } from 'fflate';

import {
  changesSinceCreated,
  fetchAllSsiSites,
  fetchSsiSiteChanges,
  isSsiCatalogueShort,
  mergeSsiSites,
  type SiteChanges,
  type SitesPageFetcher,
} from '@/models/ssi/site-catalogue';
import { reduceSsiSites, type SsiSite } from '@/models/ssi/sites';

import { createSsiClient, ssiData } from './api';

/** The reduced catalogue, in app documents so it survives a cache eviction. */
const INDEX_FILENAME = 'ssi-sites-index.json';

/**
 * How many sites the index holds and when it was built, beside it rather than
 * inside it. Settings reads this on every render, and the index itself is a
 * few megabytes: parsing that to display a count would stall the screen.
 */
const INFO_FILENAME = 'ssi-sites-info.json';

function indexFile(): File {
  return new File(Paths.document, INDEX_FILENAME);
}

function infoFile(): File {
  return new File(Paths.document, INFO_FILENAME);
}

export type SsiSiteIndexInfo = {
  /** Sites in the stored index, or 0 when there is none. */
  count: number;
  /** When it was built, milliseconds since epoch. Null when there is none. */
  downloadedAt: number | null;
  /**
   * Whether the index holds more than the ZIP. False when the last top-up failed,
   * and on installs from before the top-up existed, whose sidecars lack the field.
   */
  complete: boolean;
};

const NO_INDEX: SsiSiteIndexInfo = { count: 0, downloadedAt: null, complete: false };

/** What Settings shows about the catalogue. Reads the sidecar, not the index. */
export function siteIndexInfo(): SsiSiteIndexInfo {
  try {
    const info = infoFile();
    if (!info.exists || !indexFile().exists) {
      return NO_INDEX;
    }
    const stored = JSON.parse(info.textSync()) as Partial<SsiSiteIndexInfo>;
    return {
      count: typeof stored.count === 'number' ? stored.count : 0,
      downloadedAt: typeof stored.downloadedAt === 'number' ? stored.downloadedAt : null,
      complete: stored.complete === true,
    };
  } catch {
    return NO_INDEX;
  }
}

function readIndex(): SsiSite[] | null {
  try {
    const file = indexFile();
    if (!file.exists) {
      return null;
    }
    const stored = JSON.parse(file.textSync()) as unknown;
    return Array.isArray(stored) ? (stored as SsiSite[]) : null;
  } catch {
    // A truncated or half-written index is not worth recovering: it is
    // reproducible from the network in a few seconds.
    return null;
  }
}

function write(file: File, contents: string): void {
  if (!file.exists) {
    file.create({ intermediates: true });
  }
  file.write(contents);
}

function store(sites: readonly SsiSite[], complete: boolean): void {
  // The index first: the sidecar is what `siteIndexInfo` trusts, so it must
  // not claim a catalogue that is not fully written yet.
  write(indexFile(), JSON.stringify(sites));
  write(
    infoFile(),
    JSON.stringify({
      count: sites.length,
      downloadedAt: Date.now(),
      complete,
    } satisfies SsiSiteIndexInfo)
  );
}

/** Downloads, unzips and reduces the ZIP. Throws rather than return no sites. */
async function downloadZip(): Promise<{ sites: SsiSite[]; raw: SitesResponse }> {
  const { data } = await createSsiClient().initialSites();
  const entries = unzipSync(new Uint8Array(data));
  const name = Object.keys(entries).find((entry) => entry.endsWith('.json'));
  if (name === undefined) {
    throw new Error('The dive site download contained no catalogue.');
  }

  const raw = JSON.parse(new TextDecoder().decode(entries[name])) as SitesResponse;
  const sites = reduceSsiSites(raw.divesites ?? []);
  if (sites.length === 0) {
    throw new Error('The dive site catalogue came back empty.');
  }
  return { sites, raw };
}

/**
 * A fetcher returning raw rows. The default lenient decode would strip numeric
 * names and the 0/1 deletion marker, since neither matches the declared types.
 */
function sitesPageFetcher(): SitesPageFetcher {
  const client = createSsiClient();
  return async (request) => {
    const body = await ssiData(client.sites(request, { decode: (raw) => raw }));
    const rows =
      body !== null && typeof body === 'object' && 'divesites' in body ? body.divesites : null;
    if (!Array.isArray(rows)) {
      throw new Error('SSI returned no dive site list.');
    }
    return rows as unknown as Site[];
  };
}

/** Everything the ZIP lacks, plus whatever was deleted since it was built. */
async function downloadTopUp(created: unknown): Promise<SiteChanges[]> {
  const fetchPage = sitesPageFetcher();
  const reads = [await fetchAllSsiSites(fetchPage)];
  const since = changesSinceCreated(created);
  if (since !== null) {
    reads.push(await fetchSsiSiteChanges(fetchPage, since));
  }
  return reads;
}

async function buildSiteIndex(): Promise<SsiSite[]> {
  const { sites: zipSites, raw } = await downloadZip();
  // Header fields of the real ZIP, absent from the declared response model.
  const header = raw as SitesResponse & { created?: unknown; divesites_total?: unknown };

  let merged: SsiSite[];
  try {
    merged = mergeSsiSites(zipSites, await downloadTopUp(header.created));
    if (isSsiCatalogueShort(merged.length, header.divesites_total)) {
      throw new Error('The dive site list stopped short of the whole catalogue.');
    }
  } catch (error) {
    // Whatever is stored stays. With nothing stored, the ZIP alone is still most
    // of the catalogue, and being incomplete it is topped up on a later launch.
    if (readIndex() !== null) {
      throw error;
    }
    store(zipSites, false);
    return zipSites;
  }

  store(merged, true);
  return merged;
}

let inFlight: Promise<SsiSite[]> | null = null;

/**
 * Downloads the catalogue, replacing what was stored only once it has something
 * at least as good. Concurrent callers share one download: a background upgrade
 * and a tap on Refresh must not both walk SSI's listing.
 */
export function downloadSiteIndex(): Promise<SsiSite[]> {
  inFlight ??= buildSiteIndex().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * The catalogue, downloading it on first use. Returning the stored index is the
 * fast path, also when it is incomplete, so a bad connection never blocks site
 * lookup: that case is topped up in the background and handed to `onUpgraded`.
 * A failed upgrade changes nothing and is tried again on the next launch.
 */
export async function ensureSiteIndex(
  onUpgraded?: (sites: SsiSite[]) => void
): Promise<SsiSite[]> {
  const stored = readIndex();
  if (stored === null) {
    return downloadSiteIndex();
  }
  if (!siteIndexInfo().complete) {
    void downloadSiteIndex().then(onUpgraded, () => {});
  }
  return stored;
}

/** Fetches a fresh catalogue. The stored one stays in place if that fails. */
export function refreshSiteIndex(): Promise<SsiSite[]> {
  return downloadSiteIndex();
}
