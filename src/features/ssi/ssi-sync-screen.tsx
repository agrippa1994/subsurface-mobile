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
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { describeSsiSite, type SsiSite } from '@/models/ssi/sites';
import { useDive, useProfile, useSites } from '@/queries/logbook';
import { useSettings } from '@/queries/settings';
import {
  isSearchable,
  isSyncedToSsi,
  useSsiAccount,
  useSsiNearestSite,
  useSsiSiteIndex,
  useSsiSiteSearch,
  useSyncDiveToSsi,
} from '@/queries/ssi';

export function SsiSyncScreen({ diveId }: { diveId: number }) {
  const theme = useTheme();
  const router = useRouter();
  const { unitSystem } = useSettings();

  const diveQuery = useDive(diveId);
  const profileQuery = useProfile(diveId);
  const { data: sites = [] } = useSites();
  const account = useSsiAccount();
  // Gated on the account: without one the screen only points at Settings, and
  // the catalogue costs a 2.5 MB download the first time it is asked for.
  const catalogue = useSsiSiteIndex(Boolean(account.data));
  const sync = useSyncDiveToSsi();

  const dive = diveQuery.data;
  const profile = profileQuery.data;
  const site = useMemo(
    () => (dive ? sites.find((entry) => entry.uuid === dive.siteUuid) : undefined),
    [dive, sites]
  );

  // The dive's own position, in the degrees the SSI catalogue uses. Null when
  // the dive has no site, or its site has no coordinates - then there is
  // nothing to preselect from and the diver searches.
  const position = useMemo(
    () =>
      site?.hasGps
        ? { lat: udegToDegrees(site.latUdeg), lon: udegToDegrees(site.lonUdeg) }
        : null,
    [site]
  );
  const nearest = useSsiNearestSite(catalogue.data, position?.lat ?? null, position?.lon ?? null);

  const [query, setQuery] = useState('');
  const results = useSsiSiteSearch(catalogue.data, query);

  const form = useForm({
    defaultValues: { site: null as SsiSite | null },
    validators: {
      onSubmit: ({ value }) =>
        value.site === null
          ? { fields: { site: 'Pick the SSI dive site this dive belongs to.' } }
          : undefined,
    },
    onSubmit: async ({ value }) => {
      if (!dive || !profile || value.site === null) {
        return;
      }
      try {
        await sync.mutateAsync({ dive, profile, site, ssiSiteId: value.site.id });
        operationSucceeded();
        router.back();
      } catch (caught) {
        operationFailed();
        Alert.alert('Could not sync to SSI', formatErrorLine(describeError(caught)));
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
    return <StatusView kind="loading" title="Opening dive" />;
  }

  if (!account.data) {
    return (
      <StatusView
        kind="empty"
        title="Not signed in to SSI"
        description="Sign in under Settings, SSI, and this dive can go straight to your SSI logbook."
        systemImage="person.crop.circle.badge.questionmark"
      />
    );
  }

  const failure = diveQuery.error ?? profileQuery.error;
  if (failure) {
    return (
      <StatusView
        kind="error"
        title="Dive not found"
        description={formatErrorLine(describeError(failure))}
        systemImage="questionmark.circle"
      />
    );
  }

  if (!dive || !profile) {
    return <StatusView kind="loading" title="Opening dive" />;
  }

  if (catalogue.isError) {
    return (
      <StatusView
        kind="error"
        title="No dive site catalogue"
        description={`${formatErrorLine(describeError(catalogue.error))} SSI has no site search, so the catalogue has to be downloaded before a dive can be filed.`}
        systemImage="exclamationmark.triangle"
        actionLabel="Try again"
        onAction={() => void catalogue.refetch()}
      />
    );
  }

  if (catalogue.isPending) {
    return (
      <StatusView
        kind="loading"
        title="Downloading SSI dive sites"
        description="This happens once. The catalogue is about 2.5 MB and is kept on this device afterwards."
      />
    );
  }

  const row = toDiveRow(dive, unitSystem);

  return (
    <form.Field name="site">
      {(field) => (
        <FlatList
          style={{ backgroundColor: theme.background }}
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          data={field.state.value === null && isSearchable(query) ? results : []}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={
            <View style={styles.header}>
              <FormSection title="Dive">
                <Row label="Date" value={`${row.dateText} ${row.timeText}`} />
                <Row label="Max depth" value={formatDepth(dive.maxDepthMm, unitSystem)} />
                <Row label="Duration" value={formatDuration(dive.durationSec)} />
                <Row label="Site in this logbook" value={dive.siteName || '-'} />
              </FormSection>

              <FormSection
                title="SSI dive site"
                footer={
                  field.state.value !== null && nearest !== null && field.state.value.id === nearest.site.id
                    ? `Nearest site to this dive's position, ${formatDistance(nearest.distanceMeters)} away.`
                    : position === null
                      ? 'This dive has no position, so its SSI site has to be found by name. Give its site coordinates in the Sites tab and the match becomes automatic.'
                      : "Searched in SSI's own site catalogue, which is separate from this logbook."
                }>
                {field.state.value !== null ? (
                  <FormButtonRow
                    label={field.state.value.name}
                    value="Change"
                    onPress={() => {
                      field.handleChange(null);
                      setQuery('');
                    }}
                  />
                ) : (
                  <>
                    <TextInput
                      value={query}
                      onChangeText={setQuery}
                      placeholder="Search SSI dive sites"
                      placeholderTextColor={theme.textSecondary}
                      autoCapitalize="words"
                      autoCorrect={false}
                      autoFocus={position === null}
                      style={[
                        styles.search,
                        { backgroundColor: theme.background, color: theme.text },
                      ]}
                    />
                    {isSearchable(query) && results.length === 0 ? (
                      <Text style={{ color: theme.textSecondary }}>
                        {`No SSI site matches "${query.trim()}".`}
                      </Text>
                    ) : null}
                  </>
                )}

                {fieldError(field.state.meta.errors) ? (
                  <Text style={[styles.error, { color: theme.danger }]}>
                    {fieldError(field.state.meta.errors)}
                  </Text>
                ) : null}
              </FormSection>
            </View>
          }
          renderItem={({ item }) => (
            <SiteRow
              site={item}
              onPress={() => {
                field.handleChange(item);
                setQuery('');
              }}
            />
          )}
          ListFooterComponent={
            <View style={styles.footer}>
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) =>
                  isSubmitting ? (
                    <View style={styles.pending}>
                      <ActivityIndicator />
                      <Text style={{ color: theme.textSecondary }}>Sending to SSI...</Text>
                    </View>
                  ) : (
                    <FormButtonRow
                      label={isSyncedToSsi(dive) ? 'Sync again' : 'Sync to SSI'}
                      onPress={() => {
                        if (isSyncedToSsi(dive)) {
                          warned();
                          Alert.alert(
                            'Already synced',
                            'This dive has gone to SSI before. Syncing again adds a second copy to your SSI logbook.',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Sync again', onPress: () => void form.handleSubmit() },
                            ]
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
          }
        />
      )}
    </form.Field>
  );
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

function SiteRow({ site, onPress }: { site: SsiSite; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.siteRow,
        { borderBottomColor: theme.separator },
        pressed ? { backgroundColor: theme.backgroundSelected } : null,
      ]}>
      <Text style={[styles.siteName, { color: theme.text }]}>{site.name}</Text>
      <Text style={[styles.siteMeta, { color: theme.textSecondary }]}>{describeSsiSite(site)}</Text>
    </Pressable>
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
  siteRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.half,
    paddingVertical: Spacing.two,
  },
  siteName: {
    fontSize: 17,
  },
  siteMeta: {
    fontSize: 13,
  },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
