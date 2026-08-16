// AI-generated (Claude)
// A comma-separated name field with autocomplete, used for buddy and diveguide.
//
// `dive::buddy` and `dive::diveguide` (core/dive.h) are plain comma-separated
// strings - the core has no buddy table - so the field edits the string
// directly and the suggestions are harvested from the loaded log. All of that
// logic lives in models/dive-edit.ts; this component only renders it.

import { StyleSheet, View } from 'react-native';

import { FormField } from '@/components/form';
import { SuggestionChips } from '@/components/suggest-field';
import { Spacing } from '@/constants/theme';
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
      <SuggestionChips
        suggestions={suggestNames(value, corpus)}
        onSelect={(name) => onChange(applySuggestion(value, name))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
});
