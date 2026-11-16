// AI-generated (Claude)
// Useful questions and the way to a chart of one's own, as a native list.
import { Button, Form, Host, HStack, Image, Section, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, lineLimit } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useExploreScreen } from '@/features/statistics/use-explore-screen';
import { t } from '@/i18n';

const ACCENT = '#007AFF';
// On the row, as in dive-row-swift.tsx: a Button's tint would turn its content blue.
const LABEL = PlatformColor('label');
const SECONDARY = { type: 'hierarchical', style: 'secondary' } as const;

function Row({
  icon,
  title,
  detail,
  onPress,
}: {
  icon: string;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Button onPress={onPress}>
      <HStack spacing={12} alignment="center" modifiers={[foregroundStyle(LABEL)]}>
        <Image
          systemName={icon as SFSymbol}
          size={22}
          color={ACCENT}
          modifiers={[frame({ width: 30 })]}
        />
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[lineLimit(2)]}>{title}</Text>
          <Text modifiers={[font({ textStyle: 'footnote' }), foregroundStyle(SECONDARY), lineLimit(2)]}>{detail}</Text>
        </VStack>
      </HStack>
    </Button>
  );
}

export default function ExploreScreen() {
  const screen = useExploreScreen();
  return (
    <Host style={{ flex: 1 }} useViewportSizeMeasurement>
      <Form>
        <Section title={t('ui.yourChart')}>
          {screen.last ? (
            <Row icon="chart.xyaxis.line" title={screen.last.title} detail={screen.last.detail} onPress={screen.openLast} />
          ) : null}
          <Row
            icon="slider.horizontal.3"
            title={t('ui.buildYourOwn')}
            detail={t('ui.chooseWhatToCompareAndHow')}
            onPress={screen.build}
          />
        </Section>
        <Section title={t('ui.questions')}>
          {screen.presets.map((preset) => (
            <Row
              key={preset.key}
              icon={preset.icon}
              title={preset.title}
              detail={preset.detail}
              onPress={() => screen.openPreset(preset)}
            />
          ))}
        </Section>
      </Form>
    </Host>
  );
}
