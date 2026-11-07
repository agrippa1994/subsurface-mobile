// AI-generated (Claude)
// A search field for where no navigation bar can host the native one: the sidebar
// of the Dives tab and the sheet over the Sites map.
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { SymbolView } from '@/components/symbol';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function SearchField({
  value,
  onChangeText,
  placeholder,
  onFocus,
  tint,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  onFocus?: () => void;
  /** The field's fill, where the default would not stand out from what is behind it. */
  tint?: string;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.field, { backgroundColor: tint ?? theme.backgroundElement }]}>
      <SymbolView name="magnifyingglass" size={17} tintColor={theme.textSecondary} />
      <TextInput
        style={[styles.input, { color: theme.text }]}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={placeholder}
      />
      {value !== '' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={Spacing.two}
          onPress={() => onChangeText('')}>
          <SymbolView name="xmark.circle.fill" size={17} tintColor={theme.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: 22,
    borderCurve: 'continuous',
  },
  input: {
    flex: 1,
    fontSize: 17,
    paddingVertical: Spacing.one,
  },
});
