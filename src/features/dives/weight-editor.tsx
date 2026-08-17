// AI-generated (Claude)
// The weight rows of the dive editor.
//
// One card per weightsystem: what it was (autocompleted from the log, plus the
// types the core knows) and how much it weighed. Everything is text; the
// parsing and the unit conversion live in models/weight-edit.ts.
//
// Unlike a cylinder, a weightsystem is not referred to from anywhere else in
// the dive - no samples, no gas-switch events - so every row can be removed.

import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FormField, FormSection } from '@/components/form';
import { SuggestField } from '@/components/suggest-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatWeight, type UnitSystem } from '@/models';
import {
  newWeightDraft,
  totalWeightGrams,
  type WeightDraft,
  type WeightErrors,
} from '@/models/weight-edit';

export function WeightEditor({
  drafts,
  errors,
  descriptions,
  unitSystem,
  onChange,
}: {
  drafts: readonly WeightDraft[];
  errors: WeightErrors;
  /** Weight descriptions to complete against. */
  descriptions: readonly string[];
  unitSystem: UnitSystem;
  onChange: (drafts: WeightDraft[]) => void;
}) {
  const theme = useTheme();

  const patchRow = (key: string, changes: Partial<WeightDraft>) => {
    onChange(drafts.map((draft) => (draft.key === key ? { ...draft, ...changes } : draft)));
  };

  return (
    <View style={styles.container}>
      {drafts.map((draft, index) => (
        <FormSection key={draft.key} title={`Weight ${index + 1}`}>
          <SuggestField
            label="Type"
            value={draft.description}
            corpus={descriptions}
            placeholder="belt"
            autoCorrect={false}
            onChange={(description) => patchRow(draft.key, { description })}
          />

          <FormField
            label={unitSystem === 'imperial' ? 'Weight (lbs)' : 'Weight (kg)'}
            value={draft.weightText}
            onChangeText={(weightText) => patchRow(draft.key, { weightText })}
            keyboardType="decimal-pad"
            placeholder={unitSystem === 'imperial' ? '12' : '6'}
          />

          {errors[draft.key] ? (
            <Text style={[styles.note, { color: theme.danger }]}>{errors[draft.key]}</Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => onChange(drafts.filter((other) => other.key !== draft.key))}
            style={({ pressed }) => [pressed ? { opacity: 0.6 } : null]}>
            <Text style={[styles.remove, { color: theme.danger }]}>Remove weight</Text>
          </Pressable>
        </FormSection>
      ))}

      {drafts.length > 1 ? (
        <FormSection>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: theme.text }]}>Total weight</Text>
            <Text style={[styles.totalValue, { color: theme.text }]}>
              {formatWeight(totalWeightGrams(drafts, unitSystem), unitSystem)}
            </Text>
          </View>
        </FormSection>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => onChange([...drafts, newWeightDraft()])}
        style={({ pressed }) => [
          styles.add,
          {
            backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
          },
        ]}>
        <SymbolView
          name="plus"
          size={16}
          tintColor={theme.accent}
          fallback={<Text style={{ color: theme.accent }}>+</Text>}
        />
        <Text style={[styles.addText, { color: theme.accent }]}>Add weight</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.four,
  },
  note: {
    fontSize: 13,
  },
  remove: {
    fontSize: 15,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  totalLabel: {
    fontSize: 17,
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '600',
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  addText: {
    fontSize: 17,
  },
});
