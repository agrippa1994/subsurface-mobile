// AI-generated (Claude)
// The dive-site editor, shared by the "new site" and "edit site" routes.
//
// The module owns the sites; this screen holds a draft, and on save turns it
// into the smallest `upsertDiveSite` argument that expresses the change (see
// models/site-edit.ts). Saving also flushes the logbook to disk, so a
// force-quit right after cannot lose the edit.

import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FormButtonRow, FormField, FormSection } from '@/components/form';
import { SiteMap } from '@/components/site-map';
import { StatusView } from '@/components/status-view';
import { Spacing } from '@/constants/theme';
import { warned } from '@/lib/haptics';
import { useTheme } from '@/hooks/use-theme';
import { describeError, formatErrorLine } from '@/models/errors';
import {
  buildSiteInput,
  EMPTY_SITE_DRAFT,
  findDuplicateSites,
  findNearbySites,
  formatCoordinateInput,
  isEmptySiteInput,
  parseCoordinates,
  siteDraftFrom,
  validateSiteDraft,
  type SiteDraft,
} from '@/models/site-edit';
import { useLogStore } from '@/store/log-store';

export function SiteEditor({ uuid }: { uuid: number }) {
  const router = useRouter();
  const theme = useTheme();
  const sites = useLogStore((state) => state.sites);
  const saveSite = useLogStore((state) => state.saveSite);
  const deleteSite = useLogStore((state) => state.deleteSite);
  const flush = useLogStore((state) => state.flush);

  const original = useMemo(() => sites.find((site) => site.uuid === uuid), [sites, uuid]);
  const [draft, setDraft] = useState<SiteDraft>(() =>
    original ? siteDraftFrom(original) : { ...EMPTY_SITE_DRAFT }
  );
  const [coordinateText, setCoordinateText] = useState(() =>
    original ? formatCoordinateInput(draft.latUdeg, draft.lonUdeg) : ''
  );
  const [coordinateError, setCoordinateError] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // A brand-new site is invalid until it has a name, but saying so before the
  // user has typed anything is scolding an empty form. The hint appears once
  // saving has been attempted.
  const [saveAttempted, setSaveAttempted] = useState(false);

  const isNew = uuid === 0;
  const patch = useCallback(
    (changes: Partial<SiteDraft>) => setDraft((current) => ({ ...current, ...changes })),
    []
  );

  const onCoordinateText = useCallback(
    (text: string) => {
      setCoordinateText(text);
      if (text.trim() === '') {
        setCoordinateError(false);
        patch({ latUdeg: null, lonUdeg: null });
        return;
      }
      const parsed = parseCoordinates(text);
      setCoordinateError(parsed === null);
      if (parsed) {
        patch({ latUdeg: parsed.latUdeg, lonUdeg: parsed.lonUdeg });
      }
    },
    [patch]
  );

  const onPick = useCallback(
    (latUdeg: number, lonUdeg: number) => {
      patch({ latUdeg, lonUdeg });
      setCoordinateText(formatCoordinateInput(latUdeg, lonUdeg));
      setCoordinateError(false);
    },
    [patch]
  );

  const duplicates = findDuplicateSites(draft, sites);
  const nearby = findNearbySites(draft, sites);
  const validation = validateSiteDraft(draft);

  const onSave = useCallback(async () => {
    setSaveAttempted(true);
    const check = validateSiteDraft(draft);
    if (!check.ok) {
      setSaveError(check.message);
      return;
    }
    if (coordinateError) {
      setSaveError('The position could not be read.');
      return;
    }
    try {
      const input = buildSiteInput(draft, original);
      if (!isEmptySiteInput(input)) {
        await saveSite(input);
        await flush();
      }
      router.back();
    } catch (error) {
      setSaveError(formatErrorLine(describeError(error)));
    }
  }, [coordinateError, draft, flush, original, router, saveSite]);

  const onDelete = useCallback(() => {
    if (!original) {
      return;
    }
    const attached =
      original.diveCount > 0
        ? `\n\n${original.diveCount} ${original.diveCount === 1 ? 'dive keeps' : 'dives keep'} its data but loses the site.`
        : '';
    warned();
    Alert.alert(`Delete "${original.name || 'this site'}"?`, `This cannot be undone.${attached}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSite(original.uuid);
            await flush();
            router.back();
          } catch (error) {
            setSaveError(formatErrorLine(describeError(error)));
          }
        },
      },
    ]);
  }, [deleteSite, flush, original, router]);

  if (!isNew && !original) {
    return (
      <StatusView
        kind="error"
        title="Dive site not found"
        description="The logbook was reloaded and this site is no longer in it."
        systemImage="mappin.slash"
      />
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag">
      <Stack.Screen
        options={{
          title: isNew ? 'New site' : 'Edit site',
          headerRight: () => (
            <Pressable onPress={onSave} accessibilityRole="button" hitSlop={Spacing.two}>
              <Text style={[styles.headerAction, { color: theme.accent }]}>Save</Text>
            </Pressable>
          ),
        }}
      />

      {saveError ? (
        <Text style={[styles.error, { color: theme.danger }]}>{saveError}</Text>
      ) : null}

      <FormSection title="Site">
        <FormField
          label="Name"
          value={draft.name}
          onChangeText={(name) => patch({ name })}
          placeholder="Blue Hole"
          autoCapitalize="words"
          hint={saveAttempted && !validation.ok ? validation.message : undefined}
        />
        <FormField
          label="Description"
          value={draft.description}
          onChangeText={(description) => patch({ description })}
          placeholder="Wall, 5 minutes by boat"
        />
        <FormField
          label="Notes"
          value={draft.notes}
          onChangeText={(notes) => patch({ notes })}
          multiline
        />
      </FormSection>

      <FormSection
        title="Position"
        footer="Tap the map to move the marker, or type coordinates - decimal degrees, or degrees and minutes with a hemisphere.">
        <FormField
          label="Coordinates"
          value={coordinateText}
          onChangeText={onCoordinateText}
          placeholder="47.376900, 8.541700"
          autoCapitalize="characters"
          autoCorrect={false}
          hint={coordinateError ? 'Not a position this can read.' : undefined}
        />
        <SiteMap
          latUdeg={draft.latUdeg}
          lonUdeg={draft.lonUdeg}
          editable
          onPick={onPick}
          title={draft.name || 'Dive site'}
        />
        {draft.latUdeg !== null ? (
          <FormButtonRow
            label="Clear position"
            onPress={() => {
              patch({ latUdeg: null, lonUdeg: null });
              setCoordinateText('');
              setCoordinateError(false);
            }}
          />
        ) : null}
      </FormSection>

      {duplicates.length > 0 || nearby.length > 0 ? (
        <FormSection title="Possible duplicate">
          {duplicates.length > 0 ? (
            <Text style={{ color: theme.text }}>
              {duplicates.length === 1
                ? 'Another site already has this name.'
                : `${duplicates.length} other sites already have this name.`}
            </Text>
          ) : null}
          {nearby.length > 0 ? (
            <Text style={{ color: theme.text }}>
              {`Within 100 m of ${nearby.map((site) => site.name || 'an unnamed site').join(', ')}.`}
            </Text>
          ) : null}
          <Text style={{ color: theme.textSecondary }}>
            Two sites can share a name and a position; move the dives to one of them if that is not
            what you meant.
          </Text>
        </FormSection>
      ) : null}

      {!isNew ? (
        <FormSection>
          <FormButtonRow label="Delete site" onPress={onDelete} destructive />
        </FormSection>
      ) : null}

      <View style={styles.footerSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  headerAction: {
    fontSize: 17,
    fontWeight: '600',
  },
  error: {
    fontSize: 15,
  },
  footerSpace: {
    height: Spacing.six,
  },
});
