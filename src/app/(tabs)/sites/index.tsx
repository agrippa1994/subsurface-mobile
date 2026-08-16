// AI-generated (Claude)
// Dive sites: the list, the way into the editor, and the way to a new site.
//
// The rows come from the same module read as the dive list; how one renders is
// decided in models/site-edit.ts so the vitest suite covers it.
import { Link, Stack, useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { StatusView } from '@/components/status-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { sortSitesByName, toSiteRow } from '@/models/site-edit';
import { useLogbook, useSites } from '@/queries/logbook';

export default function SitesScreen() {
  const logbook = useLogbook();
  const { data: sites = [] } = useSites();
  const router = useRouter();
  const theme = useTheme();

  const header = (
    <Stack.Screen
      options={{
        headerRight: () => (
          <Link href="/sites/new" asChild>
            <Pressable accessibilityRole="button" accessibilityLabel="New dive site" hitSlop={Spacing.two}>
              <Text style={[styles.headerAction, { color: theme.accent }]}>New</Text>
            </Pressable>
          </Link>
        ),
      }}
    />
  );

  if (!logbook.isSuccess) {
    return (
      <>
        {header}
        <StatusView kind="loading" title="Opening logbook" />
      </>
    );
  }

  if (sites.length === 0) {
    return (
      <>
        {header}
        <StatusView
          kind="empty"
          title="No dive sites"
          description="Sites appear here once a logbook with sites is loaded, or when you add one."
          systemImage="mappin.slash"
          actionLabel="New site"
          onAction={() => router.push('/sites/new')}
        />
      </>
    );
  }

  const rows = sortSitesByName(sites).map(toSiteRow);

  return (
    <>
      {header}
      <FlatList
        data={rows}
        keyExtractor={(row) => String(row.uuid)}
        style={{ backgroundColor: theme.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/sites/${item.uuid}`)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.row,
              pressed ? { backgroundColor: theme.backgroundSelected } : null,
            ]}>
            <View style={styles.main}>
              <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{item.subtitle}</Text>
            </View>
            <Text style={[styles.count, { color: theme.textSecondary }]}>{item.countText}</Text>
          </Pressable>
        )}
      />
    </>
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
  headerAction: {
    fontSize: 17,
    fontWeight: '600',
  },
});
