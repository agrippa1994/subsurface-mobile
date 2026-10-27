// AI-generated (Claude)
// The dive list, portable fallback (Android in task 13, and web).
//
// iOS renders a real SwiftUI List instead - see dive-list-view.ios.tsx. Both
// variants take the same props and read the same presentation model, so the
// grouping and the formatting cannot diverge between platforms. There is no
// swipe here; a long press offers the same delete as the iOS swipe action.
//
// The row itself is DiveRowView (dive-row.tsx), which matches the iOS row: the
// dive number in a fixed-width badge, depth over duration at the end.
import { useEffect, useState } from 'react';
import { Animated, SectionList, StyleSheet, Text, View } from 'react-native';

import { DiveRowView, diveRowStyles } from '@/components/dive-row';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DiveSummary, UnitSystem } from '@/models';
import { sectionSubtitle, skeletonRows, toDiveRow, type DiveTripSection } from '@/models/dive-list';

export type DiveListViewProps = {
  sections: DiveTripSection[];
  unitSystem: UnitSystem;
  onSelectDive: (id: number) => void;
  /** Asks to delete a dive. The screen confirms; the list only reports the gesture. */
  onDeleteDive: (dive: DiveSummary) => void;
};

export function DiveListView({
  sections,
  unitSystem,
  onSelectDive,
  onDeleteDive,
}: DiveListViewProps) {
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
      renderItem={({ item }) => (
        <DiveRowView
          row={toDiveRow(item, unitSystem)}
          onPress={() => onSelectDive(item.id)}
          onLongPress={() => onDeleteDive(item)}
        />
      )}
    />
  );
}

/** Shown while the logbook is still being read: grey bars shaped like rows, pulsing. */
export function DiveListSkeleton() {
  const theme = useTheme();
  const [pulse] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const bar = (width: number, height: number) => (
    <View
      style={{ width, height, borderRadius: 4, backgroundColor: theme.backgroundSelected }}
    />
  );

  return (
    <Animated.View
      accessible
      accessibilityLabel="Loading dives"
      style={[styles.skeleton, { backgroundColor: theme.background, opacity: pulse }]}>
      <View style={styles.sectionHeader}>{bar(140, 17)}</View>
      {skeletonRows().map((row) => (
        <View key={row.id} style={diveRowStyles.row}>
          <View style={[diveRowStyles.badge, { backgroundColor: theme.backgroundSelected }]} />
          <View style={diveRowStyles.main}>
            {bar(row.title.length * 8, 15)}
            {bar(110, 12)}
          </View>
          <View style={diveRowStyles.trailing}>
            {bar(48, 15)}
            {bar(36, 12)}
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    flex: 1,
  },
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
});
