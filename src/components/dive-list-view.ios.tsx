// AI-generated (Claude)
// The dive list, iOS variant: a real SwiftUI List, one Section per trip.
//
// Every row leads with the dive number in a fixed-width badge, so the numbers
// line up down the list and never get truncated away with a long site name.
// Depth and duration sit stacked on the trailing edge for the same reason.
//
// Rows are Buttons in the List's default style rather than tap gestures, so
// the whole cell is the tap target and they get the system's row highlight and
// accessibility behaviour for free. That style tints its label with the
// accent colour, so the row content sets the system label colour. Swiping a
// row from the trailing edge offers Delete; the screen confirms before anything
// is removed, so the button has no destructive role - that role makes SwiftUI
// animate the row away before the user has answered. Swiping from the leading
// edge, or a long press, offers the trip actions, and a trip's section header
// leads to the trip. A long press also offers a merge with a neighbouring dive,
// when the core would do one; the screen confirms first. Everything shown comes from the presentation model in src/models/dive-list.ts - no formatting
// decisions are made here.
//
// The loading skeleton is the same List drawn over stand-in rows with SwiftUI's
// placeholder redaction, so it has the exact shape of the list it stands for.
import {
  Button,
  ContextMenu,
  Divider,
  Host,
  HStack,
  Image,
  List,
  Section,
  SwipeActions,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityHidden,
  accessibilityHint,
  accessibilityLabel,
  buttonStyle,
  disabled,
  font,
  foregroundStyle,
  listRowBackground,
  listStyle,
  redacted,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';

import type { DiveListViewProps } from './dive-list-view';
import { DiveRowContent } from '@/components/dive-row-swift';
import { sectionSubtitle, skeletonRows, toDiveRow } from '@/models/dive-list';

export type { DiveListViewProps };

const ACCENT = '#007AFF';
const DESTRUCTIVE = '#FF3B30';
const OPEN_ROW = '#007AFF33';
const LABEL = PlatformColor('label');
const SECONDARY = { type: 'hierarchical', style: 'secondary' } as const;

function SectionHeader({
  title,
  subtitle,
  chevron = false,
}: {
  title: string;
  subtitle: string;
  chevron?: boolean;
}) {
  return (
    <VStack spacing={2} alignment="leading">
      <HStack spacing={4} modifiers={[foregroundStyle(LABEL)]}>
        <Text modifiers={[font({ textStyle: 'headline' })]}>{title}</Text>
        {chevron ? <Image systemName="chevron.right" size={12} color="#8E8E93" /> : null}
      </HStack>
      <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(SECONDARY)]}>{subtitle}</Text>
    </VStack>
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
}: DiveListViewProps) {
  const inSidebar = openDiveId !== undefined;
  return (
    <Host style={{ flex: 1 }}>
      <List modifiers={[listStyle('insetGrouped')]}>
        {resultsText ? (
          <Section
            header={
              <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle(SECONDARY)]}>
                {resultsText}
              </Text>
            }>
            {null}
          </Section>
        ) : null}
        {sections.map((section) => (
          <Section
            key={section.key}
            header={
              // While selecting, the list is about marking dives: a header that
              // navigated away would drop the selection.
              section.tripId !== 0 && !selectedIds ? (
                <Button
                  onPress={() => onOpenTrip(section.tripId)}
                  modifiers={[
                    buttonStyle('plain'),
                    accessibilityLabel(`${section.title}, ${sectionSubtitle(section)}`),
                    accessibilityHint('Opens the trip'),
                  ]}>
                  <SectionHeader
                    title={section.title}
                    subtitle={sectionSubtitle(section)}
                    chevron
                  />
                </Button>
              ) : (
                <SectionHeader title={section.title} subtitle={sectionSubtitle(section)} />
              )
            }>
            {section.dives.map((dive) => {
              const row = toDiveRow(dive, units);
              if (selectedIds) {
                const selected = selectedIds.has(dive.id);
                return (
                  <Button
                    key={row.id}
                    onPress={() => onToggleDive(dive.id)}
                    modifiers={[
                      accessibilityLabel(row.accessibilityLabel),
                      ...(selected ? [accessibilityAddTraits(['isSelected'])] : []),
                    ]}>
                    <DiveRowContent row={row} selected={selected} />
                  </Button>
                );
              }
              const actions = tripActions(dive);
              const merges = mergeActions(dive);
              const swipe = actions.find((action) => action.kind === 'remove') ??
                actions.find((action) => action.kind === 'pick');
              return (
                <SwipeActions key={row.id}>
                  <ContextMenu>
                    <ContextMenu.Items>
                      {actions.map((action) => (
                        <Button
                          key={`${action.kind}-${action.label}`}
                          label={`${action.label}${action.kind === 'pick' ? '...' : ''}`}
                          systemImage={action.symbol}
                          onPress={() => onTripAction(dive, action)}
                        />
                      ))}
                      {merges.length > 0 ? <Divider /> : null}
                      {merges.map((action) => (
                        <Button
                          key={action.kind}
                          label={action.label}
                          systemImage={action.symbol}
                          onPress={() => onMergeAction(dive, action)}
                        />
                      ))}
                      <Divider />
                      <Button
                        label="Select"
                        systemImage="checkmark.circle"
                        onPress={() => onStartSelecting(dive.id)}
                      />
                      <Button
                        label="Delete"
                        systemImage="trash"
                        role="destructive"
                        onPress={() => onDeleteDive(dive)}
                      />
                    </ContextMenu.Items>
                    <ContextMenu.Trigger>
                      <Button
                        onPress={() => onSelectDive(row.id)}
                        modifiers={[
                          // The row's own texts are shorthand (a bare "12", a run of
                          // star images, "20.1 m" over "42:15"); VoiceOver reads the
                          // sentence from the presentation model instead.
                          accessibilityLabel(row.accessibilityLabel),
                          ...(row.id === openDiveId
                            ? [listRowBackground(OPEN_ROW), accessibilityAddTraits(['isSelected'])]
                            : []),
                        ]}>
                        <DiveRowContent row={row} chevron={!inSidebar} />
                      </Button>
                    </ContextMenu.Trigger>
                  </ContextMenu>
                  {swipe ? (
                    <SwipeActions.Actions edge="leading" allowsFullSwipe={false}>
                      <Button
                        label={swipe.kind === 'remove' ? 'Remove' : 'Add to Trip'}
                        systemImage={swipe.symbol}
                        onPress={() => onTripAction(dive, swipe)}
                        modifiers={[tint(ACCENT)]}
                      />
                    </SwipeActions.Actions>
                  ) : null}
                  <SwipeActions.Actions edge="trailing">
                    <Button
                      label="Delete"
                      systemImage="trash"
                      onPress={() => onDeleteDive(dive)}
                      modifiers={[tint(DESTRUCTIVE)]}
                    />
                  </SwipeActions.Actions>
                </SwipeActions>
              );
            })}
          </Section>
        ))}
      </List>
    </Host>
  );
}

/** Shown while the logbook is still being read. */
export function DiveListSkeleton() {
  const rows = skeletonRows();
  return (
    <Host style={{ flex: 1 }}>
      <List
        modifiers={[
          listStyle('insetGrouped'),
          redacted('placeholder'),
          disabled(true),
          accessibilityLabel('Loading dives'),
        ]}>
        <Section header={<SectionHeader title="Trip location" subtitle="8 dives - 12 Mar 2024" />}>
          {rows.map((row) => (
            <VStack key={row.id} modifiers={[accessibilityHidden(true)]}>
              <DiveRowContent row={row} />
            </VStack>
          ))}
        </Section>
      </List>
    </Host>
  );
}
