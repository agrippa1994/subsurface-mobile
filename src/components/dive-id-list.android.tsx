// AI-generated (Claude)
// A plain list of dives on Android: a Compose LazyColumn of the dive list's rows.
import { Host } from '@/components/material/host';
import { LazyColumn, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxSize } from '@expo/ui/jetpack-compose/modifiers';

import { M3DiveRow } from '@/components/material/dive-row';
import { toDiveRow } from '@/models/dive-list';

import type { DiveIdListProps } from './dive-id-list';

export type { DiveIdListProps };

export function DiveIdList({ dives, unitSystem, onSelect }: DiveIdListProps) {
  const palette = useMaterialColors();
  return (
    <Host style={{ flex: 1, backgroundColor: palette.surface }}>
      <LazyColumn modifiers={[fillMaxSize()]}>
        <LazyColumn.Items
          data={dives}
          keyExtractor={(dive) => String(dive.id)}
          estimatedItemSize={72}>
          {({ item }) => (
            <M3DiveRow row={toDiveRow(item, unitSystem)} onPress={() => onSelect(item.id)} />
          )}
        </LazyColumn.Items>
      </LazyColumn>
    </Host>
  );
}
