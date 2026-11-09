// AI-generated (Claude)
// A dive by its start time, for links from outside the app.
//
// A widget names a dive by when it started rather than by id: ids are
// process-local and reassigned on every load (modules/ssrf-core/cpp/API.md),
// and a widget's link outlives the process that wrote it. This route waits for
// the dive list, finds the dive and hands over to the dive screen; a dive that
// is no longer there (deleted, or the logbook replaced) lands on the list.
import { Redirect, useLocalSearchParams } from 'expo-router';

import { StatusView } from '@/components/status-view';
import { sortDivesNewestFirst } from '@/models/dive-list';
import { useDives } from '@/queries/logbook';

export default function DiveAtTimeScreen() {
  const { when } = useLocalSearchParams<{ when: string }>();
  const { data: dives, isError } = useDives();

  if (isError) {
    return <Redirect href="/dives" />;
  }
  if (!dives) {
    return <StatusView kind="loading" title="Opening dive" />;
  }
  const start = Number(when);
  // Newest first, so of two dives logged at the same second the one a widget
  // showed (the newest) wins.
  const dive = sortDivesNewestFirst(dives).find((candidate) => candidate.when === start);
  return <Redirect href={dive ? `/dives/${dive.id}` : '/dives'} />;
}
