// AI-generated (Claude)
// The dive form, shared by the editor and by adding a dive by hand.
//
// What matters most comes first: when, how deep, how long, where. Nothing further down
// is required, so a diver can stop there and Save. The two screens differ in what they
// do with the values, and in `self`, the dive being edited, whose depth and duration
// can only change if it was added by hand.

import { useForm, useStore } from '@tanstack/react-form';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fieldError, FormButtonRow, FormField, FormSection, RatingField } from '@/components/form';
import { NameField } from '@/components/name-field';
import { SuggestField, SuggestionChips } from '@/components/suggest-field';
import { Spacing } from '@/constants/theme';
import { CylinderEditor } from '@/features/dives/cylinder-editor';
import { PreviousDiveCard } from '@/features/dives/previous-dive-card';
import { SitePicker } from '@/features/dives/site-picker';
import { WeightEditor } from '@/features/dives/weight-editor';
import { WhenField } from '@/features/dives/when-field';
import { useTheme } from '@/hooks/use-theme';
import { operationFailed } from '@/lib/haptics';
import type { Dive, Units } from '@/models';
import { depthUnitName, formatDepth, formatDuration, formatSac, temperatureUnitName } from '@/models';
import {
  dateNotes,
  depthUnit,
  parseDurationInput,
  temperatureUnit,
  validateDiveBasics,
  type DiveBasicsDraft,
  type DiveBasicsRules,
} from '@/models/dive-basics';
import { copyCylinderSetup, copyWeights, findPreviousDive, mergeNames } from '@/models/copy-previous';
import { validateCylinderDrafts, type CylinderDraft } from '@/models/cylinder-edit';
import {
  harvestCylinderDescriptions,
  harvestNames,
  harvestSuits,
  harvestTags,
  harvestWeightDescriptions,
  parseTagInput,
  type DiveDraft,
} from '@/models/dive-edit';
import { validateWeightDrafts, type WeightDraft } from '@/models/weight-edit';
import { useDive, useDives, useSites, useTrips } from '@/queries/logbook';
import { useDefaultCylinder } from '@/queries/settings';
import { t } from '@/i18n';

/**
 * The draft, plus the things that are input rather than data: the raw tag text
 * (so a trailing comma survives being typed) and the cylinder and weight rows,
 * which carry the identity a row needs to survive a re-render (the drafts'
 * `key`).
 */
export type DiveFormValues = DiveDraft &
  DiveBasicsDraft & {
    tagText: string;
    cylinders: CylinderDraft[];
    weights: WeightDraft[];
  };

export function useDiveForm({
  initial,
  rules,
  units,
  onSave,
}: {
  initial: DiveFormValues;
  rules: DiveBasicsRules;
  units: Units;
  onSave: (values: DiveFormValues) => Promise<void>;
}) {
  return useForm({
    defaultValues: initial,
    validators: {
      // The per-row messages are already on screen in red next to the fields
      // they belong to; this is the line that says why Save did nothing.
      onSubmit: ({ value }) => {
        if (Object.keys(validateDiveBasics(value, units, rules)).length > 0) {
          return t('diveForm.fixFields');
        }
        if (Object.keys(validateCylinderDrafts(value.cylinders, units)).length > 0) {
          return t('diveForm.fixCylinders');
        }
        if (Object.keys(validateWeightDrafts(value.weights, units)).length > 0) {
          return t('diveForm.fixWeights');
        }
        return undefined;
      },
    },
    onSubmitInvalid: () => operationFailed(),
    onSubmit: ({ value }) => onSave(value),
  });
}

export type DiveForm = ReturnType<typeof useDiveForm>;

/** A figure that is shown here but not edited here. */
function ValueRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.valueRow} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.valueLabel, { color: theme.text }]}>{label}</Text>
      <Text style={[styles.value, { color: theme.textSecondary }]}>{value}</Text>
    </View>
  );
}

/** When, how deep and how long. */
function BasicsSection({
  form,
  self,
  rules,
  units,
}: {
  form: DiveForm;
  self?: Dive;
  rules: DiveBasicsRules;
  units: Units;
}) {
  const theme = useTheme();
  const { data: dives = [] } = useDives();
  const { data: trips = [] } = useTrips();
  const values = useStore(form.store, (state) => state.values);
  const attempted = useStore(form.store, (state) => state.submissionAttempts > 0);
  const errors = validateDiveBasics(values, units, rules);
  // A field not filled in yet is not a mistake until Save is pressed.
  const shown = (key: 'durationText' | 'maxDepthText') =>
    values[key].trim() !== '' || attempted ? errors[key] : undefined;

  const notes = dateNotes({
    dives,
    trips,
    when: values.when,
    durationSec: self?.durationSec ?? parseDurationInput(values.durationText) ?? 0,
    dive: self,
  });

  const footer =
    rules.profileEditable && self
      ? t('diveForm.redrawsProfile')
      : rules.profileEditable
        ? undefined
        : t('diveForm.fromComputer');

  return (
    <FormSection title={t('ui.dive')} footer={footer}>
      <form.Field name="when">
        {(field) => <WhenField value={field.state.value} onChange={field.handleChange} />}
      </form.Field>
      {errors.when ? (
        <Text style={[styles.note, { color: theme.danger }]}>{errors.when}</Text>
      ) : null}
      {notes.map((note) => (
        <Text key={note} style={[styles.note, { color: theme.warning }]}>
          {note}
        </Text>
      ))}
      {rules.profileEditable ? (
        <>
          <form.Field name="maxDepthText">
            {(field) => (
              <FormField
                label={t('diveForm.maxDepthUnit', { unit: depthUnit(units) })}
                accessibilityLabel={t('diveForm.maxDepthSpoken', { unit: depthUnitName(units) })}
                value={field.state.value}
                onChangeText={field.handleChange}
                error={shown('maxDepthText')}
                keyboardType="decimal-pad"
                placeholder={t('ui.required')}
              />
            )}
          </form.Field>
          <form.Field name="durationText">
            {(field) => (
              <FormField
                label={t('ui.durationMinOrHMm')}
                accessibilityLabel={t('ui.durationInMinutesOrHoursAnd')}
                value={field.state.value}
                onChangeText={field.handleChange}
                error={shown('durationText')}
                keyboardType="numbers-and-punctuation"
                placeholder={t('ui.required')}
              />
            )}
          </form.Field>
        </>
      ) : self ? (
        <>
          <ValueRow label={t('ui.maximumDepth')} value={formatDepth(self.maxDepthMm, units)} />
          <ValueRow label={t('ui.duration')} value={formatDuration(self.durationSec)} />
        </>
      ) : null}
    </FormSection>
  );
}

/** The figures a diver may or may not have: average, temperatures, number. */
function DetailsSection({
  form,
  self,
  rules,
  units,
}: {
  form: DiveForm;
  self?: Dive;
  rules: DiveBasicsRules;
  units: Units;
}) {
  const values = useStore(form.store, (state) => state.values);
  const errors = validateDiveBasics(values, units, rules);
  const unit = temperatureUnit(units);
  const manual = rules.profileEditable;

  return (
    <FormSection
      title={t('ui.details')}
      footer={manual ? t('diveForm.averageEmpty') : undefined}>
      {manual ? (
        <form.Field name="meanDepthText">
          {(field) => (
            <FormField
              label={t('diveForm.avgDepthUnit', { unit: depthUnit(units) })}
              accessibilityLabel={t('diveForm.avgDepthSpoken', { unit: depthUnitName(units) })}
              value={field.state.value}
              onChangeText={field.handleChange}
              error={errors.meanDepthText}
              keyboardType="decimal-pad"
            />
          )}
        </form.Field>
      ) : self && self.meanDepthMm > 0 ? (
        <ValueRow label={t('ui.averageDepth')} value={formatDepth(self.meanDepthMm, units)} />
      ) : null}
      <form.Field name="waterTempText">
        {(field) => (
          <FormField
            label={t('diveForm.waterTempUnit', { unit })}
            accessibilityLabel={t('diveForm.waterTempSpoken', { unit: temperatureUnitName(units) })}
            value={field.state.value}
            onChangeText={field.handleChange}
            error={errors.waterTempText}
            keyboardType="numbers-and-punctuation"
          />
        )}
      </form.Field>
      <form.Field name="airTempText">
        {(field) => (
          <FormField
            label={t('diveForm.airTempUnit', { unit })}
            accessibilityLabel={t('diveForm.airTempSpoken', { unit: temperatureUnitName(units) })}
            value={field.state.value}
            onChangeText={field.handleChange}
            error={errors.airTempText}
            keyboardType="numbers-and-punctuation"
          />
        )}
      </form.Field>
      {self ? (
        <form.Field name="numberText">
          {(field) => (
            <FormField
              label={t('ui.diveNumber')}
              value={field.state.value}
              onChangeText={field.handleChange}
              error={errors.numberText}
              keyboardType="number-pad"
              placeholder={t('ui.none')}
            />
          )}
        </form.Field>
      ) : null}
    </FormSection>
  );
}

export function DiveFormSections({
  form,
  self,
  rules,
  units,
  previewSac,
  errors = [],
}: {
  form: DiveForm;
  self?: Dive;
  rules: DiveBasicsRules;
  units: Units;
  /** SAC as the core would compute it from these values, 0 for none. */
  previewSac: (values: DiveFormValues) => number;
  /** Failures of the screen's own actions, shown with the form's. */
  errors?: readonly unknown[];
}) {
  const theme = useTheme();
  const { data: dives = [] } = useDives();
  const { data: sites = [] } = useSites();
  const [pickingSite, setPickingSite] = useState(false);

  const names = useMemo(() => harvestNames(dives), [dives]);
  const knownTags = useMemo(() => harvestTags(dives), [dives]);
  const knownSuits = useMemo(() => harvestSuits(dives), [dives]);
  const knownCylinders = useMemo(() => harvestCylinderDescriptions(dives), [dives]);
  const defaultCylinder = useDefaultCylinder();
  const knownWeights = useMemo(() => harvestWeightDescriptions(dives), [dives]);

  // The list rows carry no cylinders or weights, so the previous dive is read
  // in full. NaN keeps the query disabled for the first dive in the log. A new dive
  // has no id, and -1 is nobody's.
  const when = useStore(form.store, (state) => state.values.when);
  const previousSummary = useMemo(
    () => findPreviousDive(dives, { id: self?.id ?? -1, when }),
    [dives, self?.id, when],
  );
  const { data: previous } = useDive(previousSummary?.id ?? Number.NaN);

  return (
    <>
      <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
        {(submitError) => {
          const message = fieldError([submitError, ...errors]);
          return message ? (
            <Text style={[styles.error, { color: theme.danger }]}>{message}</Text>
          ) : null;
        }}
      </form.Subscribe>

      <BasicsSection form={form} self={self} rules={rules} units={units} />

      <FormSection title={t('ui.place')}>
        <form.Field name="siteUuid">
          {(field) => (
            <>
              <FormButtonRow
                label={t('ui.diveSite')}
                value={
                  field.state.value === 0
                    ? t('ui.none')
                    : sites.find((site) => site.uuid === field.state.value)?.name || t('sites.unnamed')
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

      {previous ? (
        <PreviousDiveCard
          previous={previous}
          units={units}
          onCopySite={() => form.setFieldValue('siteUuid', previous.siteUuid)}
          onCopyBuddies={() =>
            form.setFieldValue('buddy', (buddy) => mergeNames(buddy, previous.buddy))
          }
          onCopyDiveguide={() =>
            form.setFieldValue('diveguide', (guide) => mergeNames(guide, previous.diveguide))
          }
          onCopySuit={() => form.setFieldValue('suit', previous.suit.trim())}
          onCopyCylinders={() =>
            form.setFieldValue('cylinders', (cylinders) =>
              copyCylinderSetup(cylinders, previous.cylinders, units)
            )
          }
          onCopyWeights={() =>
            form.setFieldValue('weights', (weights) =>
              copyWeights(weights, previous.weightsystems, units)
            )
          }
        />
      ) : null}

      <DetailsSection form={form} self={self} rules={rules} units={units} />

      <FormSection title={t('ui.people')} footer={t('ui.separateNamesWithCommas')}>
        <form.Field name="buddy">
          {(field) => (
            <NameField
              label={t('ui.buddy')}
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
              label={t('ui.divemaster')}
              value={field.state.value}
              corpus={names}
              onChange={field.handleChange}
            />
          )}
        </form.Field>
      </FormSection>

      <FormSection title={t('ui.conditions')}>
        <form.Field name="rating">
          {(field) => (
            <RatingField label={t('ui.rating')} value={field.state.value} onChange={field.handleChange} />
          )}
        </form.Field>
        <form.Field name="visibility">
          {(field) => (
            <RatingField
              label={t('ui.visibility')}
              value={field.state.value}
              onChange={field.handleChange}
            />
          )}
        </form.Field>
        <form.Field name="suit">
          {(field) => (
            <SuggestField
              label={t('ui.suit')}
              value={field.state.value}
              corpus={knownSuits}
              placeholder={t('ui.n5mmWetsuit')}
              onChange={field.handleChange}
            />
          )}
        </form.Field>
      </FormSection>

      <form.Field name="cylinders">
        {(field) => (
          <CylinderEditor
            drafts={field.state.value}
            errors={validateCylinderDrafts(field.state.value, units)}
            descriptions={knownCylinders}
            units={units}
            template={defaultCylinder}
            onChange={field.handleChange}
          />
        )}
      </form.Field>

      <form.Field name="weights">
        {(field) => (
          <WeightEditor
            drafts={field.state.value}
            errors={validateWeightDrafts(field.state.value, units)}
            descriptions={knownWeights}
            units={units}
            onChange={field.handleChange}
          />
        )}
      </form.Field>

      <FormSection
        title={t('ui.gasConsumption')}
        footer={t('ui.surfaceAirConsumptionComputedFromThe')}>
        <form.Subscribe selector={(state) => state.values}>
          {(values) => {
            const sac = previewSac(values);
            return (
              <View style={styles.valueRow}>
                <Text style={[styles.valueLabel, { color: theme.text }]}>{t('dive.field.sac')}</Text>
                <Text style={[styles.sacValue, { color: theme.text }]}>
                  {sac > 0 ? formatSac(sac, units) : t('diveForm.notEnoughData')}
                </Text>
              </View>
            );
          }}
        </form.Subscribe>
      </FormSection>

      <FormSection title={t('ui.tags')}>
        <form.Subscribe selector={(state) => state.values.tags}>
          {(tags) => (
            <>
              <form.Field name="tagText">
                {(field) => (
                  <FormField
                    label={t('ui.tags')}
                    value={field.state.value}
                    onChangeText={(text) => {
                      field.handleChange(text);
                      form.setFieldValue('tags', parseTagInput(text));
                    }}
                    placeholder={t('ui.boatDeepNight')}
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

      <FormSection title={t('ui.notes')}>
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
    </>
  );
}

export const diveFormStyles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  footerSpace: {
    height: Spacing.six,
  },
});

const styles = StyleSheet.create({
  error: {
    fontSize: 15,
  },
  note: {
    fontSize: 13,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  valueLabel: {
    fontSize: 17,
  },
  value: {
    fontSize: 17,
  },
  sacValue: {
    fontSize: 17,
    fontWeight: '600',
  },
});
