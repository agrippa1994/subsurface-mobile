// AI-generated (Claude)
// The dive list.
//
// Read-only in this task; editing arrives in task 10. The screen owns no data:
// it renders whatever the store cached from the module, grouped by the
// presentation model, and shows the loading / empty / error placeholders around
// it.
import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { DiveListView } from '@/components/dive-list-view';
import { StatusView } from '@/components/status-view';
import { formatErrorLine } from '@/models/errors';
import { groupDivesByTrip } from '@/models/dive-list';
import { useLogStore } from '@/store/log-store';
import { useUnitSystem } from '@/store/settings-store';

export default function DivesScreen() {
  const router = useRouter();
  const status = useLogStore((state) => state.status);
  const dives = useLogStore((state) => state.dives);
  const error = useLogStore((state) => state.error);
  const open = useLogStore((state) => state.open);
  const unitSystem = useUnitSystem();

  const sections = useMemo(() => groupDivesByTrip(dives), [dives]);

  if (status === 'error' && error) {
    return (
      <StatusView
        kind="error"
        title="The logbook could not be opened"
        description={formatErrorLine(error)}
        systemImage="exclamationmark.triangle"
        actionLabel="Try again"
        onAction={() => void open()}
      />
    );
  }

  if (status === 'idle' || status === 'loading') {
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
