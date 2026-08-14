// AI-generated (Claude)
// Dive detail - placeholder.
//
// Task 08 replaces the body of this screen with the profile diagram and the
// full dive header. What matters here is the plumbing: the route carries the
// dive id, and the id is resolved against the module's current log rather than
// against anything cached in the navigation state, because ids are reassigned
// on every load (see modules/ssrf-core/cpp/API.md).
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { StatusView } from '@/components/status-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDepth, formatDuration, formatTemperature } from '@/models';
import { toDiveRow } from '@/models/dive-list';
import { selectDive, useLogStore } from '@/store/log-store';
import { useUnitSystem } from '@/store/settings-store';

export default function DiveDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const diveId = Number(id);
  const dive = useLogStore((state) => selectDive(state, diveId));
  const unitSystem = useUnitSystem();
  const theme = useTheme();

  if (!dive) {
    return (
      <StatusView
        kind="error"
        title="Dive not found"
        description="It is no longer part of the loaded logbook."
        systemImage="questionmark.circle"
      />
    );
  }

  const row = toDiveRow(dive, unitSystem);
  const facts: [string, string][] = [
    ['Date', `${row.dateText} ${row.timeText}`],
    ['Max depth', dive.maxDepthMm > 0 ? formatDepth(dive.maxDepthMm, unitSystem) : '-'],
    ['Average depth', dive.meanDepthMm > 0 ? formatDepth(dive.meanDepthMm, unitSystem) : '-'],
    ['Duration', dive.durationSec > 0 ? formatDuration(dive.durationSec) : '-'],
    [
      'Water temperature',
      dive.waterTempMkelvin > 0 ? formatTemperature(dive.waterTempMkelvin, unitSystem) : '-',
    ],
    ['Dive site', dive.siteName || '-'],
    ['Trip', dive.tripLocation || '-'],
    ['Buddy', dive.buddy || '-'],
    ['Divemaster', dive.diveguide || '-'],
    ['Tags', dive.tags.length > 0 ? dive.tags.join(', ') : '-'],
    ['Dive computer', dive.dcModel || '-'],
  ];

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: row.title }} />
      {facts.map(([label, value]) => (
        <View key={label} style={styles.row}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
          <Text style={[styles.value, { color: theme.text }]}>{value}</Text>
        </View>
      ))}
      <Text style={[styles.footnote, { color: theme.textSecondary }]}>
        The profile diagram arrives in task 08.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  label: {
    fontSize: 15,
  },
  value: {
    flexShrink: 1,
    fontSize: 15,
    textAlign: 'right',
  },
  footnote: {
    marginTop: Spacing.four,
    fontSize: 13,
  },
});
