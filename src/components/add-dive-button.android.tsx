// AI-generated (Claude)
// The primary action of the dive list on Android: a floating action button over the
// end of the list, offering the ways a dive gets into the log.
import { Host } from '@/components/material/host';
import {
  DropdownMenu,
  DropdownMenuItem,
  FloatingActionButton,
  Text,
} from '@expo/ui/jetpack-compose';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { HeaderMenuItem } from '@/components/header-action';
import { M3Icon } from '@/components/material/icon';

export const ADD_DIVE_IN_HEADER = false;

export function AddDiveButton({ items }: { items: HeaderMenuItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.place} pointerEvents="box-none">
      <Host matchContents>
        <DropdownMenu expanded={open} onDismissRequest={() => setOpen(false)}>
          <DropdownMenu.Trigger>
            <FloatingActionButton onClick={() => setOpen(true)}>
              <FloatingActionButton.Icon>
                <M3Icon name="add" label="Add dive" />
              </FloatingActionButton.Icon>
            </FloatingActionButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Items>
            {items.map((item) => (
              <DropdownMenuItem
                key={item.label}
                onClick={() => {
                  setOpen(false);
                  item.onPress();
                }}>
                {item.icon ? (
                  <DropdownMenuItem.LeadingIcon>
                    <M3Icon symbol={item.icon} />
                  </DropdownMenuItem.LeadingIcon>
                ) : null}
                <DropdownMenuItem.Text>
                  <Text>{item.label}</Text>
                </DropdownMenuItem.Text>
              </DropdownMenuItem>
            ))}
          </DropdownMenu.Items>
        </DropdownMenu>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  place: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
