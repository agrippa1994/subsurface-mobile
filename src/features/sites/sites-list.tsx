// AI-generated (Claude)
// The Sites tab as a list: every site by name, with its position and dive
// count. How a row reads is decided in models/site-edit.ts, so the vitest
// suite covers it. With a map, the same rows sit in a sheet over it instead, see
// (tabs)/sites/index.tsx.
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DiveSite } from '@/models';
import { sortSitesByName, toSiteRow, type SiteRow } from '@/models/site-edit';

export function SitesList({
  sites,
  onSelectSite,
}: {
  sites: readonly DiveSite[];
  onSelectSite: (uuid: number) => void;
}) {
  const theme = useTheme();
  const rows = sortSitesByName(sites).map(toSiteRow);

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => String(row.uuid)}
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      renderItem={({ item }) => <SiteRowView row={item} onPress={() => onSelectSite(item.uuid)} />}
    />
  );
}

/** One site, in this list and in the sheet over the map. */
export function SiteRowView({ row, onPress }: { row: SiteRow; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        pressed ? { backgroundColor: theme.backgroundSelected } : null,
      ]}
    >
      <View style={styles.main}>
        <Text style={[styles.title, { color: theme.text }]}>{row.title}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{row.subtitle}</Text>
      </View>
      <Text style={[styles.count, { color: theme.textSecondary }]}>{row.countText}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: Spacing.two,
    paddingBottom: Spacing.six,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  main: {
    flex: 1,
    gap: Spacing.half,
  },
  title: {
    fontSize: 17,
  },
  subtitle: {
    fontSize: 13,
  },
  count: {
    fontSize: 13,
  },
});
