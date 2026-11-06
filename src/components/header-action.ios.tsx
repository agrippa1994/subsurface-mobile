// AI-generated (Claude)
// The actions a screen puts at the right of its navigation bar, iOS
// variant: a native toolbar item (liquid glass on iOS 26). The portable
// variant is header-action.tsx.
import { Stack } from 'expo-router';

import type { HeaderActionProps } from './header-action';

export function HeaderAction(props: HeaderActionProps) {
  return <HeaderActions actions={[props]} />;
}

/** Several actions in one toolbar: a second Stack.Toolbar would replace the first. */
export function HeaderActions({ actions }: { actions: HeaderActionProps[] }) {
  return (
    <Stack.Toolbar placement="right">
      {actions.map(({ label, icon, done, disabled, onPress }) =>
        icon ? (
          <Stack.Toolbar.Button
            key={label}
            icon={icon}
            accessibilityLabel={label}
            disabled={disabled}
            onPress={onPress}
          />
        ) : (
          <Stack.Toolbar.Button
            key={label}
            variant={done ? 'done' : undefined}
            disabled={disabled}
            onPress={onPress}>
            {label}
          </Stack.Toolbar.Button>
        ),
      )}
    </Stack.Toolbar>
  );
}
