// AI-generated (Claude)
// The dive list.
//
// Read-only in this task; editing arrives in task 10. The screen owns no data:
// it renders whatever the module answered on the last read, grouped by the
// presentation model, and shows the loading / empty / error placeholders around
// it.
import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { DiveListView } from '@/components/dive-list-view';
import { StatusView } from '@/components/status-view';
import { describeError, formatErrorLine } from '@/models/errors';
import { groupDivesByTrip } from '@/models/dive-list';
import { useDives, useLogbook } from '@/queries/logbook';
import { useUnitSystem } from '@/queries/settings';

export default function DivesScreen() {
  const router = useRouter();
  const logbook = useLogbook();
  const { data: dives = [] } = useDives();
  const unitSystem = useUnitSystem();

  const sections = useMemo(() => groupDivesByTrip(dives), [dives]);

  if (logbook.isError) {
    return (
      <StatusView
        kind="error"
        title="The logbook could not be opened"
        description={formatErrorLine(describeError(logbook.error))}
        systemImage="exclamationmark.triangle"
        actionLabel="Try again"
        onAction={() => void logbook.refetch()}
      />
    );
  }

  if (!logbook.isSuccess) {
    return <StatusView kind="loading" title="Opening logbook" />;
  }

  if (dives.length === 0) {
    return (
      <StatusView
        kind="empty"
        title="No dives yet"
        description="Import a Suunto database or a Subsurface logbook to get started."
        systemImage="water.waves"
      />
    );
  }

  return (
    <DiveListView
      sections={sections}
      unitSystem={unitSystem}
      onSelectDive={(id) => router.push(`/dives/${id}`)}
    />
  );
}
