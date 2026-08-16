// AI-generated (Claude)
// The cylinder rows of the dive editor.
//
// One card per cylinder: description (autocompleted from the tanks the log
// already knows), size and working pressure, gas mix, and the start and end
// pressures the SAC rate is computed from. Everything is text; the parsing and
// the unit conversion live in models/cylinder-edit.ts.
//
// A cylinder the samples or the gas-switch events refer to cannot be removed -
// the bindings refuse it (api.cpp, apply_cylinders) - so the row does not offer
// a delete button for one, rather than offering it and failing on save.

import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FormField, FormSection, OptionField } from '@/components/form';
import { SuggestField } from '@/components/suggest-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CylinderUse, formatGasMix, type UnitSystem } from '@/models';
import {
  newCylinderDraft,
  parseFractionInput,
  type CylinderDraft,
  type CylinderErrors,
} from '@/models/cylinder-edit';

const USE_OPTIONS: readonly { value: CylinderUse; label: string }[] = [
  { value: CylinderUse.OcGas, label: 'Open circuit' },
  { value: CylinderUse.Diluent, label: 'Diluent' },
  { value: CylinderUse.Oxygen, label: 'Oxygen' },
  { value: CylinderUse.NotUsed, label: 'Not used' },
];

export function CylinderEditor({
  drafts,
  errors,
  descriptions,
  unitSystem,
  onChange,
}: {
  drafts: readonly CylinderDraft[];
  errors: CylinderErrors;
  /** Cylinder descriptions the log already knows, for autocomplete. */
  descriptions: readonly string[];
  unitSystem: UnitSystem;
  onChange: (drafts: CylinderDraft[]) => void;
}) {
  const theme = useTheme();

  const patchRow = (key: string, changes: Partial<CylinderDraft>) => {
    onChange(drafts.map((draft) => (draft.key === key ? { ...draft, ...changes } : draft)));
  };

  return (
    <View style={styles.container}>
      {drafts.map((draft, index) => (
        <FormSection key={draft.key} title={`Cylinder ${index + 1}`}>
          <SuggestField
            label="Type"
            value={draft.description}
            corpus={descriptions}
            placeholder="AL80"
            autoCorrect={false}
            onChange={(description) => patchRow(draft.key, { description })}
          />

          <View style={styles.pair}>
            <FormField
              label={unitSystem === 'imperial' ? 'Size (cuft)' : 'Size (l)'}
              value={draft.sizeText}
              onChangeText={(sizeText) => patchRow(draft.key, { sizeText })}
              keyboardType="decimal-pad"
              placeholder="12"
              style={styles.half}
            />
            <FormField
              label={unitSystem === 'imperial' ? 'Working (psi)' : 'Working (bar)'}
              value={draft.workingPressureText}
              onChangeText={(workingPressureText) =>
                patchRow(draft.key, { workingPressureText })
              }
              keyboardType="decimal-pad"
              placeholder="232"
              style={styles.half}
            />
          </View>

          <View style={styles.pair}>
            <FormField
              label="Oxygen (%)"
              value={draft.o2Text}
              onChangeText={(o2Text) => patchRow(draft.key, { o2Text })}
              keyboardType="decimal-pad"
              placeholder="21"
              style={styles.half}
            />
            <FormField
              label="Helium (%)"
              value={draft.heText}
              onChangeText={(heText) => patchRow(draft.key, { heText })}
              keyboardType="decimal-pad"
              placeholder="0"
              style={styles.half}
            />
          </View>
          <Text style={[styles.gasName, { color: theme.textSecondary }]}>
            {gasLabel(draft)}
          </Text>

          <View style={styles.pair}>
            <FormField
              label={unitSystem === 'imperial' ? 'Start (psi)' : 'Start (bar)'}
              value={draft.startText}
              onChangeText={(startText) => patchRow(draft.key, { startText })}
              keyboardType="decimal-pad"
              placeholder="200"
              style={styles.half}
            />
            <FormField
              label={unitSystem === 'imperial' ? 'End (psi)' : 'End (bar)'}
              value={draft.endText}
              onChangeText={(endText) => patchRow(draft.key, { endText })}
              keyboardType="decimal-pad"
              placeholder="50"
              style={styles.half}
            />
          </View>

          <OptionField
            options={USE_OPTIONS}
            value={draft.use}
            onChange={(use) => patchRow(draft.key, { use })}
          />

          {errors[draft.key] ? (
            <Text style={[styles.note, { color: theme.danger }]}>{errors[draft.key]}</Text>
          ) : null}

          {draft.used ? (
            <Text style={[styles.note, { color: theme.textSecondary }]}>
              Recorded by the dive computer, so this cylinder cannot be removed.
            </Text>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => onChange(drafts.filter((other) => other.key !== draft.key))}
              style={({ pressed }) => [pressed ? { opacity: 0.6 } : null]}>
              <Text style={[styles.remove, { color: theme.danger }]}>Remove cylinder</Text>
            </Pressable>
          )}
        </FormSection>
      ))}

      <Pressable
        accessibilityRole="button"
        onPress={() => onChange([...drafts, newCylinderDraft()])}
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
        <Text style={[styles.addText, { color: theme.accent }]}>Add cylinder</Text>
      </Pressable>
    </View>
  );
}

/**
 * The mix as the core would name it, so the diver sees "EAN32" while typing 32
 * and can tell at a glance that an empty field means air rather than 0% oxygen.
 */
function gasLabel(draft: CylinderDraft): string {
  const o2 = parseFractionInput(draft.o2Text);
  const he = parseFractionInput(draft.heText);
  if (o2 === null || he === null) {
    return '';
  }
  return formatGasMix(o2 ?? 0, he ?? 0);
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.four,
  },
  pair: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  half: {
    flex: 1,
  },
  gasName: {
    fontSize: 13,
  },
  note: {
    fontSize: 13,
  },
  remove: {
    fontSize: 15,
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
