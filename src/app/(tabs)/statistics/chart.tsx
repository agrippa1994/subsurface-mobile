// AI-generated (Claude)
// One chart of the configurable statistics.
//
// A list, with everything above its first row in the header: the rows are the chart's
// values, or, for a chart of rows, the chart. Being a virtualized list is what keeps a
// chart of a few hundred sites smooth.
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { HeaderAction } from '@/components/header-action';
import { StatsChartView, StatsLegend, StatsMarkers } from '@/components/stats-chart';
import { StatsRow } from '@/components/stats-row';
import { StatusView } from '@/components/status-view';
import { SymbolView } from '@/components/symbol';
import { Spacing } from '@/constants/theme';
import { StatsFilterBar } from '@/features/statistics/stats-filter-bar';
import { useChartScreen, type ChartScreen } from '@/features/statistics/use-chart-screen';
import { useStatisticsScreen } from '@/features/statistics/use-statistics-screen';
import { useLandscapeCapable } from '@/hooks/use-landscape';
import { useTheme } from '@/hooks/use-theme';
import {
  chartDescription,
  chartEmptyText,
  chartHeadline,
  chartRows,
  chartSummary,
  diveCount,
} from '@/models/stats-chart';
import { t } from '@/i18n';

const CHART_HEIGHT = 300;

export default function StatisticsChartScreen() {
  const screen = useChartScreen();
  const filterScreen = useStatisticsScreen();
  const theme = useTheme();
  const router = useRouter();
  const focused = useIsFocused();
  const landscape = useLandscapeCapable(focused);
  const { build } = useLocalSearchParams<{ build?: string }>();

  // "Build your own" opens with the builder up, once.
  const opened = useRef(false);
  useEffect(() => {
    if (build && !opened.current) {
      opened.current = true;
      router.push('/statistics/builder');
    }
  }, [build, router]);

  const { chart, config, dives } = screen;
  const rows = useMemo(() => (chart ? chartRows(chart) : []), [chart]);

  const customize = (
    <HeaderAction label={t('ui.customize')} icon="slider.horizontal.3" onPress={() => router.push('/statistics/builder')} />
  );

  if (screen.loading) {
    return <StatusView kind="loading" title={t('ui.drawingTheChart')} />;
  }
  if (screen.error || !chart) {
    return (
      <StatusView
        kind="error"
        title={t('ui.theChartCouldNotBeDrawn')}
        description={screen.error ?? t('errors.unreadable')}
        systemImage="exclamationmark.triangle"
      />
    );
  }

  const horizontal = chart.family === 'bar' && chart.horizontal;
  const summary = chartSummary(config, chart, dives, screen.options);

  const header = (
    <View style={styles.header}>
      <Text style={[styles.headline, { color: theme.text }]} accessibilityRole="header">
        {chartHeadline(config, screen.options)}
      </Text>
      <Text style={[styles.description, { color: theme.textSecondary }]}>
        {chartDescription(config, chart, screen.options)}
      </Text>

      {chart.family === 'empty' ? (
        <View style={styles.empty}>
          <SymbolView name="chart.bar" size={36} tintColor={theme.textSecondary} />
          <Text style={[styles.description, styles.centered, { color: theme.textSecondary }]}>
            {chartEmptyText(config, dives)}
          </Text>
        </View>
      ) : horizontal ? (
        <>
          <StatsLegend chart={chart} />
          <Text style={[styles.caption, { color: theme.textSecondary }]} accessibilityLabel={summary}>
            {diveCount(dives)} in this chart
          </Text>
        </>
      ) : (
        <>
          <StatsChartView
            chart={chart}
            config={config}
            height={CHART_HEIGHT}
            summary={summary}
            selection={screen.selection}
            onSelect={screen.setSelection}
          />
          {config.features.legend ? <StatsLegend chart={chart} /> : null}
          <StatsMarkers chart={chart} config={config} />
          <Readout screen={screen} />
        </>
      )}

      <StatsFilterBar screen={filterScreen} />

      {rows.length > 0 && !horizontal ? (
        <Text style={[styles.section, { color: theme.textSecondary }]} accessibilityRole="header">
          {t('statsScreen.values')}
        </Text>
      ) : null}
    </View>
  );

  return (
    <>
      {customize}
      <FlatList
        style={{ backgroundColor: theme.background }}
        contentInsetAdjustmentBehavior="automatic"
        data={rows}
        keyExtractor={(row) => row.key}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <StatsRow
            row={item}
            showBar={horizontal}
            onPress={() => screen.showDives(item.label, item.dives)}
          />
        )}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.separator }]} />}
        contentContainerStyle={styles.list}
      />
      {chart.family !== 'empty' && !horizontal ? (
        <ChartFullscreen screen={screen} visible={landscape} summary={summary} />
      ) : null}
    </>
  );
}

function Readout({ screen }: { screen: ChartScreen }) {
  const theme = useTheme();
  const { readout } = screen;
  if (!readout) {
    return (
      <Text style={[styles.caption, { color: theme.textSecondary }]}>
        {t('statsScreen.tapChart')}
      </Text>
    );
  }
  return (
    <View
      style={[styles.readout, { backgroundColor: theme.backgroundElement }]}
      accessibilityLiveRegion="polite">
      <Text style={[styles.readoutTitle, { color: theme.text }]} numberOfLines={2}>
        {readout.title}
      </Text>
      <View style={styles.readoutLines}>
        {readout.lines.map((line) => (
          <View key={line.label} style={styles.readoutLine} accessible>
            <Text style={[styles.caption, { color: theme.textSecondary }]} numberOfLines={1}>
              {line.label}
            </Text>
            <Text style={[styles.readoutValue, { color: theme.text }]}>{line.value}</Text>
          </View>
        ))}
      </View>
      {readout.dives.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => screen.showDives(readout.title, readout.dives)}
          style={styles.readoutButton}>
          <Text style={[styles.readoutButtonText, { color: theme.accent }]}>
            {readout.dives.length === 1
              ? t('statsScreen.openDive')
              : t('statsScreen.showDives', { dives: diveCount(readout.dives.length) })}
          </Text>
          <SymbolView name="chevron.right" size={12} tintColor={theme.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * The chart with the screen to itself in landscape, which suits most of them. A modal
 * rather than a layout of its own, for the reason the profile's is: the tab bar cannot
 * be hidden from a screen pushed under it. See profile-fullscreen.tsx.
 */
function ChartFullscreen({ screen, visible, summary }: { screen: ChartScreen; visible: boolean; summary: string }) {
  const theme = useTheme();
  const [height, setHeight] = useState(0);
  const { chart, config } = screen;
  if (!chart) {
    return null;
  }
  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
      onRequestClose={() => {}}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.background }}>
          <SafeAreaView style={styles.full} edges={['top', 'bottom', 'left', 'right']}>
            <View style={styles.fullChart}>
              <Text style={[styles.fullTitle, { color: theme.text }]} numberOfLines={1}>
                {chartHeadline(config, screen.options)}
              </Text>
              <View style={styles.flex} onLayout={(event) => setHeight(event.nativeEvent.layout.height)}>
                {height > 0 ? (
                  <StatsChartView
                    chart={chart}
                    config={config}
                    height={Math.max(120, height - 18)}
                    summary={summary}
                    selection={screen.selection}
                    onSelect={screen.setSelection}
                  />
                ) : null}
              </View>
              {config.features.legend ? <StatsLegend chart={chart} /> : null}
            </View>
            {/* Always there, or a first tap would resize the chart under the finger. */}
            <ScrollView style={styles.fullSide} contentContainerStyle={styles.fullSideContent}>
              <StatsMarkers chart={chart} config={config} />
              <Readout screen={screen} />
            </ScrollView>
          </SafeAreaView>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: Spacing.six,
  },
  header: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  headline: {
    fontSize: 22,
    fontWeight: '700',
  },
  description: {
    fontSize: 15,
    lineHeight: 20,
  },
  centered: {
    textAlign: 'center',
  },
  caption: {
    fontSize: 13,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  section: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: Spacing.two,
    marginBottom: -Spacing.two,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.three,
  },
  readout: {
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  readoutTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  readoutLines: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.four,
    rowGap: Spacing.two,
  },
  readoutLine: {
    gap: 1,
  },
  readoutValue: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  readoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 32,
  },
  readoutButtonText: {
    fontSize: 15,
  },
  full: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  fullChart: {
    flex: 1,
    gap: Spacing.one,
  },
  fullTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  flex: {
    flex: 1,
  },
  fullSide: {
    width: 240,
    flexGrow: 0,
  },
  fullSideContent: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
});
