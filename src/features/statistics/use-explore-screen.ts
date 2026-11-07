// AI-generated (Claude)
// The Explore screen: start from a question, go on with the last chart, or build one.
import { useRouter } from 'expo-router';

import { chartDescription, chartHeadline, STATS_PRESETS, type StatsPreset } from '@/models/stats-chart';
import { useSettings } from '@/queries/settings';

import { useChartConfig } from './use-chart-screen';

export function useExploreScreen() {
  const router = useRouter();
  const { statsChart } = useSettings();
  const { setConfig } = useChartConfig();

  return {
    last: statsChart ? { title: chartHeadline(statsChart), detail: chartDescription(statsChart) } : null,
    presets: STATS_PRESETS,
    openLast: () => router.push('/statistics/chart'),
    build: () => {
      // On from the last chart, or from the first question if there has been none.
      if (!statsChart) {
        setConfig(STATS_PRESETS[0].config);
      }
      router.push('/statistics/chart?build=1');
    },
    openPreset: (preset: StatsPreset) => {
      setConfig(preset.config);
      router.push('/statistics/chart');
    },
  };
}
