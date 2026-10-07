// AI-generated (Claude)
// The dive list, portable fallback (Android in task 13, and web).
//
// iOS renders a real SwiftUI List instead - see dive-list-view.ios.tsx. Both
// variants take the same props and read the same presentation model, so the
// grouping and the formatting cannot diverge between platforms. There is no
// swipe here; a long press offers the same delete as the iOS swipe action.
//
// Each row leads with the dive number in a fixed-width badge and ends with
// depth over duration, matching the iOS row.
import { useEffect, useState } from 'react';
import { Animated, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DiveSummary, UnitSystem } from '@/models';
import {
  ratingStars,
  sectionSubtitle,
  skeletonRows,
  toDiveRow,
  type DiveTripSection,
} from '@/models/dive-list';

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
      renderItem={({ item }) => {
        const row = toDiveRow(item, unitSystem);
        return (
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel={row.accessibilityLabel}
            onPress={() => onSelectDive(row.id)}
            onLongPress={() => onDeleteDive(item)}
            style={styles.row}>
            <View style={[styles.badge, { backgroundColor: theme.backgroundSelected }]}>
              <Text style={[styles.badgeText, { color: theme.accent }]}>{row.badgeText}</Text>
            </View>
            <View style={styles.rowMain}>
              <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
                {row.title}
              </Text>
              <Text style={[styles.rowSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                {`${row.dateText}, ${row.timeText}${row.invalid ? '  invalid' : ''}`}
              </Text>
              {row.rating > 0 ? (
                <Text style={styles.rowStars}>{ratingStars(row.rating)}</Text>
              ) : null}
            </View>
            <View style={styles.rowTrailing}>
              {row.depthText !== '' ? (
                <Text style={[styles.rowDepth, { color: theme.text }]}>{row.depthText}</Text>
              ) : null}
              {row.durationText !== '' ? (
                <Text style={[styles.rowDuration, { color: theme.textSecondary }]}>
                  {row.durationText}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      }}
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
        <View key={row.id} style={styles.row}>
          <View style={[styles.badge, { backgroundColor: theme.backgroundSelected }]} />
          <View style={styles.rowMain}>
            {bar(row.title.length * 8, 15)}
            {bar(110, 12)}
          </View>
          <View style={styles.rowTrailing}>
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
  badge: {
    minWidth: 44,
    height: 32,
    paddingHorizontal: Spacing.one,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  rowTrailing: {
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
  rowDepth: {
    fontSize: 16,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  rowDuration: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
});
