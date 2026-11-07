// AI-generated (Claude)
// A plain list of dives, iOS variant: a SwiftUI List of the rows the dive list has.
import { Button, Host, List } from '@expo/ui/swift-ui';
import { accessibilityLabel, listStyle } from '@expo/ui/swift-ui/modifiers';

import { DiveRowContent } from '@/components/dive-row-swift';
import { toDiveRow } from '@/models/dive-list';

import type { DiveIdListProps } from './dive-id-list';

export type { DiveIdListProps };

export function DiveIdList({ dives, unitSystem, onSelect }: DiveIdListProps) {
  return (
    <Host style={{ flex: 1 }}>
      <List modifiers={[listStyle('plain')]}>
        {dives.map((dive) => {
          const row = toDiveRow(dive, unitSystem);
          return (
            <Button
              key={dive.id}
              onPress={() => onSelect(dive.id)}
              modifiers={[accessibilityLabel(row.accessibilityLabel)]}>
              <DiveRowContent row={row} />
            </Button>
          );
        })}
      </List>
    </Host>
  );
}
