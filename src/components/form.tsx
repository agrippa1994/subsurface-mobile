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
import { selectionChanged } from '@/lib/haptics';
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
  /** Shown under the field: what it is for, or what it accepts. */
  hint?: string;
  /**
   * Why the value is not accepted. Takes the place of the hint and is drawn in
   * the danger colour - a rejection and an explanation must not look alike.
   */
  error?: string;
};

export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField(
  { label, hint, error, style, multiline, ...props },
  ref
) {
  const theme = useTheme();
  const note = error ?? hint;
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
      {note ? (
        <Text style={[styles.hint, { color: error ? theme.danger : theme.textSecondary }]}>
          {note}
        </Text>
      ) : null}
    </View>
  );
});

/**
 * A form field's error as one line. TanStack Form collects errors into an
 * array and lets a validator return a string or an object; a field shows a
 * single line, so this takes the first thing that is actually an error.
 */
export function fieldError(errors: readonly unknown[]): string | undefined {
  const first = errors.find((error) => error !== undefined && error !== null);
  if (first === undefined) {
    return undefined;
  }
  if (typeof first === 'string') {
    return first;
  }
  const message = (first as { message?: unknown }).message;
  return typeof message === 'string' ? message : String(first);
}

/**
 * A row of chips, one selected. Used where a picker would be overkill and a
 * SwiftUI segmented control cannot be hosted (the editors are plain React
 * Native - see the note at the top of this file).
 */
export function OptionField<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.options}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              selectionChanged();
              onChange(option.value);
            }}
            style={[
              styles.option,
              {
                borderColor: selected ? theme.accent : theme.separator,
                backgroundColor: selected ? theme.backgroundSelected : 'transparent',
              },
            ]}>
            <Text style={{ color: selected ? theme.accent : theme.textSecondary }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

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
            onPress={() => {
              selectionChanged();
              onChange(value === star ? 0 : star);
            }}
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
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  option: {
    borderRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
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
