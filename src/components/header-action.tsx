// AI-generated (Claude)
// The one action a screen puts at the right of its navigation bar, portable
// variant (Android). expo-router's Stack.Toolbar draws only bitmap icons on
// Android - no text, no SF Symbols - so the action goes into the header's
// right slot instead: a Material Symbol icon button, or a text button for a
// labelled action such as "Save". iOS keeps the native toolbar item, see
// header-action.ios.tsx.
import { Stack } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { SymbolView, type SFSymbol } from '@/components/symbol';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type HeaderActionProps = {
  /** What the action does; the visible text, or the accessibility label of an icon. */
  label: string;
  /** Draw an icon instead of the label. */
  icon?: SFSymbol;
  /** The confirming action of a form (iOS draws it prominent). */
  done?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export function HeaderAction({ label, icon, disabled = false, onPress }: HeaderActionProps) {
  const theme = useTheme();
  const headerRight = () => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={Spacing.two}
      android_ripple={{ color: theme.backgroundSelected, borderless: true }}
      style={[styles.button, disabled ? styles.disabled : null]}>
      {icon ? (
        <SymbolView
          name={icon}
          size={24}
          tintColor={theme.accent}
          fallback={<Text style={[styles.label, { color: theme.accent }]}>{label}</Text>}
        />
      ) : (
        <Text style={[styles.label, { color: theme.accent }]}>{label}</Text>
      )}
    </Pressable>
  );
  return <Stack.Screen options={{ headerRight }} />;
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
