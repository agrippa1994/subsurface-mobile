// AI-generated (Claude)
// A trip's summary, notes and dives on Android, in Compose. A long press on a dive
// offers its removal in a bottom sheet.
import { Host } from '@/components/material/host';
import { Box, LazyColumn, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxSize } from '@expo/ui/jetpack-compose/modifiers';
import { useState } from 'react';

import { M3ActionSheet } from '@/components/material/action-sheet';
import { M3DiveRow } from '@/components/material/dive-row';
import { M3ActionRow, M3Note, M3Section, M3ValueRow } from '@/components/material/list';
import type { DiveSummary } from '@/models';
import { diveRowTitle, toDiveRow } from '@/models/dive-list';

import type { TripDetailViewProps } from './trip-detail-view';

export type { TripDetailViewProps };

export function TripDetailView({
  summary,
  summaryFooter,
  location,
  notes,
  dives,
  units,
  onEdit,
  onSelectDive,
  onRemoveDive,
  onUngroup,
}: TripDetailViewProps) {
  const palette = useMaterialColors();
  const [pressed, setPressed] = useState<DiveSummary | null>(null);
  const text = notes.trim();
  return (
    <Host style={{ flex: 1, backgroundColor: palette.surface }}>
      <Box modifiers={[fillMaxSize()]}>
        <LazyColumn modifiers={[fillMaxSize()]} contentPadding={{ bottom: 24 }}>
          <M3Section title="Summary" footer={summaryFooter}>
            {location.trim() === '' ? <M3ActionRow label="Add a Location" onPress={onEdit} /> : null}
            {summary.map((row) => (
              <M3ValueRow key={row.label} label={row.label} value={row.value} />
            ))}
          </M3Section>
          <M3Section title="Notes">
            {text !== '' ? <M3Note>{text}</M3Note> : <M3ActionRow label="Add Notes" onPress={onEdit} />}
          </M3Section>
          <M3Section title="Dives">
            {dives.map((dive) => (
              <M3DiveRow
                key={dive.id}
                row={toDiveRow(dive, units)}
                onPress={() => onSelectDive(dive.id)}
                onLongPress={() => setPressed(dive)}
              />
            ))}
          </M3Section>
          <M3Section footer="The trip goes away. Its dives stay in your logbook.">
            <M3ActionRow label="Ungroup Trip" destructive onPress={onUngroup} />
          </M3Section>
        </LazyColumn>
        {pressed ? (
          <M3ActionSheet
            title={diveRowTitle(pressed)}
            actions={[
              {
                label: 'Remove from Trip',
                icon: 'minus.circle',
                onPress: () => onRemoveDive(pressed),
              },
            ]}
            onDismiss={() => setPressed(null)}
          />
        ) : null}
      </Box>
    </Host>
  );
}
