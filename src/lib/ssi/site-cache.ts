// AI-generated (Claude)
// The on-device copy of SSI's dive-site catalogue.
//
// SSI has no site-search endpoint. Its app downloads the whole catalogue as a
// ZIP and searches it locally, so this app does the same - which also means
// site lookup keeps working on a boat with no signal, once the file is there.
//
// The download is 2.5 MB and unzips to roughly 18 MB of JSON describing some
// 36 000 sites. Parsing that is the one genuinely expensive thing this app
// does, so it happens exactly once: the result is reduced to the handful of
// fields the picker needs (src/models/ssi/sites.ts) and only the reduction -
// about 3 MB - is kept. Every later launch parses the small file instead.
//
// The URL needs no authentication; it is fetched before the user has an account.

import { Directory, File, Paths } from 'expo-file-system';
import { unzipSync } from 'fflate';

import { reduceSsiSites, type RawSsiSite, type SsiSite } from '@/models/ssi/sites';

const CATALOGUE_URL =
  'https://api.divessi.com/app/APP_CACHE_SITES.zip?ssiapp=0815_ADR&lang=en&version=ADR_4.1.268-ssi&context=s';

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
};

const NO_INDEX: SsiSiteIndexInfo = { count: 0, downloadedAt: null };

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

/**
 * Downloads, unzips and reduces the catalogue, replacing whatever was stored.
 *
 * The ZIP goes to the cache directory rather than documents, because it is
 * disposable and its 2.5 MB should not count against the user's backup. It is
 * deleted as soon as it has been read, along with the 18 MB string it decodes
 * to - only the reduction outlives this call.
 */
export async function downloadSiteIndex(): Promise<SsiSite[]> {
  const scratch = new Directory(Paths.cache, 'ssi');
  if (!scratch.exists) {
    scratch.create({ intermediates: true });
  }

  const archive = await File.downloadFileAsync(CATALOGUE_URL, scratch);

  try {
    const entries = unzipSync(archive.bytesSync());
    const name = Object.keys(entries).find((entry) => entry.endsWith('.json'));
    if (name === undefined) {
      throw new Error('The dive site download contained no catalogue.');
    }

    const raw = JSON.parse(new TextDecoder().decode(entries[name])) as {
      divesites?: RawSsiSite[];
    };
    const sites = reduceSsiSites(raw.divesites ?? []);
    if (sites.length === 0) {
      throw new Error('The dive site catalogue came back empty.');
    }

    // The index first: the sidecar is what `siteIndexInfo` trusts, so it must
    // not claim a catalogue that is not fully written yet.
    write(indexFile(), JSON.stringify(sites));
    write(
      infoFile(),
      JSON.stringify({ count: sites.length, downloadedAt: Date.now() } satisfies SsiSiteIndexInfo)
    );

    return sites;
  } finally {
    try {
      archive.delete();
    } catch {
      // A leftover in the cache directory is the OS's problem to reclaim.
    }
  }
}

/**
 * The catalogue, downloading it on first use. Returning the stored index is the
 * fast path; only a missing or unreadable one hits the network.
 */
export async function ensureSiteIndex(): Promise<SsiSite[]> {
  return readIndex() ?? (await downloadSiteIndex());
}

/** Throws away the stored index and fetches a fresh catalogue. */
export async function refreshSiteIndex(): Promise<SsiSite[]> {
  for (const file of [infoFile(), indexFile()]) {
    try {
      if (file.exists) {
        file.delete();
      }
    } catch {
      // The download overwrites them anyway; failing to delete first is harmless.
    }
  }
  return downloadSiteIndex();
}
