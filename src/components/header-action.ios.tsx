// AI-generated (Claude)
// The one action a screen puts at the right of its navigation bar, iOS
// variant: a native toolbar item (liquid glass on iOS 26). The portable
// variant is header-action.tsx.
import { Stack } from 'expo-router';

import type { HeaderActionProps } from './header-action';

export function HeaderAction({ label, icon, done, disabled, onPress }: HeaderActionProps) {
  if (icon) {
    return (
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={icon}
          accessibilityLabel={label}
          disabled={disabled}
          onPress={onPress}
        />
      </Stack.Toolbar>
    );
  }
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button variant={done ? 'done' : undefined} disabled={disabled} onPress={onPress}>
        {label}
      </Stack.Toolbar.Button>
    </Stack.Toolbar>
  );
}
