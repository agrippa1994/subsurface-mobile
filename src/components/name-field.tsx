// AI-generated (Claude)
// A comma-separated name field with autocomplete, used for buddy and diveguide.
//
// `dive::buddy` and `dive::diveguide` (core/dive.h) are plain comma-separated
// strings - the core has no buddy table - so the field edits the string
// directly and the suggestions are harvested from the loaded log. All of that
// logic lives in models/dive-edit.ts; this component only renders it.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/form';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { applySuggestion, suggestNames } from '@/models/dive-edit';

export function NameField({
  label,
  value,
  corpus,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  /** Every known name, from `harvestNames(dives)`. */
  corpus: readonly string[];
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const theme = useTheme();
  const suggestions = suggestNames(value, corpus);

  return (
    <View style={styles.container}>
      <FormField
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        autoCapitalize="words"
        autoCorrect={false}
      />
      {suggestions.length > 0 ? (
        <View style={styles.suggestions}>
          {suggestions.map((name) => (
            <Pressable
              key={name}
              onPress={() => onChange(applySuggestion(value, name))}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: pressed ? theme.backgroundSelected : theme.background,
                  borderColor: theme.separator,
                },
              ]}>
              <Text style={[styles.chipText, { color: theme.text }]}>{name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  suggestions: {
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
