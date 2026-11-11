// AI-generated (Claude)
// The surface GF card on the iOS dive list: a Section at the top of its SwiftUI
// List. While some compartment is supersaturated it shows the big number, the
// time to 0 %, the time since surfacing and a sparkline (Swift Charts); with
// only residual nitrogen left it collapses to one row; once clean the screen
// leaves it out. A tap opens the timeline. Texts: src/models/surface-gf.ts.
import { Button, Chart, HStack, Image, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityHint,
  accessibilityLabel,
  font,
  foregroundStyle,
  frame,
  monospacedDigit,
} from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import type { SurfaceGfCard } from '@/models/surface-gf';
import { t } from '@/i18n';

const LABEL = PlatformColor('label');
const SECONDARY = { type: 'hierarchical', style: 'secondary' } as const;
const CURVE = '#8f5fd8';

export function SurfaceGfCardView({ card, onOpen }: { card: SurfaceGfCard; onOpen: () => void }) {
  const theme = useTheme();
  const gfColor = card.aboveGfHigh ? theme.warning : LABEL;
  const modifiers = [
    accessibilityLabel(card.accessibilityLabel),
    accessibilityHint(t('ui.opensTheSurfaceGfTimeline')),
  ];

  if (card.phase === 'residual') {
    return (
      <Section>
        <Button onPress={onOpen} modifiers={modifiers}>
          <HStack spacing={12} alignment="center" modifiers={[foregroundStyle(LABEL)]}>
            <Image systemName="chart.line.downtrend.xyaxis" size={22} color={CURVE} />
            <VStack alignment="leading" spacing={2}>
              <Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' })]}>
                {t('surfaceGf.gf', { gf: card.gfText })}
              </Text>
              <Text modifiers={[font({ textStyle: 'footnote' }), foregroundStyle(SECONDARY)]}>
                {card.untilText}
              </Text>
            </VStack>
            <Spacer />
            <Image systemName="chevron.right" size={13} color="#8E8E93" />
          </HStack>
        </Button>
      </Section>
    );
  }

  return (
    <Section
      header={<Text modifiers={[font({ textStyle: 'footnote' })]}>{t('surfaceGfScreen.desaturation')}</Text>}
      footer={card.planned ? undefined : <Text>{t('surfaceGfScreen.modelValue')}</Text>}>
      <Button onPress={onOpen} modifiers={modifiers}>
        <HStack spacing={12} alignment="center" modifiers={[foregroundStyle(LABEL)]}>
          <VStack alignment="leading" spacing={2}>
            <Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' }), foregroundStyle(SECONDARY)]}>
              {t('surfaceGfScreen.caption')}
            </Text>
            <Text
              modifiers={[
                font({ textStyle: 'largeTitle', weight: 'bold', design: 'rounded' }),
                monospacedDigit(),
                foregroundStyle(gfColor),
              ]}>
              {card.gfText}
            </Text>
            <Text modifiers={[font({ textStyle: 'subheadline' }), monospacedDigit()]}>{card.untilText}</Text>
            <Text modifiers={[font({ textStyle: 'footnote' }), monospacedDigit(), foregroundStyle(SECONDARY)]}>
              {card.sinceText}
            </Text>
          </VStack>
          <Spacer />
          <Chart
            type="line"
            data={card.sparkline.map((point) => ({ x: point.x, y: point.y }))}
            showGrid={false}
            lineStyle={{ color: CURVE, width: 2, pointSize: 0 }}
            modifiers={[frame({ width: 104, height: 56 })]}
          />
          <Image systemName="chevron.right" size={13} color="#8E8E93" />
        </HStack>
      </Button>
      {card.planned ? (
        <Button onPress={onOpen} modifiers={[accessibilityLabel(card.planned.accessibilityLabel)]}>
          <HStack spacing={10} alignment="center" modifiers={[foregroundStyle(LABEL)]}>
            <Image systemName="figure.open.water.swim" size={18} color={theme.accent} />
            <VStack alignment="leading" spacing={1}>
              <Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' }), monospacedDigit()]}>
                {t('surfaceGfScreen.nextEntry', { entry: card.planned.gfText })}
              </Text>
              <Text modifiers={[font({ textStyle: 'footnote' }), monospacedDigit(), foregroundStyle(SECONDARY)]}>
                {card.planned.whenText}
              </Text>
            </VStack>
            <Spacer />
          </HStack>
        </Button>
      ) : null}
    </Section>
  );
}
