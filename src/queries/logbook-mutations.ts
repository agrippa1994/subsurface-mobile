// AI-generated (Claude)
// Changing the logbook.
//
// Every mutation applies the change in the module, tells the cache what it
// invalidated and schedules a save - the SSRF file is the source of truth, so
// nothing is a change until it is on disk. Invalidation is wholesale on purpose
// (`['log','data']`, not one key): the module owns the divelog, so the only
// honest thing the cache can do after a mutation is re-read it.
//
// The load-shaped mutations go further and *remove* the derived subtree instead
// of invalidating it, because dive ids are process-local and a cached
// ['log','data','dive',7] would survive pointing at a different dive.
//
// Anything that changes the divelog first waits for the working logbook to be
// loaded (`ensureLogbookLoaded` / `settleLogbook`). The module holds a single
// divelog, so a change made while the initial load is still in flight is
// overwritten the moment that load lands - and it is not saved either, because
// the same load is what points the persist target at the logbook file.

import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import {
  deleteDive,
  deleteDiveSite,
  importFile,
  loadFromXML,
  saveToXML,
  ungroupDives,
  updateDive,
  upsertDiveSite,
} from '../../modules/ssrf-core/src';
import type {
  DeleteDiveResult,
  Dive,
  DivePatch,
  DiveSiteInput,
  ImportResult,
  LoadResult,
} from '@/models';
import { ensureLogbook } from '@/lib/logbook-file';
import { flush, schedulePersist, setPersistTarget } from '@/lib/logbook-persist';
import { queryKeys } from '@/lib/query-keys';
import { ensureLogbookLoaded, settleLogbook, type Logbook } from '@/queries/logbook';

/** After an edit: re-read everything derived, leaving the load itself alone. */
function invalidateData(client: QueryClient): Promise<void> {
  return client.invalidateQueries({ queryKey: queryKeys.logData() });
}

/**
 * After a load: point the cache at the new logbook and drop every id-bearing
 * answer that belonged to the old one. The root key is set rather than
 * invalidated so that nothing re-runs `loadFromXML` behind this.
 */
function adoptLogbook(client: QueryClient, logbook: Logbook): void {
  setPersistTarget(logbook.path);
  client.setQueryData(queryKeys.log(), logbook);
  client.removeQueries({ queryKey: queryKeys.logData() });
}

export function useUpdateDive(): UseMutationResult<Dive, Error, { id: number; patch: DivePatch }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }) => updateDive(id, patch),
    onSuccess: async () => {
      await invalidateData(client);
      schedulePersist();
    },
  });
}

/**
 * Removes a dive. The dive's own cache entries are *removed* rather than
 * invalidated: nothing can answer for that id any more, so a refetch behind the
 * closing screen would only come back as "no dive with id".
 */
export function useDeleteDive(): UseMutationResult<DeleteDiveResult, Error, number> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => deleteDive(id),
    onSuccess: async (_result, id) => {
      client.removeQueries({ queryKey: queryKeys.dive(id) });
      client.removeQueries({ queryKey: queryKeys.diveProfiles(id) });
      await invalidateData(client);
      schedulePersist();
    },
  });
}

export function useSaveSite(): UseMutationResult<number, Error, DiveSiteInput> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: DiveSiteInput) => upsertDiveSite(input),
    onSuccess: async () => {
      await invalidateData(client);
      schedulePersist();
    },
  });
}

export function useDeleteSite(): UseMutationResult<void, Error, number> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (uuid: number) => deleteDiveSite(uuid),
    onSuccess: async () => {
      await invalidateData(client);
      schedulePersist();
    },
  });
}

/**
 * Takes every dive out of its trip. Not an edit the user would expect to lose,
 * so it does not wait for the debounce.
 */
export function useUngroupDives(): UseMutationResult<void, Error, void> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      ungroupDives();
    },
    onSuccess: async () => {
      await invalidateData(client);
      schedulePersist();
      await flush();
    },
  });
}

/**
 * Merges a file of any supported format into the loaded log and writes the
 * logbook straight away - an import is not a change the user would expect to
 * lose, so it does not wait for the mutation debounce.
 *
 * The merge renumbers dives, so this drops the derived subtree rather than
 * invalidating it.
 */
export function useImportFile(): UseMutationResult<ImportResult, Error, string> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (path: string) => {
      // The merge goes into whatever the module holds, so it must not start
      // before the working logbook is in there. A file handed over at launch
      // (share sheet, AirDrop, a tapped attachment) arrives while the initial
      // load may still be in flight, and that load would then land *after* the
      // merge: `loadFromXML` replaces the divelog, so the imported dives would
      // be gone from the list - and gone from disk too, because the persist
      // target is set by the same load and was still null when the import
      // asked for a save.
      await ensureLogbookLoaded(client);
      return importFile(path);
    },
    onSuccess: async () => {
      client.removeQueries({ queryKey: queryKeys.logData() });
      schedulePersist();
      await flush();
    },
  });
}

/**
 * Replaces the working logbook with `path`: the file is loaded and then saved
 * over the app's own logbook, so the picked file - which may be a temporary copy
 * handed over by another app - is never the file the app keeps writing to.
 */
export function useReplaceLogbook(): UseMutationResult<Logbook, Error, string> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (path: string): Promise<Logbook> => {
      // Same launch race as the import above, from the other side: a load still
      // in flight would resolve after this one and put the previous logbook
      // back, persist target included.
      await settleLogbook(client);
      const target = await ensureLogbook();
      let lastLoad: LoadResult;
      try {
        lastLoad = loadFromXML(path);
      } catch (error) {
        // A failed parse leaves the module's divelog cleared, so the app would
        // be sitting on a cache of dives that are no longer there. Put the
        // working logbook back before handing the failure to the screen.
        adoptLogbook(client, { path: target, lastLoad: loadFromXML(target) });
        throw error;
      }
      // The loaded content now belongs to the app's own logbook, not to the
      // file it came from.
      return { path: target, lastLoad };
    },
    onSuccess: async (logbook) => {
      adoptLogbook(client, logbook);
      schedulePersist();
      await flush();
    },
  });
}

/**
 * Re-reads the working logbook from disk, seeding it from the bundled sample if
 * it is not there. Deleting the file first (`resetLogbook`) and then calling
 * this is how Settings restores the sample.
 *
 * This is a mutation rather than a refetch of the log query because it must
 * also drop the derived subtree: a re-read reassigns every dive id.
 */
export function useReloadLogbook(): UseMutationResult<Logbook, Error, void> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<Logbook> => {
      await settleLogbook(client);
      const path = await ensureLogbook();
      return { path, lastLoad: loadFromXML(path) };
    },
    onSuccess: (logbook) => adoptLogbook(client, logbook),
  });
}

/** Loads an arbitrary logbook, replacing whatever the module held. */
export function useLoadPath(): UseMutationResult<LoadResult, Error, string> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (path: string) => {
      await settleLogbook(client);
      return loadFromXML(path);
    },
    onSuccess: (lastLoad, path) => adoptLogbook(client, { path, lastLoad }),
  });
}

/** Writes the current logbook to `path` for sharing. Flushes first. */
export function useExportTo(): UseMutationResult<void, Error, string> {
  return useMutation({
    mutationFn: async (path: string) => {
      // Anything still inside the debounce belongs in the export too.
      await flush();
      saveToXML(path);
    },
  });
}
