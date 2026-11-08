// AI-generated (Claude)
// Switches the dive computer a dive is shown from, on Android: a dropdown menu.
import { Host } from '@/components/material/host';
import {
  DropdownMenu,
  DropdownMenuItem,
  HorizontalDivider,
  Row,
  Text,
  TextButton,
} from '@expo/ui/jetpack-compose';
import { useState } from 'react';

import { M3MenuRow } from '@/components/material/list';
import { M3Icon } from '@/components/material/icon';

import { MAKE_FIRST_LABEL, type ComputerPickerProps } from './computer-picker';

export type { ComputerPickerProps };

export function ComputerPicker({
  labels,
  selectedIndex,
  onSelect,
  compact = false,
  onMakeFirst,
}: ComputerPickerProps) {
  const [open, setOpen] = useState(false);
  const canMakeFirst = onMakeFirst !== undefined && selectedIndex > 0;
  if (!compact) {
    return (
      <Host matchContents={{ vertical: true }}>
        <M3MenuRow
          label="Computer"
          value={selectedIndex}
          options={labels.map((label, index) => ({ value: index, label }))}
          onChange={onSelect}
        />
      </Host>
    );
  }
  return (
    <Host matchContents>
      <DropdownMenu expanded={open} onDismissRequest={() => setOpen(false)}>
        <DropdownMenu.Trigger>
          <TextButton onClick={() => setOpen(true)}>
            <Row verticalAlignment="center">
              <Text maxLines={1} overflow="ellipsis">
                {labels[selectedIndex]}
              </Text>
              <M3Icon name="arrow_drop_down" />
            </Row>
          </TextButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {labels.map((label, index) => (
            <DropdownMenuItem
              key={`${index}-${label}`}
              onClick={() => {
                setOpen(false);
                onSelect(index);
              }}>
              <DropdownMenuItem.Text>
                <Text>{label}</Text>
              </DropdownMenuItem.Text>
              {index === selectedIndex ? (
                <DropdownMenuItem.TrailingIcon>
                  <M3Icon name="check" />
                </DropdownMenuItem.TrailingIcon>
              ) : null}
            </DropdownMenuItem>
          ))}
          {canMakeFirst ? <HorizontalDivider /> : null}
          {canMakeFirst ? (
            <DropdownMenuItem
              onClick={() => {
                setOpen(false);
                onMakeFirst(selectedIndex);
              }}>
              <DropdownMenuItem.LeadingIcon>
                <M3Icon name="arrow_upward" />
              </DropdownMenuItem.LeadingIcon>
              <DropdownMenuItem.Text>
                <Text>{MAKE_FIRST_LABEL}</Text>
              </DropdownMenuItem.Text>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  );
}
