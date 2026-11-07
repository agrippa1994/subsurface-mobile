// AI-generated (Claude)
// What can be done with the dives marked in the list, as a row of text buttons
// under it: on Android, whose toolbar draws no text, and in a tablet's sidebar,
// which has no navigation bar for the iOS menu (dive-selection-bar.ios.tsx) to sit in.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DiveSummary } from '@/models';

export type DiveSelectionBarProps = {
  dives: readonly DiveSummary[];
  onNewTrip: () => void;
  onAddToTrip: () => void;
  onRemoveFromTrip: () => void;
};

export function DiveSelectionRow({
  dives,
  onNewTrip,
  onAddToTrip,
  onRemoveFromTrip,
}: DiveSelectionBarProps) {
  const theme = useTheme();
  const none = dives.length === 0;
  const button = (label: string, disabled: boolean, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={Spacing.two}
      onPress={onPress}>
      <Text style={[styles.label, { color: disabled ? theme.textSecondary : theme.accent }]}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View style={[styles.bar, { backgroundColor: theme.backgroundElement }]}>
      {button('New Trip', none, onNewTrip)}
      {button('Add to Trip', none, onAddToTrip)}
      {button('Remove', !dives.some((dive) => dive.tripId !== 0), onRemoveFromTrip)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
});
