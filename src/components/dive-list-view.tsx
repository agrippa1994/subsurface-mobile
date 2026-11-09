// AI-generated (Claude)
// The dive list, portable fallback (web). Android has dive-list-view.android.tsx.
//
// iOS renders a real SwiftUI List instead - see dive-list-view.ios.tsx. Both
// variants take the same props and read the same presentation model, so the
// grouping and the formatting cannot diverge between platforms. There is no
// swipe here; a long press offers what the iOS swipe actions and context menu
// do, merging included, and a trip's section header leads to the trip.
//
// The row itself is DiveRowView (dive-row.tsx), which matches the iOS row: the
// dive number in a fixed-width badge, depth over duration at the end.
import { useEffect, useState } from 'react';
import {
  Alert,
  type AlertButton,
  Animated,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
  type TextStyle,
} from 'react-native';

import { DiveRowView, diveRowStyles, diveRowTextStyles } from '@/components/dive-row';
import { SymbolView } from '@/components/symbol';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DiveSummary, Units } from '@/models';
import { diveRowTitle, sectionSubtitle, skeletonRows, toDiveRow, type DiveTripSection } from '@/models/dive-list';
import type { MergeAction } from '@/models/dive-merge';
import type { TripAction } from '@/models/trips';

export type DiveListViewProps = {
  sections: DiveTripSection[];
  units: Units;
  onSelectDive: (id: number) => void;
  /** Asks to delete a dive. The screen confirms; the list only reports the gesture. */
  onDeleteDive: (dive: DiveSummary) => void;
  /** While searching: how many dives match, shown above the sections. */
  resultsText?: string;
  onOpenTrip: (tripId: number) => void;
  /** The trip actions a dive offers (models/trips.ts). */
  tripActions: (dive: DiveSummary) => TripAction[];
  onTripAction: (dive: DiveSummary, action: TripAction) => void;
  /** Null outside selection mode. While selecting, a tap marks a dive. */
  selectedIds: ReadonlySet<number> | null;
  onToggleDive: (id: number) => void;
  onStartSelecting: (id: number) => void;
  /** The merges a dive offers (models/dive-merge.ts). The screen confirms. */
  mergeActions: (dive: DiveSummary) => MergeAction[];
  onMergeAction: (dive: DiveSummary, action: MergeAction) => void;
  /**
   * In a sidebar: the dive open beside the list, or null with none open. Absent
   * when a dive opens on top of the list instead.
   */
  openDiveId?: number | null;
};

export function DiveListView({
  sections,
  units,
  onSelectDive,
  onDeleteDive,
  resultsText,
  onOpenTrip,
  tripActions,
  onTripAction,
  selectedIds,
  onToggleDive,
  onStartSelecting,
  mergeActions,
  onMergeAction,
  openDiveId,
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
      ListHeaderComponent={
        resultsText ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.results, { color: theme.textSecondary }]}>
            {resultsText}
          </Text>
        ) : undefined
      }
      renderSectionHeader={({ section }) => {
        const opensTrip = section.tripId !== 0 && !selectedIds;
        return (
          <Pressable
            disabled={!opensTrip}
            accessibilityRole={opensTrip ? 'button' : 'header'}
            accessibilityHint={opensTrip ? 'Opens the trip' : undefined}
            onPress={() => onOpenTrip(section.tripId)}
            style={[styles.sectionHeader, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
              {opensTrip ? (
                <SymbolView name="chevron.right" size={13} tintColor={theme.textSecondary} />
              ) : null}
            </View>
            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
              {sectionSubtitle(section)}
            </Text>
          </Pressable>
        );
      }}
      renderItem={({ item }) => (
        <DiveRowView
          row={toDiveRow(item, units)}
          selected={selectedIds ? selectedIds.has(item.id) : undefined}
          open={item.id === openDiveId}
          onPress={() => (selectedIds ? onToggleDive(item.id) : onSelectDive(item.id))}
          onLongPress={
            selectedIds
              ? undefined
              : () => {
                  // Android shows three buttons at most, so the trip actions go
                  // through the picker, which offers them all.
                  const pick =
                    tripActions(item).find((action) => action.kind === 'pick') ?? null;
                  const trip: AlertButton = {
                    text: 'Trip',
                    onPress: () => (pick ? onTripAction(item, pick) : undefined),
                  };
                  const select: AlertButton = {
                    text: 'Select',
                    onPress: () => onStartSelecting(item.id),
                  };
                  const remove: AlertButton = {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => onDeleteDive(item),
                  };
                  const merges = mergeActions(item);
                  if (merges.length === 0) {
                    Alert.alert(diveRowTitle(item), undefined, [trip, select, remove]);
                    return;
                  }
                  // No room for a fourth button: the rest moves one step further.
                  Alert.alert(diveRowTitle(item), undefined, [
                    trip,
                    {
                      text: 'Merge',
                      onPress: () =>
                        merges.length === 1
                          ? onMergeAction(item, merges[0])
                          : Alert.alert('Merge with', undefined, [
                              { text: 'Cancel', style: 'cancel' },
                              ...merges.map((action) => ({
                                text: action.kind === 'next' ? 'Next Dive' : 'Previous Dive',
                                onPress: () => onMergeAction(item, action),
                              })),
                            ]),
                    },
                    {
                      text: 'More',
                      onPress: () =>
                        Alert.alert(diveRowTitle(item), undefined, [
                          { text: 'Cancel', style: 'cancel' },
                          select,
                          remove,
                        ]),
                    },
                  ]);
                }
          }
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

  // Each bar is the real row's text, drawn invisible over a grey fill: it gets
  // the exact line height of what replaces it, so nothing moves on load.
  const bar = (style: TextStyle, text: string, align: 'flex-start' | 'flex-end' = 'flex-start') => (
    <Text
      style={[
        style,
        styles.bar,
        { alignSelf: align, color: 'transparent', backgroundColor: theme.backgroundSelected },
      ]}>
      {text}
    </Text>
  );

  return (
    <Animated.View
      accessible
      accessibilityLabel="Loading dives"
      style={[styles.skeleton, { backgroundColor: theme.background, opacity: pulse }]}>
      <View style={styles.sectionHeader}>
        {bar(styles.sectionTitle, 'Trip location')}
        {bar(styles.sectionSubtitle, '8 dives - 12 Mar 2024')}
      </View>
      {skeletonRows().map((row) => (
        <View key={row.id} style={diveRowStyles.row}>
          <View style={[diveRowStyles.badge, { backgroundColor: theme.backgroundSelected }]} />
          <View style={diveRowStyles.main}>
            {bar(diveRowTextStyles.title, row.title)}
            {bar(diveRowTextStyles.subtitle, row.subtitle)}
          </View>
          <View style={diveRowStyles.trailing}>
            {bar(diveRowTextStyles.depth, row.depthText, 'flex-end')}
            {bar(diveRowTextStyles.duration, row.durationText, 'flex-end')}
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
  bar: {
    borderRadius: 4,
    overflow: 'hidden',
  },
  content: {
    paddingBottom: Spacing.six,
  },
  results: {
    fontSize: 13,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.one,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  sectionSubtitle: {
    fontSize: 13,
  },
});
