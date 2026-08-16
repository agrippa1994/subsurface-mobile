// AI-generated (Claude)
// Dive detail: the dive's own record plus the profile diagram.
//
// `getDive` and `getProfile` are called here rather than cached in the store,
// because both are per-dive and the store only caches the list. Ids are
// process-local (see modules/ssrf-core/cpp/API.md), so a reload of the log
// invalidates this screen - which is why the lookup failing renders "not
// found" instead of throwing.
//
// This screen is React Native rather than SwiftUI: the profile is a Skia
// canvas, and a SwiftUI list cannot host one.
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ProfileChart } from '@/components/profile-chart';
import { StatusView } from '@/components/status-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getDive, getProfile } from '../../../../modules/ssrf-core/src';
import type { Cylinder, Dive, PlotInfo, WeightSystem } from '@/models';
import {
  DiveMode,
  formatDepth,
  formatDuration,
  formatGasMix,
  formatPressure,
  formatTemperature,
  formatVolume,
  formatWeight,
} from '@/models';
import { toDiveRow } from '@/models/dive-list';
import { buildProfilePlot } from '@/models/profile-plot';
import { describeError, formatErrorLine } from '@/models/errors';
import { useLogStore } from '@/store/log-store';
import { useUnitSystem } from '@/store/settings-store';

const DIVE_MODE_LABEL: Record<DiveMode, string> = {
  [DiveMode.OC]: 'Open circuit',
  [DiveMode.CCR]: 'CCR',
  [DiveMode.PSCR]: 'pSCR',
  [DiveMode.Freedive]: 'Freedive',
};

type Loaded = { dive: Dive; profile: PlotInfo };

export default function DiveDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const diveId = Number(id);
  // Re-read whenever the log is reloaded: the ids change with it.
  const logPath = useLogStore((state) => state.path);
  // ...and whenever a mutation happened: `refresh()` replaces this array, so
  // its identity is what tells the screen its copy of the dive is stale.
  const dives = useLogStore((state) => state.dives);
  const unitSystem = useUnitSystem();
  const theme = useTheme();

  const loaded = useMemo<Loaded | { error: string }>(() => {
    try {
      return { dive: getDive(diveId), profile: getProfile(diveId) };
    } catch (error) {
      return { error: formatErrorLine(describeError(error)) };
    }
    // logPath and dives are not read here on purpose - they are the
    // invalidation keys.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diveId, logPath, dives]);

  const plot = useMemo(
    () => ('dive' in loaded ? buildProfilePlot(loaded.profile, loaded.dive.dcs[0]?.events ?? []) : null),
    [loaded]
  );

  if ('error' in loaded) {
    return (
      <StatusView
        kind="error"
        title="Dive not found"
        description={loaded.error}
        systemImage="questionmark.circle"
      />
    );
  }

  const { dive, profile } = loaded;
  const row = toDiveRow(dive, unitSystem);
  const dc = dive.dcs[0];

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen
        options={{
          title: row.title,
          headerRight: () => (
            <Link href={`/dives/edit/${dive.id}`} asChild>
              <Pressable accessibilityRole="button" hitSlop={Spacing.two}>
                <Text style={[styles.headerAction, { color: theme.accent }]}>Edit</Text>
              </Pressable>
            </Link>
          ),
        }}
      />

      <Header dive={dive} />

      <Section title="Profile">
        {plot ? (
          <ProfileChart plot={plot} pi={profile} unitSystem={unitSystem} />
        ) : (
          <Text style={{ color: theme.textSecondary }}>No profile.</Text>
        )}
      </Section>

      <Section title="Dive">
        <Row label="Date" value={`${row.dateText} ${row.timeText}`} />
        <Row label="Max depth" value={formatDepth(dive.maxDepthMm, unitSystem)} />
        {dive.meanDepthMm > 0 ? (
          <Row label="Average depth" value={formatDepth(dive.meanDepthMm, unitSystem)} />
        ) : null}
        <Row label="Duration" value={formatDuration(dive.durationSec)} />
        <Row label="Mode" value={DIVE_MODE_LABEL[dive.divemode] ?? 'Open circuit'} />
        {dive.waterTempMkelvin > 0 ? (
          <Row label="Water" value={formatTemperature(dive.waterTempMkelvin, unitSystem)} />
        ) : null}
        {dive.airTempMkelvin > 0 ? (
          <Row label="Air" value={formatTemperature(dive.airTempMkelvin, unitSystem)} />
        ) : null}
        {dive.sac > 0 ? (
          <Row label="SAC" value={`${formatVolume(dive.sac, unitSystem)}/min`} />
        ) : null}
        {dive.otu > 0 ? <Row label="OTU" value={String(Math.round(dive.otu))} /> : null}
        {dive.maxcns > 0 ? <Row label="CNS" value={`${Math.round(dive.maxcns)} %`} /> : null}
        {dive.rating > 0 ? <Row label="Rating" value={`${dive.rating} / 5`} /> : null}
        {dive.visibility > 0 ? <Row label="Visibility" value={`${dive.visibility} / 5`} /> : null}
      </Section>

      <Section title="People and place">
        <Row label="Dive site" value={dive.siteName || '-'} />
        <Row label="Trip" value={dive.tripLocation || '-'} />
        <Row label="Buddy" value={dive.buddy || '-'} />
        <Row label="Divemaster" value={dive.diveguide || '-'} />
        <Row label="Suit" value={dive.suit || '-'} />
        <Row label="Tags" value={dive.tags.length > 0 ? dive.tags.join(', ') : '-'} />
      </Section>

      {dive.cylinders.length > 0 ? (
        <Section title="Cylinders">
          {dive.cylinders.map((cylinder, index) => (
            <CylinderRow key={index} cylinder={cylinder} index={index} />
          ))}
        </Section>
      ) : null}

      {dive.weightsystems.length > 0 ? (
        <Section title="Weights">
          {dive.weightsystems.map((weight, index) => (
            <WeightRow key={index} weight={weight} />
          ))}
          <Row label="Total" value={formatWeight(dive.totalWeightGrams, unitSystem)} />
        </Section>
      ) : null}

      {dc ? (
        <Section title="Dive computer">
          <Row label="Model" value={dc.model || '-'} />
          {dc.serial ? <Row label="Serial" value={dc.serial} /> : null}
          {dc.fwVersion ? <Row label="Firmware" value={dc.fwVersion} /> : null}
          <Row label="Samples" value={String(dc.sampleCount)} />
          {dive.dcs.length > 1 ? (
            <Row label="Other computers" value={String(dive.dcs.length - 1)} />
          ) : null}
        </Section>
      ) : null}

      {dive.notes.trim() !== '' ? (
        <Section title="Notes">
          <Text style={[styles.notes, { color: theme.text }]}>{dive.notes.trim()}</Text>
        </Section>
      ) : null}
    </ScrollView>
  );
}

function Header({ dive }: { dive: Dive }) {
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const stats: [string, string][] = [
    ['Max depth', formatDepth(dive.maxDepthMm, unitSystem)],
    ['Duration', formatDuration(dive.durationSec)],
    [
      'Water',
      dive.waterTempMkelvin > 0 ? formatTemperature(dive.waterTempMkelvin, unitSystem) : '-',
    ],
  ];

  return (
    <View style={styles.header}>
      {stats.map(([label, value]) => (
        <View key={label} style={styles.stat} accessible accessibilityLabel={spoken(label, value)}>
          <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>{children}</View>
    </View>
  );
}

/**
 * Label and value as one announcement. The dash the screen uses for a field the
 * dive does not carry is a visual placeholder; VoiceOver says what it means.
 */
function spoken(label: string, value: string): string {
  const text = value.trim() === '-' ? 'not recorded' : value.replace(/\n/g, ', ');
  return `${label}, ${text}`;
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessible accessibilityLabel={spoken(label, value)}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.value, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function CylinderRow({ cylinder, index }: { cylinder: Cylinder; index: number }) {
  const unitSystem = useUnitSystem();
  const gas = formatGasMix(cylinder.gasmix.o2EffectivePermille, cylinder.gasmix.heEffectivePermille);
  const start = cylinder.startMbar || cylinder.sampleStartMbar;
  const end = cylinder.endMbar || cylinder.sampleEndMbar;
  const pressure =
    start > 0 && end > 0
      ? `${formatPressure(start, unitSystem)} to ${formatPressure(end, unitSystem)}`
      : '-';
  const size = cylinder.sizeMl > 0 ? ` - ${formatVolume(cylinder.sizeMl, unitSystem)}` : '';

  return (
    <Row
      label={cylinder.description || `Cylinder ${index + 1}`}
      value={`${gas}${size}\n${pressure}`}
    />
  );
}

function WeightRow({ weight }: { weight: WeightSystem }) {
  const unitSystem = useUnitSystem();
  return (
    <Row
      label={weight.description || 'Weight'}
      value={formatWeight(weight.weightGrams, unitSystem)}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
    paddingBottom: Spacing.six,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    alignItems: 'center',
    flex: 1,
    gap: Spacing.half,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 12,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 13,
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  label: {
    fontSize: 15,
  },
  value: {
    flexShrink: 1,
    fontSize: 15,
    textAlign: 'right',
  },
  notes: {
    fontSize: 15,
    lineHeight: 21,
  },
  headerAction: {
    fontSize: 17,
    fontWeight: '600',
  },
});
