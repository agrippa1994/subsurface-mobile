// AI-generated (Claude)
// The dives behind what was tapped on a chart.
//
// Looked up in the log rather than kept: a dive deleted or undone away since is gone
// from this list too, and the screen has nothing to show after a restart, when the
// state holding the ids is gone along with the chart it came from.
import { Stack, useRouter } from 'expo-router';
import { useMemo } from 'react';

import { DiveIdList } from '@/components/dive-id-list';
import { StatusView } from '@/components/status-view';
import { useStatisticsContext } from '@/features/statistics/statistics-context';
import { sortDivesNewestFirst } from '@/models/dive-list';
import { useDives } from '@/queries/logbook';
import { useUnits } from '@/queries/settings';

export default function DivesBehindChartScreen() {
  const { behind } = useStatisticsContext();
  const router = useRouter();
  const units = useUnits();
  const { data } = useDives();
  const dives = useMemo(() => {
    const ids = new Set(behind?.ids ?? []);
    return sortDivesNewestFirst((data ?? []).filter((dive) => ids.has(dive.id)));
  }, [behind, data]);

  return (
    <>
      <Stack.Screen options={{ title: behind?.title ?? 'Dives' }} />
      {dives.length === 0 ? (
        <StatusView
          kind="empty"
          title="No dives"
          description="These dives are no longer in the logbook."
          systemImage="chart.bar"
        />
      ) : (
        <DiveIdList
          dives={dives}
          units={units}
          onSelect={(id) => router.push(`/statistics/dive/${id}`)}
        />
      )}
    </>
  );
}
