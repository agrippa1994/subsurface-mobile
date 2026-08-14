// AI-generated (Claude)
// Settings, portable fallback (Android in task 13, and web). iOS renders a
// native Form instead - see index.ios.tsx.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useSettingsScreen } from '@/features/settings/use-settings-screen';
import { useTheme } from '@/hooks/use-theme';
import type { UnitSystem } from '@/models';

export default function SettingsScreen() {
  const screen = useSettingsScreen();
  const theme = useTheme();

  const unitOption = (system: UnitSystem, label: string) => (
    <Pressable
      key={system}
      accessibilityRole="radio"
      accessibilityState={{ selected: screen.unitSystem === system }}
      onPress={() => screen.setUnitSystem(system)}
      style={[
        styles.segment,
        {
          backgroundColor:
            screen.unitSystem === system ? theme.backgroundSelected : theme.backgroundElement,
        },
      ]}>
      <Text style={{ color: theme.text }}>{label}</Text>
    </Pressable>
  );

  const action = (label: string, onPress: () => void) => (
    <Pressable key={label} accessibilityRole="button" onPress={onPress} style={styles.action}>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Units</Text>
      <View style={styles.segments}>
        {unitOption('metric', 'Metric')}
        {unitOption('imperial', 'Imperial')}
      </View>

      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Logbook</Text>
      <Text style={{ color: theme.text }}>
        {screen.diveCount} dives, {screen.siteCount} sites
      </Text>
      <Text style={[styles.path, { color: theme.textSecondary }]}>
        {screen.logbookPath ?? 'not loaded'}
      </Text>
      {action('Reload from disk', screen.reload)}
      {action('Restore the sample logbook', screen.restoreSample)}

      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Transfer</Text>
      {action('Import dives', screen.transfer.importFile)}
      {action('Export and share', screen.transfer.shareLogbook)}
      {action('Open a logbook', screen.transfer.openLogbook)}

      {__DEV__ ? (
        <>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Developer</Text>
          {action('Import the Suunto sample', screen.importSuuntoSample)}
          {action('Import the Suunto XML sample', screen.importSuuntoXmlSample)}
          {action('Load an empty logbook', screen.loadEmptyLogbook)}
          {action('Load a malformed logbook', screen.loadMalformedLogbook)}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  sectionTitle: {
    marginTop: Spacing.three,
    fontSize: 13,
    textTransform: 'uppercase',
  },
  segments: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  segment: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  path: {
    fontSize: 12,
  },
  action: {
    paddingVertical: Spacing.two,
  },
  actionLabel: {
    fontSize: 17,
    color: '#0A84FF',
  },
});
