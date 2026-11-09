// AI-generated (Claude)
// A trip's summary, notes and dives, iOS variant: a SwiftUI List. The portable
// variant is trip-detail-view.tsx; both take the same props.
import {
  Button,
  Host,
  LabeledContent,
  List,
  Section,
  SwipeActions,
  Text,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  foregroundStyle,
  listStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import type { TripDetailViewProps } from './trip-detail-view';
import { DiveRowContent } from '@/components/dive-row-swift';
import { toDiveRow } from '@/models/dive-list';

export type { TripDetailViewProps };

const SECONDARY = { type: 'hierarchical', style: 'secondary' } as const;

export function TripDetailView({
  summary,
  summaryFooter,
  location,
  notes,
  dives,
  units,
  onEdit,
  onSelectDive,
  onRemoveDive,
  onUngroup,
}: TripDetailViewProps) {
  const text = notes.trim();
  return (
    <Host style={{ flex: 1 }}>
      <List modifiers={[listStyle('insetGrouped')]}>
        <Section
          title="Summary"
          footer={summaryFooter ? <Text>{summaryFooter}</Text> : undefined}>
          {location.trim() === '' ? (
            <Button label="Add a Location" systemImage="mappin" onPress={onEdit} />
          ) : null}
          {summary.map((row) => (
            <LabeledContent key={row.label} label={row.label}>
              <Text modifiers={[foregroundStyle(SECONDARY)]}>{row.value}</Text>
            </LabeledContent>
          ))}
        </Section>

        <Section title="Notes">
          {text !== '' ? (
            <Text>{text}</Text>
          ) : (
            <Button label="Add Notes" systemImage="square.and.pencil" onPress={onEdit} />
          )}
        </Section>

        <Section title="Dives">
          {dives.map((dive) => {
            const row = toDiveRow(dive, units);
            return (
              <SwipeActions key={row.id}>
                <Button
                  onPress={() => onSelectDive(row.id)}
                  modifiers={[accessibilityLabel(row.accessibilityLabel)]}>
                  <DiveRowContent row={row} />
                </Button>
                <SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
                  <Button
                    label="Remove"
                    systemImage="minus.circle"
                    onPress={() => onRemoveDive(dive)}
                    modifiers={[tint('#FF9500')]}
                  />
                </SwipeActions.Actions>
              </SwipeActions>
            );
          })}
        </Section>

        <Section
          footer={<Text>The trip goes away. Its dives stay in your logbook.</Text>}>
          <Button label="Ungroup Trip" role="destructive" onPress={onUngroup} />
        </Section>
      </List>
    </Host>
  );
}
