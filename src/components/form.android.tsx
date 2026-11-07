// AI-generated (Claude)
// The form pieces the editors are built from, on Android: Compose outlined text
// fields, filter chips and icon buttons, with no card behind them, as Material forms
// have it. The portable variant explains the layout; form.tsx. The editors stay React
// Native around these, since they hold charts, maps and autocomplete.
import { Host } from '@/components/material/host';
import {
  FilterChip,
  FlowRow,
  IconButton,
  OutlinedTextField,
  Row,
  Text as ComposeText,
  useMaterialColors,
  useNativeState,
  type TextFieldImeAction,
  type TextFieldKeyboardActions,
  type TextFieldKeyboardType,
  type TextFieldRef,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth, weight } from '@expo/ui/jetpack-compose/modifiers';
import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type KeyboardTypeOptions,
  type TextInputInstance,
  type TextInputProps,
} from 'react-native';

import { M3Icon } from '@/components/material/icon';
import { SymbolView } from '@/components/symbol';
import { Spacing } from '@/constants/theme';
import { selectionChanged } from '@/lib/haptics';

export { fieldError } from './field-error';

export function FormSection({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
}) {
  const palette = useMaterialColors();
  return (
    <View style={styles.section}>
      {title ? <Text style={[styles.sectionTitle, { color: palette.primary }]}>{title}</Text> : null}
      <View style={styles.fields}>{children}</View>
      {footer ? (
        <Text style={[styles.footer, { color: palette.onSurfaceVariant }]}>{footer}</Text>
      ) : null}
    </View>
  );
}

export type FormFieldProps = TextInputProps & {
  label: string;
  /** Shown under the field: what it is for, or what it accepts. */
  hint?: string;
  /** Why the value is not accepted. Takes the place of the hint, in the error colour. */
  error?: string;
};

function keyboardType(type: KeyboardTypeOptions | undefined): TextFieldKeyboardType {
  switch (type) {
    case 'number-pad':
    case 'numeric':
      return 'number';
    case 'decimal-pad':
      return 'decimal';
    case 'email-address':
      return 'email';
    case 'phone-pad':
      return 'phone';
    case 'url':
      return 'uri';
    default:
      return 'text';
  }
}

function imeAction(key: TextInputProps['returnKeyType']): TextFieldImeAction {
  switch (key) {
    case 'done':
    case 'go':
    case 'next':
    case 'search':
    case 'send':
      return key;
    default:
      return 'default';
  }
}

export const FormField = forwardRef<TextInputInstance, FormFieldProps>(function FormField(
  {
    label,
    hint,
    error,
    value,
    defaultValue,
    placeholder,
    multiline = false,
    editable = true,
    secureTextEntry = false,
    autoFocus,
    maxLength,
    autoCapitalize,
    autoCorrect,
    keyboardType: keyboard,
    returnKeyType,
    onChangeText,
    onFocus,
    onBlur,
    onSubmitEditing,
  },
  ref,
) {
  const palette = useMaterialColors();
  const initial = value ?? defaultValue ?? '';
  const text = useNativeState(initial);
  const field = useRef<TextFieldRef>(null);

  // The native field holds what is being typed. The form is told, and what it says
  // back must not rewrite a field that has moved on; only a change that came from
  // elsewhere, such as a suggestion or a filled-in cylinder, is written to it.
  const typed = useRef(initial);
  useEffect(() => {
    if (value !== undefined && value !== typed.current) {
      typed.current = value;
      text.set(value);
    }
  }, [text, value]);

  useImperativeHandle(
    ref,
    () =>
      ({
        focus: () => void field.current?.focus(),
        blur: () => void field.current?.blur(),
      }) as unknown as TextInputInstance,
    [],
  );

  const submit = (entered: string) =>
    onSubmitEditing?.({
      nativeEvent: { text: entered },
    } as Parameters<NonNullable<TextInputProps['onSubmitEditing']>>[0]);
  const action = imeAction(returnKeyType);
  const actions: TextFieldKeyboardActions =
    onSubmitEditing && action !== 'default'
      ? { [`on${action[0].toUpperCase()}${action.slice(1)}`]: submit }
      : {};
  const note = error ?? hint;

  return (
    <Host matchContents={{ vertical: true }}>
      <OutlinedTextField
        ref={field}
        value={text}
        enabled={editable}
        autoFocus={autoFocus}
        isError={error !== undefined}
        singleLine={!multiline}
        minLines={multiline ? 3 : undefined}
        maxLength={maxLength}
        visualTransformation={secureTextEntry ? 'password' : 'none'}
        keyboardOptions={{
          capitalization: autoCapitalize === 'none' ? 'none' : (autoCapitalize ?? 'sentences'),
          autoCorrectEnabled: autoCorrect ?? true,
          keyboardType: secureTextEntry ? 'password' : keyboardType(keyboard),
          imeAction: action,
        }}
        keyboardActions={actions}
        onValueChange={(next) => {
          typed.current = next;
          onChangeText?.(next);
        }}
        onFocusChanged={(focused) => {
          // The shared forms only read that these happened, not the event.
          (focused ? onFocus : onBlur)?.(undefined as never);
        }}
        modifiers={[fillMaxWidth()]}>
        <OutlinedTextField.Label>
          <ComposeText>{label}</ComposeText>
        </OutlinedTextField.Label>
        {placeholder ? (
          <OutlinedTextField.Placeholder>
            <ComposeText color={palette.onSurfaceVariant}>{placeholder}</ComposeText>
          </OutlinedTextField.Placeholder>
        ) : null}
        {note ? (
          <OutlinedTextField.SupportingText>
            <ComposeText>{note}</ComposeText>
          </OutlinedTextField.SupportingText>
        ) : null}
      </OutlinedTextField>
    </Host>
  );
});

/** One of a few: filter chips, wrapping as needed. */
export function OptionField<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <Host matchContents={{ vertical: true }}>
      <FlowRow horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
        {options.map((option) => (
          <FilterChip
            key={String(option.value)}
            selected={option.value === value}
            onClick={() => {
              selectionChanged();
              onChange(option.value);
            }}>
            <FilterChip.Label>
              <ComposeText>{option.label}</ComposeText>
            </FilterChip.Label>
          </FilterChip>
        ))}
      </FlowRow>
    </Host>
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
  const palette = useMaterialColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: palette.secondaryContainer }}
      style={styles.buttonRow}>
      <Text style={[styles.rowLabel, { color: destructive ? palette.error : palette.onSurface }]}>
        {label}
      </Text>
      {value ? (
        <Text style={[styles.rowValue, { color: palette.onSurfaceVariant }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {destructive ? null : (
        <SymbolView name="chevron.right" size={20} tintColor={palette.onSurfaceVariant} />
      )}
    </Pressable>
  );
}

/**
 * The 0-5 scale the core uses for `rating` and `visibility`. Tapping the star that is
 * already the value clears it, which is the only way back to the core's own 0.
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
  const palette = useMaterialColors();
  return (
    <Host matchContents={{ vertical: true }}>
      <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
        <ComposeText style={{ typography: 'bodyLarge' }} modifiers={[weight(1)]}>
          {label}
        </ComposeText>
        {[1, 2, 3, 4, 5].map((star) => (
          <IconButton
            key={star}
            onClick={() => {
              selectionChanged();
              onChange(value === star ? 0 : star);
            }}>
            <M3Icon
              symbol={star <= value ? 'star.fill' : 'star'}
              tint={star <= value ? palette.primary : palette.onSurfaceVariant}
              label={`${label} ${star} of 5`}
            />
          </IconButton>
        ))}
      </Row>
    </Host>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  fields: {
    gap: Spacing.three,
  },
  footer: {
    fontSize: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 48,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
  },
  rowValue: {
    flexShrink: 1,
    fontSize: 14,
    textAlign: 'right',
  },
});
