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

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

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
 */
export function useLogbook(): UseQueryResult<Logbook> {
  return useQuery({
    queryKey: queryKeys.log(),
    queryFn: async (): Promise<Logbook> => {
      const path = await ensureLogbook();
      const lastLoad = loadFromXML(path);
      setPersistTarget(path);
      return { path, lastLoad };
    },
  });
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

export function useProfile(id: number, dcIndex = 0): UseQueryResult<PlotInfo> {
  return useQuery({
    queryKey: queryKeys.profile(id, dcIndex),
    queryFn: () => getProfile(id, dcIndex),
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
