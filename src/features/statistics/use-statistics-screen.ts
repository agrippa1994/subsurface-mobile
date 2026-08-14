// AI-generated (Claude)
// Everything the Statistics screen does, minus the rendering.
//
// Two calls into the module per render pass: one unfiltered summary, which is
// only used to populate the year picker, and one for the filter in force. The
// filtered numbers are never derived from the unfiltered ones - the module
// recomputes them, which is what keeps them identical to desktop's.

import { useMemo, useState } from 'react';

import { getStatistics } from '../../../modules/ssrf-core/src';
import type { DiveSite, StatsSummary } from '@/models';
import { describeError, formatErrorLine } from '@/models/errors';
import { filterYears, isFiltered, toStatsFilter, type StatsFilterInput } from '@/models/statistics';
import { useLogStore } from '@/store/log-store';

export type StatisticsScreen = {
  /** null while the module could not answer; `error` says why. */
  summary: StatsSummary | null;
  error: string | null;
  filter: StatsFilterInput;
  filtered: boolean;
  /** Years the log covers, newest first. Unaffected by the current filter. */
  years: number[];
  /** Sites with at least one dive, most-dived first. */
  sites: DiveSite[];
  setYear: (year: number | null) => void;
  setSite: (uuid: number | null) => void;
  clearFilter: () => void;
  /** True when the log itself is empty, as opposed to the filter matching nothing. */
  logEmpty: boolean;
};

export function useStatisticsScreen(): StatisticsScreen {
  const [filter, setFilter] = useState<StatsFilterInput>({ year: null, siteUuid: null });

  // Both the loaded path and the dive count change on every load and mutation,
  // so they are what makes the summaries stale.
  const logPath = useLogStore((state) => state.path);
  const dives = useLogStore((state) => state.dives);
  const sites = useLogStore((state) => state.sites);

  // logPath and the dive count are the invalidation keys, not inputs: the
  // module owns the divelog, so a reload or a mutation is what makes the last
  // answer stale.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const unfiltered = useMemo(() => read(), [logPath, dives.length]);
  const filtered = useMemo(
    () => (isFiltered(filter) ? read(filter) : unfiltered),
    [filter, unfiltered]
  );

  const years = useMemo(
    () => (unfiltered.summary ? filterYears(unfiltered.summary) : []),
    [unfiltered.summary]
  );

  const sitesWithDives = useMemo(
    () => sites.filter((site) => site.diveCount > 0).sort((a, b) => b.diveCount - a.diveCount),
    [sites]
  );

  return {
    summary: filtered.summary,
    error: filtered.error,
    filter,
    filtered: isFiltered(filter),
    years,
    sites: sitesWithDives,
    setYear: (year) => setFilter((current) => ({ ...current, year })),
    setSite: (siteUuid) => setFilter((current) => ({ ...current, siteUuid })),
    clearFilter: () => setFilter({ year: null, siteUuid: null }),
    logEmpty: dives.length === 0,
  };
}

type Result = { summary: StatsSummary | null; error: string | null };

function read(input?: StatsFilterInput): Result {
  try {
    return { summary: getStatistics(input ? toStatsFilter(input) : undefined), error: null };
  } catch (error) {
    return { summary: null, error: formatErrorLine(describeError(error)) };
  }
}
