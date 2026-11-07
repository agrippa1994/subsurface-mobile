// AI-generated (Claude)
// The dive editor: the fields a diver fills in after the dive.
//
// Depth, duration and the samples come from the dive computer and are not
// editable here, unless the dive was added by hand, when they are all there is.
// The rest is what the diver knows: date, temperatures, site, buddies, tags,
// gear, conditions, notes.
//
// The form holds the draft and is turned into the smallest possible
// `updateDive` patch on save (models/dive-edit.ts, models/dive-basics.ts): the
// form hands over full values, so the diff against the loaded dive is what keeps
// a field nobody touched from being written back.

import { Stack, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { HeaderAction } from '@/components/header-action';
import { FormButtonRow, FormSection } from '@/components/form';
import { StatusView } from '@/components/status-view';
import {
  DiveFormSections,
  diveFormStyles,
  useDiveForm,
  type DiveFormValues,
} from '@/features/dives/dive-form';
import { useTheme } from '@/hooks/use-theme';
import { useLastRestore, useLeaveWhenGone } from '@/features/history/use-leave-when-gone';
import { operationSucceeded } from '@/lib/haptics';
import { rememberScreenOfLastChange } from '@/lib/logbook-history';
import { diveScreenOfEditor } from '@/models/logbook-history';
import { flush } from '@/lib/logbook-persist';
import { previewDive } from '../../../../../modules/ssrf-core/src';
import type { Dive, DivePatch, UnitSystem } from '@/models';
import {
  buildCylinderPatches,
  cylinderDraftsFrom,
  validateCylinderDrafts,
} from '@/models/cylinder-edit';
import {
  buildDiveBasicsPatch,
  diveBasicsDraftFrom,
  isManualDive,
  localNowWhen,
  validateDiveBasics,
  type DiveBasicsRules,
} from '@/models/dive-basics';
import { buildDivePatch, diveDraftFrom, isEmptyPatch } from '@/models/dive-edit';
import { buildWeightPatches, weightDraftsFrom } from '@/models/weight-edit';
import { describeError, formatErrorLine } from '@/models/errors';
import { useDive } from '@/queries/logbook';
import { useDeleteDive, useUpdateDive } from '@/queries/logbook-mutations';
import { useUnitSystem } from '@/queries/settings';

export default function DiveEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const diveId = Number(id);
  const unitSystem = useUnitSystem();

  // The dive is read from the module rather than the cached list: the list rows
  // carry no notes or suit, and the editor writes those too.
  const diveQuery = useDive(diveId);
  const lastRestore = useLastRestore();
  useLeaveWhenGone(diveQuery.error !== null);

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
  // dive that no longer exists would save into the wrong one. An undo counts: a draft
  // made from what it took back would put that back on Save.
  return <DiveEditForm key={`${diveQuery.data.id}-${lastRestore}`} dive={diveQuery.data} unitSystem={unitSystem} />;
}

function DiveEditForm({ dive, unitSystem }: { dive: Dive; unitSystem: UnitSystem }) {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const updateDive = useUpdateDive();
  const deleteDive = useDeleteDive();

  const [rules] = useState<DiveBasicsRules>(() => ({
    profileEditable: isManualDive(dive),
    allowFuture: dive.planned,
    now: localNowWhen(Date.now(), new Date().getTimezoneOffset()),
    seed: diveBasicsDraftFrom(dive, unitSystem),
  }));

  const initial = useMemo<DiveFormValues>(
    () => ({
      ...diveDraftFrom(dive),
      ...diveBasicsDraftFrom(dive, unitSystem),
      tagText: dive.tags.join(', '),
      cylinders: cylinderDraftsFrom(dive, unitSystem),
      weights: weightDraftsFrom(dive, unitSystem),
    }),
    [dive, unitSystem],
  );

  const form = useDiveForm({
    initial,
    rules,
    unitSystem,
    onSave: async (value) => {
      const patch: DivePatch = {
        ...buildDivePatch(dive, value),
        ...buildDiveBasicsPatch(dive, value, unitSystem),
      };
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
    void (async () => {
      await deleteDive.mutateAsync(dive.id);
      await flush();
      operationSucceeded();
      // Undoing this comes back to the dive's own screen, which this closes.
      rememberScreenOfLastChange(diveScreenOfEditor(pathname));
      // Not back(): the screen behind is this dive's detail view, which
      // would come up as "Dive not found". Pop past it to whatever opened
      // the dive - the dive list, or the site it was opened from.
      router.dismiss(2);
    })().catch(() => undefined); // Shown above the form, from deleteDive.error.
  }, [deleteDive, dive, pathname, router]);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={diveFormStyles.content}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="on-drag">
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <>
            <Stack.Screen options={{ title: 'Edit dive' }} />
            {/* A native bar button item, so Save gets the system confirmation
                style (prominent liquid glass on iOS 26). */}
            <HeaderAction
              label="Save"
              done
              disabled={isSubmitting}
              onPress={() => void form.handleSubmit()}
            />
          </>
        )}
      </form.Subscribe>

      <DiveFormSections
        form={form}
        self={dive}
        rules={rules}
        unitSystem={unitSystem}
        previewSac={(values) => previewSac(dive, values, unitSystem, rules)}
        errors={[updateDive.error, deleteDive.error]}
      />

      <FormSection>
        <FormButtonRow label="Delete dive" onPress={onDelete} destructive />
      </FormSection>

      <View style={diveFormStyles.footerSpace} />
    </ScrollView>
  );
}

/**
 * SAC as the core would compute it once these values are saved. It comes from
 * the module rather than from arithmetic here because it depends on gas
 * compressibility and the dive's mean depth (`calculate_sac` in
 * core/divelist.cpp) - a second implementation could disagree with the file.
 *
 * The patch is built the same way the save builds it, so the number on screen
 * is computed from exactly what saving would write.
 */
function previewSac(
  dive: Dive,
  values: DiveFormValues,
  unitSystem: UnitSystem,
  rules: DiveBasicsRules,
): number {
  if (
    Object.keys(validateCylinderDrafts(values.cylinders, unitSystem)).length > 0 ||
    Object.keys(validateDiveBasics(values, unitSystem, rules)).length > 0
  ) {
    return 0;
  }
  try {
    const patch: DivePatch = buildDiveBasicsPatch(dive, values, unitSystem);
    const cylinders = buildCylinderPatches(dive, values.cylinders, unitSystem);
    if (cylinders !== null) {
      patch.cylinders = cylinders;
    }
    return isEmptyPatch(patch) ? dive.sac : previewDive(dive.id, patch).sac;
  } catch {
    // A preview is a convenience; a failure here must not stop the editor.
    // Whatever is wrong will be reported when the save attempts it for real.
    return 0;
  }
}
