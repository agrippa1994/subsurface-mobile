// AI-generated (Claude)
// A trip's summary, notes and dives, portable fallback. iOS renders a SwiftUI
// List instead, see trip-detail-view.ios.tsx. There is no swipe here; a long
// press on a dive offers its removal.
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, type ColorValue } from 'react-native';

import { DiveRowView } from '@/components/dive-row';
import { FormSection } from '@/components/form';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DiveSummary, Units } from '@/models';
import { diveRowTitle, toDiveRow } from '@/models/dive-list';
import type { TripSummaryRow } from '@/models/trips';

export type TripDetailViewProps = {
  summary: TripSummaryRow[];
  summaryFooter?: string;
  location: string;
  notes: string;
  dives: DiveSummary[];
  units: Units;
  onEdit: () => void;
  onSelectDive: (id: number) => void;
  onRemoveDive: (dive: DiveSummary) => void;
  onUngroup: () => void;
};

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
  const theme = useTheme();
  const text = notes.trim();
  const action = (label: string, color: ColorValue, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed ? { backgroundColor: theme.backgroundSelected } : null,
      ]}>
      <Text style={[styles.action, { color }]}>{label}</Text>
    </Pressable>
  );
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <FormSection title="Summary" footer={summaryFooter}>
        {location.trim() === '' ? action('Add a Location', theme.accent, onEdit) : null}
        {summary.map((row) => (
          <View key={row.label} style={styles.row} accessible>
            <Text style={[styles.label, { color: theme.text }]}>{row.label}</Text>
            <Text selectable style={[styles.value, { color: theme.textSecondary }]}>
              {row.value}
            </Text>
          </View>
        ))}
      </FormSection>

      <FormSection title="Notes">
        {text !== '' ? (
          <Text selectable style={[styles.notes, { color: theme.text }]}>
            {text}
          </Text>
        ) : (
          action('Add Notes', theme.accent, onEdit)
        )}
      </FormSection>

      <FormSection title="Dives">
        {dives.map((dive) => (
          <DiveRowView
            key={dive.id}
            row={toDiveRow(dive, units)}
            onPress={() => onSelectDive(dive.id)}
            onLongPress={() =>
              Alert.alert(diveRowTitle(dive), undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove from Trip', onPress: () => onRemoveDive(dive) },
              ])
            }
          />
        ))}
      </FormSection>

      <FormSection footer="The trip goes away. Its dives stay in your logbook.">
        {action('Ungroup Trip', theme.danger, onUngroup)}
      </FormSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.four,
    padding: Spacing.three,
    paddingBottom: Spacing.six,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  label: {
    fontSize: 16,
  },
  value: {
    flexShrink: 1,
    fontSize: 16,
    textAlign: 'right',
  },
  action: {
    fontSize: 16,
    fontWeight: '600',
  },
  notes: {
    fontSize: 16,
    lineHeight: 22,
    padding: Spacing.three,
  },
});
