// AI-generated (Claude)
// The dive list.
//
// The screen owns no data: it renders whatever the module answered on the last
// read, grouped by the presentation model, and shows the loading / empty /
// error placeholders around it. Deleting from the list (a swipe on iOS) asks
// first, the same way the dive editor does - a deleted dive is gone for good.
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';

import { DiveListView } from '@/components/dive-list-view';
import { StatusView } from '@/components/status-view';
import { warned } from '@/lib/haptics';
import { flush } from '@/lib/logbook-persist';
import type { DiveSummary } from '@/models';
import { describeError, formatErrorLine } from '@/models/errors';
import { diveRowTitle, groupDivesByTrip } from '@/models/dive-list';
import { useDives, useLogbook } from '@/queries/logbook';
import { useDeleteDive } from '@/queries/logbook-mutations';
import { useUnitSystem } from '@/queries/settings';

export default function DivesScreen() {
  const router = useRouter();
  const logbook = useLogbook();
  const { data: dives = [] } = useDives();
  const unitSystem = useUnitSystem();
  const deleteDive = useDeleteDive();

  const sections = useMemo(() => groupDivesByTrip(dives), [dives]);

  const onDeleteDive = useCallback(
    (dive: DiveSummary) => {
      warned();
      Alert.alert(
        `Delete "${diveRowTitle(dive)}"?`,
        'This dive and its profile are gone for good.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  await deleteDive.mutateAsync(dive.id);
                  // Same as the editor: a force-quit right after must still find
                  // the dive gone from disk.
                  await flush();
                } catch (error) {
                  Alert.alert(
                    'The dive could not be deleted',
                    formatErrorLine(describeError(error)),
                  );
                }
              })();
            },
          },
        ],
      );
    },
    [deleteDive],
  );

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
      onDeleteDive={onDeleteDive}
    />
  );
}
