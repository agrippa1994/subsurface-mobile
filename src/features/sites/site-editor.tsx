// AI-generated (Claude)
// The dive-site editor, shared by the "new site" and "edit site" routes.
//
// The module owns the sites; this screen holds a TanStack Form over a draft,
// and on save turns it into the smallest `upsertDiveSite` argument that
// expresses the change (see models/site-edit.ts) - the form hands over full
// values, so the diff against `original` is what keeps untouched fields from
// being written back. Saving also flushes the logbook to disk, so a force-quit
// right after cannot lose the edit.
//
// Validation is the pure functions in models/site-edit.ts, run as form
// validators. They stay there rather than moving into this screen because that
// is what keeps them covered by the Node test suite.

import { useForm } from '@tanstack/react-form';
import { Stack, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fieldError, FormButtonRow, FormField, FormSection } from '@/components/form';
import { SiteMap } from '@/components/site-map';
import { StatusView } from '@/components/status-view';
import { Spacing } from '@/constants/theme';
import { warned } from '@/lib/haptics';
import { flush } from '@/lib/logbook-persist';
import { useTheme } from '@/hooks/use-theme';
import type { DiveSite } from '@/models';
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
import { useSites } from '@/queries/logbook';
import { useDeleteSite, useSaveSite } from '@/queries/logbook-mutations';

/**
 * The draft plus the raw coordinate text. The parsed position is kept beside
 * the text rather than derived from it on save: re-parsing a formatted string
 * would round the position the user picked on the map.
 */
type SiteFormValues = SiteDraft & { coordinateText: string };

export function SiteEditor({ uuid }: { uuid: number }) {
  const router = useRouter();
  const theme = useTheme();
  const { data: sites = [] } = useSites();
  const saveSite = useSaveSite();
  const deleteSite = useDeleteSite();

  const original = sites.find((site) => site.uuid === uuid);
  const isNew = uuid === 0;

  const form = useForm({
    defaultValues: ((): SiteFormValues => {
      const draft = original ? siteDraftFrom(original) : { ...EMPTY_SITE_DRAFT };
      return {
        ...draft,
        coordinateText: original ? formatCoordinateInput(draft.latUdeg, draft.lonUdeg) : '',
      };
    })(),
    validators: {
      // A brand-new site is invalid until it has a name, but saying so before
      // the user has typed anything is scolding an empty form - so this runs on
      // submit rather than on change.
      onSubmit: ({ value }) => {
        const check = validateSiteDraft(value);
        return check.ok ? undefined : { fields: { name: check.message } };
      },
    },
    onSubmit: async ({ value }) => {
      const input = buildSiteInput(value, original);
      if (!isEmptySiteInput(input)) {
        await saveSite.mutateAsync(input);
        // The editor is about to close, so the debounce window has to end here.
        await flush();
      }
      router.back();
    },
  });

  /** Typing a position: the text is the field, the parsed pair follows it. */
  const onCoordinateText = useCallback(
    (text: string) => {
      form.setFieldValue('coordinateText', text);
      if (text.trim() === '') {
        form.setFieldValue('latUdeg', null);
        form.setFieldValue('lonUdeg', null);
        return;
      }
      const parsed = parseCoordinates(text);
      if (parsed) {
        form.setFieldValue('latUdeg', parsed.latUdeg);
        form.setFieldValue('lonUdeg', parsed.lonUdeg);
      }
    },
    [form]
  );

  /** Tapping the map: the pair is the truth, the text follows it. */
  const onPick = useCallback(
    (latUdeg: number, lonUdeg: number) => {
      form.setFieldValue('latUdeg', latUdeg);
      form.setFieldValue('lonUdeg', lonUdeg);
      form.setFieldValue('coordinateText', formatCoordinateInput(latUdeg, lonUdeg));
    },
    [form]
  );

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
        onPress: () => {
          void (async () => {
            await deleteSite.mutateAsync(original.uuid);
            await flush();
            router.back();
          })();
        },
      },
    ]);
  }, [deleteSite, original, router]);

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

  // Whatever the save or the delete threw. Both write the same file, so one
  // line above the form covers both.
  const failure = saveSite.error ?? deleteSite.error;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag">
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Stack.Screen
            options={{
              title: isNew ? 'New site' : 'Edit site',
              headerRight: () => (
                <Pressable
                  onPress={() => void form.handleSubmit()}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isSubmitting }}
                  hitSlop={Spacing.two}>
                  <Text
                    style={[
                      styles.headerAction,
                      { color: theme.accent, opacity: isSubmitting ? 0.5 : 1 },
                    ]}>
                    Save
                  </Text>
                </Pressable>
              ),
            }}
          />
        )}
      </form.Subscribe>

      {failure ? (
        <Text style={[styles.error, { color: theme.danger }]}>
          {formatErrorLine(describeError(failure))}
        </Text>
      ) : null}

      <FormSection title="Site">
        <form.Field name="name">
          {(field) => (
            <FormField
              label="Name"
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              placeholder="Blue Hole"
              autoCapitalize="words"
              error={fieldError(field.state.meta.errors)}
            />
          )}
        </form.Field>
        <form.Field name="description">
          {(field) => (
            <FormField
              label="Description"
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              placeholder="Wall, 5 minutes by boat"
            />
          )}
        </form.Field>
        <form.Field name="notes">
          {(field) => (
            <FormField
              label="Notes"
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              multiline
            />
          )}
        </form.Field>
      </FormSection>

      <FormSection
        title="Position"
        footer="Tap the map to move the marker, or type coordinates - decimal degrees, or degrees and minutes with a hemisphere.">
        <form.Field
          name="coordinateText"
          validators={{
            onChange: ({ value }) =>
              value.trim() === '' || parseCoordinates(value) !== null
                ? undefined
                : 'Not a position this can read.',
          }}>
          {(field) => (
            <FormField
              label="Coordinates"
              value={field.state.value}
              onChangeText={onCoordinateText}
              onBlur={field.handleBlur}
              placeholder="47.376900, 8.541700"
              autoCapitalize="characters"
              autoCorrect={false}
              error={fieldError(field.state.meta.errors)}
            />
          )}
        </form.Field>

        <form.Subscribe
          selector={(state) =>
            [state.values.latUdeg, state.values.lonUdeg, state.values.name] as const
          }>
          {([latUdeg, lonUdeg, name]) => (
            <>
              <SiteMap
                latUdeg={latUdeg}
                lonUdeg={lonUdeg}
                editable
                onPick={onPick}
                title={name || 'Dive site'}
              />
              {latUdeg !== null ? (
                <FormButtonRow
                  label="Clear position"
                  onPress={() => {
                    form.setFieldValue('latUdeg', null);
                    form.setFieldValue('lonUdeg', null);
                    form.setFieldValue('coordinateText', '');
                  }}
                />
              ) : null}
            </>
          )}
        </form.Subscribe>
      </FormSection>

      <form.Subscribe selector={(state) => state.values}>
        {(draft) => <DuplicateWarning draft={draft} sites={sites} />}
      </form.Subscribe>

      {!isNew ? (
        <FormSection>
          <FormButtonRow label="Delete site" onPress={onDelete} destructive />
        </FormSection>
      ) : null}

      <View style={styles.footerSpace} />
    </ScrollView>
  );
}

/**
 * Two sites can share a name and a position, so this is a note rather than a
 * validation failure - it says what the log already holds and leaves the
 * decision to the diver.
 */
function DuplicateWarning({
  draft,
  sites,
}: {
  draft: SiteDraft;
  sites: readonly DiveSite[];
}) {
  const theme = useTheme();
  const duplicates = findDuplicateSites(draft, sites);
  const nearby = findNearbySites(draft, sites);
  if (duplicates.length === 0 && nearby.length === 0) {
    return null;
  }
  return (
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
        Two sites can share a name and a position; move the dives to one of them if that is not what
        you meant.
      </Text>
    </FormSection>
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
