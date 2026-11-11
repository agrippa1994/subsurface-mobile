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
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { HeaderAction } from '@/components/header-action';
import { fieldError, FormButtonRow, FormField, FormSection } from '@/components/form';
import { MAPS_AVAILABLE, SiteMap } from '@/components/site-map';
import { StatusView } from '@/components/status-view';
import { Spacing } from '@/constants/theme';
import { operationSucceeded } from '@/lib/haptics';
import { rememberScreenOfLastChange } from '@/lib/logbook-history';
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
import { t } from '@/i18n';

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
    void (async () => {
      await deleteSite.mutateAsync(original.uuid);
      await flush();
      operationSucceeded();
      // Undoing this comes back to the site's own screen, which this closes.
      rememberScreenOfLastChange(`/sites/${original.uuid}`);
      // Past the site's own page too: it would only say "not found".
      router.dismissTo('/sites');
    })().catch(() => undefined); // Shown above the form, from deleteSite.error.
  }, [deleteSite, original, router]);

  if (!isNew && !original) {
    return (
      <StatusView
        kind="error"
        title={t('ui.diveSiteNotFound')}
        description={t('ui.theLogbookWasReloadedAndThis')}
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
          <>
            <Stack.Screen options={{ title: isNew ? t('nav.newSite') : t('nav.editSite') }} />
            {/* A native bar button item, so Save gets the system confirmation
                style (prominent liquid glass on iOS 26). */}
            <HeaderAction
              label={t('ui.save')}
              done
              disabled={isSubmitting}
              onPress={() => void form.handleSubmit()}
            />
          </>
        )}
      </form.Subscribe>

      {failure ? (
        <Text style={[styles.error, { color: theme.danger }]}>
          {formatErrorLine(describeError(failure))}
        </Text>
      ) : null}

      <FormSection title={t('ui.site')}>
        <form.Field name="name">
          {(field) => (
            <FormField
              label={t('ui.name')}
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
              label={t('ui.description')}
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              placeholder={t('ui.wall5MinutesByBoat')}
            />
          )}
        </form.Field>
        <form.Field name="notes">
          {(field) => (
            <FormField
              label={t('ui.notes')}
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              multiline
            />
          )}
        </form.Field>
      </FormSection>

      <FormSection
        title={t('ui.position')}
        footer={
          MAPS_AVAILABLE
            ? t('siteEditor.positionMap')
            : t('siteEditor.positionType')
        }>
        <form.Field
          name="coordinateText"
          validators={{
            onChange: ({ value }) =>
              value.trim() === '' || parseCoordinates(value) !== null
                ? undefined
                : t('siteEditor.positionInvalid'),
          }}>
          {(field) => (
            <FormField
              label={t('ui.coordinates')}
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
                title={name || t('ui.diveSite')}
              />
              {latUdeg !== null ? (
                <FormButtonRow
                  label={t('ui.clearPosition')}
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
          <FormButtonRow label={t('ui.deleteSite')} onPress={onDelete} destructive />
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
    <FormSection title={t('ui.possibleDuplicate')}>
      {duplicates.length > 0 ? (
        <Text style={{ color: theme.text }}>
          {t('siteEditor.duplicates', { count: duplicates.length })}
        </Text>
      ) : null}
      {nearby.length > 0 ? (
        <Text style={{ color: theme.text }}>
          {t('siteEditor.nearby', { sites: nearby.map((site) => site.name || t('siteEditor.anUnnamedSite')).join(', ') })}
        </Text>
      ) : null}
      <Text style={{ color: theme.textSecondary }}>
        {t('siteEditor.duplicateNote')}
      </Text>
    </FormSection>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  error: {
    fontSize: 15,
  },
  footerSpace: {
    height: Spacing.six,
  },
});
