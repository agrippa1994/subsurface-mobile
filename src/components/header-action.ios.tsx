// AI-generated (Claude)
// The actions a screen puts at the right of its navigation bar, iOS
// variant: a native toolbar item (liquid glass on iOS 26). The portable
// variant is header-action.tsx.
import { Stack } from 'expo-router';

import { useHistoryMenu } from '@/features/history/use-history-actions';

import type { HeaderActionProps } from './header-action';

/** The way out of a sheet, where the back button would be. */
export function HeaderCancel({ onPress }: { onPress: () => void }) {
  return (
    <Stack.Toolbar placement="left">
      <Stack.Toolbar.Button onPress={onPress}>Cancel</Stack.Toolbar.Button>
    </Stack.Toolbar>
  );
}

export function HeaderAction({ history, ...props }: HeaderActionProps & { history?: boolean }) {
  return <HeaderActions actions={[props]} history={history} />;
}

/**
 * Several actions in one toolbar: a second Stack.Toolbar would replace the first.
 * `history` adds the undo and redo menu, while there is anything to undo or redo.
 */
export function HeaderActions({
  actions,
  history = false,
}: {
  actions: HeaderActionProps[];
  history?: boolean;
}) {
  const menu = useHistoryMenu();
  return (
    <Stack.Toolbar placement="right">
      {history && menu ? (
        <Stack.Toolbar.Menu icon="arrow.uturn.backward" accessibilityLabel="Undo and redo">
          <Stack.Toolbar.MenuAction
            icon="arrow.uturn.backward"
            disabled={!menu.canUndo}
            onPress={menu.undo}>
            {menu.undoTitle}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon="arrow.uturn.forward"
            disabled={!menu.canRedo}
            onPress={menu.redo}>
            {menu.redoTitle}
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      ) : null}
      {actions.map(({ label, icon, done, disabled, items, onPress }) =>
        items ? (
          <Stack.Toolbar.Menu key={label} icon={icon} accessibilityLabel={label}>
            {items.map((item) => (
              <Stack.Toolbar.MenuAction key={item.label} icon={item.icon} onPress={item.onPress}>
                {item.label}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
        ) : icon ? (
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
