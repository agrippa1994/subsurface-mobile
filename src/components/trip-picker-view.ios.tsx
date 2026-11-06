// AI-generated (Claude)
// The trip picker's list, iOS variant: a SwiftUI List in the sheet.
import { Button, Host, HStack, Image, List, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  font,
  foregroundStyle,
  lineLimit,
  listStyle,
} from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';

import type { TripPickerViewProps } from './trip-picker-view';
import { emptyPickerText, tripSubtitle, tripTitle } from '@/models/trips';

export type { TripPickerViewProps };

const LABEL = PlatformColor('label');
const SECONDARY = { type: 'hierarchical', style: 'secondary' } as const;

export function TripPickerView({
  trips,
  hasCandidates,
  searching,
  canRemove,
  onNewTrip,
  onPickTrip,
  onRemove,
}: TripPickerViewProps) {
  const empty = trips.length === 0 ? emptyPickerText(hasCandidates, searching) : null;
  return (
    <Host style={{ flex: 1 }}>
      <List modifiers={[listStyle('insetGrouped')]}>
        <Section>
          <Button label="New Trip" systemImage="plus" onPress={onNewTrip} />
          {canRemove ? (
            <Button
              label="Remove from Trip"
              systemImage="minus.circle"
              role="destructive"
              onPress={onRemove}
            />
          ) : null}
        </Section>
        <Section title={empty ? undefined : 'Nearest first'}>
          {empty ? (
            <Text modifiers={[foregroundStyle(SECONDARY)]}>{empty}</Text>
          ) : (
            trips.map((trip) => (
              <Button
                key={trip.id}
                onPress={() => onPickTrip(trip)}
                modifiers={[accessibilityLabel(`${tripTitle(trip.location)}, ${tripSubtitle(trip)}`)]}>
                <HStack modifiers={[foregroundStyle(LABEL)]}>
                  <VStack spacing={3} alignment="leading">
                    <Text modifiers={[font({ textStyle: 'body', weight: 'semibold' }), lineLimit(1)]}>
                      {tripTitle(trip.location)}
                    </Text>
                    <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle(SECONDARY), lineLimit(1)]}>
                      {tripSubtitle(trip)}
                    </Text>
                  </VStack>
                  <Spacer />
                  <Image systemName="plus.circle" size={20} color="#007AFF" />
                </HStack>
              </Button>
            ))
          )}
        </Section>
      </List>
    </Host>
  );
}
