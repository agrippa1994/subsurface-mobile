// AI-generated (Claude)
// One dive as a SwiftUI row, for the Lists of the iOS screens: the dive list, a
// trip's dives. Only ever imported from .ios files, since @expo/ui/swift-ui does
// not exist elsewhere; the React Native row is dive-row.tsx.
import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  background,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';

import { ratingStars, type DiveRow } from '@/models/dive-list';
import { t } from '@/i18n';

const ACCENT = '#007AFF';
const ACCENT_FILL = '#007AFF1F';
const STAR = '#FFB300';
// The system label colour, not the hierarchical 'primary' style: that one
// resolves against the button's accent tint and would leave the row blue.
const LABEL = PlatformColor('label');
const SECONDARY = { type: 'hierarchical', style: 'secondary' } as const;

/**
 * `selected` is for a list in selection mode: a circle leads the row, and the
 * chevron goes, since a tap now marks the dive rather than opening it. So it does
 * with `chevron` off, in a sidebar, whose dive opens beside it rather than on top.
 */
export function DiveRowContent({
  row,
  selected,
  chevron = true,
}: {
  row: DiveRow;
  selected?: boolean;
  chevron?: boolean;
}) {
  const stars = ratingStars(row.rating).length;
  return (
    <HStack spacing={12} alignment="center" modifiers={[foregroundStyle(LABEL)]}>
      {selected !== undefined ? (
        <Image
          systemName={selected ? 'checkmark.circle.fill' : 'circle'}
          size={22}
          color={selected ? ACCENT : '#C4C4C7'}
        />
      ) : null}
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
          {row.subtitle}
        </Text>
        {stars > 0 || row.invalid || row.planned ? (
          <HStack spacing={2}>
            {Array.from({ length: stars }, (_, i) => (
              <Image key={i} systemName="star.fill" size={10} color={STAR} />
            ))}
            {row.planned ? (
              <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(SECONDARY)]}>
                {`${stars > 0 ? '  ' : ''}${t('diveList.planned')}`}
              </Text>
            ) : null}
            {row.invalid ? (
              <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(SECONDARY)]}>
                {`${stars > 0 || row.planned ? '  ' : ''}${t('diveList.invalid')}`}
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
      {selected === undefined && chevron ? (
        <Image systemName="chevron.right" size={12} color="#C4C4C7" />
      ) : null}
    </HStack>
  );
}
