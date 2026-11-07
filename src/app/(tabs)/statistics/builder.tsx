// AI-generated (Claude)
// The chart builder, portable variant: rows that open the app's list picker. iOS has a
// native form, see builder.ios.tsx. Both draw the fields of use-builder.ts.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { FormSection } from '@/components/form';
import { HeaderAction } from '@/components/header-action';
import { SymbolView } from '@/components/symbol';
import { Spacing } from '@/constants/theme';
import { ChoicePicker, type Choice } from '@/features/dive-computer/choice-picker';
import { useBuilder, type BuilderField, type VariableField } from '@/features/statistics/use-builder';
import { useTheme } from '@/hooks/use-theme';

type Open = { title: string; selected: string; choices: Choice<string | null>[]; onChoose: (value: string | null) => void };

export default function BuilderScreen() {
  const builder = useBuilder();
  const router = useRouter();
  const theme = useTheme();
  const [open, setOpen] = useState<Open | null>(null);

  const row = (key: string, label: string, value: string, onPress: () => void) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={styles.row}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <Text style={[styles.value, { color: theme.textSecondary }]} numberOfLines={1}>
        {value}
      </Text>
      <SymbolView name="chevron.right" size={12} tintColor={theme.textSecondary} />
    </Pressable>
  );

  const variableRow = (field: VariableField) =>
    row(field.key, field.label, field.selected, () =>
      setOpen({
        title: field.label,
        selected: field.selected,
        choices: [
          ...(field.noneLabel ? [{ key: field.noneLabel, label: field.noneLabel, value: null }] : []),
          ...field.groups.flatMap((group) =>
            group.variables.map((variable) => ({
              key: variable.name,
              label: variable.name,
              detail: group.title,
              value: variable.name,
            })),
          ),
        ],
        onChoose: field.onChoose,
      }),
    );

  const choiceRow = (field: BuilderField) =>
    row(
      field.key,
      field.label,
      field.choices.find((choice) => choice.key === field.selected)?.label ?? '',
      () =>
        setOpen({
          title: field.label,
          selected: field.selected,
          choices: field.choices.map((choice) => ({ key: choice.key, label: choice.label, value: choice.key })),
          onChoose: (value) => {
            if (value !== null) {
              field.onChoose(value);
            }
          },
        }),
    );

  return (
    <>
      <HeaderAction label="Done" done onPress={() => router.back()} />
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic">
        <FormSection title="What to show" footer={builder.description}>
          {builder.first ? variableRow(builder.first) : null}
          {builder.fields.map(choiceRow)}
          {builder.second ? variableRow(builder.second) : null}
          {builder.measures.map(choiceRow)}
        </FormSection>
        <FormSection title="How to show it">
          {builder.display.map(choiceRow)}
          {builder.features.map((feature) => (
            <View key={feature.key} style={styles.row}>
              <Text style={[styles.label, { color: theme.text }]}>{feature.label}</Text>
              <Switch
                accessibilityLabel={feature.label}
                value={feature.on}
                onValueChange={(on) => builder.setFeature(feature.key, on)}
              />
            </View>
          ))}
        </FormSection>
        <Text style={[styles.note, { color: theme.textSecondary }]}>
          The chart counts the dives the filter on the chart screen selects.
        </Text>
      </ScrollView>
      <ChoicePicker
        visible={open !== null}
        title={open?.title ?? ''}
        choices={open?.choices ?? []}
        selectedKey={open?.selected}
        onSelect={(value) => {
          open?.onChoose(value);
          setOpen(null);
        }}
        onClose={() => setOpen(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
  },
  label: {
    fontSize: 16,
    flex: 1,
  },
  value: {
    fontSize: 16,
    flexShrink: 1,
  },
  note: {
    fontSize: 13,
  },
});
