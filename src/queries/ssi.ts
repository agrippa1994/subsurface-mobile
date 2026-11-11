// AI-generated (Claude)
// Everything asynchronous about SSI.
//
// These are the only queries in the app that touch the network, so they are the
// only ones that have to argue with the client defaults in
// src/lib/query-client.ts. Those defaults describe a synchronous native module
// that cannot change behind our back - staleTime and gcTime Infinity, no
// retries, no refetching - which is exactly wrong for a remote logbook. Each
// query below therefore states its own policy rather than inheriting one.
//
// The keys live under their own ['ssi'] root (src/lib/query-keys.ts), so
// loading a different logbook does not sign the user out or throw away the
// downloaded site catalogue.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { uuid } from 'expo';
import { useMemo } from 'react';

import { ensureLogbookLoaded } from '@/queries/logbook';
import { resetData, useReplaceLogbook } from '@/queries/logbook-mutations';

import { importFile, listDives, listDiveSites, updateDive } from '../../modules/ssrf-core/src';
import { flush, schedulePersist } from '@/lib/logbook-persist';
import { SSI_TAG_KIND } from '@/models/logbook-history';
import { fetchSsiSiteDetail, fetchSsiSiteLookups } from '@/lib/ssi/site-detail';
import { queryKeys } from '@/lib/query-keys';
import {
  readAccount,
  signIn,
  signOut,
  type SsiAccount,
} from '@/lib/ssi/auth';
import { fetchSsiLogbook, saveSsiDive, type SsiLogbook } from '@/lib/ssi/divelog';
import {
  buildSsiSsrf,
  fetchSsiDownload,
  writeSsiSsrfFile,
  type SsiDownload,
} from '@/lib/ssi/logbook-download';
import {
  ensureSiteIndex,
  refreshSiteIndex,
  siteIndexInfo,
  type SsiSiteIndexInfo,
} from '@/lib/ssi/site-cache';
import type { Dive, DiveSite, PlotInfo } from '@/models';
import { convertDiveToSsi } from '@/models/ssi/converter';
import { convertSsiLogbookToSsrf, type SsiToSsrfResult } from '@/models/ssi/ssrf-import';
import type { SsiCredentials } from '@/models/ssi/credentials';
import {
  MIN_QUERY_LENGTH,
  nearestSsiSite,
  searchSsiSites,
  type NearestSsiSite,
  type SsiSite,
} from '@/models/ssi/sites';
import { t } from '@/i18n';

/**
 * The tag a synced dive carries. It is the only durable record that a dive went
 * to SSI - the SSRF format has nowhere else the app may write, and it is in the
 * file, so it survives an export and a reinstall.
 */
export const SSI_TAG = 'ssi';

export function isSyncedToSsi(dive: { tags: string[] }): boolean {
  return dive.tags.some((tag) => tag.toLocaleLowerCase() === SSI_TAG);
}

// --- Account ---------------------------------------------------------------

/**
 * Who the app is signed in as, read from the keychain. Never garbage-collected
 * and never stale: it only changes when the two mutations below change it, and
 * they set it directly.
 */
export function useSsiAccount(): UseQueryResult<SsiAccount | null> {
  return useQuery({
    queryKey: queryKeys.ssiAccount(),
    queryFn: () => readAccount(),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useSsiSignIn(): UseMutationResult<SsiAccount, Error, SsiCredentials> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (credentials: SsiCredentials) => signIn(credentials),
    onSuccess: (account) => {
      client.setQueryData(queryKeys.ssiAccount(), account);
      // The dive number and the buddies came from the previous account's logbook.
      client.removeQueries({ queryKey: queryKeys.ssiLogbook() });
      client.removeQueries({ queryKey: queryKeys.ssiDownload() });
    },
  });
}

export function useSsiSignOut(): UseMutationResult<void, Error, void> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => signOut(),
    onSuccess: () => {
      client.setQueryData(queryKeys.ssiAccount(), null);
      client.removeQueries({ queryKey: queryKeys.ssiLogbook() });
      client.removeQueries({ queryKey: queryKeys.ssiDownload() });
    },
  });
}

// --- Dive site catalogue ---------------------------------------------------

/**
 * The catalogue itself. Downloaded on first use, which takes seconds and tens
 * of megabytes of transient memory (see src/lib/ssi/site-cache.ts), so it is
 * pinned in the cache for the life of the app rather than re-parsed per screen.
 *
 * `enabled` is the caller's business: the sync screen wants it, Settings only
 * wants to know whether it is there, which is what `useSsiSiteIndexInfo` is for.
 */
export function useSsiSiteIndex(enabled = true): UseQueryResult<SsiSite[]> {
  const client = useQueryClient();
  return useQuery({
    queryKey: queryKeys.ssiSiteIndex(),
    queryFn: () =>
      ensureSiteIndex((sites) => {
        client.setQueryData(queryKeys.ssiSiteIndex(), sites);
        client.invalidateQueries({ queryKey: queryKeys.ssiSiteIndexInfo() });
      }),
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}

/** Count and download date, for the Settings row. Cheap: metadata only. */
export function useSsiSiteIndexInfo(): UseQueryResult<SsiSiteIndexInfo> {
  return useQuery({
    queryKey: queryKeys.ssiSiteIndexInfo(),
    queryFn: () => siteIndexInfo(),
    initialData: siteIndexInfo,
    staleTime: Infinity,
  });
}

/** Re-downloads the catalogue, replacing both the file and the cached array. */
export function useRefreshSsiSites(): UseMutationResult<SsiSite[], Error, void> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => refreshSiteIndex(),
    onSuccess: (sites) => {
      client.setQueryData(queryKeys.ssiSiteIndex(), sites);
      client.invalidateQueries({ queryKey: queryKeys.ssiSiteIndexInfo() });
    },
  });
}

/**
 * Name search over the loaded catalogue.
 *
 * Not a query: the catalogue is already in memory and the match is a synchronous
 * scan of an array, so putting it behind a queryFn would buy a cache entry per
 * keystroke and nothing else. Debouncing belongs to the caller, which owns the
 * text field.
 */
export function useSsiSiteSearch(sites: readonly SsiSite[] | undefined, query: string): SsiSite[] {
  return useMemo(() => (sites ? searchSsiSites(sites, query) : []), [sites, query]);
}

export function isSearchable(query: string): boolean {
  return query.trim().length >= MIN_QUERY_LENGTH;
}

/**
 * The catalogue site closest to a position, or null when none is close enough.
 * Also a memo rather than a query, for the same reason.
 */
export function useSsiNearestSite(
  sites: readonly SsiSite[] | undefined,
  lat: number | null,
  lon: number | null
): NearestSsiSite | null {
  return useMemo(
    () => (sites && lat !== null && lon !== null ? nearestSsiSite(sites, lat, lon) : null),
    [sites, lat, lon]
  );
}

// --- Syncing a dive --------------------------------------------------------

/**
 * The number the dive will be filed under and the buddies it can be filed with.
 * Kept short-lived: it is a fact about a logbook on someone else's server, and
 * syncing a dive makes the number wrong.
 */
export function useSsiLogbook(enabled = true): UseQueryResult<SsiLogbook> {
  return useQuery({
    queryKey: queryKeys.ssiLogbook(),
    queryFn: ({ signal }) => fetchSsiLogbook(signal),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export type SsiSyncInput = {
  dive: Dive;
  profile: PlotInfo;
  /** The dive's own site, for the position that goes with the dive. */
  site?: DiveSite;
  ssiSiteId: number;
  /**
   * The SSI buddies to attach, from the diver's own SSI list. Empty is a
   * perfectly ordinary answer - it means a solo dive, or one nobody bothered
   * to name.
   */
  ssiBuddyIds: number[];
};

/**
 * Converts the dive, writes it to SSI, and only then tags it locally. The order
 * matters: a tag written first would claim a dive was synced when the upload
 * had yet to happen, and this is the app's only record of it.
 *
 * The number is fetched here rather than taken from the query above so that a
 * sync begun minutes after the screen opened still lands on a free number.
 */
export function useSyncDiveToSsi(): UseMutationResult<void, Error, SsiSyncInput> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async ({ dive, profile, site, ssiSiteId, ssiBuddyIds }: SsiSyncInput) => {
      const logbook = await client.fetchQuery({
        queryKey: queryKeys.ssiLogbook(),
        queryFn: ({ signal }) => fetchSsiLogbook(signal),
        staleTime: 60 * 1000,
      });

      await saveSsiDive(
        convertDiveToSsi({
          dive, profile, site, ssiSiteId, ssiBuddyIds, nr: logbook.nextNumber,
          diveRef: uuid.v4(),
        })
      );

      if (!isSyncedToSsi(dive)) {
        updateDive(dive.id, { tags: [...dive.tags, SSI_TAG] }, SSI_TAG_KIND);
        // flush() only writes a change that was scheduled, so mark the log dirty
        // first. The screen is about to close, so this must not sit in the
        // debounce.
        schedulePersist();
        await flush();
      }
    },
    onSuccess: async () => {
      // The dive gained a tag, and SSI's next free number moved on.
      client.removeQueries({ queryKey: queryKeys.ssiLogbook() });
      await client.invalidateQueries({ queryKey: queryKeys.logData() });
    },
    retry: false,
  });
}

// --- Downloading the logbook ----------------------------------------------

/** The labels are nice to have, so losing them never fails a download. */
function lookupsFor(client: ReturnType<typeof useQueryClient>) {
  return client
    .fetchQuery({
      queryKey: SITE_LOOKUPS_KEY,
      queryFn: ({ signal }) => fetchSsiSiteLookups(signal),
      staleTime: LOOKUPS_STALE_MS,
    })
    .catch(() => null);
}

/**
 * The SSI logbook, for the import screen to list and convert. Held for minutes: it is
 * the largest thing the app downloads, and it is about someone else's server.
 */
export function useSsiDownload(): UseQueryResult<SsiDownload> {
  const client = useQueryClient();
  return useQuery({
    queryKey: queryKeys.ssiDownload(),
    queryFn: async () => fetchSsiDownload(await lookupsFor(client)),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: true,
    retry: 1,
  });
}

/**
 * Adds the chosen dives to the logbook. A chosen dive the logbook already has is left
 * alone: its original download beats SSI's copy. Saved straight away, as every import is.
 */
export function useImportSelectedSsiDives(): UseMutationResult<
  SsiToSsrfResult,
  Error,
  { download: SsiDownload; keys: ReadonlySet<string> }
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ download, keys }) => {
      await ensureLogbookLoaded(client);
      const result = convertSsiLogbookToSsrf({
        ...download,
        only: keys,
        existingDives: listDives(),
        existingSites: listDiveSites(),
      });
      if (result.dives > 0) {
        const file = writeSsiSsrfFile(result.xml, 'ssi-import.ssrf');
        try {
          importFile(file.nativePath);
        } finally {
          file.remove();
        }
      }
      return result;
    },
    onSuccess: async (result) => {
      if (result.dives > 0) {
        await resetData(client);
        schedulePersist();
        await flush();
      }
    },
    retry: false,
  });
}

/**
 * Makes the SSI logbook the working logbook, discarding what was there. Refuses an SSI
 * response with no dives in it: an empty logbook would load without complaint, and a
 * glitch on SSI's side must not be able to wipe the diver's log.
 */
export function useReplaceWithSsiLogbook(): UseMutationResult<
  SsiToSsrfResult,
  Error,
  SsiDownload
> {
  const replace = useReplaceLogbook();
  return useMutation({
    mutationFn: async (download) => {
      const result = convertSsiLogbookToSsrf(download);
      if (result.dives === 0) {
        throw new Error(t('errors.ssi.noDives'));
      }
      const file = writeSsiSsrfFile(result.xml, 'ssi-replace.ssrf');
      try {
        await replace.mutateAsync(file.nativePath);
      } finally {
        file.remove();
      }
      return result;
    },
    retry: false,
  });
}

/**
 * The whole SSI logbook as a new .ssrf file, ignoring what is in the app. Opening it
 * through the existing logbook import is how it becomes the working log.
 */
export function useDownloadSsiLogbook(): UseMutationResult<string, Error, void> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { xml } = await buildSsiSsrf({ lookups: await lookupsFor(client) });
      const stamp = new Date().toISOString().slice(0, 10);
      return writeSsiSsrfFile(xml, `ssi-logbook-${stamp}.ssrf`).uri;
    },
    retry: false,
  });
}

const SITE_LOOKUPS_KEY = ['ssi', 'site-lookups'];
const LOOKUPS_STALE_MS = 7 * 24 * 60 * 60 * 1000;

/** Reference data, so it is kept for a week. Without it the coded rows are left out. */
export function useSsiSiteLookups() {
  return useQuery({
    queryKey: SITE_LOOKUPS_KEY,
    queryFn: ({ signal }) => fetchSsiSiteLookups(signal),
    staleTime: LOOKUPS_STALE_MS,
    gcTime: LOOKUPS_STALE_MS,
    retry: 1,
  });
}

export function useSsiSiteDetail(id: number) {
  return useQuery({
    queryKey: ['ssi', 'site-detail', id],
    queryFn: ({ signal }) => fetchSsiSiteDetail(id, signal),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}
