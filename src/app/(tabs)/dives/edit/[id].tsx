// AI-generated (Claude)
// The dive editor: the fields a diver fills in after the dive.
//
// Depth, duration and the samples come from the dive computer and are not
// editable here - the core treats them as recorded data. What is editable is
// what the diver knows: site, buddies, tags, gear, conditions, notes.
//
// The form holds the draft and is turned into the smallest possible
// `updateDive` patch on save (models/dive-edit.ts): the form hands over full
// values, so the diff against the loaded dive is what keeps a field nobody
// touched from being written back.

import { useForm } from '@tanstack/react-form';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fieldError, FormButtonRow, FormField, FormSection, RatingField } from '@/components/form';
import { NameField } from '@/components/name-field';
import { StatusView } from '@/components/status-view';
import { SuggestField, SuggestionChips } from '@/components/suggest-field';
import { Spacing } from '@/constants/theme';
import { CylinderEditor } from '@/features/dives/cylinder-editor';
import { SitePicker } from '@/features/dives/site-picker';
import { WeightEditor } from '@/features/dives/weight-editor';
import { useTheme } from '@/hooks/use-theme';
import { warned } from '@/lib/haptics';
import { flush } from '@/lib/logbook-persist';
import { previewDive } from '../../../../../modules/ssrf-core/src';
import type { Dive, DivePatch } from '@/models';
import { formatSac } from '@/models';
import {
  buildCylinderPatches,
  cylinderDraftsFrom,
  validateCylinderDrafts,
  type CylinderDraft,
} from '@/models/cylinder-edit';
import {
  buildDivePatch,
  harvestCylinderDescriptions,
  harvestNames,
  harvestSuits,
  harvestTags,
  harvestWeightDescriptions,
  diveDraftFrom,
  isEmptyPatch,
  parseTagInput,
  type DiveDraft,
} from '@/models/dive-edit';
import {
  buildWeightPatches,
  validateWeightDrafts,
  weightDraftsFrom,
  type WeightDraft,
} from '@/models/weight-edit';
import { diveRowTitle } from '@/models/dive-list';
import { describeError, formatErrorLine } from '@/models/errors';
import { useDive, useDives, useSites } from '@/queries/logbook';
import { useDeleteDive, useUpdateDive } from '@/queries/logbook-mutations';
import { useUnitSystem } from '@/queries/settings';

/**
 * The draft, plus the things that are input rather than data: the raw tag text
 * (so a trailing comma survives being typed) and the cylinder and weight rows,
 * which carry the identity a row needs to survive a re-render (the drafts'
 * `key`).
 */
type DiveFormValues = DiveDraft & {
  tagText: string;
  cylinders: CylinderDraft[];
  weights: WeightDraft[];
};

export default function DiveEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const diveId = Number(id);
  const unitSystem = useUnitSystem();

  // The dive is read from the module rather than the cached list: the list rows
  // carry no notes or suit, and the editor writes those too.
  const diveQuery = useDive(diveId);

  if (diveQuery.error) {
    return (
      <StatusView
        kind="error"
        title="Dive not found"
        description={formatErrorLine(describeError(diveQuery.error))}
        systemImage="questionmark.circle"
      />
    );
  }

  if (!diveQuery.data) {
    return <StatusView kind="loading" title="Opening dive" />;
  }

  // Keyed on the dive so the form is rebuilt from scratch if the log is
  // reloaded underneath the editor - ids are process-local, and a draft over a
  // dive that no longer exists would save into the wrong one.
  return <DiveEditForm key={diveQuery.data.id} dive={diveQuery.data} unitSystem={unitSystem} />;
}

function DiveEditForm({ dive, unitSystem }: { dive: Dive; unitSystem: ReturnType<typeof useUnitSystem> }) {
  const router = useRouter();
  const theme = useTheme();
  const { data: dives = [] } = useDives();
  const { data: sites = [] } = useSites();
  const updateDive = useUpdateDive();
  const deleteDive = useDeleteDive();
  const [pickingSite, setPickingSite] = useState(false);

  const names = useMemo(() => harvestNames(dives), [dives]);
  const knownTags = useMemo(() => harvestTags(dives), [dives]);
  const knownSuits = useMemo(() => harvestSuits(dives), [dives]);
  const knownCylinders = useMemo(() => harvestCylinderDescriptions(dives), [dives]);
  const knownWeights = useMemo(() => harvestWeightDescriptions(dives), [dives]);

  const form = useForm({
    defaultValues: {
      ...diveDraftFrom(dive),
      tagText: dive.tags.join(', '),
      cylinders: cylinderDraftsFrom(dive, unitSystem),
      weights: weightDraftsFrom(dive, unitSystem),
    } as DiveFormValues,
    validators: {
      // The per-row messages are already on screen in red next to the fields
      // they belong to; this is the line that says why Save did nothing.
      onSubmit: ({ value }) => {
        if (Object.keys(validateCylinderDrafts(value.cylinders, unitSystem)).length > 0) {
          return 'Fix the cylinder fields marked in red before saving.';
        }
        if (Object.keys(validateWeightDrafts(value.weights, unitSystem)).length > 0) {
          return 'Fix the weight fields marked in red before saving.';
        }
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      const patch: DivePatch = buildDivePatch(dive, value);
      // `buildCylinderPatches` throws if the rows were reordered, which the
      // editor cannot do - so it is a bug rather than a validation failure, and
      // it is left to reach the form's error state as itself. The same holds
      // for `buildWeightPatches`.
      const cylinderPatches = buildCylinderPatches(dive, value.cylinders, unitSystem);
      if (cylinderPatches !== null) {
        patch.cylinders = cylinderPatches;
      }
      const weightPatches = buildWeightPatches(dive, value.weights, unitSystem);
      if (weightPatches !== null) {
        patch.weightsystems = weightPatches;
      }
      if (!isEmptyPatch(patch)) {
        await updateDive.mutateAsync({ id: dive.id, patch });
        // The editor is about to close, so the debounce window has to end here:
        // a force-quit from the screen behind must still find the edit on disk.
        await flush();
      }
      router.back();
    },
  });

  const onDelete = useCallback(() => {
    warned();
    Alert.alert(`Delete "${diveRowTitle(dive)}"?`, 'This dive and its profile are gone for good.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteDive.mutateAsync(dive.id);
            await flush();
            // Not back(): the screen behind is this dive's detail view, which
            // would come up as "Dive not found". Pop past it to the list.
            router.dismissTo('/dives');
          })();
        },
      },
    ]);
  }, [deleteDive, dive, router]);

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
              title: 'Edit dive',
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

      <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
        {(submitError) => {
          const message = fieldError([submitError, updateDive.error, deleteDive.error]);
          return message ? (
            <Text style={[styles.error, { color: theme.danger }]}>{message}</Text>
          ) : null;
        }}
      </form.Subscribe>

      <FormSection title="Place">
        <form.Field name="siteUuid">
          {(field) => (
            <>
              <FormButtonRow
                label="Dive site"
                value={
                  field.state.value === 0
                    ? 'None'
                    : sites.find((site) => site.uuid === field.state.value)?.name || 'Unnamed site'
                }
                onPress={() => setPickingSite(true)}
              />
              <SitePicker
                visible={pickingSite}
                selectedUuid={field.state.value}
                onSelect={(siteUuid) => {
                  field.handleChange(siteUuid);
                  setPickingSite(false);
                }}
                onClose={() => setPickingSite(false)}
              />
            </>
          )}
        </form.Field>
      </FormSection>

      <FormSection title="People" footer="Separate names with commas.">
        <form.Field name="buddy">
          {(field) => (
            <NameField
              label="Buddy"
              value={field.state.value}
              corpus={names}
              placeholder="Alice, Bob"
              onChange={field.handleChange}
            />
          )}
        </form.Field>
        <form.Field name="diveguide">
          {(field) => (
            <NameField
              label="Divemaster"
              value={field.state.value}
              corpus={names}
              onChange={field.handleChange}
            />
          )}
        </form.Field>
      </FormSection>

      <FormSection title="Conditions">
        <form.Field name="rating">
          {(field) => (
            <RatingField label="Rating" value={field.state.value} onChange={field.handleChange} />
          )}
        </form.Field>
        <form.Field name="visibility">
          {(field) => (
            <RatingField
              label="Visibility"
              value={field.state.value}
              onChange={field.handleChange}
            />
          )}
        </form.Field>
        <form.Field name="suit">
          {(field) => (
            <SuggestField
              label="Suit"
              value={field.state.value}
              corpus={knownSuits}
              placeholder="5mm wetsuit"
              onChange={field.handleChange}
            />
          )}
        </form.Field>
      </FormSection>

      <form.Field name="cylinders">
        {(field) => (
          <CylinderEditor
            drafts={field.state.value}
            errors={validateCylinderDrafts(field.state.value, unitSystem)}
            descriptions={knownCylinders}
            unitSystem={unitSystem}
            onChange={field.handleChange}
          />
        )}
      </form.Field>

      <form.Field name="weights">
        {(field) => (
          <WeightEditor
            drafts={field.state.value}
            errors={validateWeightDrafts(field.state.value, unitSystem)}
            descriptions={knownWeights}
            unitSystem={unitSystem}
            onChange={field.handleChange}
          />
        )}
      </form.Field>

      <FormSection
        title="Gas consumption"
        footer="Surface air consumption, computed from the cylinder sizes and the start and end pressures.">
        <form.Subscribe selector={(state) => state.values.cylinders}>
          {(cylinders) => (
            <View style={styles.sacRow}>
              <Text style={[styles.sacLabel, { color: theme.text }]}>SAC</Text>
              <Text style={[styles.sacValue, { color: theme.text }]}>
                {(() => {
                  const sac = previewSac(dive, cylinders, unitSystem);
                  return sac > 0 ? formatSac(sac, unitSystem) : 'Not enough data';
                })()}
              </Text>
            </View>
          )}
        </form.Subscribe>
      </FormSection>

      <FormSection title="Tags">
        <form.Subscribe selector={(state) => state.values.tags}>
          {(tags) => (
            <>
              <form.Field name="tagText">
                {(field) => (
                  <FormField
                    label="Tags"
                    value={field.state.value}
                    onChangeText={(text) => {
                      field.handleChange(text);
                      form.setFieldValue('tags', parseTagInput(text));
                    }}
                    placeholder="boat, deep, night"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                )}
              </form.Field>
              <SuggestionChips
                suggestions={knownTags.filter((tag) => !tags.includes(tag)).slice(0, 6)}
                onSelect={(tag) => {
                  const next = [...tags, tag];
                  form.setFieldValue('tags', next);
                  form.setFieldValue('tagText', next.join(', '));
                }}
              />
            </>
          )}
        </form.Subscribe>
      </FormSection>

      <FormSection title="Notes">
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

      <FormSection>
        <FormButtonRow label="Delete dive" onPress={onDelete} destructive />
      </FormSection>

      <View style={styles.footerSpace} />
    </ScrollView>
  );
}

/**
 * SAC as the core would compute it once these cylinders are saved. It comes
 * from the module rather than from arithmetic here because it depends on gas
 * compressibility and the dive's mean depth (`calculate_sac` in
 * core/divelist.cpp) - a second implementation could disagree with the file.
 *
 * The patch is built the same way the save builds it, so the number on screen
 * is computed from exactly what saving would write.
 */
function previewSac(
  dive: Dive,
  cylinders: readonly CylinderDraft[],
  unitSystem: ReturnType<typeof useUnitSystem>
): number {
  if (Object.keys(validateCylinderDrafts(cylinders, unitSystem)).length > 0) {
    return 0;
  }
  try {
    const patches = buildCylinderPatches(dive, cylinders, unitSystem);
    return patches === null ? dive.sac : previewDive(dive.id, { cylinders: patches }).sac;
  } catch {
    // A preview is a convenience; a failure here must not stop the editor.
    // Whatever is wrong will be reported when the save attempts it for real.
    return 0;
  }
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
  sacRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  sacLabel: {
    fontSize: 17,
  },
  sacValue: {
    fontSize: 17,
    fontWeight: '600',
  },
  footerSpace: {
    height: Spacing.six,
  },
});
