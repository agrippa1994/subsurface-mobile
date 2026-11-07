// AI-generated (Claude)
// Year and site filters, one row of chips each, and the planned dives where the log
// has any. Chips rather than a menu because the point is to see what is selected
// without opening anything - and both lists are short (a logbook covers a handful of
// years, and the site list is the sites that have dives, most-dived first).
//
// The same bar on the overview and on a chart, driving one filter: there is no second
// set of filters for a chart to be confused with.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { StatisticsScreen } from './use-statistics-screen';

export function StatsFilterBar({ screen }: { screen: StatisticsScreen }) {
  const theme = useTheme();
  const { filter } = screen;

  return (
    <View style={styles.filters}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="All years" selected={filter.year === null} onPress={() => screen.setYear(null)} />
        {screen.years.map((year) => (
          <Chip
            key={year}
            label={String(year)}
            selected={filter.year === year}
            onPress={() => screen.setYear(filter.year === year ? null : year)}
          />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="All sites" selected={filter.siteUuid === null} onPress={() => screen.setSite(null)} />
        {screen.sites.map((site) => (
          <Chip
            key={site.uuid}
            label={`${site.name || 'Unnamed site'} (${site.diveCount})`}
            selected={filter.siteUuid === site.uuid}
            onPress={() => screen.setSite(filter.siteUuid === site.uuid ? null : site.uuid)}
          />
        ))}
      </ScrollView>

      {screen.plannedDives > 0 ? (
        <View style={styles.planned}>
          <Chip
            label={`Without planned dives (${screen.plannedDives})`}
            selected={Boolean(filter.excludePlanned)}
            onPress={() => screen.setExcludePlanned(!filter.excludePlanned)}
          />
          {filter.excludePlanned ? null : (
            <Text style={[styles.note, { color: theme.textSecondary }]}>
              Counted now, as desktop Subsurface does.
            </Text>
          )}
        </View>
      ) : null}

      {screen.filtered ? (
        <Pressable onPress={screen.clearFilter} accessibilityRole="button">
          <Text style={[styles.clear, { color: theme.textSecondary }]}>Clear filter</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, { backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement }]}>
      <Text style={[styles.chipLabel, { color: theme.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    maxWidth: 240,
  },
  chipLabel: {
    fontSize: 14,
  },
  planned: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  note: {
    fontSize: 12,
    flexShrink: 1,
  },
  clear: {
    fontSize: 14,
  },
});
