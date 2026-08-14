// AI-generated (Claude)
// The form pieces the dive and dive-site editors are built from.
//
// Plain React Native rather than @expo/ui: an editor mixes text fields, a
// rating control, an autocomplete dropdown and (for a site) a map, and a
// SwiftUI Form cannot host the last two. The visual language still follows the
// grouped-list convention - a section title above a rounded card of rows.

import { SymbolView } from 'expo-symbols';
import { forwardRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function FormSection({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      {title ? (
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
      ) : null}
      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>{children}</View>
      {footer ? <Text style={[styles.footer, { color: theme.textSecondary }]}>{footer}</Text> : null}
    </View>
  );
}

export type FormFieldProps = TextInputProps & {
  label: string;
  /** Shown under the field, e.g. why the value is not accepted. */
  hint?: string;
};

export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField(
  { label, hint, style, multiline, ...props },
  ref
) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <TextInput
        ref={ref}
        style={[
          styles.input,
          { color: theme.text },
          multiline ? styles.inputMultiline : null,
          style,
        ]}
        placeholderTextColor={theme.textSecondary}
        multiline={multiline}
        {...props}
      />
      {hint ? <Text style={[styles.hint, { color: theme.textSecondary }]}>{hint}</Text> : null}
    </View>
  );
});

/** A row that opens something else - a picker, a map, another screen. */
export function FormButtonRow({
  label,
  value,
  onPress,
  destructive = false,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.buttonRow, pressed ? { opacity: 0.6 } : null]}>
      <Text style={[styles.rowLabel, { color: destructive ? theme.danger : theme.text }]}>
        {label}
      </Text>
      {value ? (
        <Text style={[styles.rowValue, { color: theme.textSecondary }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * The 0-5 scale the core uses for `rating` and `visibility`. Tapping the star
 * that is already the value clears it, which is the only way back to "not
 * rated" - the core's own 0.
 */
export function RatingField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.ratingRow}>
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            onPress={() => onChange(value === star ? 0 : star)}
            accessibilityRole="button"
            accessibilityLabel={`${label} ${star} of 5`}
            hitSlop={Spacing.two}>
            <SymbolView
              name={star <= value ? 'star.fill' : 'star'}
              size={22}
              tintColor={star <= value ? theme.accent : theme.textSecondary}
              fallback={
                <Text
                  style={[
                    styles.star,
                    { color: star <= value ? theme.accent : theme.textSecondary },
                  ]}>
                  {star <= value ? '*' : '-'}
                </Text>
              }
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 13,
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  footer: {
    fontSize: 13,
  },
  field: {
    gap: Spacing.half,
  },
  label: {
    fontSize: 13,
  },
  input: {
    fontSize: 17,
    paddingVertical: Spacing.one,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 13,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowLabel: {
    fontSize: 17,
  },
  rowValue: {
    flexShrink: 1,
    fontSize: 15,
    textAlign: 'right',
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stars: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  star: {
    fontSize: 22,
  },
});
