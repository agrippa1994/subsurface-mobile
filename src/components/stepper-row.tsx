// AI-generated (Claude)
// A label and a minus and a plus button: what the portable screens have for the
// iOS variants' native Stepper.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function StepperRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const theme = useTheme();
  const button = (text: string, next: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${text === '-' ? 'Decrease' : 'Increase'} ${label}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onChange(next)}
      style={[styles.button, { backgroundColor: theme.backgroundSelected }]}
    >
      <Text style={{ color: disabled ? theme.textSecondary : theme.text }}>{text}</Text>
    </Pressable>
  );
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <View style={styles.buttons}>
        {button('-', Math.max(min, value - step), value <= min)}
        {button('+', Math.min(max, value + step), value >= max)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  label: {
    flexShrink: 1,
    fontSize: 17,
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
  },
});
