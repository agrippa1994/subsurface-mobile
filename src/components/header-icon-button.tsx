// AI-generated (Claude)
// An icon button for an Android navigation bar with more than one action, which
// HeaderAction (one action per screen) cannot express. iOS has native bar items.
import { Pressable, StyleSheet, Text } from 'react-native';

import { SymbolView, type SFSymbol } from '@/components/symbol';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function HeaderIconButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: SFSymbol;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={Spacing.one}
      android_ripple={{ color: theme.backgroundSelected, borderless: true }}
      style={styles.button}>
      <SymbolView
        name={icon}
        size={24}
        tintColor={theme.accent}
        fallback={<Text style={{ color: theme.accent }}>{label}</Text>}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
});
