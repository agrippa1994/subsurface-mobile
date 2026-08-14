// AI-generated (Claude)
// Dive sites, read-only.
//
// The sites come from the same store snapshot as the dive list; editing them is
// task 10.
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { StatusView } from '@/components/status-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { udegToDegrees } from '@/models';
import { useLogStore } from '@/store/log-store';

function coordinates(latUdeg: number, lonUdeg: number): string {
  const lat = udegToDegrees(latUdeg);
  const lon = udegToDegrees(lonUdeg);
  return `${Math.abs(lat).toFixed(4)}${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(4)}${
    lon >= 0 ? 'E' : 'W'
  }`;
}

export default function SitesScreen() {
  const status = useLogStore((state) => state.status);
  const sites = useLogStore((state) => state.sites);
  const theme = useTheme();

  if (status === 'idle' || status === 'loading') {
    return <StatusView kind="loading" title="Opening logbook" />;
  }

  if (sites.length === 0) {
    return (
      <StatusView
        kind="empty"
        title="No dive sites"
        description="Sites appear here once a logbook with sites is loaded."
        systemImage="mappin.slash"
      />
    );
  }

  const sorted = [...sites].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <FlatList
      data={sorted}
      keyExtractor={(site) => String(site.uuid)}
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.main}>
            <Text style={[styles.title, { color: theme.text }]}>{item.name || 'Unnamed site'}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {item.hasGps ? coordinates(item.latUdeg, item.lonUdeg) : 'no position'}
            </Text>
          </View>
          <Text style={[styles.count, { color: theme.textSecondary }]}>
            {item.diveCount} {item.diveCount === 1 ? 'dive' : 'dives'}
          </Text>
        </View>
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
