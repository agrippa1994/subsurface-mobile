// AI-generated (Claude)
// The actions in the Android top app bar, as Compose draws them: icon buttons, a text
// button for the action that finishes a form, and dropdown menus. An action with only
// a label and no icon does not fit that bar, so it goes into the overflow menu.
import { Host } from '@/components/material/host';
import {
  DropdownMenu,
  DropdownMenuItem,
  IconButton,
  Row,
  Text,
  TextButton,
} from '@expo/ui/jetpack-compose';
import { Stack } from 'expo-router';
import { useState } from 'react';

import { M3Icon } from '@/components/material/icon';
import { useHistoryMenu } from '@/features/history/use-history-actions';

import type { HeaderActionProps, HeaderMenuItem } from './header-action';

export type { HeaderActionProps, HeaderMenuItem };

/** The way out of a sheet, where the back button would be. */
export function HeaderCancel({ onPress }: { onPress: () => void }) {
  const headerLeft = () => (
    <Host matchContents>
      <IconButton onClick={onPress}>
        <M3Icon name="close" label="Cancel" />
      </IconButton>
    </Host>
  );
  return <Stack.Screen options={{ headerLeft }} />;
}

export function HeaderAction({ history, ...props }: HeaderActionProps & { history?: boolean }) {
  return <HeaderActions actions={[props]} history={history} />;
}

function MenuItems({ items, onChosen }: { items: HeaderMenuItem[]; onChosen: () => void }) {
  return (
    <DropdownMenu.Items>
      {items.map((item) => (
        <DropdownMenuItem
          key={item.label}
          onClick={() => {
            onChosen();
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
  );
}

function ActionMenu({
  label,
  icon,
  name,
  items,
  disabled = false,
}: {
  label: string;
  icon?: string;
  name?: 'more_vert';
  items: HeaderMenuItem[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu expanded={open} onDismissRequest={() => setOpen(false)}>
      <DropdownMenu.Trigger>
        <IconButton enabled={!disabled} onClick={() => setOpen(true)}>
          <M3Icon name={name} symbol={icon} label={label} />
        </IconButton>
      </DropdownMenu.Trigger>
      <MenuItems items={items} onChosen={() => setOpen(false)} />
    </DropdownMenu>
  );
}

function Actions({ actions, history }: { actions: HeaderActionProps[]; history: boolean }) {
  const menu = useHistoryMenu();
  const overflow = actions.filter((action) => !action.icon && !action.done);
  const shown = actions.filter((action) => action.icon || action.done);
  const undoItems: HeaderMenuItem[] =
    history && menu
      ? [
          ...(menu.canUndo ? [{ label: menu.undoTitle, icon: 'arrow.uturn.backward' as const, onPress: menu.undo }] : []),
          ...(menu.canRedo ? [{ label: menu.redoTitle, icon: 'arrow.uturn.forward' as const, onPress: menu.redo }] : []),
        ]
      : [];
  return (
    <Host matchContents>
      <Row verticalAlignment="center">
        {undoItems.length > 0 ? (
          <ActionMenu label="Undo and redo" icon="arrow.uturn.backward" items={undoItems} />
        ) : null}
        {shown.map(({ label, icon, disabled = false, items, onPress }) =>
          items ? (
            <ActionMenu key={label} label={label} icon={icon} items={items} disabled={disabled} />
          ) : icon ? (
            <IconButton key={label} enabled={!disabled} onClick={onPress}>
              <M3Icon symbol={icon} label={label} />
            </IconButton>
          ) : (
            <TextButton key={label} enabled={!disabled} onClick={onPress}>
              <Text>{label}</Text>
            </TextButton>
          ),
        )}
        {overflow.length > 0 ? (
          <ActionMenu
            label="More options"
            name="more_vert"
            items={overflow.map((action) => ({
              label: action.label,
              onPress: action.onPress ?? (() => undefined),
            }))}
          />
        ) : null}
      </Row>
    </Host>
  );
}

/** Several actions side by side. `history` adds an undo button while there is any. */
export function HeaderActions({
  actions,
  history = false,
}: {
  actions: HeaderActionProps[];
  history?: boolean;
}) {
  const headerRight = () => <Actions actions={actions} history={history} />;
  return <Stack.Screen options={{ headerRight }} />;
}
