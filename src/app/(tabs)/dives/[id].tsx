// AI-generated (Claude)
// Dive detail: the dive's own record plus the profile diagram.
//
// The dive and its profile are their own queries rather than something derived
// from the list, because the list rows carry neither. Ids are process-local
// (see modules/ssrf-core/cpp/API.md), so a reload of the log removes both keys -
// which is why the lookup failing renders "not found" instead of throwing.
//
// This screen is React Native rather than SwiftUI: the profile is a Skia
// canvas, and a SwiftUI list cannot host one. It still draws the grouped-list
// look - section titles over rounded cards of separated rows - so it sits
// next to the native screens without looking off.
import { HeaderAction } from '@/components/header-action';
import { SymbolView, type SymbolViewProps } from '@/components/symbol';
import { Link, Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Children, Fragment, isValidElement, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PlanNotesView } from '@/components/plan-notes-view';
import { ProfileChart } from '@/components/profile-chart';
import { ProfileFullscreen } from '@/components/profile-fullscreen';
import { MAPS_AVAILABLE, SiteMap } from '@/components/site-map';
import { StatusView } from '@/components/status-view';
import { Spacing } from '@/constants/theme';
import { ComputerPicker } from '@/features/dives/computer-picker';
import { useComputerSelection } from '@/features/dives/use-computer-selection';
import { useDiveCsvExport } from '@/features/dives/use-dive-csv-export';
import { useDiveMerge } from '@/features/dives/use-dive-merge';
import { useTripActions } from '@/features/dives/use-trip-actions';
import { useLeaveWhenGone } from '@/features/history/use-leave-when-gone';
import { MAPS_PLATFORM, useOpenInMaps } from '@/features/sites/use-open-in-maps';
import { IS_TABLET } from '@/hooks/use-adaptive-layout';
import { useTheme } from '@/hooks/use-theme';
import { useCurrentDiveId } from '@/lib/merged-dives';
import type { Cylinder, Dive, WeightSystem } from '@/models';
import {
  formatDepth,
  formatDuration,
  formatGasMix,
  formatPressure,
  formatTemperature,
  formatVolume,
  formatWeight,
} from '@/models';
import {
  computerFigures,
  computerLabels,
  diveModeLabel,
  makeFirstLabel,
  plotForComputer,
} from '@/models/dive-computers';
import { isManualDive, MANUAL_DC_MODEL } from '@/models/dive-basics';
import { profileCalculationNote } from '@/models/disclaimer';
import { toDiveRow } from '@/models/dive-list';
import { buildProfilePlot } from '@/models/profile-plot';
import { describeError, formatErrorLine } from '@/models/errors';
import { mapsAppName } from '@/models/maps-link';
import { toSiteRow } from '@/models/site-edit';
import { CSV_FORMATS } from '@/models/transfer';
import {
  adjacentTripsByDive,
  tripActionsFor,
  tripSubtitle,
  tripTitle,
  type TripAction,
} from '@/models/trips';
import { useDive, useDives, useProfile, useSites, useTrips } from '@/queries/logbook';
import { useProfileSeries, useUnits } from '@/queries/settings';
import { isSyncedToSsi, useSsiAccount } from '@/queries/ssi';
import { t } from '@/i18n';

type SymbolName = SymbolViewProps['name'];

/**
 * The stacks this screen is pushed in. Its own links (Edit, Sync to SSI) stay in
 * the same stack, so Back from them returns here rather than to another tab.
 */
export type DiveStackPath = '/dives' | '/sites/dive' | '/statistics/dive';

export default function DiveDetailScreen({ stackPath = '/dives' }: { stackPath?: DiveStackPath }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const diveId = Number(id);
  const currentId = useCurrentDiveId(diveId);
  const units = useUnits();
  // Which series the profile draws (gradient factors, ceilings, grid). A display
  // preference only - all are in every plot_info, so a toggle costs no recomputation.
  const profileSeries = useProfileSeries();
  const theme = useTheme();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  // Both are keyed on the dive id and live under the log subtree, so a reload
  // drops them: ids are process-local and mean nothing across a load.
  const diveQuery = useDive(diveId);
  const computer = useComputerSelection(diveId, diveQuery.data?.dcs.length ?? 0);
  const profileQuery = useProfile(diveId, computer.index);
  // Whether the SSI row offers an upload or points at Settings. A network
  // query, unlike everything else on this screen - see src/queries/ssi.ts.
  const ssiAccount = useSsiAccount();
  const { data: sites = [] } = useSites();
  const dive = diveQuery.data;
  const profile = profileQuery.data;

  const plot = useMemo(
    () =>
      dive && profile
        ? plotForComputer(
            buildProfilePlot(profile, dive.dcs[computer.index]?.events ?? []),
            dive.dcs,
            computer.index,
          )
        : null,
    [computer.index, dive, profile],
  );

  const failure = diveQuery.error ?? profileQuery.error;
  // Undone or redone away: the dive may be back as soon as the undo is undone, but
  // the screen has nothing to show until then.
  useLeaveWhenGone(failure !== null && currentId === diveId);

  // Merged since this screen opened, from here or from anywhere else: the dive
  // goes on under a new id, and only then would the lookup below fail.
  if (currentId !== diveId) {
    return <Redirect href={`${stackPath}/${currentId}`} />;
  }

  if (failure) {
    return (
      <StatusView
        kind="error"
        title={t('dive.notFound')}
        description={formatErrorLine(describeError(failure))}
        systemImage="questionmark.circle"
      />
    );
  }

  if (!dive || !profile) {
    return <StatusView kind="loading" title={t('ui.openingDive')} />;
  }

  const row = toDiveRow(dive, units);
  const dc = dive.dcs[computer.index];
  const severalComputers = dive.dcs.length > 1;
  const manualComputer = dc?.model === MANUAL_DC_MODEL;
  const synced = isSyncedToSsi(dive);
  const notes = dive.notes.trim();
  // A site with a position gets a section of its own, with the map.
  const siteOnMap = sites.some((site) => site.uuid === dive.siteUuid && site.hasGps);
  const hasPeopleOrPlace =
    (dive.siteName !== '' && !siteOnMap) ||
    dive.buddy !== '' ||
    dive.diveguide !== '' ||
    dive.suit !== '' ||
    dive.tags.length > 0;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Stack.Screen options={{ title: row.title }} />
      {/* A native bar button item rather than a custom headerRight view, so it
          gets the system Edit look (liquid glass on iOS 26). */}
      <HeaderAction history label={t('common.edit')} onPress={() => router.push(`${stackPath}/edit/${dive.id}`)} />

      <Header
        dive={dive}
        dateText={row.dateText}
        timeText={row.timeText}
        numberText={row.numberText}
      />

      {dive.planned ? (
        <Text style={[styles.plannedBanner, { color: theme.warning }]}>
          {t('dive.plannedBanner')}
        </Text>
      ) : null}

      <Section
        title={t('dive.profile')}
        inset
        footer={
          manualComputer
            ? `${t('dive.manualProfile')} ${profileCalculationNote()}`
            : plot
              ? profileCalculationNote()
              : undefined
        }
        action={
          IS_TABLET && plot ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('dive.fullScreen')}
              hitSlop={Spacing.three}
              onPress={() => setExpanded(true)}>
              <SymbolView
                name="arrow.up.left.and.arrow.down.right"
                size={17}
                tintColor={theme.accent}
              />
            </Pressable>
          ) : undefined
        }
      >
        {severalComputers ? (
          <View style={styles.computerPicker}>
            <ComputerPicker
              labels={computerLabels(dive.dcs)}
              selectedIndex={computer.index}
              onSelect={computer.select}
              onMakeFirst={computer.makeFirst}
            />
          </View>
        ) : null}
        {plot ? (
          <ProfileChart
            key={computer.index}
            plot={plot}
            pi={profile}
            units={units}
            series={profileSeries}
          />
        ) : (
          <Text style={[styles.placeholder, { color: theme.textSecondary }]}>
            {t('dive.noProfile')}
          </Text>
        )}
      </Section>

      {/* Turning a phone, or the button on a tablet, hands the same plot the whole screen. */}
      {plot ? (
        <ProfileFullscreen
          title={manualComputer ? t('dive.addedManually', { title: row.title }) : row.title}
          chartKey={computer.index}
          expanded={expanded}
          onClose={() => setExpanded(false)}
          accessory={
            severalComputers ? (
              <ComputerPicker
                compact
                labels={computerLabels(dive.dcs)}
                selectedIndex={computer.index}
                onSelect={computer.select}
                onMakeFirst={computer.makeFirst}
              />
            ) : null
          }
          plot={plot}
          pi={profile}
          units={units}
          series={profileSeries}
        />
      ) : null}

      <Section title={t('dive.details')}>
        {dive.meanDepthMm > 0 ? (
          <Row label={t('dive.field.averageDepth')} value={formatDepth(dive.meanDepthMm, units)} />
        ) : null}
        {/* The summary's mode is the first computer's. With several, each states its own. */}
        {severalComputers ? null : (
          <Row label={t('dive.field.mode')} value={diveModeLabel(dive.divemode)} />
        )}
        {dive.airTempMkelvin > 0 ? (
          <Row label={t('dive.field.airTemperature')} value={formatTemperature(dive.airTempMkelvin, units)} />
        ) : null}
        {dive.sac > 0 ? (
          <Row label={t('dive.field.sac')} value={`${formatVolume(dive.sac, units)}/min`} />
        ) : null}
        {dive.otu > 0 ? <Row label={t('ui.otu')} value={String(Math.round(dive.otu))} /> : null}
        {dive.maxcns > 0 ? <Row label={t('ui.cns')} value={`${Math.round(dive.maxcns)} %`} /> : null}
        {dive.rating > 0 ? <StarRow label={t('dive.field.rating')} value={dive.rating} /> : null}
        {dive.visibility > 0 ? <StarRow label={t('dive.field.visibility')} value={dive.visibility} /> : null}
      </Section>

      <SiteSection dive={dive} stackPath={stackPath} />

      {hasPeopleOrPlace ? (
        <Section title={t('dive.peopleAndPlace')}>
          {dive.siteName && !siteOnMap ? <Row label={t('dive.field.diveSite')} value={dive.siteName} /> : null}
          {dive.buddy ? <Row label={t('dive.field.buddy')} value={dive.buddy} /> : null}
          {dive.diveguide ? <Row label={t('dive.field.divemaster')} value={dive.diveguide} /> : null}
          {dive.suit ? <Row label={t('dive.field.suit')} value={dive.suit} /> : null}
          {dive.tags.length > 0 ? <TagsRow tags={dive.tags} /> : null}
        </Section>
      ) : null}

      <TripSection dive={dive} stackPath={stackPath} />

      {notes !== '' ? (
        <Section title={dive.planned ? t('dive.plan') : t('dive.notes')}>
          {dive.planned ? (
            <View style={styles.planNotes}>
              <PlanNotesView notes={notes} />
            </View>
          ) : (
            <Text selectable style={[styles.notes, { color: theme.text }]}>
              {notes}
            </Text>
          )}
        </Section>
      ) : null}

      {dive.cylinders.length > 0 ? (
        <Section title={t('dive.cylinders')}>
          {dive.cylinders.map((cylinder, index) => (
            <CylinderRow key={index} cylinder={cylinder} index={index} />
          ))}
        </Section>
      ) : null}

      {dive.weightsystems.length > 0 ? (
        <Section title={t('dive.weights')}>
          {dive.weightsystems.map((weight, index) => (
            <WeightRow key={index} weight={weight} />
          ))}
          {dive.weightsystems.length > 1 ? (
            <Row label={t('dive.field.total')} value={formatWeight(dive.totalWeightGrams, units)} emphasized />
          ) : null}
        </Section>
      ) : null}

      {dc ? (
        <Section
          title={manualComputer ? t('dive.source') : t('dive.diveComputer')}
          footer={
            severalComputers
              ? t('dive.wholeDiveNote')
              : undefined
          }
        >
          {manualComputer ? (
            <Row label={t('dive.diveComputer')} value={t('dive.noneManual')} />
          ) : (
            <Row label={t('dive.field.model')} value={dc.model || t('dive.unknown')} />
          )}
          {dc.serial ? <Row label={t('dive.field.serial')} value={dc.serial} /> : null}
          {dc.fwVersion ? <Row label={t('dive.field.firmware')} value={dc.fwVersion} /> : null}
          {manualComputer ? null : <Row label={t('dive.field.samples')} value={String(dc.sampleCount)} />}
          {severalComputers
            ? computerFigures(dc, units).map(({ label, value }) => (
                <Row key={label} label={label} value={value} />
              ))
            : null}
          {/* Desktop's "Make first dive computer": what reads the first computer
              (the mode in the summary, SSI upload, CSV export) reads this one after. */}
          {severalComputers && computer.index > 0 ? (
            <ActionRow
              symbol="arrow.up"
              label={makeFirstLabel()}
              detail={t('dive.makeFirstDetail')}
              onPress={() => computer.makeFirst(computer.index)}
            />
          ) : null}
        </Section>
      ) : null}

      {/* A plan never happened, and an SSI logbook is of dives that did. */}
      {dive.planned ? null : (
      <Section
        title={t('ui.ssi')}
        footer={
          ssiAccount.data === null
            ? t('dive.ssi.signIn')
            : severalComputers
              ? t('dive.ssi.firstComputer', { computer: computerLabels(dive.dcs)[0] })
              : undefined
        }
      >
        {ssiAccount.data === null ? (
          <ActionRow symbol="icloud.slash" label={t('dive.ssi.notSignedIn')} disabled />
        ) : (
          <Link href={`${stackPath}/ssi/${dive.id}`} asChild>
            <ActionRow
              symbol={synced ? 'checkmark.icloud' : 'icloud.and.arrow.up'}
              label={synced ? t('dive.ssi.syncAgain') : t('dive.ssi.sync')}
              detail={synced ? t('dive.ssi.synced') : t('dive.ssi.pickSite')}
              chevron
            />
          </Link>
        )}
      </Section>
      )}

      <MergeSection diveId={dive.id} />

      <CsvExportSection dive={dive} />
    </ScrollView>
  );
}

/** Where each stack shows a dive site, so Back from it returns to the dive. */
const SITE_PATH: Record<DiveStackPath, string> = {
  '/dives': '/dives/site',
  '/sites/dive': '/sites',
  '/statistics/dive': '/statistics/site',
};

/**
 * The dive site, when it has a position: a small map of it, the site itself one tap
 * away - as the Sites tab shows it, with its other dives - and the maps app for
 * directions. A site without a position stays a line under People and place.
 */
function SiteSection({ dive, stackPath }: { dive: Dive; stackPath: DiveStackPath }) {
  const router = useRouter();
  const openInMaps = useOpenInMaps();
  const { data: sites = [] } = useSites();
  const site = sites.find((candidate) => candidate.uuid === dive.siteUuid);
  if (!site?.hasGps) {
    return null;
  }
  const row = toSiteRow(site);
  const openSite = () => router.push(`${SITE_PATH[stackPath]}/${site.uuid}`);
  return (
    <Section title={t('dive.field.diveSite')}>
      {MAPS_AVAILABLE ? (
        <Pressable
          key="map"
          onPress={openSite}
          accessibilityRole="button"
          accessibilityLabel={t('dive.site.map', { title: row.title })}
          accessibilityHint={t('dive.site.mapHint')}
          style={({ pressed }) => [styles.siteMap, pressed ? { opacity: 0.8 } : null]}
        >
          {/* A picture of the place, not a map to pan: the tap is the row's. */}
          <View pointerEvents="none" style={{ flex: 1 }}>
            <SiteMap
              latUdeg={site.latUdeg}
              lonUdeg={site.lonUdeg}
              title={row.title}
              height={150}
              flush
            />
          </View>
        </Pressable>
      ) : null}
      <ActionRow
        key="site"
        symbol="mappin.and.ellipse"
        label={row.title}
        detail={`${row.subtitle} - ${row.countText}`}
        chevron
        onPress={openSite}
        accessibilityHint={t('dive.site.rowHint')}
      />
      <ActionRow
        key="maps"
        symbol="map"
        label={t('dive.site.openInMaps')}
        detail={t('dive.site.directions', { app: mapsAppName(MAPS_PLATFORM) })}
        onPress={() => openInMaps(site)}
      />
    </Section>
  );
}

/**
 * The dive's trip, or what it can do without one. Its own component for the same
 * reason as the export below: the screen's early returns come before these
 * queries could be called.
 */
function TripSection({ dive, stackPath }: { dive: Dive; stackPath: DiveStackPath }) {
  const router = useRouter();
  const { data: dives = [] } = useDives();
  const { data: trips = [] } = useTrips();
  const tripActions = useTripActions();
  const trip = trips.find((candidate) => candidate.id === dive.tripId);
  const adjacent = adjacentTripsByDive(dives, trips).get(dive.id);
  const actions = tripActionsFor(dive, adjacent);

  const run = (action: TripAction) => {
    switch (action.kind) {
      case 'open':
        router.push(`${stackPath}/trip/${action.tripId}`);
        break;
      case 'pick':
        router.push(`${stackPath}/trip/pick?diveIds=${dive.id}`);
        break;
      case 'add':
        tripActions.addToTrip([dive], action.tripId);
        break;
      case 'new':
        tripActions.createTrip([dive], (created) => router.push(`${stackPath}/trip/${created.id}`));
        break;
      case 'remove':
        tripActions.removeFromTrip([dive]);
        break;
    }
  };

  return (
    <Section title={t('dive.trip')}>
      {actions.map((action) =>
        action.kind === 'open' ? (
          <ActionRow
            key={action.kind}
            symbol={action.symbol}
            label={trip ? tripTitle(trip.location) : action.label}
            detail={trip ? tripSubtitle(trip) : undefined}
            chevron
            onPress={() => run(action)}
          />
        ) : (
          <ActionRow
            key={`${action.kind}-${action.label}`}
            symbol={action.symbol}
            label={action.label}
            chevron={action.kind === 'pick'}
            onPress={() => run(action)}
          />
        ),
      )}
    </Section>
  );
}

/**
 * The merges this dive offers, if any. Its own component for the same reason as
 * the trip section above.
 */
function MergeSection({ diveId }: { diveId: number }) {
  const { actionsFor, confirmMerge } = useDiveMerge();
  const actions = actionsFor(diveId);
  if (actions.length === 0) {
    return null;
  }
  return (
    <Section title={t('dive.merge')}>
      {actions.map((action) => (
        <ActionRow
          key={action.kind}
          symbol={action.symbol}
          label={action.label}
          detail={action.detail}
          onPress={() => confirmMerge(diveId, action)}
        />
      ))}
    </Section>
  );
}

/**
 * The CSV flavours of desktop Subsurface's export dialog, one row each. Its own
 * component so the export hook is only mounted once the dive has loaded.
 */
function CsvExportSection({ dive }: { dive: Dive }) {
  const { busy, share } = useDiveCsvExport(dive);
  return (
    <Section
      title={t('dive.csv.title')}
      footer={
        dive.dcs.length > 1
          ? t('dive.csv.firstComputer', { computer: computerLabels(dive.dcs)[0] })
          : undefined
      }
    >
      {CSV_FORMATS.map(({ format, label, description }) => (
        <ActionRow
          key={format}
          symbol="square.and.arrow.up"
          label={label}
          detail={
            format === 'details' && isManualDive(dive)
              ? t('dive.csv.manualDetails')
              : description
          }
          disabled={busy}
          onPress={() => share(format)}
        />
      ))}
    </Section>
  );
}

/**
 * Date, number and the three figures a diver looks for first. The site is the
 * navigation title already, so it is not repeated here.
 */
function Header({
  dive,
  dateText,
  timeText,
  numberText,
}: {
  dive: Dive;
  dateText: string;
  timeText: string;
  numberText: string;
}) {
  const theme = useTheme();
  const units = useUnits();
  const stats: { label: string; value: string; symbol: SymbolName }[] = [
    {
      label: t('dive.field.maxDepth'),
      value: formatDepth(dive.maxDepthMm, units),
      symbol: 'arrow.down.to.line',
    },
    { label: t('dive.field.duration'), value: formatDuration(dive.durationSec), symbol: 'clock' },
    {
      label: t('dive.field.water'),
      value: dive.waterTempMkelvin > 0 ? formatTemperature(dive.waterTempMkelvin, units) : '-',
      symbol: 'thermometer.medium',
    },
  ];

  return (
    <View style={styles.header}>
      <View style={styles.headerLine}>
        <Text style={[styles.headerDate, { color: theme.textSecondary }]}>
          {t('diveList.spoken.dateAt', { date: dateText, time: timeText })}
        </Text>
        {numberText ? (
          <View style={[styles.badge, { backgroundColor: theme.backgroundSelected }]}>
            <Text
              style={[styles.badgeText, { color: theme.textSecondary }]}
              accessibilityLabel={t('dive.numberSpoken', { number: dive.number })}
            >
              {numberText}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.stats}>
        {stats.map(({ label, value, symbol }) => (
          <View
            key={label}
            style={[styles.stat, { backgroundColor: theme.backgroundElement }]}
            accessible
            accessibilityLabel={spoken(label, value)}
          >
            <SymbolView name={symbol} size={17} tintColor={theme.accent} />
            <Text
              style={[styles.statValue, { color: theme.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {value}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * A titled card. Rows are separated by hairlines the way a grouped list draws
 * them; `inset` is for content that is not rows (the profile), which gets
 * padding on every side instead.
 */
function Section({
  title,
  footer,
  inset = false,
  action,
  children,
}: {
  title: string;
  footer?: string;
  inset?: boolean;
  /** At the far end of the title line. */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleLine}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
        {action}
      </View>
      <View
        style={[
          styles.card,
          inset ? styles.cardInset : null,
          { backgroundColor: theme.backgroundElement },
        ]}
      >
        {inset
          ? children
          : rows.map((child, index) => (
              <Fragment key={child.key ?? index}>
                {index > 0 ? (
                  <View style={[styles.separator, { backgroundColor: theme.separator }]} />
                ) : null}
                {child}
              </Fragment>
            ))}
      </View>
      {footer ? (
        <Text style={[styles.sectionFooter, { color: theme.textSecondary }]}>{footer}</Text>
      ) : null}
    </View>
  );
}

/**
 * Label and value as one announcement. The dash the screen uses for a field the
 * dive does not carry is a visual placeholder; VoiceOver says what it means.
 */
function spoken(label: string, value: string): string {
  const text = value.trim() === '-' ? t('dive.notRecorded') : value.replace(/\n/g, ', ');
  return `${label}, ${text}`;
}

function Row({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessible accessibilityLabel={spoken(label, value)}>
      <Text style={[styles.label, { color: theme.text }, emphasized ? styles.strong : null]}>
        {label}
      </Text>
      <Text
        selectable
        style={[styles.value, { color: theme.textSecondary }, emphasized ? styles.strong : null]}
      >
        {value}
      </Text>
    </View>
  );
}

/** A 1-5 value as stars, the same scale the editor's RatingField sets. */
function StarRow({ label, value }: { label: string; value: number }) {
  const theme = useTheme();
  const filled = Math.round(value);
  return (
    <View style={styles.row} accessible accessibilityLabel={t('dive.stars', { label, filled })}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <SymbolView
            key={star}
            name={star <= filled ? 'star.fill' : 'star'}
            size={15}
            tintColor={star <= filled ? theme.accent : theme.textSecondary}
          />
        ))}
      </View>
    </View>
  );
}

function TagsRow({ tags }: { tags: readonly string[] }) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessible accessibilityLabel={`${t('dive.field.tags')}, ${tags.join(', ')}`}>
      <Text style={[styles.label, { color: theme.text }]}>{t('dive.field.tags')}</Text>
      <View style={styles.tags}>
        {tags.map((tag) => (
          <View key={tag} style={[styles.tag, { backgroundColor: theme.backgroundSelected }]}>
            <Text style={[styles.tagText, { color: theme.text }]}>{tag}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * A row that does something: an icon, a title, an optional explanation under
 * it. Forwards the press props so it can sit inside a `Link asChild`.
 */
function ActionRow({
  symbol,
  label,
  detail,
  chevron = false,
  disabled = false,
  ...pressable
}: {
  symbol: SymbolName;
  label: string;
  detail?: string;
  chevron?: boolean;
  disabled?: boolean;
} & Omit<React.ComponentProps<typeof Pressable>, 'children' | 'style'>) {
  const theme = useTheme();
  const tint = disabled ? theme.textSecondary : theme.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={detail}
      accessibilityState={{ disabled }}
      disabled={disabled}
      {...pressable}
      style={({ pressed }) => [
        styles.row,
        styles.actionRow,
        pressed ? { backgroundColor: theme.backgroundSelected } : null,
      ]}
    >
      <SymbolView name={symbol} size={20} tintColor={tint} style={styles.actionIcon} />
      <View style={styles.actionText}>
        <Text style={[styles.label, { color: tint }]}>{label}</Text>
        {detail ? (
          <Text style={[styles.detail, { color: theme.textSecondary }]}>{detail}</Text>
        ) : null}
      </View>
      {chevron ? (
        <SymbolView name="chevron.right" size={13} tintColor={theme.textSecondary} />
      ) : null}
    </Pressable>
  );
}

function CylinderRow({ cylinder, index }: { cylinder: Cylinder; index: number }) {
  const theme = useTheme();
  const units = useUnits();
  const gas = formatGasMix(
    cylinder.gasmix.o2EffectivePermille,
    cylinder.gasmix.heEffectivePermille,
  );
  const start = cylinder.startMbar || cylinder.sampleStartMbar;
  const end = cylinder.endMbar || cylinder.sampleEndMbar;
  const pressure =
    start > 0 && end > 0
      ? t('statistics.range', { from: formatPressure(start, units), to: formatPressure(end, units) })
      : '';
  const name = cylinder.description || t('dive.cylinderNumber', { number: index + 1 });
  const size = cylinder.sizeMl > 0 ? formatVolume(cylinder.sizeMl, units) : '';
  const subtitle = [name, size].filter(Boolean).join(' - ');

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={spoken(name, [gas, size, pressure].filter(Boolean).join(', '))}
    >
      <View style={styles.actionText}>
        <Text style={[styles.label, styles.strong, { color: theme.text }]}>{gas}</Text>
        <Text style={[styles.detail, { color: theme.textSecondary }]}>{subtitle}</Text>
      </View>
      {pressure ? (
        <Text style={[styles.value, { color: theme.textSecondary }]}>{pressure}</Text>
      ) : null}
    </View>
  );
}

function WeightRow({ weight }: { weight: WeightSystem }) {
  const units = useUnits();
  return (
    <Row
      label={weight.description || t('dive.field.weight')}
      value={formatWeight(weight.weightGrams, units)}
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
    gap: Spacing.three,
  },
  headerLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerDate: {
    fontSize: 15,
  },
  badge: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    alignItems: 'flex-start',
    gap: Spacing.one,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three - Spacing.one,
    paddingVertical: Spacing.three - Spacing.one,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 12,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
  },
  sectionTitle: {
    fontSize: 13,
    // Android's section titles are in sentence case, as its settings have them.
    textTransform: Platform.OS === 'ios' ? 'uppercase' : 'none',
  },
  sectionFooter: {
    fontSize: 13,
    paddingHorizontal: Spacing.three,
  },
  card: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  cardInset: {
    padding: Spacing.three,
  },
  siteMap: {
    height: 150,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
  },
  label: {
    fontSize: 17,
  },
  value: {
    flexShrink: 1,
    fontSize: 17,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  strong: {
    fontWeight: '600',
  },
  detail: {
    fontSize: 13,
  },
  stars: {
    flexDirection: 'row',
    gap: Spacing.half,
  },
  tags: {
    flexShrink: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: Spacing.one,
  },
  tag: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.two + Spacing.half,
    paddingVertical: Spacing.half,
  },
  tagText: {
    fontSize: 13,
  },
  actionRow: {
    justifyContent: 'flex-start',
  },
  actionIcon: {
    width: 24,
    height: 24,
  },
  actionText: {
    flex: 1,
    gap: Spacing.half,
  },
  computerPicker: {
    marginBottom: Spacing.two,
  },
  placeholder: {
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
  planNotes: {
    padding: Spacing.three,
  },
  plannedBanner: {
    fontSize: 15,
    fontWeight: '600',
  },
  notes: {
    fontSize: 17,
    lineHeight: 22,
    padding: Spacing.three,
  },
});
