// AI-generated (Claude)
// One dive as a React Native row: the number badge, title over subtitle and
// stars, depth over duration on the trailing edge.
//
// Shared by the portable dive list and by every screen that lists dives inside
// a React Native layout (a site's dives), so a dive looks the same wherever it
// is listed. The iOS dive list draws the same row in SwiftUI instead, see
// dive-list-view.ios.tsx. What the texts say is decided by the presentation
// model (models/dive-list.ts), never here.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ratingStars, type DiveRow } from '@/models/dive-list';

const BADGE_WIDTH = 44;

/** Where a separator between rows starts: under the title, past the badge. */
export const DIVE_ROW_SEPARATOR_INSET = Spacing.three + BADGE_WIDTH + Spacing.three;

export function DiveRowView({
  row,
  onPress,
  onLongPress,
}: {
  row: DiveRow;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const theme = useTheme();
  const subtitle = [row.subtitle, row.invalid ? 'invalid' : ''].filter(Boolean).join('  ');
  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={row.accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        diveRowStyles.row,
        pressed ? { backgroundColor: theme.backgroundSelected } : null,
      ]}
    >
      <View style={[diveRowStyles.badge, { backgroundColor: theme.backgroundSelected }]}>
        <Text style={[diveRowTextStyles.badgeText, { color: theme.accent }]}>{row.badgeText}</Text>
      </View>
      <View style={diveRowStyles.main}>
        <Text style={[diveRowTextStyles.title, { color: theme.text }]} numberOfLines={1}>
          {row.title}
        </Text>
        {subtitle !== '' ? (
          <Text style={[diveRowTextStyles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {row.rating > 0 ? <Text style={diveRowTextStyles.stars}>{ratingStars(row.rating)}</Text> : null}
      </View>
      <View style={diveRowStyles.trailing}>
        {row.depthText !== '' ? (
          <Text style={[diveRowTextStyles.depth, { color: theme.text }]}>{row.depthText}</Text>
        ) : null}
        {row.durationText !== '' ? (
          <Text style={[diveRowTextStyles.duration, { color: theme.textSecondary }]}>{row.durationText}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** The row's layout, for the loading skeleton that stands in for it. */
export const diveRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  badge: {
    minWidth: BADGE_WIDTH,
    height: 32,
    paddingHorizontal: Spacing.one,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: {
    flex: 1,
    gap: Spacing.half,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
});

/** The row's text styles; the skeleton draws its bars with them so they match. */
export const diveRowTextStyles = StyleSheet.create({
  badgeText: {
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  title: {
    fontSize: 17,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 14,
  },
  stars: {
    fontSize: 13,
    color: '#FFB300',
  },
  depth: {
    fontSize: 16,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  duration: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
});
