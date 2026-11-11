// AI-generated (Claude)
// When and where, one row of chips each, and the planned dives where the log has
// any. Chips rather than a menu because the point is to see what is selected
// without opening anything - and both lists are short (a logbook covers a handful of
// years, and the site list is the sites that have dives, most-dived first).
//
// "When" holds the legacy dive summary's periods (last month, 3, 6 and 12 months)
// ahead of the calendar years: both say which dives count by their date, so they are
// one choice in one row, and picking either replaces the other.
//
// The same bar on the overview and on a chart, driving one filter: there is no second
// set of filters for a chart to be confused with.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { RECENT_PERIODS, periodNote } from '@/models/statistics';

import type { StatisticsScreen } from './use-statistics-screen';
import { t } from '@/i18n';

export function StatsFilterBar({ screen }: { screen: StatisticsScreen }) {
  const theme = useTheme();
  const { filter } = screen;

  return (
    <View style={styles.filters}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip
          label={t('ui.allTime')}
          selected={filter.year === null && !filter.recentMonths}
          onPress={() => screen.setYear(null)}
        />
        {RECENT_PERIODS.map((period) => (
          <Chip
            key={`recent-${period.months}`}
            label={period.label}
            accessibilityLabel={t('statsScreen.periodSpoken', { period: period.spoken })}
            selected={filter.recentMonths === period.months}
            onPress={() =>
              screen.setRecentPeriod(filter.recentMonths === period.months ? null : period.months)
            }
          />
        ))}
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
        <Chip label={t('ui.allSites')} selected={filter.siteUuid === null} onPress={() => screen.setSite(null)} />
        {screen.sites.map((site) => (
          <Chip
            key={site.uuid}
            label={`${site.name || t('sites.unnamed')} (${site.diveCount})`}
            selected={filter.siteUuid === site.uuid}
            onPress={() => screen.setSite(filter.siteUuid === site.uuid ? null : site.uuid)}
          />
        ))}
      </ScrollView>

      {screen.plannedDives > 0 ? (
        <View style={styles.planned}>
          <Chip
            label={t('statsScreen.withoutPlanned', { count: screen.plannedDives })}
            selected={Boolean(filter.excludePlanned)}
            onPress={() => screen.setExcludePlanned(!filter.excludePlanned)}
          />
          {filter.excludePlanned ? null : (
            <Text style={[styles.note, { color: theme.textSecondary }]}>
              {t('statsScreen.countedNow')}
            </Text>
          )}
        </View>
      ) : null}

      {screen.summary && periodNote(screen.summary) ? (
        <Text style={[styles.note, { color: theme.textSecondary }]}>{periodNote(screen.summary)}</Text>
      ) : null}

      {screen.filtered ? (
        <Pressable onPress={screen.clearFilter} accessibilityRole="button">
          <Text style={[styles.clear, { color: theme.textSecondary }]}>{t('statsScreen.clearFilter')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
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
