// AI-generated (Claude)
// A text field with autocomplete over a single value - the suit, a cylinder
// description.
//
// The comma-separated sibling is NameField, which edits a list. This one edits
// one value, so tapping a suggestion replaces the field rather than appending
// to it. The matching rules live in models/dive-edit.ts (`suggestValues`).

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FormField, type FormFieldProps } from '@/components/form';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { suggestValues } from '@/models/dive-edit';

/** The chip row both autocomplete fields and the tag field render. */
export function SuggestionChips({
  suggestions,
  onSelect,
}: {
  suggestions: readonly string[];
  onSelect: (value: string) => void;
}) {
  const theme = useTheme();
  if (suggestions.length === 0) {
    return null;
  }
  return (
    <View style={styles.chips}>
      {suggestions.map((value) => (
        <Pressable
          key={value}
          onPress={() => onSelect(value)}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.chip,
            {
              backgroundColor: pressed ? theme.backgroundSelected : theme.background,
              borderColor: theme.separator,
            },
          ]}>
          <Text style={[styles.chipText, { color: theme.text }]}>{value}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// `onChange` is TextInput's own event handler; this field takes the text
// instead, so the inherited one is dropped rather than intersected with it.
export type SuggestFieldProps = Omit<FormFieldProps, 'onChange' | 'onChangeText'> & {
  value: string;
  /** Every known value, e.g. from `harvestSuits(dives)`. */
  corpus: readonly string[];
  onChange: (value: string) => void;
};

export function SuggestField({ value, corpus, onChange, ...props }: SuggestFieldProps) {
  return (
    <View style={styles.container}>
      <FormField value={value} onChangeText={onChange} {...props} />
      <SuggestionChips suggestions={suggestValues(value, corpus)} onSelect={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  chipText: {
    fontSize: 15,
  },
});
