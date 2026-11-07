// AI-generated (Claude)
// The rows the Android screens are made of: Compose's own list items and controls in
// the layout Android's settings use. A section's rows sit in a tonal card, as they do
// there, with its title and footnote outside.
//
// A row has to say whether it can be tapped, since the shapes alone do not:
// - a value is plain text, and nothing happens on it;
// - a row that does something is in the primary colour, or the error colour if it
//   destroys something, the way a text button is;
// - a row that leads elsewhere ends in a chevron; a choice, in a dropdown arrow; a
//   switch or stepper shows its control.
//
// Imported only from .android.tsx files: @expo/ui/jetpack-compose does not exist on iOS.
import { Host } from './host';
import {
  Box,
  Card,
  Column,
  DropdownMenu,
  DropdownMenuItem,
  FilledTonalIconButton,
  HorizontalDivider,
  LazyColumn,
  ListItem,
  Row,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Switch,
  Text,
  useMaterialColors,
} from '@expo/ui/jetpack-compose';
import {
  clickable,
  combinedClickable,
  fillMaxWidth,
  height,
  padding,
  toggleable,
} from '@expo/ui/jetpack-compose/modifiers';
import { Children, useState, type ReactNode } from 'react';
import type { ColorValue } from 'react-native';

import { M3Icon } from './icon';

/** A row takes the colour of the card it sits in. */
const ROW_COLORS = { containerColor: 'transparent' };

/** A whole screen of rows. */
export function M3Screen({ children }: { children: ReactNode }) {
  const palette = useMaterialColors();
  return (
    <Host style={{ flex: 1, backgroundColor: palette.surface }}>
      <LazyColumn contentPadding={{ bottom: 24 }}>{children}</LazyColumn>
    </Host>
  );
}

/** Its children are items of the list it is in, so it scrolls and recycles as rows do. */
export function M3Section({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const palette = useMaterialColors();
  return (
    <>
      {title ? (
        <Text
          color={palette.primary}
          style={{ typography: 'titleSmall' }}
          modifiers={[padding(32, 24, 32, 8)]}>
          {title}
        </Text>
      ) : (
        <Box modifiers={[height(16)]} />
      )}
      {Children.toArray(children).length > 0 ? (
        <Card
          colors={{ containerColor: palette.surfaceContainer }}
          modifiers={[padding(16, 0, 16, 0), fillMaxWidth()]}>
          <Column modifiers={[fillMaxWidth()]}>{children}</Column>
        </Card>
      ) : null}
      {footer ? <M3Footnote>{footer}</M3Footnote> : null}
    </>
  );
}

/** A line under a section, or anywhere a row needs an aside. */
export function M3Footnote({ children, color }: { children: ReactNode; color?: ColorValue }) {
  const palette = useMaterialColors();
  return (
    <Text
      color={color ?? palette.onSurfaceVariant}
      style={{ typography: 'bodySmall' }}
      modifiers={[padding(32, 8, 32, 8)]}>
      {children}
    </Text>
  );
}

/** A line of the screen's own text, for a warning or a result, set in the body style. */
export function M3Note({ children, color }: { children: ReactNode; color?: ColorValue }) {
  const palette = useMaterialColors();
  return (
    <Text
      color={color ?? palette.onSurface}
      style={{ typography: 'bodyMedium' }}
      modifiers={[padding(16, 8, 16, 8)]}>
      {children}
    </Text>
  );
}

/**
 * A label and a read-only value. The value goes under the label, where a long address
 * or date has room, or at the end of the row with `inline` for a short figure.
 */
export function M3ValueRow({
  label,
  value,
  inline = false,
  color,
}: {
  label: string;
  value: string;
  inline?: boolean;
  /** Colours the whole row, for a figure past a limit. */
  color?: ColorValue;
}) {
  return (
    <ListItem colors={ROW_COLORS}>
      <ListItem.HeadlineContent>
        <Text color={color}>{label}</Text>
      </ListItem.HeadlineContent>
      {inline ? (
        <ListItem.TrailingContent>
          <Text color={color} style={{ typography: 'bodyMedium' }}>
            {value}
          </Text>
        </ListItem.TrailingContent>
      ) : (
        <ListItem.SupportingContent>
          <Text color={color}>{value}</Text>
        </ListItem.SupportingContent>
      )}
    </ListItem>
  );
}

/** A row that does something when tapped, or with `opens`, leads to another screen. */
export function M3ActionRow({
  label,
  detail,
  icon,
  onPress,
  disabled = false,
  destructive = false,
  chosen = false,
  opens = false,
  onLongPress,
}: {
  label: string;
  detail?: string;
  /** An SF Symbol, drawn as its Material Symbol. */
  icon?: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
  /** Marks the row as the current choice. */
  chosen?: boolean;
  /** Leads to another screen: plain text and a chevron, rather than the action colour. */
  opens?: boolean;
  onLongPress?: () => void;
}) {
  const palette = useMaterialColors();
  const content = disabled
    ? `${palette.onSurface.slice(0, 7)}61`
    : destructive
      ? palette.error
      : opens
        ? palette.onSurface
        : palette.primary;
  return (
    <ListItem
      colors={ROW_COLORS}
      modifiers={
        disabled
          ? []
          : [onLongPress ? combinedClickable({ onClick: onPress, onLongClick: onLongPress }) : clickable(onPress)]
      }>
      {icon ? (
        <ListItem.LeadingContent>
          <M3Icon symbol={icon} tint={opens && !disabled ? palette.onSurfaceVariant : content} />
        </ListItem.LeadingContent>
      ) : null}
      <ListItem.HeadlineContent>
        <Text color={content}>{label}</Text>
      </ListItem.HeadlineContent>
      {detail ? (
        <ListItem.SupportingContent>
          <Text>{detail}</Text>
        </ListItem.SupportingContent>
      ) : null}
      {chosen || opens ? (
        <ListItem.TrailingContent>
          <M3Icon
            name={chosen ? 'check' : 'chevron_right'}
            tint={chosen ? palette.primary : palette.onSurfaceVariant}
          />
        </ListItem.TrailingContent>
      ) : null}
    </ListItem>
  );
}

export function M3SwitchRow({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <ListItem colors={ROW_COLORS} modifiers={[toggleable(value, () => onChange(!value), { role: 'switch' })]}>
      <ListItem.HeadlineContent>
        <Text>{label}</Text>
      </ListItem.HeadlineContent>
      {detail ? (
        <ListItem.SupportingContent>
          <Text>{detail}</Text>
        </ListItem.SupportingContent>
      ) : null}
      <ListItem.TrailingContent>
        <Switch value={value} onCheckedChange={onChange} />
      </ListItem.TrailingContent>
    </ListItem>
  );
}

/**
 * A value changed a step at a time. Android has no stepper control; a slider would
 * not land on an exact gradient factor or surface pressure, so it is a tonal icon
 * button either side of the end of the row.
 */
export function M3StepperRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  detail,
}: {
  /** With the value in it, as the iOS stepper's label has it. */
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  detail?: string;
}) {
  return (
    <ListItem colors={ROW_COLORS}>
      <ListItem.HeadlineContent>
        <Text>{label}</Text>
      </ListItem.HeadlineContent>
      {detail ? (
        <ListItem.SupportingContent>
          <Text>{detail}</Text>
        </ListItem.SupportingContent>
      ) : null}
      <ListItem.TrailingContent>
        <Row horizontalArrangement={{ spacedBy: 8 }}>
          <FilledTonalIconButton
            enabled={value > min}
            onClick={() => onChange(Math.max(min, value - step))}>
            <M3Icon name="remove" label={`Decrease ${label}`} />
          </FilledTonalIconButton>
          <FilledTonalIconButton
            enabled={value < max}
            onClick={() => onChange(Math.min(max, value + step))}>
            <M3Icon name="add" label={`Increase ${label}`} />
          </FilledTonalIconButton>
        </Row>
      </ListItem.TrailingContent>
    </ListItem>
  );
}

/** One of a few, all in view: a segmented button row, full width. */
export function M3SegmentedRow<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** What is being chosen, where the section's title does not already say. */
  label?: string;
}) {
  const palette = useMaterialColors();
  return (
    <>
      {label ? (
        <Text
          color={palette.onSurfaceVariant}
          style={{ typography: 'bodyMedium' }}
          modifiers={[padding(16, 8, 16, 0)]}>
          {label}
        </Text>
      ) : null}
      <Box modifiers={[fillMaxWidth(), padding(16, 8, 16, 8)]}>
        <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
          {options.map((option) => (
            <SegmentedButton
              key={String(option.value)}
              selected={option.value === value}
              onClick={() => onChange(option.value)}>
              <SegmentedButton.Label>
                <Text maxLines={1} overflow="ellipsis">
                  {option.label}
                </Text>
              </SegmentedButton.Label>
            </SegmentedButton>
          ))}
        </SingleChoiceSegmentedButtonRow>
      </Box>
    </>
  );
}

export type M3MenuGroup<T> = {
  title?: string;
  options: readonly { value: T; label: string }[];
};

/** One of many: the current value under the label, the rest in a dropdown menu. */
export function M3MenuRow<T extends string | number | null>({
  label,
  value,
  shown,
  options,
  groups,
  onChange,
}: {
  label: string;
  value: T;
  /** The text of the current value, where it is not one of the options. */
  shown?: string;
  options?: readonly { value: T; label: string }[];
  /** Options under headings, for a long menu. */
  groups?: readonly M3MenuGroup<T>[];
  onChange: (value: T) => void;
}) {
  const palette = useMaterialColors();
  const [open, setOpen] = useState(false);
  const all = groups ?? [{ options: options ?? [] }];
  const current =
    shown ?? all.flatMap((group) => group.options).find((option) => option.value === value)?.label;
  return (
    <DropdownMenu
      expanded={open}
      onDismissRequest={() => setOpen(false)}
      modifiers={[fillMaxWidth()]}>
      <DropdownMenu.Trigger>
        <ListItem colors={ROW_COLORS} modifiers={[clickable(() => setOpen(true))]}>
          <ListItem.HeadlineContent>
            <Text>{label}</Text>
          </ListItem.HeadlineContent>
          <ListItem.SupportingContent>
            <Text>{current ?? ''}</Text>
          </ListItem.SupportingContent>
          <ListItem.TrailingContent>
            <M3Icon name="arrow_drop_down" tint={palette.onSurfaceVariant} />
          </ListItem.TrailingContent>
        </ListItem>
      </DropdownMenu.Trigger>
      <DropdownMenu.Items>
        {all.map((group, index) => (
          <Column key={group.title ?? index}>
            {index > 0 ? <HorizontalDivider /> : null}
            {group.title ? (
              <Text
                color={palette.primary}
                style={{ typography: 'labelMedium' }}
                modifiers={[padding(12, 8, 12, 4)]}>
                {group.title}
              </Text>
            ) : null}
            {group.options.map((option) => (
              <DropdownMenuItem
                key={String(option.value)}
                onClick={() => {
                  setOpen(false);
                  onChange(option.value);
                }}>
                <DropdownMenuItem.Text>
                  <Text>{option.label}</Text>
                </DropdownMenuItem.Text>
                {option.value === value ? (
                  <DropdownMenuItem.TrailingIcon>
                    <M3Icon name="check" tint={palette.primary} />
                  </DropdownMenuItem.TrailingIcon>
                ) : null}
              </DropdownMenuItem>
            ))}
          </Column>
        ))}
      </DropdownMenu.Items>
    </DropdownMenu>
  );
}
