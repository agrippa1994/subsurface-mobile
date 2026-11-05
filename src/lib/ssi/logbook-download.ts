// AI-generated (Claude)
// Everything the SSI-to-Subsurface conversion needs from the network and the disk.
// The conversion itself is pure: src/models/ssi/ssrf-import.ts.
//
// All of it is read-only on SSI's side.

import { File, Paths } from 'expo-file-system';

import { toNativePath } from '@/lib/logbook-file';
import type { SsiSiteLookups } from '@/models/ssi/site-lookups';
import {
  convertSsiLogbookToSsrf,
  type SsiToSsrfInput,
  type SsiToSsrfResult,
} from '@/models/ssi/ssrf-import';

import { createSsiClient, ssiData } from './api';
import { withToken } from './auth';
import { ensureSiteIndex } from './site-cache';

type Json = Record<string, unknown>;

/**
 * The logbook without the library's decoding, which drops values whose wire type
 * differs from the declared one. See ssrf-import.ts.
 */
function fetchRawDivelog(): Promise<Json> {
  return withToken((token) =>
    ssiData(createSsiClient(token).get_divelog(undefined, { decode: (raw: unknown) => raw as Json })),
  );
}

/** Equipment names by id, for the notes. Missing names only cost that one line. */
async function fetchGearNames(): Promise<Map<number, string>> {
  const names = new Map<number, string>();
  try {
    const gear = await withToken((token) =>
      ssiData(createSsiClient(token).get_gear(undefined, { decode: (raw: unknown) => raw })),
    );
    for (const item of Array.isArray(gear) ? (gear as Json[]) : []) {
      const name = [item.gear_manufacturer_misc, item.gear_product_name_modell]
        .filter((part) => typeof part === 'string' && part.trim() !== '')
        .join(' ');
      if (typeof item.gear_id === 'number' && name !== '') {
        names.set(item.gear_id, name);
      }
    }
  } catch {
    // Deliberately nothing: the dives are what was asked for.
  }
  return names;
}

function sitesMissingFrom(divelog: Json): boolean {
  const known = new Set(
    (Array.isArray(divelog.logbook_sites) ? (divelog.logbook_sites as Json[]) : []).map(
      (site) => site.odin_dive_sites_id,
    ),
  );
  const dives = Array.isArray(divelog.logbook_details) ? (divelog.logbook_details as Json[]) : [];
  return dives.some((dive) => {
    const id = dive.odin_user_log_dive_sites_id;
    return typeof id === 'number' && id > 0 && !known.has(id);
  });
}

/** What the conversion needs, fetched once so a screen can convert it repeatedly. */
export type SsiDownload = Pick<SsiToSsrfInput, 'divelog' | 'labels' | 'catalogue'>;

export async function fetchSsiDownload(lookups: SsiSiteLookups | null): Promise<SsiDownload> {
  const [divelog, gear] = await Promise.all([fetchRawDivelog(), fetchGearNames()]);

  // `logbook_sites` normally covers the log, and the catalogue is a sizeable first
  // download, so it is only asked for when a dive's site is really not there.
  const catalogue = sitesMissingFrom(divelog) ? await ensureSiteIndex().catch(() => []) : [];

  const wildlife = new Map<number, string>();
  for (const [id, animal] of lookups?.wildlife ?? []) {
    wildlife.set(id, animal.name);
  }

  return {
    divelog,
    labels: { tables: lookups?.logbook ?? new Map(), wildlife, gear },
    catalogue,
  };
}

/** The whole SSI logbook as one standalone document. */
export async function buildSsiSsrf({
  lookups,
}: {
  lookups: SsiSiteLookups | null;
}): Promise<SsiToSsrfResult> {
  return convertSsiLogbookToSsrf(await fetchSsiDownload(lookups));
}

/** Writes the document to the cache, replacing any earlier copy of the same name. */
export function writeSsiSsrfFile(
  xml: string,
  name: string,
): { uri: string; nativePath: string; remove: () => void } {
  const file = new File(Paths.cache, name);
  if (file.exists) {
    file.delete();
  }
  file.create();
  // Sync: the caller hands this path straight to the core, and `write` in SDK 58 is
  // async, so the core would read the still-empty file `create` left behind.
  file.writeSync(xml);
  return {
    uri: file.uri,
    nativePath: toNativePath(file.uri),
    remove: () => file.delete(),
  };
}
