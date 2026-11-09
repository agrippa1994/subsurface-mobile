// AI-generated (Claude)
// "Logbook Totals": how much diving the logbook holds.
//
// Configurable: editing the widget picks the period - all dives, this year, or
// the last twelve months. The props carry all three, so changing the choice
// needs nothing from the app.
//
// Home screen: small, medium, large. Lock Screen: circular (a gauge towards
// the next round dive count), rectangular, inline. The layout function runs
// inside the widget extension - see the note in last-dive.tsx.
import {
  AccessoryWidgetBackground,
  Gauge,
  HStack,
  Image,
  Spacer,
  Text,
  VStack,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  gaugeStyle,
  lineLimit,
  minimumScaleFactor,
  tint,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import { PlatformColor } from 'react-native';

import type { TotalsPeriodKey, TotalsWidgetProps } from '@/models/widgets';

export type LogbookTotalsConfiguration = { period: TotalsPeriodKey };

const LogbookTotalsWidget = (
  props: TotalsWidgetProps,
  environment: WidgetEnvironment<LogbookTotalsConfiguration>,
) => {
  'widget';
  const family = environment.widgetFamily ?? 'systemSmall';
  const key = environment.configuration?.period ?? 'all';
  const period = props.periods[key] ?? props.periods.all;
  const link = widgetURL(props.url);
  const accent = '#0A84FF';
  const divesWord = period.dives === 1 ? 'dive' : 'dives';

  if (family === 'accessoryInline') {
    return (
      <Text
        modifiers={[link]}
      >{`${period.dives} ${divesWord}, ${period.hoursText} underwater`}</Text>
    );
  }

  if (family === 'accessoryCircular') {
    // Towards the next round number, whatever period the widget is set to: a
    // milestone is about the whole logbook.
    return (
      <ZStack modifiers={[containerBackground('clear', 'widget'), link]}>
        <AccessoryWidgetBackground />
        <Gauge
          value={props.totalDives}
          min={props.previousMilestone}
          max={props.nextMilestone}
          currentValueLabel={
            <Text modifiers={[font({ weight: 'bold', design: 'rounded' })]}>
              {String(props.totalDives)}
            </Text>
          }
          modifiers={[gaugeStyle('circularCapacity')]}
        >
          <Image systemName="water.waves" />
        </Gauge>
      </ZStack>
    );
  }

  if (family === 'accessoryRectangular') {
    return (
      <VStack
        alignment="leading"
        spacing={1}
        modifiers={[
          frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'leading' }),
          containerBackground('clear', 'widget'),
          link,
        ]}
      >
        <Text modifiers={[font({ textStyle: 'headline' }), lineLimit(1)]}>
          {`${period.dives} ${divesWord}`}
        </Text>
        <Text modifiers={[font({ textStyle: 'body', design: 'rounded' }), lineLimit(1)]}>
          {`${period.hoursText}, deepest ${period.deepestText}`}
        </Text>
        <Text modifiers={[font({ textStyle: 'caption' }), lineLimit(1)]}>{period.label}</Text>
      </VStack>
    );
  }

  const background = containerBackground(PlatformColor('systemBackground'), 'widget');
  const fill = frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' });
  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

  const caption = (
    <HStack spacing={4}>
      <Image systemName="book.closed.fill" size={11} color={accent} />
      <Text
        modifiers={[
          font({ textStyle: 'caption2', weight: 'semibold' }),
          foregroundStyle(accent),
          lineLimit(1),
        ]}
      >
        {period.label.toUpperCase()}
      </Text>
    </HStack>
  );

  const count = (
    <HStack alignment="firstTextBaseline" spacing={4}>
      <Text
        modifiers={[
          font({ size: family === 'systemSmall' ? 40 : 46, weight: 'bold', design: 'rounded' }),
          minimumScaleFactor(0.5),
          lineLimit(1),
        ]}
      >
        {String(period.dives)}
      </Text>
      <Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' }), secondary]}>
        {divesWord}
      </Text>
    </HStack>
  );

  const figure = (
    symbol:
      | 'clock'
      | 'arrow.down.to.line'
      | 'timer'
      | 'gauge.with.dots.needle.33percent'
      | 'mappin.and.ellipse',
    label: string,
    value: string,
  ) => (
    <HStack spacing={6} modifiers={[frame({ maxWidth: 10000, alignment: 'leading' })]}>
      <Image systemName={symbol} size={13} color={accent} modifiers={[frame({ width: 18 })]} />
      <VStack alignment="leading" spacing={0}>
        <Text modifiers={[font({ textStyle: 'caption2' }), secondary, lineLimit(1)]}>{label}</Text>
        <Text
          modifiers={[
            font({ textStyle: 'subheadline', weight: 'semibold', design: 'rounded' }),
            lineLimit(1),
            minimumScaleFactor(0.7),
          ]}
        >
          {value}
        </Text>
      </VStack>
    </HStack>
  );

  if (family === 'systemSmall') {
    return (
      <VStack alignment="leading" spacing={2} modifiers={[fill, background, link]}>
        {caption}
        <Spacer />
        {count}
        <Text
          modifiers={[font({ textStyle: 'caption', weight: 'medium' }), secondary, lineLimit(1)]}
        >
          {`${period.hoursText} underwater`}
        </Text>
        <Text
          modifiers={[font({ textStyle: 'caption', weight: 'medium' }), secondary, lineLimit(1)]}
        >
          {`Deepest ${period.deepestText}`}
        </Text>
      </VStack>
    );
  }

  const grid = (
    <VStack spacing={10}>
      <HStack spacing={8}>
        {figure('clock', 'Underwater', period.hoursText)}
        {figure('arrow.down.to.line', 'Deepest', period.deepestText)}
      </HStack>
      <HStack spacing={8}>
        {figure('timer', 'Longest', period.longestText)}
        {figure('gauge.with.dots.needle.33percent', 'Avg depth', period.averageDepthText)}
      </HStack>
    </VStack>
  );

  if (family === 'systemMedium') {
    return (
      <HStack spacing={16} modifiers={[fill, background, link]}>
        <VStack
          alignment="leading"
          spacing={2}
          modifiers={[frame({ maxHeight: 10000, alignment: 'topLeading' })]}
        >
          {caption}
          <Spacer />
          {count}
          <Text modifiers={[font({ textStyle: 'caption' }), secondary, lineLimit(1)]}>
            {`${period.sites} ${period.sites === 1 ? 'site' : 'sites'}`}
          </Text>
        </VStack>
        <VStack modifiers={[frame({ maxWidth: 10000, maxHeight: 10000 })]}>{grid}</VStack>
      </HStack>
    );
  }

  // systemLarge and systemExtraLarge.
  const toGo = props.nextMilestone - props.totalDives;
  return (
    <VStack alignment="leading" spacing={14} modifiers={[fill, background, link]}>
      {caption}
      {count}
      {grid}
      {figure('mappin.and.ellipse', 'Dive sites', String(period.sites))}
      {period.deepestWhere !== '' ? (
        <Text modifiers={[font({ textStyle: 'caption' }), secondary, lineLimit(2)]}>
          {`Deepest dive: ${period.deepestWhere}`}
        </Text>
      ) : null}
      <Spacer />
      <VStack alignment="leading" spacing={4}>
        <HStack>
          <Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' })]}>
            {`Next milestone: ${props.nextMilestone} dives`}
          </Text>
          <Spacer />
          <Text modifiers={[font({ textStyle: 'caption' }), secondary]}>{`${toGo} to go`}</Text>
        </HStack>
        <Gauge
          value={props.totalDives}
          min={props.previousMilestone}
          max={props.nextMilestone}
          modifiers={[gaugeStyle('linearCapacity'), tint(accent)]}
        />
      </VStack>
    </VStack>
  );
};

export default createWidget<TotalsWidgetProps, LogbookTotalsConfiguration>(
  'LogbookTotals',
  LogbookTotalsWidget,
);
