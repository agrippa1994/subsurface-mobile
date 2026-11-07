// AI-generated (Claude)
// The configurable chart, minus its rendering: which chart, what it is allowed to
// become, and the dives behind what was tapped.
//
// The configuration lives in settings.json, so the last chart survives a restart, and
// each change goes through StatsState in C++: what comes back is what to keep. All the
// screens of the stack read the same one, so a change in the builder redraws the chart
// behind it.

import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { statsChart } from '../../../modules/ssrf-core/src';
import type { StatsChart, StatsChartChange, StatsChartConfig, StatsChartConfigInput } from '@/models';
import { describeError, formatErrorLine } from '@/models/errors';
import {
  DEFAULT_STATS_CONFIG,
  dotTitle,
  foldSeries,
  phoneFriendlyChart,
  selectionReadout,
  type ChartSelection,
} from '@/models/stats-chart';
import { useDives, useStatsChart } from '@/queries/logbook';
import { useSettings, useUpdateSettings } from '@/queries/settings';

import { useStatisticsContext } from './statistics-context';

/** Sets and changes the configuration. Synchronous, as every call into the core is. */
export function useChartConfig() {
  const settings = useSettings();
  const update = useUpdateSettings();
  const config: StatsChartConfigInput = settings.statsChart ?? DEFAULT_STATS_CONFIG;
  const imperial = settings.unitSystem === 'imperial';
  const { mutate } = update;

  const setConfig = useCallback(
    (input: StatsChartConfigInput) => {
      const result = statsChart({ config: input, imperial, plot: false });
      mutate({ statsChart: result.config });
    },
    [imperial, mutate],
  );

  const change = useCallback(
    (next: StatsChartChange) => {
      const result = statsChart({ config, change: next, imperial, plot: false });
      const friendly = phoneFriendlyChart(next, result.config, result.options);
      const settled = friendly
        ? statsChart({ config: result.config, change: { kind: 'chart', value: friendly }, imperial, plot: false }).config
        : result.config;
      mutate({ statsChart: settled });
    },
    [config, imperial, mutate],
  );

  return { config, setConfig, change };
}

export type ChartScreen = ReturnType<typeof useChartScreen>;

export function useChartScreen() {
  const router = useRouter();
  const { filter, setBehind } = useStatisticsContext();
  const { unitSystem } = useSettings();
  const { config, change } = useChartConfig();
  const query = useStatsChart(config, filter, unitSystem);
  const [selected, setSelected] = useState<{ chart: StatsChart; selection: ChartSelection } | null>(null);

  const result = query.data;
  const chart: StatsChart | null = useMemo(() => (result?.chart ? foldSeries(result.chart) : null), [result]);
  // A selection is indexed into its chart, so a new chart starts with none.
  const selection = selected && selected.chart === chart ? selected.selection : null;
  const setSelection = useCallback(
    (next: ChartSelection) => setSelected(chart ? { chart, selection: next } : null),
    [chart],
  );

  const { data: allDives } = useDives();
  const readout = useMemo(() => {
    const read = chart ? selectionReadout(chart, selection) : null;
    if (!read || selection?.kind !== 'point') {
      return read;
    }
    // A dot is one dive, and worth naming.
    const dive = allDives?.find((candidate) => candidate.id === read.dives[0]);
    return dive ? { ...read, title: dotTitle(dive.siteName, dive.when) } : read;
  }, [chart, selection, allDives]);

  const showDives = useCallback(
    (title: string, ids: readonly number[]) => {
      if (ids.length === 1) {
        router.push(`/statistics/dive/${ids[0]}`);
        return;
      }
      setBehind({ title, ids });
      router.push('/statistics/dives');
    },
    [router, setBehind],
  );

  return {
    config: result?.config ?? (config as StatsChartConfig),
    options: result?.options ?? null,
    dives: result?.dives ?? 0,
    chart,
    selection,
    setSelection,
    readout,
    change,
    showDives,
    loading: query.isPending,
    error: query.error ? formatErrorLine(describeError(query.error)) : null,
  };
}
