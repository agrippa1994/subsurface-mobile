// AI-generated (Claude)
// "Dive Activity": dives per month over the last twelve months.
//
// Home screen: small (this year's count against last year's), medium (the
// bars), large (the bars and the year in figures). The layout function runs
// inside the widget extension - see the note in last-dive.tsx.
import { Chart, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import { PlatformColor } from 'react-native';

import type { ActivityWidgetProps } from '@/models/widgets';

const DiveActivityWidget = (props: ActivityWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const family = environment.widgetFamily ?? 'systemMedium';
  const accent = '#0A84FF';
  const muted = '#0A84FF66';
  const background = containerBackground(PlatformColor('systemBackground'), 'widget');
  const fill = frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' });
  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
  const link = widgetURL(props.url);
  const lastIndex = props.months.length - 1;
  // The current month in full colour, the eleven before it lighter.
  const bars = props.months.map((month, index) => ({
    x: month.label,
    y: month.dives,
    color: index === lastIndex ? accent : muted,
  }));
  const anyDives = props.months.some((month) => month.dives > 0);

  const caption = (
    <HStack spacing={4}>
      <Image systemName="chart.bar.fill" size={11} color={accent} />
      <Text
        modifiers={[font({ textStyle: 'caption2', weight: 'semibold' }), foregroundStyle(accent)]}
      >
        {props.text.caption}
      </Text>
    </HStack>
  );

  const yearCount = (size: number) => (
    <HStack alignment="firstTextBaseline" spacing={4}>
      <Text
        modifiers={[
          font({ size, weight: 'bold', design: 'rounded' }),
          minimumScaleFactor(0.5),
          lineLimit(1),
        ]}
      >
        {String(props.thisYear)}
      </Text>
      <Text
        modifiers={[
          font({ textStyle: 'subheadline', weight: 'semibold' }),
          secondary,
          lineLimit(1),
        ]}
      >
        {props.text.inYear}
      </Text>
    </HStack>
  );

  const comparison = (
    <Text modifiers={[font({ textStyle: 'caption', weight: 'medium' }), secondary, lineLimit(1)]}>
      {props.text.comparison}
    </Text>
  );

  const chart = anyDives ? (
    <Chart
      type="bar"
      data={bars}
      showGrid={family !== 'systemMedium'}
      barStyle={{ cornerRadius: 3 }}
    />
  ) : (
    <VStack modifiers={[frame({ maxWidth: 10000, maxHeight: 10000 })]}>
      <Text modifiers={[font({ textStyle: 'caption' }), secondary]}>
        {props.text.none}
      </Text>
    </VStack>
  );

  if (family === 'systemSmall') {
    return (
      <VStack alignment="leading" spacing={2} modifiers={[fill, background, link]}>
        {caption}
        <Spacer />
        {yearCount(40)}
        {comparison}
        <Text modifiers={[font({ textStyle: 'caption' }), secondary, lineLimit(1)]}>
          {props.text.hoursIn12}
        </Text>
      </VStack>
    );
  }

  if (family === 'systemMedium') {
    return (
      <HStack spacing={14} modifiers={[fill, background, link]}>
        <VStack
          alignment="leading"
          spacing={2}
          modifiers={[
            frame({ width: 110, alignment: 'topLeading' }),
            frame({ maxHeight: 10000, alignment: 'topLeading' }),
          ]}
        >
          {caption}
          <Spacer />
          {yearCount(34)}
          {comparison}
        </VStack>
        <VStack spacing={4} modifiers={[frame({ maxWidth: 10000, maxHeight: 10000 })]}>
          {chart}
          <HStack>
            <Text modifiers={[font({ textStyle: 'caption2' }), secondary]}>
              {props.months[0]?.label ?? ''}
            </Text>
            <Spacer />
            <Text modifiers={[font({ textStyle: 'caption2' }), secondary]}>
              {props.months[lastIndex]?.label ?? ''}
            </Text>
          </HStack>
        </VStack>
      </HStack>
    );
  }

  // systemLarge and systemExtraLarge.
  const stat = (label: string, value: string) => (
    <VStack
      alignment="leading"
      spacing={1}
      modifiers={[frame({ maxWidth: 10000, alignment: 'leading' })]}
    >
      <Text modifiers={[font({ textStyle: 'caption2' }), secondary]}>{label}</Text>
      <Text
        modifiers={[
          font({ textStyle: 'headline', design: 'rounded' }),
          lineLimit(1),
          minimumScaleFactor(0.7),
        ]}
      >
        {value}
      </Text>
    </VStack>
  );
  return (
    <VStack alignment="leading" spacing={10} modifiers={[fill, background, link]}>
      {caption}
      {yearCount(40)}
      {comparison}
      <VStack modifiers={[frame({ maxWidth: 10000, maxHeight: 10000 })]}>{chart}</VStack>
      <HStack spacing={8}>
        {stat(props.text.lastYear, String(props.lastYear))}
        {stat(props.text.months12, props.hoursText)}
        {stat(props.text.busiest, props.busiestText !== '' ? props.busiestText : '-')}
      </HStack>
    </VStack>
  );
};

export default createWidget<ActivityWidgetProps>('DiveActivity', DiveActivityWidget);
