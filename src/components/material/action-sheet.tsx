// AI-generated (Claude)
// What a long press offers on Android: a modal bottom sheet of actions. Goes inside
// a Host, next to what it acts on.
import {
  HorizontalDivider,
  ListItem,
  ModalBottomSheet,
  Text,
  useMaterialColors,
} from '@expo/ui/jetpack-compose';
import { clickable, padding } from '@expo/ui/jetpack-compose/modifiers';
import { Fragment } from 'react';

import { M3Icon } from './icon';

export type M3SheetAction = {
  label: string;
  /** An SF Symbol, drawn as its Material Symbol. */
  icon?: string;
  destructive?: boolean;
  /** Draws a divider above, to set a group of actions apart. */
  group?: boolean;
  onPress: () => void;
};

export function M3ActionSheet({
  title,
  actions,
  onDismiss,
}: {
  title?: string;
  actions: readonly M3SheetAction[];
  onDismiss: () => void;
}) {
  const palette = useMaterialColors();
  return (
    <ModalBottomSheet onDismissRequest={onDismiss} skipPartiallyExpanded>
      {title ? (
        <Text
          color={palette.onSurfaceVariant}
          style={{ typography: 'titleSmall' }}
          modifiers={[padding(16, 0, 16, 8)]}>
          {title}
        </Text>
      ) : null}
      {actions.map((action) => {
        const color = action.destructive ? palette.error : palette.onSurface;
        return (
          <Fragment key={action.label}>
            {action.group ? <HorizontalDivider /> : null}
            <ListItem
              colors={{ containerColor: 'transparent' }}
              modifiers={[
                clickable(() => {
                  onDismiss();
                  action.onPress();
                }),
              ]}>
              {action.icon ? (
                <ListItem.LeadingContent>
                  <M3Icon symbol={action.icon} tint={color} />
                </ListItem.LeadingContent>
              ) : null}
              <ListItem.HeadlineContent>
                <Text color={color}>{action.label}</Text>
              </ListItem.HeadlineContent>
            </ListItem>
          </Fragment>
        );
      })}
    </ModalBottomSheet>
  );
}
