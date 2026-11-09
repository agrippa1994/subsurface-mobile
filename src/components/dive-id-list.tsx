// AI-generated (Claude)
// A plain list of dives, portable variant. iOS draws a SwiftUI List instead, see
// dive-id-list.ios.tsx.
import { FlatList, StyleSheet, View } from 'react-native';

import { DIVE_ROW_SEPARATOR_INSET, DiveRowView } from '@/components/dive-row';
import { useTheme } from '@/hooks/use-theme';
import type { DiveSummary, Units } from '@/models';
import { toDiveRow } from '@/models/dive-list';

export type DiveIdListProps = {
  dives: DiveSummary[];
  units: Units;
  onSelect: (id: number) => void;
};

export function DiveIdList({ dives, units, onSelect }: DiveIdListProps) {
  const theme = useTheme();
  return (
    <FlatList
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      data={dives}
      keyExtractor={(dive) => String(dive.id)}
      renderItem={({ item }) => (
        <DiveRowView row={toDiveRow(item, units)} onPress={() => onSelect(item.id)} />
      )}
      ItemSeparatorComponent={() => (
        <View
          style={{
            height: StyleSheet.hairlineWidth,
            marginLeft: DIVE_ROW_SEPARATOR_INSET,
            backgroundColor: theme.separator,
          }}
        />
      )}
    />
  );
}
