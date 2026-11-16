// AI-generated (Claude)
// The statistics screen.
//
// Every number is computed by the core (statistics.cpp plus the two buckets the
// bindings add) and only labelled here - see src/models/statistics.ts. The
// filter row feeds `getStatistics(filter)`, so narrowing to a year or a site
// recomputes in C++ rather than filtering the rows in JS.
//
// React Native rather than SwiftUI, for the same reason the dive detail screen
// is: the charts are Skia canvases, and a SwiftUI Form cannot host one.
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { StatusView } from '@/components/status-view';
import { SymbolView } from '@/components/symbol';
import { Spacing } from '@/constants/theme';
import { StatsFilterBar } from '@/features/statistics/stats-filter-bar';
import { useStatisticsScreen } from '@/features/statistics/use-statistics-screen';
import { useTheme } from '@/hooks/use-theme';
import {
  depthAxisUnit,
  depthHistogram,
  divesOverTime,
  durationHistogram,
  pickGranularity,
  sacAxisUnit,
  sacOverTime,
  summaryTiles,
  type StatTile,
} from '@/models/statistics';
import { chartHeadline } from '@/models/stats-chart';
import { useSettings, useUnits } from '@/queries/settings';
import { t } from '@/i18n';

export default function StatisticsScreen() {
  const screen = useStatisticsScreen();
  const units = useUnits();
  const theme = useTheme();

  const summary = screen.summary;

  const tiles = useMemo(
    () => (summary ? summaryTiles(summary, units) : []),
    [summary, units]
  );
  const overTime = useMemo(() => (summary ? divesOverTime(summary) : []), [summary]);
  const depths = useMemo(
    () => (summary ? depthHistogram(summary, units) : []),
    [summary, units]
  );
  const durations = useMemo(() => (summary ? durationHistogram(summary) : []), [summary]);
  const sacs = useMemo(
    () => (summary ? sacOverTime(summary, units) : []),
    [summary, units]
  );

  if (screen.loading) {
    return <StatusView kind="loading" title={t('ui.openingLogbook')} />;
  }

  if (screen.error || !summary) {
    return (
      <StatusView
        kind="error"
        title={t('ui.statisticsAreUnavailable')}
        description={screen.error ?? t('errors.unreadable')}
        systemImage="exclamationmark.triangle"
      />
    );
  }

  if (screen.logEmpty) {
    return (
      <StatusView
        kind="empty"
        title={t('ui.nothingToCountYet')}
        description={t('ui.statisticsAppearOnceTheLogbookHolds')}
        systemImage="chart.bar"
      />
    );
  }

  const perYear = pickGranularity(summary) === 'year';
  const timeLabel = perYear ? t('statsScreen.perYear') : t('statsScreen.perMonth');

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={styles.tiles}>
        {tiles.map((tile) => (
          <Tile key={tile.key} tile={tile} />
        ))}
      </View>

      <ExploreRow />

      <StatsFilterBar screen={screen} />

      {screen.filtered && summary.matched === 0 ? (
        <Text style={[styles.note, { color: theme.textSecondary }]}>
          {t('charts.noDivesMatch')}
        </Text>
      ) : null}

      <BarChart title={timeLabel} bars={overTime} />
      <BarChart
        title={t('ui.divesByMaximumDepth')}
        bars={depths}
        axisUnit={depthAxisUnit(units)}
      />
      <BarChart title={t('ui.divesByDuration')} bars={durations} axisUnit="min" />
      <BarChart
        title={perYear ? t('statsScreen.sacPerYear') : t('statsScreen.sacPerMonth')}
        bars={sacs}
        axisUnit={sacAxisUnit(units)}
        integer={false}
        hint={t('ui.tapABarForItsAverage')}
        emptyText={t('ui.noDivesWithAKnownSac')}
      />
    </ScrollView>
  );
}

function Tile({ tile }: { tile: StatTile }) {
  const theme = useTheme();
  return (
    // One element to VoiceOver: read apart, "412" and "Dives" are two
    // announcements that say nothing on their own. The value keeps its single
    // line - it is a number and a unit - but the label and the detail wrap,
    // because at the larger Dynamic Type sizes they no longer fit on one.
    <View
      style={[styles.tile, { backgroundColor: theme.backgroundElement }]}
      accessible
      accessibilityLabel={[tile.label, tile.value, tile.detail].filter(Boolean).join(', ')}>
      <Text style={[styles.tileValue, { color: theme.text }]} numberOfLines={1}>
        {tile.value}
      </Text>
      <Text style={[styles.tileLabel, { color: theme.textSecondary }]}>{tile.label}</Text>
      {tile.detail !== '' ? (
        <Text style={[styles.tileDetail, { color: theme.textSecondary }]}>{tile.detail}</Text>
      ) : null}
    </View>
  );
}

function ExploreRow() {
  const theme = useTheme();
  const router = useRouter();
  const { statsChart } = useSettings();
  const detail = statsChart ? chartHeadline(statsChart) : t('statsScreen.askQuestion');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('statsScreen.explore')}. ${detail}`}
      onPress={() => router.push('/statistics/explore')}
      style={({ pressed }) => [
        styles.explore,
        { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
      ]}>
      <SymbolView name="chart.xyaxis.line" size={22} tintColor={theme.accent} />
      <View style={styles.exploreText}>
        <Text style={[styles.exploreTitle, { color: theme.text }]}>{t('statsScreen.explore')}</Text>
        <Text style={[styles.tileLabel, { color: theme.textSecondary }]} numberOfLines={2}>
          {detail}
        </Text>
      </View>
      <SymbolView name="chevron.right" size={13} tintColor={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  tileValue: {
    fontSize: 24,
    fontWeight: '600',
  },
  tileLabel: {
    fontSize: 13,
  },
  tileDetail: {
    fontSize: 12,
  },
  explore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 12,
    padding: Spacing.three,
    marginTop: Spacing.two,
  },
  exploreText: {
    flex: 1,
    gap: Spacing.half,
  },
  exploreTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  note: {
    fontSize: 14,
    marginTop: Spacing.two,
  },
});
