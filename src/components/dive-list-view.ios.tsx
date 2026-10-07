// AI-generated (Claude)
// The dive list, iOS variant: a real SwiftUI List, one Section per trip.
//
// Every row leads with the dive number in a fixed-width badge, so the numbers
// line up down the list and never get truncated away with a long site name.
// Depth and duration sit stacked on the trailing edge for the same reason.
//
// Rows are plain-styled Buttons rather than tap gestures so they get the
// system's row highlight and accessibility behaviour for free. Swiping a row
// from the trailing edge offers Delete; the screen confirms before anything is
// removed, so the button has no destructive role - that role makes SwiftUI
// animate the row away before the user has answered. Everything shown
// comes from the presentation model in src/models/dive-list.ts - no formatting
// decisions are made here.
//
// The loading skeleton is the same List drawn over stand-in rows with SwiftUI's
// placeholder redaction, so it has the exact shape of the list it stands for.
import {
  Button,
  HStack,
  Host,
  Image,
  List,
  Section,
  Spacer,
  SwipeActions,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  accessibilityLabel,
  background,
  buttonStyle,
  disabled,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  listStyle,
  monospacedDigit,
  redacted,
  shapes,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import type { DiveListViewProps } from './dive-list-view';
import { ratingStars, sectionSubtitle, skeletonRows, toDiveRow, type DiveRow } from '@/models/dive-list';

export type { DiveListViewProps };

const ACCENT = '#007AFF';
const ACCENT_FILL = '#007AFF1F';
const DESTRUCTIVE = '#FF3B30';
const STAR = '#FFB300';
const SECONDARY = { type: 'hierarchical', style: 'secondary' } as const;
const TERTIARY = { type: 'hierarchical', style: 'tertiary' } as const;

function DiveRowContent({ row }: { row: DiveRow }) {
  const stars = ratingStars(row.rating).length;
  return (
    <HStack spacing={12} alignment="center">
      <Text
        modifiers={[
          font({ textStyle: 'subheadline', weight: 'semibold', design: 'rounded' }),
          monospacedDigit(),
          lineLimit(1),
          foregroundStyle(ACCENT),
          frame({ minWidth: 44, minHeight: 32 }),
          background(ACCENT_FILL, shapes.roundedRectangle({ cornerRadius: 8 })),
        ]}>
        {row.badgeText}
      </Text>
      <VStack spacing={3} alignment="leading">
        <Text modifiers={[font({ textStyle: 'body', weight: 'semibold' }), lineLimit(1)]}>
          {row.title}
        </Text>
        <Text
          modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle(SECONDARY), lineLimit(1)]}>
          {`${row.dateText}, ${row.timeText}`}
        </Text>
        {stars > 0 || row.invalid ? (
          <HStack spacing={2}>
            {Array.from({ length: stars }, (_, i) => (
              <Image key={i} systemName="star.fill" size={10} color={STAR} />
            ))}
            {row.invalid ? (
              <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(SECONDARY)]}>
                {stars > 0 ? '  invalid' : 'invalid'}
              </Text>
            ) : null}
          </HStack>
        ) : null}
      </VStack>
      <Spacer />
      <VStack spacing={3} alignment="trailing">
        {row.depthText !== '' ? (
          <Text modifiers={[font({ textStyle: 'body', weight: 'medium' }), monospacedDigit()]}>
            {row.depthText}
          </Text>
        ) : null}
        {row.durationText !== '' ? (
          <Text
            modifiers={[
              font({ textStyle: 'subheadline' }),
              monospacedDigit(),
              foregroundStyle(SECONDARY),
            ]}>
            {row.durationText}
          </Text>
        ) : null}
      </VStack>
      <Image systemName="chevron.right" size={12} color="#C4C4C7" />
    </HStack>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <VStack spacing={2} alignment="leading">
      <Text modifiers={[font({ textStyle: 'headline' })]}>{title}</Text>
      <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(TERTIARY)]}>{subtitle}</Text>
    </VStack>
  );
}

export function DiveListView({
  sections,
  unitSystem,
  onSelectDive,
  onDeleteDive,
}: DiveListViewProps) {
  return (
    <Host style={{ flex: 1 }}>
      <List modifiers={[listStyle('insetGrouped')]}>
        {sections.map((section) => (
          <Section
            key={section.key}
            header={<SectionHeader title={section.title} subtitle={sectionSubtitle(section)} />}>
            {section.dives.map((dive) => {
              const row = toDiveRow(dive, unitSystem);
              return (
                <SwipeActions key={row.id}>
                  <Button
                    onPress={() => onSelectDive(row.id)}
                    modifiers={[
                      buttonStyle('plain'),
                      // The row's own texts are shorthand (a bare "12", a run of
                      // star images, "20.1 m" over "42:15"); VoiceOver reads the
                      // sentence from the presentation model instead.
                      accessibilityLabel(row.accessibilityLabel),
                    ]}>
                    <DiveRowContent row={row} />
                  </Button>
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
