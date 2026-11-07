// AI-generated (Claude)
// One row of a statistics chart's values: its label, value, and, for a chart of rows,
// its bar. Horizontal charts are these rows rather than a canvas, so that a chart of a
// few hundred dive sites scrolls like any list, and each row is a button VoiceOver can
// read and a finger can open. Under a canvas chart they are its table.
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { SymbolView } from '@/components/symbol';
import { ChartColors } from '@/constants/chart-theme';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { StatRow } from '@/models/stats-chart';

import { seriesColor } from './stats-chart';

export function StatsRow({ row, showBar, onPress }: { row: StatRow; showBar: boolean; onPress: () => void }) {
  const theme = useTheme();
  const colors = ChartColors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const opens = row.dives.length > 0;
  return (
    <Pressable
      disabled={!opens}
      onPress={onPress}
      accessibilityRole={opens ? 'button' : undefined}
      accessibilityLabel={row.accessibilityLabel}
      accessibilityHint={opens ? 'Shows these dives' : undefined}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.body}>
        <View style={styles.header}>
          {row.series !== null ? (
            <View style={[styles.swatch, { backgroundColor: seriesColor(colors, row.series) }]} />
          ) : null}
          <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
            {row.label}
          </Text>
          <Text style={[styles.value, { color: theme.text }]} numberOfLines={1}>
            {row.value}
          </Text>
        </View>
        {showBar && row.fraction !== null ? (
          <View style={styles.track}>
            {row.segments.length > 0 ? (
              row.segments.map((segment) =>
                segment.fraction > 0 ? (
                  <View
                    key={segment.series}
                    style={[
                      styles.bar,
                      {
                        width: `${segment.fraction * 100}%`,
                        backgroundColor: seriesColor(colors, segment.series),
                      },
                    ]}
                  />
                ) : null,
              )
            ) : (
              <View
                style={[
                  styles.bar,
                  { width: `${row.fraction * 100}%`, backgroundColor: seriesColor(colors, 0) },
                ]}
              />
            )}
          </View>
        ) : null}
        {row.detail !== '' ? (
          <Text style={[styles.detail, { color: theme.textSecondary }]} numberOfLines={2}>
            {row.detail}
          </Text>
        ) : null}
      </View>
      {opens ? <SymbolView name="chevron.right" size={12} tintColor={theme.textSecondary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    minHeight: 44,
  },
  body: {
    flex: 1,
    gap: Spacing.half,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  label: {
    flex: 1,
    fontSize: 15,
  },
  value: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
  track: {
    flexDirection: 'row',
    gap: 2,
    height: 8,
  },
  bar: {
    height: 8,
    borderRadius: 3,
  },
  detail: {
    fontSize: 12,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
});
