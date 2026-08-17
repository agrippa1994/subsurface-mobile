// AI-generated (Claude)
// Reading the logbook.
//
// The native module owns the parsed divelog; these queries own nothing but a
// cache of what the last read returned, plus the pending/error state around it.
// Every queryFn is synchronous - the module's calls are blocking JSI calls -
// which is fine, a queryFn may return a value rather than a promise. Query is
// here for invalidation, not for async orchestration.
//
// Two consequences worth knowing before editing this file:
//
//   - `getStatistics` mutates core state (it implements its filter by marking
//     dives `selected`). That is safe only because synchronous queryFns cannot
//     interleave on the JS thread. Do not make these async.
//   - dive ids are process-local and reassigned on every load, so every query
//     below is gated on the log query having succeeded, and a load removes the
//     whole ['log'] subtree rather than invalidating it.

import {
  queryOptions,
  useQuery,
  type QueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

import {
  getDive,
  getProfile,
  getStatistics,
  listDives,
  listDiveSites,
  loadFromXML,
} from '../../modules/ssrf-core/src';
import type { Dive, DiveSite, DiveSummary, LoadResult, PlotInfo, StatsSummary } from '@/models';
import { toStatsFilter, type StatsFilterInput } from '@/models/statistics';
import { ensureLogbook } from '@/lib/logbook-file';
import { setPersistTarget } from '@/lib/logbook-persist';
import { queryKeys } from '@/lib/query-keys';
import { useGradientFactors } from '@/queries/settings';

export type Logbook = {
  /** Path of the logbook currently loaded. */
  path: string;
  /** Counts of the last load, for the "just imported" style summaries. */
  lastLoad: LoadResult;
};

/**
 * The working logbook: seeded from the bundled sample on first run, then parsed
 * into the module. The only genuinely asynchronous step in the whole data layer
 * is `ensureLogbook`, which may have to copy the sample out of the bundle.
 *
 * A failed load leaves the module's divelog cleared, so the derived queries
 * below stay disabled rather than showing dives that are no longer there.
 *
 * Shared with the mutations rather than inlined into the hook: this load
 * replaces the module's divelog and sets the persist target, so anything that
 * changes the log has to be able to wait for it (see
 * `src/queries/logbook-mutations.ts`).
 */
export function logbookQuery() {
  return queryOptions({
    queryKey: queryKeys.log(),
    queryFn: async (): Promise<Logbook> => {
      const path = await ensureLogbook();
      const lastLoad = loadFromXML(path);
      setPersistTarget(path);
      return { path, lastLoad };
    },
  });
}

export function useLogbook(): UseQueryResult<Logbook> {
  return useQuery(logbookQuery());
}

/**
 * Resolves once the working logbook is in the module, loading it if the app has
 * not got round to it yet. Rejects with whatever the load failed on.
 */
export function ensureLogbookLoaded(client: QueryClient): Promise<Logbook> {
  return client.ensureQueryData(logbookQuery());
}

/**
 * Waits for the load above to finish, successfully or not. Used by the
 * mutations that replace the logbook wholesale: they do not need the loaded
 * content, but they must not be overtaken by a load that is still in flight.
 */
export async function settleLogbook(client: QueryClient): Promise<void> {
  await ensureLogbookLoaded(client).catch(() => undefined);
}

/** True once a logbook is in the module and its ids are safe to use. */
function useLogLoaded(): boolean {
  return useLogbook().isSuccess;
}

export function useDives(): UseQueryResult<DiveSummary[]> {
  return useQuery({
    queryKey: queryKeys.dives(),
    queryFn: () => listDives(),
    enabled: useLogLoaded(),
  });
}

export function useSites(): UseQueryResult<DiveSite[]> {
  return useQuery({
    queryKey: queryKeys.sites(),
    queryFn: () => listDiveSites(),
    enabled: useLogLoaded(),
  });
}

/**
 * One full dive. The cached list rows carry no notes, suit or cylinders, so
 * anything past the list reads the dive itself.
 */
export function useDive(id: number): UseQueryResult<Dive> {
  return useQuery({
    queryKey: queryKeys.dive(id),
    queryFn: () => getDive(id),
    enabled: useLogLoaded() && Number.isFinite(id),
  });
}

/**
 * The plotted profile, computed with the gradient factors from Settings - a
 * change there recomputes rather than redraws, because the ceiling comes out of
 * the core.
 */
export function useProfile(id: number, dcIndex = 0): UseQueryResult<PlotInfo> {
  const gf = useGradientFactors();
  return useQuery({
    queryKey: queryKeys.profile(id, dcIndex, gf),
    queryFn: () => getProfile(id, dcIndex, gf),
    enabled: useLogLoaded() && Number.isFinite(id),
  });
}

/**
 * Statistics for a filter, aggregated in C++. The filtered numbers are never
 * derived from the unfiltered ones - the module recomputes them, which is what
 * keeps them identical to desktop's.
 */
export function useStatistics(input?: StatsFilterInput): UseQueryResult<StatsSummary> {
  const filter = input ? toStatsFilter(input) : undefined;
  return useQuery({
    queryKey: queryKeys.statistics(filter),
    queryFn: () => getStatistics(filter),
    enabled: useLogLoaded(),
  });
}
