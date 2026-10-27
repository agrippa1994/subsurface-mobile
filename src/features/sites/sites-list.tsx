// AI-generated (Claude)
// The Sites tab as a list: every site by name, with its position and dive
// count. How a row reads is decided in models/site-edit.ts, so the vitest
// suite covers it. The map alternative is components/sites-map.tsx.
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DiveSite } from '@/models';
import { sortSitesByName, toSiteRow } from '@/models/site-edit';

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
      renderItem={({ item }) => (
        <Pressable
          onPress={() => onSelectSite(item.uuid)}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.row,
            pressed ? { backgroundColor: theme.backgroundSelected } : null,
          ]}
        >
          <View style={styles.main}>
            <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{item.subtitle}</Text>
          </View>
          <Text style={[styles.count, { color: theme.textSecondary }]}>{item.countText}</Text>
        </Pressable>
      )}
    />
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
