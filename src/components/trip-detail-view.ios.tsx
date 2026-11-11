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
import { t } from '@/i18n';

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
          title={t('ui.summary')}
          footer={summaryFooter ? <Text>{summaryFooter}</Text> : undefined}>
          {location.trim() === '' ? (
            <Button label={t('ui.addALocation')} systemImage="mappin" onPress={onEdit} />
          ) : null}
          {summary.map((row) => (
            <LabeledContent key={row.label} label={row.label}>
              <Text modifiers={[foregroundStyle(SECONDARY)]}>{row.value}</Text>
            </LabeledContent>
          ))}
        </Section>

        <Section title={t('ui.notes')}>
          {text !== '' ? (
            <Text>{text}</Text>
          ) : (
            <Button label={t('ui.addNotes')} systemImage="square.and.pencil" onPress={onEdit} />
          )}
        </Section>

        <Section title={t('ui.dives')}>
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
                    label={t('ui.remove')}
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
          footer={<Text>{t('ui.theTripGoesAwayItsDives')}</Text>}>
          <Button label={t('ui.ungroupTrip')} role="destructive" onPress={onUngroup} />
        </Section>
      </List>
    </Host>
  );
}
