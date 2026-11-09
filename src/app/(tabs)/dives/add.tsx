// AI-generated (Claude)
// Adding a dive by hand, for a dive with no computer, or one whose computer is gone.
//
// A sheet with Cancel and Save, over the form the editor uses. The dive goes on a dive
// computer named "manually added dive", with a profile the core draws from the figures
// (api.cpp, add_dive), which is what lets depth and duration be corrected later.

import { useNavigation, usePreventRemove, useRouter } from 'expo-router';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, type ScrollViewInstance } from 'react-native';
import { useStore } from '@tanstack/react-form';

import { HeaderAction, HeaderCancel } from '@/components/header-action';
import {
  DiveFormSections,
  diveFormStyles,
  useDiveForm,
  type DiveFormValues,
} from '@/features/dives/dive-form';
import { useTheme } from '@/hooks/use-theme';
import { operationFailed, operationSucceeded, warned } from '@/lib/haptics';
import { previewNewDive } from '../../../../modules/ssrf-core/src';
import type { NewDiveInput, Units } from '@/models';
import { buildCylinderPatches, validateCylinderDrafts } from '@/models/cylinder-edit';
import {
  buildNewDiveBasics,
  localNowWhen,
  newDiveBasicsDraft,
  validateDiveBasics,
  type DiveBasicsRules,
} from '@/models/dive-basics';
import { BLANK_DIVE_DRAFT, buildDivePatch } from '@/models/dive-edit';
import { buildWeightPatches } from '@/models/weight-edit';
import { useAddDive } from '@/queries/logbook-mutations';
import { useUnits } from '@/queries/settings';

/** What the cylinder and weight patches compare against: a dive with neither. */
const NOTHING_YET = { cylinders: [], weightsystems: [] };

function newDiveInput(values: DiveFormValues, units: Units): NewDiveInput {
  const input: NewDiveInput = {
    ...buildDivePatch(BLANK_DIVE_DRAFT, values),
    ...buildNewDiveBasics(values, units),
  };
  const cylinders = buildCylinderPatches(NOTHING_YET, values.cylinders, units);
  if (cylinders !== null) {
    input.cylinders = cylinders;
  }
  const weights = buildWeightPatches(NOTHING_YET, values.weights, units);
  if (weights !== null) {
    input.weightsystems = weights;
  }
  return input;
}

export default function AddDiveScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const theme = useTheme();
  const units = useUnits();
  const addDive = useAddDive();
  const scroll = useRef<ScrollViewInstance>(null);
  // Where the top of the form is. Not 0: the content starts under the header, by an
  // inset known once it has scrolled, and until then it is at the top anyway.
  const topInset = useRef<number | null>(null);
  const scrollToTop = () => {
    if (topInset.current !== null) {
      scroll.current?.scrollTo({ y: -topInset.current });
    }
  };

  const [now] = useState(() => localNowWhen(Date.now(), new Date().getTimezoneOffset()));
  const rules = useMemo<DiveBasicsRules>(
    () => ({ profileEditable: true, allowFuture: false, now }),
    [now],
  );
  // The dive it opened on, once saved: leaving is then no longer a discard.
  const [savedId, setSavedId] = useState<number | null>(null);

  const form = useDiveForm({
    initial: {
      ...BLANK_DIVE_DRAFT,
      ...newDiveBasicsDraft(now),
      tagText: '',
      cylinders: [],
      weights: [],
    },
    rules,
    units,
    onSave: async (values) => {
      try {
        const dive = await addDive.mutateAsync(newDiveInput(values, units));
        operationSucceeded();
        setSavedId(dive.id);
      } catch {
        // Shown above the form, from addDive.error.
        operationFailed();
        scrollToTop();
      }
    },
  });

  const untouched = useStore(form.store, (state) => state.isDefaultValue);
  const attempts = useStore(form.store, (state) => state.submissionAttempts);
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  // What is wrong is at the top of the form, and Save is pressed from anywhere in it.
  const scrollToTopNow = useEffectEvent(scrollToTop);
  useEffect(() => {
    if (attempts > 0) {
      scrollToTopNow();
    }
  }, [attempts]);

  usePreventRemove(!untouched && savedId === null, ({ data }) => {
    warned();
    Alert.alert('Discard this dive?', 'What you entered will be lost.', [
      { text: 'Keep Editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });

  // In an effect, since the guard above has to have let go first.
  useEffect(() => {
    if (savedId !== null) {
      router.replace(`/dives/${savedId}`);
    }
  }, [router, savedId]);

  const previewSac = (values: DiveFormValues): number => {
    if (
      values.cylinders.length === 0 ||
      Object.keys(validateDiveBasics(values, units, rules)).length > 0 ||
      Object.keys(validateCylinderDrafts(values.cylinders, units)).length > 0
    ) {
      return 0;
    }
    try {
      return previewNewDive(newDiveInput(values, units)).sac;
    } catch {
      // A preview is a convenience, as in the editor.
      return 0;
    }
  };

  return (
    <ScrollView
      ref={scroll}
      onScroll={(event) => {
        topInset.current = event.nativeEvent.contentInset.top;
      }}
      scrollEventThrottle={100}
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={diveFormStyles.content}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag">
      <HeaderCancel onPress={() => router.back()} />
      <HeaderAction
        label="Save"
        done
        disabled={isSubmitting}
        onPress={() => void form.handleSubmit()}
      />
      <DiveFormSections
        form={form}
        rules={rules}
        units={units}
        previewSac={previewSac}
        errors={[addDive.error]}
      />
    </ScrollView>
  );
}
