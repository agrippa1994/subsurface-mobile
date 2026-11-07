// AI-generated (Claude)
// Switches the dive computer a dive is shown from, on Android: a dropdown menu.
import { Host } from '@/components/material/host';
import {
  DropdownMenu,
  DropdownMenuItem,
  Row,
  Text,
  TextButton,
} from '@expo/ui/jetpack-compose';
import { useState } from 'react';

import { M3MenuRow } from '@/components/material/list';
import { M3Icon } from '@/components/material/icon';

import type { ComputerPickerProps } from './computer-picker';

export type { ComputerPickerProps };

export function ComputerPicker({
  labels,
  selectedIndex,
  onSelect,
  compact = false,
}: ComputerPickerProps) {
  const [open, setOpen] = useState(false);
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
        </DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  );
}
