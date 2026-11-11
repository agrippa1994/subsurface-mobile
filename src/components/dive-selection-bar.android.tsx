// AI-generated (Claude)
// What can be done with the dives marked in the list, on Android: a bottom app bar of
// text buttons, on a tonal surface, above the navigation bar.
import { Host } from '@/components/material/host';
import { Row, Surface, Text, TextButton, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';

import type { DiveSelectionBarProps } from './dive-selection-bar';
import { t } from '@/i18n';

export type { DiveSelectionBarProps };

export function DiveSelectionBar({
  dives,
  onNewTrip,
  onAddToTrip,
  onRemoveFromTrip,
}: DiveSelectionBarProps) {
  const palette = useMaterialColors();
  const none = dives.length === 0;
  return (
    <Host matchContents={{ vertical: true }}>
      <Surface color={palette.surfaceContainer} modifiers={[fillMaxWidth()]}>
        <Row horizontalArrangement="spaceBetween" modifiers={[fillMaxWidth(), padding(8, 4, 8, 4)]}>
          <TextButton enabled={!none} onClick={onNewTrip}>
            <Text>{t('ui.newTrip')}</Text>
          </TextButton>
          <TextButton enabled={!none} onClick={onAddToTrip}>
            <Text>{t('trips.action.add')}</Text>
          </TextButton>
          <TextButton enabled={dives.some((dive) => dive.tripId !== 0)} onClick={onRemoveFromTrip}>
            <Text>{t('ui.remove')}</Text>
          </TextButton>
        </Row>
      </Surface>
    </Host>
  );
}
