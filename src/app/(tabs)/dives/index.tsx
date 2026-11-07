// AI-generated (Claude)
// First screen of the Dives stack: the dive list, or on a split layout, where the
// list has moved beside the stack, what the detail shows with no dive open.
import { Stack } from 'expo-router';

import { StatusView } from '@/components/status-view';
import { DiveListScreen } from '@/features/dives/dive-list-screen';
import { useSplitLayout } from '@/hooks/use-adaptive-layout';

export default function DivesIndexRoute() {
  const { split } = useSplitLayout();
  if (!split) {
    return <DiveListScreen />;
  }
  return (
    <>
      <Stack.Screen options={{ title: '', headerLargeTitle: false }} />
      <StatusView
        kind="empty"
        title="No dive selected"
        description="Pick a dive from the list to see its profile and details."
        systemImage="water.waves"
      />
    </>
  );
}
