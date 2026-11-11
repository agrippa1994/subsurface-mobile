// AI-generated (Claude)
// The surface GF timeline, React Native variant for the web build (iOS and
// Android have native ones). Chart, readout, presets and the pressure source;
// the date pickers are native-only, so times are set by dragging the chart and
// the presets.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useSurfaceGfScreen, PRESSURE_SOURCE_OPTIONS } from './use-surface-gf-screen';
import { StatusView } from '@/components/status-view';
import { SurfaceGfChart } from '@/components/surface-gf-chart';
import { useTheme } from '@/hooks/use-theme';
import { describeError, formatErrorLine } from '@/models/errors';
import {
  PLANNED_ENTRY_PRESETS,
  singlePressureNote,
  surfaceGfDisclaimer,
  surfaceGfExplainer,
  TIMELINE_SPANS,
} from '@/models/surface-gf';
import { t } from '@/i18n';

function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[styles.chip, { backgroundColor: selected ? theme.accent : theme.backgroundElement }]}>
      <Text style={{ color: selected ? '#ffffff' : theme.text }}>{label}</Text>
    </Pressable>
  );
}

export function SurfaceGfScreen() {
  const screen = useSurfaceGfScreen();
  const theme = useTheme();
  const { timeline, surface, readout, window, planned } = screen;

  if (surface.error) {
    return (
      <StatusView
        kind="error"
        title={t('ui.surfaceGfIsUnavailable')}
        description={formatErrorLine(describeError(surface.error))}
        systemImage="exclamationmark.triangle"
      />
    );
  }
  if (!timeline || !readout || !window) {
    return surface.isPending ? (
      <StatusView kind="loading" title={t('ui.workingOutTheSurfaceGf')} />
    ) : (
      <StatusView kind="empty" title={t('ui.noDivesYet')} description={t('ui.theSurfaceGfFollowsTheLatest')} />
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <View accessible accessibilityLabel={readout.accessibilityLabel}>
        <Text style={[styles.big, { color: theme.text }]}>{readout.gfText}</Text>
        <Text style={{ color: theme.text }}>{readout.whenText}</Text>
        <Text style={{ color: theme.textSecondary }}>{readout.phaseText}</Text>
      </View>
      <SurfaceGfChart
        timeline={timeline}
        fromMs={window.fromMs}
        toMs={window.toMs}
        yMax={screen.yMax}
        nowMs={screen.asOf}
        cursorMs={screen.cursorMs}
        onCursorChange={screen.setCursor}
        plannedMs={screen.settings.plannedEntryMs}
        gfHigh={surface.gfHigh}
        accessibilityLabel={`${t('surfaceGfScreen.overTime')} ${readout.accessibilityLabel}`}
      />
      <View style={styles.row}>
        {TIMELINE_SPANS.map((span) => (
          <Chip key={span.key} label={span.label} selected={screen.span === span.key} onPress={() => screen.setSpan(span.key)} />
        ))}
        {screen.cursorFollowsNow ? null : <Chip label={t('ui.backToNow')} onPress={screen.resetCursor} />}
      </View>

      <Text style={[styles.heading, { color: theme.text }]}>{t('ui.nextEntry')}</Text>
      {planned ? (
        <Text style={{ color: theme.text }}>{`${planned.gfText}, ${planned.whenText}`}</Text>
      ) : null}
      <View style={styles.row}>
        {PLANNED_ENTRY_PRESETS.map((preset) => (
          <Chip key={preset.minutes} label={preset.label} onPress={() => screen.applyPreset(preset.minutes)} />
        ))}
        {planned ? <Chip label={t('ui.clear')} onPress={() => screen.setPlannedEntry(null)} /> : null}
      </View>

      <Text style={[styles.heading, { color: theme.text }]}>{t('surfaceGfScreen.below', { threshold: screen.threshold })}</Text>
      <Text style={{ color: theme.text }}>{screen.belowText}</Text>

      <Text style={[styles.heading, { color: theme.text }]}>{t('ui.ambientPressure')}</Text>
      <View style={styles.row}>
        {PRESSURE_SOURCE_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={screen.settings.pressureSource === option.value}
            onPress={() => screen.setPressureSource(option.value)}
          />
        ))}
      </View>
      <Text style={{ color: theme.text }}>{surface.ambient.label}</Text>
      {surface.ambient.fallbackNote ? <Text style={{ color: theme.warning }}>{surface.ambient.fallbackNote}</Text> : null}
      <Text style={[styles.small, { color: theme.textSecondary }]}>{singlePressureNote()}</Text>
      <Text style={[styles.small, { color: theme.textSecondary }]}>{surfaceGfExplainer()}</Text>
      <Text style={[styles.small, { color: theme.textSecondary }]}>{surfaceGfDisclaimer()}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8 },
  big: { fontSize: 48, fontWeight: '700', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  heading: { fontSize: 17, fontWeight: '600', marginTop: 12 },
  small: { fontSize: 13 },
});
