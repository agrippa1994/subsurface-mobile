// AI-generated (Claude)
// Settings, portable fallback (Android in task 13, and web). iOS renders a
// native Form instead - see index.ios.tsx.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useSettingsScreen } from '@/features/settings/use-settings-screen';
import { useTheme } from '@/hooks/use-theme';
import { aboutRows, LICENSE_NOTICE, PRIVACY_NOTICE, SOURCE_NOTICE } from '@/models/about';
import { GF_RANGE } from '@/models/settings';
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

  // Stands in for the iOS variant's native Stepper. The value sits between the
  // two buttons so the row reads the same way.
  const stepper = (label: string, value: number, onChange: (percent: number) => void) => (
    <View key={label} style={styles.stepper}>
      <Text style={{ color: theme.text }}>{`${label}  ${value}%`}</Text>
      <View style={styles.segments}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          disabled={value <= GF_RANGE.min}
          onPress={() => onChange(value - 1)}
          style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
          <Text style={{ color: theme.text }}>-</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          disabled={value >= GF_RANGE.max}
          onPress={() => onChange(value + 1)}
          style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
          <Text style={{ color: theme.text }}>+</Text>
        </Pressable>
      </View>
    </View>
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

      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Decompression</Text>
      {stepper('GF low', screen.gfLow, screen.setGfLow)}
      {stepper('GF high', screen.gfHigh, screen.setGfHigh)}
      <Text style={[styles.note, { color: theme.textSecondary }]}>
        Buehlmann gradient factors, in percent. They decide the deco ceiling drawn on the dive
        profile - lower is more conservative. Subsurface&apos;s defaults are 30 and 75.
      </Text>

      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Logbook</Text>
      <Text style={{ color: theme.text }}>
        {screen.diveCount} dives, {screen.siteCount} sites
      </Text>
      <Text style={[styles.path, { color: theme.textSecondary }]}>
        {screen.logbookPath ?? 'not loaded'}
      </Text>
      {action('Reload from disk', screen.reload)}
      {action('Restore the sample logbook', screen.restoreSample)}
      {action(
        screen.tripCount > 0 ? `Ungroup all dives (${screen.tripCount} trips)` : 'Ungroup all dives',
        screen.ungroupDives,
      )}

      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Transfer</Text>
      {action('Import dives', screen.transfer.importFile)}
      {action('Export and share', screen.transfer.shareLogbook)}
      {action('Open a logbook', screen.transfer.openLogbook)}

      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Problems</Text>
      <Text style={{ color: theme.text }}>{screen.diagnostics}</Text>
      <Text style={[styles.note, { color: theme.textSecondary }]}>{PRIVACY_NOTICE}</Text>
      {action('Share the problem log', screen.shareDiagnostics)}
      {action('Clear it', screen.clearDiagnostics)}

      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>About</Text>
      {aboutRows(screen.about).map((row) => (
        <Text key={row.label} style={{ color: theme.text }}>
          {`${row.label}: ${row.value}`}
        </Text>
      ))}
      <Text style={[styles.note, { color: theme.textSecondary }]}>
        {`${LICENSE_NOTICE} ${SOURCE_NOTICE}`}
      </Text>
      {action('Source code and licence', screen.openSource)}

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
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  segment: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  path: {
    fontSize: 12,
  },
  note: {
    fontSize: 13,
  },
  action: {
    paddingVertical: Spacing.two,
  },
  actionLabel: {
    fontSize: 17,
    color: '#0A84FF',
  },
});
