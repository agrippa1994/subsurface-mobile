// AI-generated (Claude)
// The dive list on Android: a Compose LazyColumn, whose recycled items keep a long log
// quick, with a section heading per trip. A long press offers in a bottom sheet what
// iOS has in its swipe actions and context menu. Both variants take the same props and
// read the same presentation model, so the grouping and formatting cannot diverge.
import { Host } from '@/components/material/host';
import {
  Box,
  Column,
  LazyColumn,
  LinearProgressIndicator,
  Row,
  Text,
  useMaterialColors,
} from '@expo/ui/jetpack-compose';
import {
  clickable,
  fillMaxSize,
  fillMaxWidth,
  padding,
  semantics,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { useMemo, useState } from 'react';

import { M3ActionSheet, type M3SheetAction } from '@/components/material/action-sheet';
import { M3DiveRow } from '@/components/material/dive-row';
import { M3Icon } from '@/components/material/icon';
import type { DiveSummary } from '@/models';
import { diveRowTitle, sectionSubtitle, toDiveRow, type DiveTripSection } from '@/models/dive-list';

import type { DiveListViewProps } from './dive-list-view';
import { t } from '@/i18n';

export type { DiveListViewProps };

/** Room for the floating action button over the end of the list. */
const END_OF_LIST = 88;

type Item =
  | { kind: 'header'; key: string }
  | { kind: 'results'; key: string; text: string }
  | { kind: 'section'; key: string; section: DiveTripSection }
  | { kind: 'dive'; key: string; dive: DiveSummary };

function SectionHeading({
  section,
  onOpen,
}: {
  section: DiveTripSection;
  /** Absent where the heading leads nowhere: no trip, or while selecting. */
  onOpen?: () => void;
}) {
  const palette = useMaterialColors();
  const subtitle = sectionSubtitle(section);
  return (
    <Row
      verticalAlignment="center"
      modifiers={[
        fillMaxWidth(),
        ...(onOpen
          ? [clickable(onOpen), semantics({ contentDescription: t('diveList.sectionSpoken', { title: section.title, subtitle }) })]
          : []),
        padding(16, 16, 16, 8),
      ]}>
      <Column modifiers={[weight(1)]}>
        <Text color={palette.primary} style={{ typography: 'titleSmall' }}>
          {section.title}
        </Text>
        <Text color={palette.onSurfaceVariant} style={{ typography: 'bodySmall' }}>
          {subtitle}
        </Text>
      </Column>
      {onOpen ? <M3Icon symbol="chevron.right" size={20} tint={palette.onSurfaceVariant} /> : null}
    </Row>
  );
}

export function DiveListView({
  sections,
  units,
  onSelectDive,
  onDeleteDive,
  resultsText,
  onOpenTrip,
  tripActions,
  onTripAction,
  selectedIds,
  onToggleDive,
  onStartSelecting,
  mergeActions,
  onMergeAction,
  openDiveId,
  header,
}: DiveListViewProps) {
  const palette = useMaterialColors();
  const [pressed, setPressed] = useState<DiveSummary | null>(null);

  const items = useMemo<Item[]>(
    () => [
      ...(header && !resultsText ? [{ kind: 'header' as const, key: 'header' }] : []),
      ...(resultsText ? [{ kind: 'results' as const, key: 'results', text: resultsText }] : []),
      ...sections.flatMap<Item>((section) => [
        { kind: 'section', key: `section-${section.key}`, section },
        ...section.dives.map((dive): Item => ({ kind: 'dive', key: `dive-${dive.id}`, dive })),
      ]),
    ],
    [header, resultsText, sections],
  );

  const sheetActions = (dive: DiveSummary): M3SheetAction[] => [
    ...tripActions(dive).map((action) => ({
      label: `${action.label}${action.kind === 'pick' ? '...' : ''}`,
      icon: action.symbol,
      onPress: () => onTripAction(dive, action),
    })),
    ...mergeActions(dive).map((action, index) => ({
      label: action.label,
      icon: action.symbol,
      group: index === 0,
      onPress: () => onMergeAction(dive, action),
    })),
    { label: t('ui.select'), icon: 'checkmark.circle', group: true, onPress: () => onStartSelecting(dive.id) },
    { label: t('ui.delete'), icon: 'trash', destructive: true, onPress: () => onDeleteDive(dive) },
  ];

  return (
    <Host style={{ flex: 1, backgroundColor: palette.surface }}>
      <Box modifiers={[fillMaxSize()]}>
        <LazyColumn modifiers={[fillMaxSize()]} contentPadding={{ bottom: END_OF_LIST }}>
          <LazyColumn.Items
            data={items}
            keyExtractor={(item) => item.key}
            estimatedItemSize={72}>
            {({ item }) => {
              switch (item.kind) {
                case 'header':
                  return <>{header}</>;
                case 'results':
                  return (
                    <Text
                      color={palette.onSurfaceVariant}
                      style={{ typography: 'bodySmall' }}
                      modifiers={[padding(16, 8, 16, 0)]}>
                      {item.text}
                    </Text>
                  );
                case 'section':
                  return (
                    <SectionHeading
                      section={item.section}
                      onOpen={
                        item.section.tripId !== 0 && !selectedIds
                          ? () => onOpenTrip(item.section.tripId)
                          : undefined
                      }
                    />
                  );
                case 'dive':
                  return (
                    <M3DiveRow
                      row={toDiveRow(item.dive, units)}
                      selected={selectedIds ? selectedIds.has(item.dive.id) : undefined}
                      open={item.dive.id === openDiveId}
                      onPress={() =>
                        selectedIds ? onToggleDive(item.dive.id) : onSelectDive(item.dive.id)
                      }
                      onLongPress={selectedIds ? undefined : () => setPressed(item.dive)}
                    />
                  );
              }
            }}
          </LazyColumn.Items>
        </LazyColumn>
        {pressed ? (
          <M3ActionSheet
            title={diveRowTitle(pressed)}
            actions={sheetActions(pressed)}
            onDismiss={() => setPressed(null)}
          />
        ) : null}
      </Box>
    </Host>
  );
}

/** Shown while the logbook is still being read. */
export function DiveListSkeleton() {
  const palette = useMaterialColors();
  return (
    <Host style={{ flex: 1, backgroundColor: palette.surface }}>
      <LinearProgressIndicator modifiers={[fillMaxWidth(), semantics({ contentDescription: t('ui.loadingDives') })]} />
    </Host>
  );
}
