// AI-generated (Claude)
// One dive site: its position and the dives logged there.
//
// Reached from a pin on the Sites map or a row of the Sites list. The map here
// is read-only; moving the pin is the editor's job (Edit), where the new
// position is only written when the form is saved. Android has no map, so it
// shows the coordinates only.

import { Stack, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FormSection } from '@/components/form';
import { HeaderAction } from '@/components/header-action';
import { SiteMap } from '@/components/site-map';
import { StatusView } from '@/components/status-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { sortDivesNewestFirst, toDiveRow } from '@/models/dive-list';
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

      {HAS_MAP ? (
        <FormSection title="Position">
          <SiteMap
            latUdeg={site.hasGps ? site.latUdeg : null}
            lonUdeg={site.hasGps ? site.lonUdeg : null}
            title={row.title}
            height={260}
          />
          <Text style={[styles.coordinates, { color: theme.textSecondary }]}>{row.subtitle}</Text>
        </FormSection>
      ) : (
        <FormSection title="Position">
          <Text style={{ color: theme.text }}>{row.subtitle}</Text>
        </FormSection>
      )}

      <FormSection title={row.countText}>
        {dives.length === 0 ? (
          <Text style={{ color: theme.textSecondary }}>No dives at this site yet.</Text>
        ) : (
          // One block, so the card's gap does not space the rows; hairlines
          // between them instead, inset past the badge like the dive list's.
          <View style={styles.diveList}>
            {dives.map((dive, index) => {
              const diveRow = toDiveRow(dive, unitSystem);
              return (
                <View key={diveRow.id}>
                  {index > 0 ? (
                    <View style={[styles.separator, { backgroundColor: theme.separator }]} />
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={diveRow.accessibilityLabel}
                    onPress={() => router.push(`/sites/dive/${diveRow.id}`)}
                    style={({ pressed }) => [
                      styles.diveRow,
                      pressed ? { backgroundColor: theme.backgroundSelected } : null,
                    ]}
                  >
                    <View style={[styles.badge, { backgroundColor: theme.backgroundSelected }]}>
                      <Text style={[styles.badgeText, { color: theme.accent }]}>
                        {diveRow.badgeText}
                      </Text>
                    </View>
                    <View style={styles.diveMain}>
                      <Text style={[styles.diveTitle, { color: theme.text }]} numberOfLines={1}>
                        {`${diveRow.dateText}, ${diveRow.timeText}`}
                      </Text>
                      {diveRow.invalid ? (
                        <Text style={[styles.diveSubtitle, { color: theme.textSecondary }]}>
                          invalid
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.diveTrailing}>
                      {diveRow.depthText !== '' ? (
                        <Text style={[styles.diveDepth, { color: theme.text }]}>
                          {diveRow.depthText}
                        </Text>
                      ) : null}
                      {diveRow.durationText !== '' ? (
                        <Text style={[styles.diveSubtitle, { color: theme.textSecondary }]}>
                          {diveRow.durationText}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </FormSection>

      <View style={styles.footerSpace} />
    </ScrollView>
  );
}

/** Only iOS has a map (Apple Maps); Android has no Google Maps key configured. */
const HAS_MAP = Platform.OS === 'ios';

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
  diveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    // Row inset plus badge width plus the row's gap: the line starts where the
    // date does.
    marginLeft: Spacing.three + 44 + Spacing.three,
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
  diveMain: {
    flex: 1,
    gap: Spacing.half,
  },
  diveTitle: {
    fontSize: 16,
  },
  diveSubtitle: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  diveTrailing: {
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
  diveDepth: {
    fontSize: 15,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  footerSpace: {
    height: Spacing.six,
  },
});
