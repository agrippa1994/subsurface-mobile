// AI-generated (Claude)
// Everything the Statistics screen does, minus the rendering.
//
// Two queries into the module: one unfiltered summary, which is only used to
// populate the year picker, and one for the filter in force. The filtered
// numbers are never derived from the unfiltered ones - the module recomputes
// them, which is what keeps them identical to desktop's.
//
// The filter is the stack's (statistics-context.tsx), so that a chart answers to the
// same one.

import { useMemo } from 'react';

import type { DiveSite, StatsSummary } from '@/models';
import { describeError, formatErrorLine } from '@/models/errors';
import {
  filterYears,
  isFiltered,
  NO_FILTER,
  withRecentPeriod,
  withYear,
  type RecentPeriod,
  type StatsFilterInput,
} from '@/models/statistics';
import { useDives, useSites, useStatistics } from '@/queries/logbook';

import { useStatisticsContext } from './statistics-context';

export type StatisticsScreen = {
  /** null while the module could not answer; `error` says why. */
  summary: StatsSummary | null;
  error: string | null;
  /** True until the first summary has been read. */
  loading: boolean;
  filter: StatsFilterInput;
  filtered: boolean;
  /** Years the log covers, newest first. Unaffected by the current filter. */
  years: number[];
  /** Sites with at least one dive, most-dived first. */
  sites: DiveSite[];
  setYear: (year: number | null) => void;
  /** The legacy summary's periods; clears the year, as a year clears it. */
  setRecentPeriod: (months: RecentPeriod | null) => void;
  setSite: (uuid: number | null) => void;
  /** Planned dives in the log. They count, as on desktop, unless left out. */
  plannedDives: number;
  setExcludePlanned: (exclude: boolean) => void;
  clearFilter: () => void;
  /** True when the log itself is empty, as opposed to the filter matching nothing. */
  logEmpty: boolean;
};

export function useStatisticsScreen(): StatisticsScreen {
  const { filter, setFilter } = useStatisticsContext();
  const active = isFiltered(filter);

  const { data: dives = [] } = useDives();
  const { data: sites = [] } = useSites();

  const unfiltered = useStatistics();
  // Keyed on the filter, so switching years hits the cache on the way back.
  // Unfiltered is reused rather than re-queried when no filter is set.
  const filtered = useStatistics(active ? filter : undefined);

  const years = useMemo(
    () => (unfiltered.data ? filterYears(unfiltered.data) : []),
    [unfiltered.data]
  );

  const sitesWithDives = useMemo(
    () => sites.filter((site) => site.diveCount > 0).sort((a, b) => b.diveCount - a.diveCount),
    [sites]
  );

  return {
    summary: filtered.data ?? null,
    error: filtered.error ? formatErrorLine(describeError(filtered.error)) : null,
    loading: filtered.isPending,
    filter,
    filtered: active,
    years,
    sites: sitesWithDives,
    setYear: (year) => setFilter((current) => withYear(current, year)),
    setRecentPeriod: (months) => setFilter((current) => withRecentPeriod(current, months)),
    setSite: (siteUuid) => setFilter((current) => ({ ...current, siteUuid })),
    plannedDives: dives.filter((dive) => dive.planned).length,
    setExcludePlanned: (excludePlanned) => setFilter((current) => ({ ...current, excludePlanned })),
    clearFilter: () => setFilter(() => NO_FILTER),
    logEmpty: dives.length === 0,
  };
}
