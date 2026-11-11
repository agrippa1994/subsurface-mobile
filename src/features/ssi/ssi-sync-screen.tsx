// AI-generated (Claude)
// The step between "Sync to SSI" and the dive actually going up: choosing which
// SSI dive site it belongs to.
//
// SSI files every dive against a site from its own global catalogue, and the
// site in this app's logbook is not one of them - the two are unrelated
// databases. What connects them is the position: if the dive's site has
// coordinates and SSI knows a site within a few kilometres, that site is
// preselected and the whole screen is one confirmation. Otherwise the diver
// searches SSI's catalogue by name.
//
// The choice is not persisted. It belongs to this upload, and the mapping from
// one of our sites to one of SSI's is a guess the diver confirms each time.

import { useForm } from '@tanstack/react-form';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { fieldError, FormButtonRow, FormSection } from '@/components/form';
import { StatusView } from '@/components/status-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { operationFailed, operationSucceeded, warned } from '@/lib/haptics';
import { formatDepth, formatDuration, udegToDegrees } from '@/models';
import { toDiveRow } from '@/models/dive-list';
import { describeError, formatErrorLine } from '@/models/errors';
import {
  describeSsiBuddy,
  searchSsiBuddies,
  suggestedSsiBuddies,
  type SsiBuddy,
} from '@/models/ssi/buddies';
import { SsiSitePicker } from './ssi-site-picker';
import { type SsiSite } from '@/models/ssi/sites';
import { useDive, useProfile, useSites } from '@/queries/logbook';
import { useSettings } from '@/queries/settings';
import {
  isSearchable,
  isSyncedToSsi,
  useSsiAccount,
  useSsiLogbook,
  useSsiNearestSite,
  useSsiSiteIndex,
  useSyncDiveToSsi,
} from '@/queries/ssi';
import { t } from '@/i18n';

export function SsiSyncScreen({ diveId }: { diveId: number }) {
  const theme = useTheme();
  const router = useRouter();
  const { units } = useSettings();

  const diveQuery = useDive(diveId);
  const profileQuery = useProfile(diveId);
  const { data: sites = [] } = useSites();
  const account = useSsiAccount();
  // Gated on the account: without one the screen only points at Settings, and
  // the catalogue costs a sizeable download the first time it is asked for.
  const catalogue = useSsiSiteIndex(Boolean(account.data));
  // The buddy list rides along with the dive number in one `get_divelog`. The
  // screen never waits on it: a dive can go up without buddies, so a slow or
  // failed read costs a section, not the sync.
  const logbook = useSsiLogbook(Boolean(account.data));
  const sync = useSyncDiveToSsi();

  const dive = diveQuery.data;
  const profile = profileQuery.data;
  const site = useMemo(
    () => (dive ? sites.find((entry) => entry.uuid === dive.siteUuid) : undefined),
    [dive, sites],
  );

  // The dive's own position, in the degrees the SSI catalogue uses. Null when
  // the dive has no site, or its site has no coordinates - then there is
  // nothing to preselect from and the diver searches.
  const position = useMemo(
    () =>
      site?.hasGps ? { lat: udegToDegrees(site.latUdeg), lon: udegToDegrees(site.lonUdeg) } : null,
    [site],
  );
  const nearest = useSsiNearestSite(catalogue.data, position?.lat ?? null, position?.lon ?? null);

  const [sitePickerOpen, setSitePickerOpen] = useState(false);

  const [buddyQuery, setBuddyQuery] = useState('');

  const form = useForm({
    defaultValues: { site: null as SsiSite | null, buddies: [] as SsiBuddy[] },
    validators: {
      onSubmit: ({ value }) =>
        value.site === null
          ? { fields: { site: t('ssiSync.pickSite') } }
          : undefined,
    },
    onSubmit: async ({ value }) => {
      if (!dive || !profile || value.site === null) {
        return;
      }
      try {
        await sync.mutateAsync({
          dive,
          profile,
          site,
          ssiSiteId: value.site.id,
          ssiBuddyIds: value.buddies.map((buddy) => buddy.id),
        });
        operationSucceeded();
        router.back();
      } catch (caught) {
        operationFailed();
        Alert.alert(t('ssiSync.failed'), formatErrorLine(describeError(caught)));
      }
    },
  });

  // Fill from the position once. Doing it on every render of the nearest-site
  // memo would undo the diver's own choice the moment they made one.
  const autoFilled = useRef(false);
  useEffect(() => {
    if (nearest !== null && !autoFilled.current) {
      autoFilled.current = true;
      form.setFieldValue('site', nearest.site);
    }
  }, [nearest, form]);

  // The keychain read is fast but not instant, and until it lands there is no
  // telling whether this screen is a sign-in prompt or a catalogue download.
  if (account.isPending) {
    return <StatusView kind="loading" title={t('ui.openingDive')} />;
  }

  if (!account.data) {
    return (
      <StatusView
        kind="empty"
        title={t('ui.notSignedInToSsi')}
        description={t('ui.signInUnderSettingsSsiAnd')}
        systemImage="person.crop.circle.badge.questionmark"
      />
    );
  }

  const failure = diveQuery.error ?? profileQuery.error;
  if (failure) {
    return (
      <StatusView
        kind="error"
        title={t('ui.diveNotFound')}
        description={formatErrorLine(describeError(failure))}
        systemImage="questionmark.circle"
      />
    );
  }

  if (!dive || !profile) {
    return <StatusView kind="loading" title={t('ui.openingDive')} />;
  }

  if (catalogue.isError) {
    return (
      <StatusView
        kind="error"
        title={t('ui.noDiveSiteCatalogue')}
        description={`${formatErrorLine(describeError(catalogue.error))} ${t('ssiSync.noSearch')}`}
        systemImage="exclamationmark.triangle"
        actionLabel={t('ui.tryAgain')}
        onAction={() => void catalogue.refetch()}
      />
    );
  }

  if (catalogue.isPending) {
    return (
      <StatusView
        kind="loading"
        title={t('ui.downloadingSsiDiveSites')}
        description={t('ui.thisHappensOnceAndTakesAbout')}
      />
    );
  }

  const row = toDiveRow(dive, units);

  return (
    <form.Field name="site">
      {(field) => (
        <ScrollView
          style={{ backgroundColor: theme.background }}
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <FormSection title={t('ui.dive')}>
              <Row label={t('ui.date')} value={`${row.dateText} ${row.timeText}`} />
              <Row label={t('ui.maxDepth')} value={formatDepth(dive.maxDepthMm, units)} />
              <Row label={t('ui.duration')} value={formatDuration(dive.durationSec)} />
              <Row label={t('ui.siteInThisLogbook')} value={dive.siteName || '-'} />
            </FormSection>

            <FormSection
              title={t('ui.ssiDiveSite')}
              footer={
                field.state.value !== null &&
                nearest !== null &&
                field.state.value.id === nearest.site.id
                  ? t('ssiSync.nearest', { distance: formatDistance(nearest.distanceMeters) })
                  : position === null
                    ? t('ssiSync.choose')
                    : t('ssiSync.searched')
              }
            >
              <FormButtonRow
                label={field.state.value?.name ?? t('ssiSync.select')}
                value={field.state.value ? t('ssiSync.change') : t('download.choose')}
                onPress={() => setSitePickerOpen(true)}
              />
              <SsiSitePicker
                visible={sitePickerOpen}
                position={position}
                onClose={() => setSitePickerOpen(false)}
                onSelect={(selected) => {
                  autoFilled.current = true;
                  field.handleChange(selected);
                  setSitePickerOpen(false);
                }}
              />

              {fieldError(field.state.meta.errors) ? (
                <Text style={[styles.error, { color: theme.danger }]}>
                  {fieldError(field.state.meta.errors)}
                </Text>
              ) : null}
            </FormSection>

            <form.Field name="buddies">
              {(buddyField) => (
                <BuddySection
                  buddies={logbook.data?.buddies ?? []}
                  selected={buddyField.state.value}
                  onChange={buddyField.handleChange}
                  query={buddyQuery}
                  onQueryChange={setBuddyQuery}
                  isPending={logbook.isPending}
                  error={logbook.error}
                  onRetry={() => void logbook.refetch()}
                />
              )}
            </form.Field>
          </View>

          <View style={styles.footer}>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) =>
                isSubmitting ? (
                  <View style={styles.pending}>
                    <ActivityIndicator />
                    <Text style={{ color: theme.textSecondary }}>{t('ssiSync.sending')}</Text>
                  </View>
                ) : (
                  <FormButtonRow
                    label={isSyncedToSsi(dive) ? t('ui.syncAgain') : t('dive.ssi.sync')}
                    onPress={() => {
                      if (isSyncedToSsi(dive)) {
                        warned();
                        Alert.alert(
                          t('dive.ssi.synced'),
                          t('ssiSync.againMessage'),
                          [
                            { text: t('ui.cancel'), style: 'cancel' },
                            { text: t('ui.syncAgain'), onPress: () => void form.handleSubmit() },
                          ],
                        );
                        return;
                      }
                      void form.handleSubmit();
                    }}
                  />
                )
              }
            </form.Subscribe>
          </View>
        </ScrollView>
      )}
    </form.Field>
  );
}

/**
 * The buddy picker: SSI's own buddy list, tapped to add and tapped again to
 * remove.
 *
 * It deliberately ignores this app's `dive.buddy` field. That is free text and
 * SSI files buddies by id, and the two logbooks share no identity - a name that
 * happens to match is a coincidence, not a person, and guessing wrong would
 * attach a stranger to the dive.
 */
function BuddySection({
  buddies,
  selected,
  onChange,
  query,
  onQueryChange,
  isPending,
  error,
  onRetry,
}: {
  buddies: readonly SsiBuddy[];
  selected: SsiBuddy[];
  onChange: (buddies: SsiBuddy[]) => void;
  query: string;
  onQueryChange: (query: string) => void;
  isPending: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  const theme = useTheme();

  const chosen = new Set(selected.map((buddy) => buddy.id));
  // Search once there is something to search for, otherwise the head of the
  // list, which is the favourites.
  const offered = (
    isSearchable(query) ? searchSsiBuddies(buddies, query) : suggestedSsiBuddies(buddies)
  ).filter((buddy) => !chosen.has(buddy.id));

  return (
    <FormSection
      title={t('ui.ssiBuddies')}
      footer={t('ui.fromYourOwnSsiBuddyList')}>
      {selected.length > 0 ? (
        <View style={styles.chips}>
          {selected.map((buddy) => (
            <BuddyChip
              key={buddy.id}
              buddy={buddy}
              selected
              onPress={() => onChange(selected.filter((entry) => entry.id !== buddy.id))}
            />
          ))}
        </View>
      ) : null}

      {isPending ? (
        <View style={styles.pending}>
          <ActivityIndicator />
          <Text style={{ color: theme.textSecondary }}>{t('ssiSync.loadingBuddies')}</Text>
        </View>
      ) : error !== null ? (
        <View style={styles.pending}>
          <Text style={[styles.error, { color: theme.danger }]}>
            {formatErrorLine(describeError(error))}
          </Text>
          <Pressable onPress={onRetry} accessibilityRole="button">
            <Text style={{ color: theme.accent }}>{t('ui.tryAgain')}</Text>
          </Pressable>
        </View>
      ) : buddies.length === 0 ? (
        <Text style={{ color: theme.textSecondary }}>
          {t('ssiSync.noBuddies')}
        </Text>
      ) : (
        <>
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder={t('ui.searchYourSsiBuddies')}
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="words"
            autoCorrect={false}
            style={[styles.search, { backgroundColor: theme.background, color: theme.text }]}
          />
          {offered.length === 0 ? (
            <Text style={{ color: theme.textSecondary }}>
              {isSearchable(query)
                ? t('ssiSync.noBuddyMatch', { query: query.trim() })
                : t('ssiSync.allBuddies')}
            </Text>
          ) : (
            <View style={styles.chips}>
              {offered.map((buddy) => (
                <BuddyChip
                  key={buddy.id}
                  buddy={buddy}
                  hint={describeSsiBuddy(buddy)}
                  onPress={() => onChange([...selected, buddy])}
                />
              ))}
            </View>
          )}
        </>
      )}
    </FormSection>
  );
}

/**
 * One tappable buddy. Local rather than the shared `SuggestionChips`, which
 * keys and identifies its entries by their label - two buddies may genuinely
 * share a name, and picking one of them by string would pick the wrong person.
 */
function BuddyChip({
  buddy,
  hint,
  selected = false,
  onPress,
}: {
  buddy: SsiBuddy;
  hint?: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        (selected ? t('ssiSync.removeBuddy', { name: buddy.name }) : t('ssiSync.addBuddy', { name: buddy.name })) +
        (buddy.pro ? `, ${t('ssiSync.pro')}` : '')
      }
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: pressed || selected ? theme.backgroundSelected : theme.background,
          borderColor: theme.separator,
        },
      ]}>
      <BuddyAvatar buddy={buddy} />
      <View style={styles.chipBody}>
        <View style={styles.chipLine}>
          <Text style={[styles.chipText, { color: theme.text }]}>{buddy.name}</Text>
          {buddy.pro ? (
            <Text style={[styles.proBadge, { color: theme.accent, borderColor: theme.accent }]}>
              PRO
            </Text>
          ) : null}
          {selected ? (
            <Text style={[styles.chipText, { color: theme.textSecondary }]}>x</Text>
          ) : null}
        </View>
        {hint ? (
          <Text style={[styles.chipHint, { color: theme.textSecondary }]}>{hint}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * The buddy's photo, or their initials. Most SSI accounts have no picture, so
 * the fallback is the common case and has to look deliberate rather than
 * broken - and it still tells two buddies apart at a glance.
 */
function BuddyAvatar({ buddy }: { buddy: SsiBuddy }) {
  const theme = useTheme();

  if (buddy.avatarUrl !== '') {
    return (
      <Image
        source={{ uri: buddy.avatarUrl }}
        style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View
      style={[
        styles.avatar,
        styles.avatarFallback,
        { backgroundColor: theme.backgroundSelected },
      ]}>
      <Text style={[styles.avatarInitials, { color: theme.textSecondary }]}>
        {initialsOf(buddy.name)}
      </Text>
    </View>
  );
}

/** Up to two initials: "Anna Berger" reads as AB, a one-word name as its first. */
function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter((part) => part !== '')
    .map((part) => part[0].toLocaleUpperCase());
  return letters.length <= 1 ? letters.join('') : `${letters[0]}${letters[letters.length - 1]}`;
}

function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
  },
  header: {
    gap: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  footer: {
    paddingTop: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  rowLabel: {
    fontSize: 15,
  },
  rowValue: {
    flexShrink: 1,
    fontSize: 15,
    textAlign: 'right',
  },
  search: {
    borderRadius: Spacing.two,
    fontSize: 17,
    paddingVertical: Spacing.one,
  },
  error: {
    fontSize: 15,
  },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  chipBody: {
    gap: Spacing.half,
  },
  chipLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  chipText: {
    fontSize: 15,
  },
  chipHint: {
    fontSize: 12,
  },
  proBadge: {
    borderRadius: Spacing.half,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: Spacing.half,
  },
  avatar: {
    borderRadius: Spacing.four,
    height: 28,
    width: 28,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 11,
    fontWeight: '600',
  },
});
