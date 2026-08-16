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
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { StatusView } from '@/components/status-view';
import { Spacing } from '@/constants/theme';
import { useStatisticsScreen } from '@/features/statistics/use-statistics-screen';
import { useTheme } from '@/hooks/use-theme';
import {
  depthAxisUnit,
  depthHistogram,
  divesOverTime,
  durationHistogram,
  pickGranularity,
  summaryTiles,
  type StatTile,
} from '@/models/statistics';
import { useLogStore } from '@/store/log-store';
import { useUnitSystem } from '@/store/settings-store';

export default function StatisticsScreen() {
  const screen = useStatisticsScreen();
  const status = useLogStore((state) => state.status);
  const unitSystem = useUnitSystem();
  const theme = useTheme();

  const summary = screen.summary;

  const tiles = useMemo(
    () => (summary ? summaryTiles(summary, unitSystem) : []),
    [summary, unitSystem]
  );
  const overTime = useMemo(() => (summary ? divesOverTime(summary) : []), [summary]);
  const depths = useMemo(
    () => (summary ? depthHistogram(summary, unitSystem) : []),
    [summary, unitSystem]
  );
  const durations = useMemo(() => (summary ? durationHistogram(summary) : []), [summary]);

  if (status === 'idle' || status === 'loading') {
    return <StatusView kind="loading" title="Opening logbook" />;
  }

  if (screen.error || !summary) {
    return (
      <StatusView
        kind="error"
        title="Statistics are unavailable"
        description={screen.error ?? 'The logbook could not be read.'}
        systemImage="exclamationmark.triangle"
      />
    );
  }

  if (screen.logEmpty) {
    return (
      <StatusView
        kind="empty"
        title="Nothing to count yet"
        description="Statistics appear once the logbook holds a dive."
        systemImage="chart.bar"
      />
    );
  }

  const timeLabel = pickGranularity(summary) === 'year' ? 'Dives per year' : 'Dives per month';

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

      <FilterRow screen={screen} />

      {screen.filtered && summary.matched === 0 ? (
        <Text style={[styles.note, { color: theme.textSecondary }]}>
          No dives match this filter.
        </Text>
      ) : null}

      <BarChart title={timeLabel} bars={overTime} />
      <BarChart
        title="Dives by maximum depth"
        bars={depths}
        axisUnit={depthAxisUnit(unitSystem)}
      />
      <BarChart title="Dives by duration" bars={durations} axisUnit="min" />
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

/**
 * Year and site filters, one row of chips each. Chips rather than a menu
 * because the whole point is to see what is selected without opening anything -
 * and both lists are short (a logbook covers a handful of years, and the site
 * list is the sites that actually have dives, most-dived first).
 */
function FilterRow({ screen }: { screen: ReturnType<typeof useStatisticsScreen> }) {
  const theme = useTheme();

  return (
    <View style={styles.filters}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="All years" selected={screen.filter.year === null} onPress={() => screen.setYear(null)} />
        {screen.years.map((year) => (
          <Chip
            key={year}
            label={String(year)}
            selected={screen.filter.year === year}
            onPress={() => screen.setYear(screen.filter.year === year ? null : year)}
          />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip
          label="All sites"
          selected={screen.filter.siteUuid === null}
          onPress={() => screen.setSite(null)}
        />
        {screen.sites.map((site) => (
          <Chip
            key={site.uuid}
            label={`${site.name || 'Unnamed site'} (${site.diveCount})`}
            selected={screen.filter.siteUuid === site.uuid}
            onPress={() => screen.setSite(screen.filter.siteUuid === site.uuid ? null : site.uuid)}
          />
        ))}
      </ScrollView>

      {screen.filtered ? (
        <Pressable onPress={screen.clearFilter} accessibilityRole="button">
          <Text style={[styles.clear, { color: theme.textSecondary }]}>Clear filter</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        { backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement },
      ]}>
      <Text style={[styles.chipLabel, { color: theme.text }]} numberOfLines={1}>
        {label}
      </Text>
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
  filters: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  chips: {
    gap: Spacing.two,
    paddingRight: Spacing.three,
  },
  chip: {
    borderRadius: 16,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    maxWidth: 220,
  },
  chipLabel: {
    fontSize: 14,
  },
  clear: {
    fontSize: 14,
  },
  note: {
    fontSize: 14,
    marginTop: Spacing.two,
  },
});
