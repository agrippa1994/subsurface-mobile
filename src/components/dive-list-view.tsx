// AI-generated (Claude)
// The dive list, portable fallback (Android in task 13, and web).
//
// iOS renders a real SwiftUI List instead - see dive-list-view.ios.tsx. Both
// variants take the same props and read the same presentation model, so the
// grouping and the formatting cannot diverge between platforms.
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DiveSummary, UnitSystem } from '@/models';
import { ratingStars, sectionSubtitle, toDiveRow, type DiveTripSection } from '@/models/dive-list';

export type DiveListViewProps = {
  sections: DiveTripSection[];
  unitSystem: UnitSystem;
  onSelectDive: (id: number) => void;
};

export function DiveListView({ sections, unitSystem, onSelectDive }: DiveListViewProps) {
  const theme = useTheme();
  // SectionList wants the rows under `data`; the presentation model calls them
  // `dives` because that is what they are everywhere else.
  const listSections = sections.map((section) => ({ ...section, data: section.dives }));

  return (
    <SectionList<DiveSummary, DiveTripSection>
      sections={listSections}
      keyExtractor={(dive) => String(dive.id)}
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      renderSectionHeader={({ section }) => (
        <View style={[styles.sectionHeader, { backgroundColor: theme.backgroundElement }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            {sectionSubtitle(section)}
          </Text>
        </View>
      )}
      renderItem={({ item }) => {
        const row = toDiveRow(item, unitSystem);
        return (
          <Pressable
            accessibilityRole="button"
            onPress={() => onSelectDive(row.id)}
            style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>{row.title}</Text>
              <Text style={[styles.rowSubtitle, { color: theme.textSecondary }]}>
                {`${row.dateText} ${row.timeText}${row.numberText === '' ? '' : `  ${row.numberText}`}`}
              </Text>
              {row.rating > 0 ? (
                <Text style={styles.rowStars}>{ratingStars(row.rating)}</Text>
              ) : null}
            </View>
            <Text style={[styles.rowDetail, { color: theme.text }]}>{row.detailText}</Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: Spacing.six,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  sectionSubtitle: {
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowMain: {
    flex: 1,
    gap: Spacing.half,
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: '500',
  },
  rowSubtitle: {
    fontSize: 14,
  },
  rowStars: {
    fontSize: 13,
    color: '#FFB300',
  },
  rowDetail: {
    fontSize: 15,
  },
});
