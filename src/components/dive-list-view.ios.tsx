// AI-generated (Claude)
// The dive list, iOS variant: a real SwiftUI List, one Section per trip.
//
// Rows are plain-styled Buttons rather than tap gestures so they get the
// system's row highlight and accessibility behaviour for free. Everything shown
// comes from the presentation model in src/models/dive-list.ts - no formatting
// decisions are made here.
import { Button, HStack, Host, Image, List, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, font, foregroundColor, listStyle } from '@expo/ui/swift-ui/modifiers';

import type { DiveListViewProps } from './dive-list-view';
import { ratingStars, sectionSubtitle, toDiveRow } from '@/models/dive-list';

export type { DiveListViewProps };

const SECONDARY = '#8E8E93';

export function DiveListView({ sections, unitSystem, onSelectDive }: DiveListViewProps) {
  return (
    <Host style={{ flex: 1 }}>
      <List modifiers={[listStyle('insetGrouped')]}>
        {sections.map((section) => (
          <Section
            key={section.key}
            header={
              <VStack spacing={2} alignment="leading">
                <Text modifiers={[font({ textStyle: 'headline' })]}>{section.title}</Text>
                <Text modifiers={[font({ textStyle: 'caption' }), foregroundColor(SECONDARY)]}>
                  {sectionSubtitle(section)}
                </Text>
              </VStack>
            }>
            {section.dives.map((dive) => {
              const row = toDiveRow(dive, unitSystem);
              const stars = ratingStars(row.rating).length;
              return (
                <Button
                  key={row.id}
                  onPress={() => onSelectDive(row.id)}
                  modifiers={[buttonStyle('plain')]}>
                  <HStack spacing={12} alignment="center">
                    <VStack spacing={2} alignment="leading">
                      <Text modifiers={[font({ textStyle: 'body', weight: 'semibold' })]}>
                        {row.title}
                      </Text>
                      <Text
                        modifiers={[font({ textStyle: 'subheadline' }), foregroundColor(SECONDARY)]}>
                        {`${row.dateText} ${row.timeText}`}
                        {row.numberText === '' ? '' : `  ${row.numberText}`}
                      </Text>
                      {stars > 0 ? (
                        <HStack spacing={2}>
                          {Array.from({ length: stars }, (_, i) => (
                            <Image key={i} systemName="star.fill" size={11} color="#FFB300" />
                          ))}
                        </HStack>
                      ) : null}
                    </VStack>
                    <Spacer />
                    <VStack spacing={2} alignment="trailing">
                      <Text modifiers={[font({ textStyle: 'body' })]}>{row.detailText}</Text>
                      {row.invalid ? (
                        <Text
                          modifiers={[font({ textStyle: 'caption' }), foregroundColor(SECONDARY)]}>
                          invalid
                        </Text>
                      ) : null}
                    </VStack>
                    <Image systemName="chevron.right" size={12} color={SECONDARY} />
                  </HStack>
                </Button>
              );
            })}
          </Section>
        ))}
      </List>
    </Host>
  );
}
