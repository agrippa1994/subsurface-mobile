// AI-generated (Claude)
// The trip picker's list, portable fallback. iOS renders a SwiftUI List instead,
// see trip-picker-view.ios.tsx; both read the same presentation model.
import { FlatList, Pressable, StyleSheet, Text, View, type ColorValue } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Trip } from '@/models';
import { emptyPickerText, tripSubtitle, tripTitle } from '@/models/trips';

export type TripPickerViewProps = {
  /** What is on offer, nearest first, after any search. */
  trips: Trip[];
  /** Whether there are trips at all, before the search. */
  hasCandidates: boolean;
  searching: boolean;
  /** Whether any of the dives is in a trip it could leave. */
  canRemove: boolean;
  onNewTrip: () => void;
  onPickTrip: (trip: Trip) => void;
  onRemove: () => void;
};

export function TripPickerView({
  trips,
  hasCandidates,
  searching,
  canRemove,
  onNewTrip,
  onPickTrip,
  onRemove,
}: TripPickerViewProps) {
  const theme = useTheme();
  const row = (title: string, subtitle: string | null, color: ColorValue, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: theme.separator },
        pressed ? { backgroundColor: theme.backgroundSelected } : null,
      ]}>
      <Text style={[styles.title, { color }]} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
  return (
    <FlatList
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      data={trips}
      keyExtractor={(trip) => String(trip.id)}
      ListHeaderComponent={
        <View>
          {row('New Trip', null, theme.accent, onNewTrip)}
          {canRemove ? row('Remove from Trip', null, theme.danger, onRemove) : null}
        </View>
      }
      ListEmptyComponent={
        <Text style={[styles.empty, { color: theme.textSecondary }]}>
          {emptyPickerText(hasCandidates, searching)}
        </Text>
      }
      renderItem={({ item }) =>
        row(tripTitle(item.location), tripSubtitle(item), theme.text, () => onPickTrip(item))
      }
    />
  );
}

const styles = StyleSheet.create({
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
  },
  empty: {
    fontSize: 15,
    padding: Spacing.three,
  },
});
