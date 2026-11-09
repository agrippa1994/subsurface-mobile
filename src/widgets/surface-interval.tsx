// AI-generated (Claude)
// "Surface Interval": how long since the last dive ended, counting up live.
//
// The count is a SwiftUI relative date, which the system keeps current on its
// own, so the widget needs no timeline and no wake-ups: it is right a minute
// after the dive and a month after it from the one snapshot.
//
// Home screen: small. Lock Screen: circular, rectangular, inline. The layout
// function runs inside the widget extension - see the note in last-dive.tsx.
import {
  AccessoryWidgetBackground,
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
  lineLimit,
  minimumScaleFactor,
  multilineTextAlignment,
  opacity,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { SurfaceIntervalWidgetProps } from '@/models/widgets';

const SurfaceIntervalWidget = (
  props: SurfaceIntervalWidgetProps,
  environment: WidgetEnvironment,
) => {
  'widget';
  const family = environment.widgetFamily ?? 'systemSmall';
  const ended = new Date(props.endedAt);
  const link = widgetURL(props.url);

  if (family === 'accessoryInline') {
    return props.hasDive ? (
      <Text modifiers={[link]} date={ended} dateStyle="relative" />
    ) : (
      <Text modifiers={[link]}>No dives yet</Text>
    );
  }

  if (family === 'accessoryCircular') {
    return (
      <ZStack modifiers={[containerBackground('clear', 'widget'), link]}>
        <AccessoryWidgetBackground />
        <VStack spacing={1}>
          <Image systemName="figure.pool.swim" size={13} />
          {props.hasDive ? (
            <Text
              date={ended}
              dateStyle="offset"
              modifiers={[
                font({ size: 12, weight: 'semibold', design: 'rounded' }),
                multilineTextAlignment('center'),
                minimumScaleFactor(0.5),
                lineLimit(2),
                padding({ horizontal: 3 }),
              ]}
            />
          ) : (
            <Text modifiers={[font({ size: 12, weight: 'semibold' })]}>-</Text>
          )}
        </VStack>
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
        <HStack spacing={4}>
          <Image systemName="figure.pool.swim" size={12} />
          <Text modifiers={[font({ textStyle: 'headline' })]}>Surface interval</Text>
        </HStack>
        {props.hasDive ? (
          <Text
            date={ended}
            dateStyle="relative"
            modifiers={[
              font({ textStyle: 'body', design: 'rounded', weight: 'semibold' }),
              lineLimit(1),
            ]}
          />
        ) : (
          <Text modifiers={[font({ textStyle: 'body' })]}>No dives yet</Text>
        )}
        <Text modifiers={[font({ textStyle: 'caption' }), opacity(0.8), lineLimit(1)]}>
          {props.title}
        </Text>
      </VStack>
    );
  }

  // systemSmall, and anything larger the system asks for.
  const water = {
    type: 'linearGradient' as const,
    colors: ['#0E8FA8', '#06395A'],
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 0.6, y: 1 },
  };
  return (
    <VStack
      alignment="leading"
      spacing={2}
      modifiers={[
        frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' }),
        containerBackground(water, 'widget'),
        link,
      ]}
    >
      <HStack spacing={4}>
        <Image systemName="figure.pool.swim" size={12} color="white" modifiers={[opacity(0.8)]} />
        <Text
          modifiers={[
            font({ textStyle: 'caption2', weight: 'semibold' }),
            foregroundStyle('white'),
            opacity(0.8),
          ]}
        >
          SURFACE INTERVAL
        </Text>
      </HStack>
      <Spacer />
      {props.hasDive ? (
        <Text
          date={ended}
          dateStyle="relative"
          modifiers={[
            font({ size: 24, weight: 'bold', design: 'rounded' }),
            foregroundStyle('white'),
            minimumScaleFactor(0.6),
            lineLimit(2),
          ]}
        />
      ) : (
        <Text modifiers={[font({ textStyle: 'title3', weight: 'bold' }), foregroundStyle('white')]}>
          No dives yet
        </Text>
      )}
      <Text
        modifiers={[
          font({ textStyle: 'caption' }),
          foregroundStyle('white'),
          opacity(0.8),
          lineLimit(1),
        ]}
      >
        {props.hasDive ? `since ${props.title}` : 'Your next dive starts the clock.'}
      </Text>
      {props.dateText !== '' ? (
        <Text
          modifiers={[
            font({ textStyle: 'caption2' }),
            foregroundStyle('white'),
            opacity(0.65),
            lineLimit(1),
          ]}
        >
          {[props.numberText, props.dateText].filter((part) => part !== '').join(', ')}
        </Text>
      ) : null}
    </VStack>
  );
};

export default createWidget<SurfaceIntervalWidgetProps>('SurfaceInterval', SurfaceIntervalWidget);
