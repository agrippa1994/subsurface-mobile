// AI-generated (Claude)
// One dive site: its position and the dives logged there.
//
// Reached from a pin on the Sites map or a row of the Sites list. The map here
// is read-only; moving the pin is the editor's job (Edit), where the new
// position is only written when the form is saved. Without a map (Android)
// the position is the coordinate line alone.

import { Stack, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DIVE_ROW_SEPARATOR_INSET, DiveRowView } from '@/components/dive-row';
import { FormSection } from '@/components/form';
import { HeaderAction } from '@/components/header-action';
import { MAPS_AVAILABLE, SiteMap } from '@/components/site-map';
import { StatusView } from '@/components/status-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { sortDivesNewestFirst, toSiteDiveRow } from '@/models/dive-list';
import { toSiteRow } from '@/models/site-edit';
import { useDives, useSites } from '@/queries/logbook';
import { useUnitSystem } from '@/queries/settings';

export function SiteDetail({ uuid }: { uuid: number }) {
  const router = useRouter();
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const { data: sites = [] } = useSites();
  const { data: allDives = [] } = useDives();

  const site = sites.find((candidate) => candidate.uuid === uuid);
  const dives = useMemo(
    () => sortDivesNewestFirst(allDives.filter((dive) => dive.siteUuid === uuid)),
    [allDives, uuid],
  );

  if (!site) {
    return (
      <StatusView
        kind="error"
        title="Dive site not found"
        description="The logbook was reloaded and this site is no longer in it."
        systemImage="mappin.slash"
      />
    );
  }

  const row = toSiteRow(site);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Stack.Screen options={{ title: row.title }} />
      <HeaderAction label="Edit" onPress={() => router.push(`/sites/edit/${uuid}`)} />

      <FormSection title="Position">
        {MAPS_AVAILABLE ? (
          <SiteMap
            latUdeg={site.hasGps ? site.latUdeg : null}
            lonUdeg={site.hasGps ? site.lonUdeg : null}
            title={row.title}
            height={260}
          />
        ) : null}
        <Text style={[styles.coordinates, { color: theme.textSecondary }]}>{row.subtitle}</Text>
      </FormSection>

      <FormSection title={row.countText}>
        {dives.length === 0 ? (
          <Text style={{ color: theme.textSecondary }}>No dives at this site yet.</Text>
        ) : (
          // One block, so the card's gap does not space the rows; hairlines
          // between them instead, inset past the badge like the dive list's.
          <View style={styles.diveList}>
            {dives.map((dive, index) => (
              <View key={dive.id}>
                {index > 0 ? (
                  <View style={[styles.separator, { backgroundColor: theme.separator }]} />
                ) : null}
                <DiveRowView
                  row={toSiteDiveRow(dive, unitSystem)}
                  onPress={() => router.push(`/sites/dive/${dive.id}`)}
                />
              </View>
            ))}
          </View>
        )}
      </FormSection>

      <View style={styles.footerSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  coordinates: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  // Cancels the card's padding, so each row - and its pressed highlight - runs
  // edge to edge like a cell of the main dive list, the whole cell the tap
  // target. The radius keeps the first and last highlight inside the card.
  diveList: {
    margin: -Spacing.three,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: DIVE_ROW_SEPARATOR_INSET,
  },
  footerSpace: {
    height: Spacing.six,
  },
});
