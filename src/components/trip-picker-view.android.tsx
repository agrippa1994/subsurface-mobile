// AI-generated (Claude)
// The trip picker's list on Android, in Compose. The portable variant is
// trip-picker-view.tsx; both read the same presentation model.
import { M3ActionRow, M3Footnote, M3Screen, M3Section } from '@/components/material/list';
import { emptyPickerText, tripSubtitle, tripTitle } from '@/models/trips';

import type { TripPickerViewProps } from './trip-picker-view';

export type { TripPickerViewProps };

export function TripPickerView({
  trips,
  hasCandidates,
  searching,
  canRemove,
  onNewTrip,
  onPickTrip,
  onRemove,
}: TripPickerViewProps) {
  return (
    <M3Screen>
      <M3Section>
        <M3ActionRow label="New Trip" icon="plus" onPress={onNewTrip} />
        {canRemove ? (
          <M3ActionRow
            label="Remove from Trip"
            icon="minus.circle"
            destructive
            onPress={onRemove}
          />
        ) : null}
      </M3Section>
      <M3Section title="Trips">
        {trips.length === 0 ? (
          <M3Footnote>{emptyPickerText(hasCandidates, searching)}</M3Footnote>
        ) : (
          trips.map((trip) => (
            <M3ActionRow
              key={trip.id}
              label={tripTitle(trip.location)}
              detail={tripSubtitle(trip)}
              opens
              onPress={() => onPickTrip(trip)}
            />
          ))
        )}
      </M3Section>
    </M3Screen>
  );
}
