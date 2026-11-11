// AI-generated (Claude)
// What can be done with the dives marked in the list, iOS variant: a native menu
// in the navigation bar. A bottom toolbar, as in Mail, would sit behind the
// floating tab bar. The portable variant is dive-selection-bar.tsx.
import { Stack } from 'expo-router';

import type { DiveSelectionBarProps } from './dive-selection-bar';
import { t } from '@/i18n';

export function DiveSelectionBar({
  dives,
  onNewTrip,
  onAddToTrip,
  onRemoveFromTrip,
}: DiveSelectionBarProps) {
  return (
    <Stack.Toolbar placement="left">
      <Stack.Toolbar.Menu
        icon="suitcase"
        accessibilityLabel={t('ui.tripActionsForTheSelectedDives')}
        disabled={dives.length === 0}>
        <Stack.Toolbar.MenuAction icon="plus" onPress={onNewTrip}>
          {t('ui.newTrip')}
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction icon="text.badge.plus" onPress={onAddToTrip}>
          {`${t('trips.action.add')}...`}
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction
          icon="minus.circle"
          disabled={!dives.some((dive) => dive.tripId !== 0)}
          onPress={onRemoveFromTrip}>
          {t('ui.removeFromTrip')}
        </Stack.Toolbar.MenuAction>
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );
}
