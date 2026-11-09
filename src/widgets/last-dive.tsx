// AI-generated (Claude)
// "Last Dive": the newest dive in the logbook, with its profile.
//
// Home screen: small (depth, time, site), medium (adds the profile), large
// (profile and the dive's details). Lock Screen: rectangular and inline.
//
// The layout function below is serialized and run inside the widget extension,
// not in the app (see the 'widget' directive): it can use only @expo/ui
// components, its props and its environment. Nothing declared outside it -
// not even a constant in this file - is there when it runs, which is why the
// colours are repeated inside it. The props come from src/models/widgets.ts.
import {
  AccessoryWidgetBackground,
  Chart,
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
  opacity,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { LastDiveWidgetProps } from '@/models/widgets';

const LastDiveWidget = (props: LastDiveWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const family = environment.widgetFamily ?? 'systemSmall';
  // The two ends of the app icon's gradient: the same water as the launch screen.
  const water = {
    type: 'linearGradient' as const,
    colors: ['#146FC4', '#062C53'],
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 0.6, y: 1 },
  };
  const profileColor = '#8FD8FF';
  const link = widgetURL(props.url);

  if (family === 'accessoryInline') {
    return (
      <Text modifiers={[link]}>
        {props.hasDive
          ? `${props.depthText}, ${props.durationText} at ${props.title}`
          : 'No dives yet'}
      </Text>
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
          <Image systemName="water.waves" size={12} />
          <Text modifiers={[font({ textStyle: 'headline' }), lineLimit(1)]}>{props.title}</Text>
        </HStack>
        <Text modifiers={[font({ textStyle: 'body', design: 'rounded', weight: 'semibold' })]}>
          {props.hasDive ? `${props.depthText}  ${props.durationText}` : '-'}
        </Text>
        <Text modifiers={[font({ textStyle: 'caption' }), opacity(0.8), lineLimit(1)]}>
          {[props.numberText, props.dateText].filter((part) => part !== '').join(', ')}
        </Text>
      </VStack>
    );
  }

  if (family === 'accessoryCircular') {
    return (
      <ZStack modifiers={[containerBackground('clear', 'widget'), link]}>
        <AccessoryWidgetBackground />
        <VStack spacing={0}>
          <Image systemName="arrow.down" size={11} />
          <Text
            modifiers={[
              font({ size: 15, weight: 'bold', design: 'rounded' }),
              minimumScaleFactor(0.5),
              lineLimit(1),
              padding({ horizontal: 4 }),
            ]}
          >
            {props.hasDive ? props.depthText : '-'}
          </Text>
        </VStack>
      </ZStack>
    );
  }

  const header = (
    <HStack spacing={4}>
      <Image systemName="water.waves" size={11} color="white" modifiers={[opacity(0.8)]} />
      <Text
        modifiers={[
          font({ textStyle: 'caption2', weight: 'semibold' }),
          foregroundStyle('white'),
          opacity(0.8),
          lineLimit(1),
        ]}
      >
        {props.numberText !== '' ? props.numberText.toUpperCase() : 'LAST DIVE'}
      </Text>
    </HStack>
  );

  const title = (
    <Text
      modifiers={[
        font({ textStyle: 'headline' }),
        foregroundStyle('white'),
        lineLimit(family === 'systemSmall' ? 2 : 1),
      ]}
    >
      {props.title}
    </Text>
  );

  const dateLine = (
    <Text
      modifiers={[
        font({ textStyle: 'caption' }),
        foregroundStyle('white'),
        opacity(0.75),
        lineLimit(family === 'systemSmall' || !props.hasDive ? 2 : 1),
      ]}
    >
      {props.dateText}
    </Text>
  );

  const depth = (
    <Text
      modifiers={[
        font({ size: family === 'systemLarge' ? 40 : 30, weight: 'bold', design: 'rounded' }),
        foregroundStyle('white'),
        minimumScaleFactor(0.6),
        lineLimit(1),
      ]}
    >
      {props.depthText}
    </Text>
  );

  const figures = (
    <Text
      modifiers={[
        font({ textStyle: 'subheadline', weight: 'medium', design: 'rounded' }),
        foregroundStyle('white'),
        opacity(0.9),
        lineLimit(1),
        minimumScaleFactor(0.7),
      ]}
    >
      {props.temperatureText !== ''
        ? `${props.durationText}  ${props.temperatureText}`
        : props.durationText}
    </Text>
  );

  const profile =
    props.profile.length > 1 ? (
      <Chart
        type="area"
        data={props.profile}
        showGrid={false}
        areaStyle={{ color: profileColor }}
        modifiers={[opacity(0.9)]}
      />
    ) : (
      <VStack modifiers={[frame({ maxWidth: 10000, maxHeight: 10000 })]}>
        <Image systemName="chart.xyaxis.line" size={28} color="white" modifiers={[opacity(0.4)]} />
      </VStack>
    );

  const background = containerBackground(water, 'widget');
  const fill = frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' });

  if (family === 'systemSmall' || !props.hasDive) {
    return (
      <VStack alignment="leading" spacing={2} modifiers={[fill, background, link]}>
        {header}
        {title}
        <Spacer />
        {props.hasDive ? depth : null}
        {props.hasDive ? figures : null}
        {dateLine}
      </VStack>
    );
  }

  if (family === 'systemMedium') {
    return (
      <HStack spacing={12} modifiers={[fill, background, link]}>
        <VStack
          alignment="leading"
          spacing={2}
          modifiers={[frame({ maxHeight: 10000, alignment: 'topLeading' })]}
        >
          {header}
          {title}
          {dateLine}
          <Spacer />
          {depth}
          {figures}
        </VStack>
        <VStack modifiers={[frame({ maxWidth: 10000, maxHeight: 10000 })]}>{profile}</VStack>
      </HStack>
    );
  }

  // systemLarge and systemExtraLarge.
  const stars = [1, 2, 3, 4, 5].map((star) => (
    <Image
      key={star}
      systemName={star <= props.rating ? 'star.fill' : 'star'}
      size={12}
      color="white"
      modifiers={[opacity(star <= props.rating ? 1 : 0.4)]}
    />
  ));
  const detail = (label: string, value: string) => (
    <VStack
      alignment="leading"
      spacing={1}
      modifiers={[frame({ maxWidth: 10000, alignment: 'leading' })]}
    >
      <Text
        modifiers={[
          font({ textStyle: 'caption2', weight: 'semibold' }),
          foregroundStyle('white'),
          opacity(0.7),
        ]}
      >
        {label.toUpperCase()}
      </Text>
      <Text
        modifiers={[
          font({ textStyle: 'headline', design: 'rounded' }),
          foregroundStyle('white'),
          lineLimit(1),
          minimumScaleFactor(0.7),
        ]}
      >
        {value}
      </Text>
    </VStack>
  );

  return (
    <VStack alignment="leading" spacing={8} modifiers={[fill, background, link]}>
      <VStack alignment="leading" spacing={2}>
        {header}
        {title}
        {dateLine}
      </VStack>
      <VStack modifiers={[frame({ maxWidth: 10000, maxHeight: 10000 })]}>{profile}</VStack>
      <HStack spacing={8}>
        {detail('Max depth', props.depthText)}
        {detail('Duration', props.durationText)}
        {detail('Water', props.temperatureText !== '' ? props.temperatureText : '-')}
      </HStack>
      <HStack spacing={8}>
        {detail('Buddy', props.buddyText !== '' ? props.buddyText : '-')}
        <VStack
          alignment="leading"
          spacing={3}
          modifiers={[frame({ maxWidth: 10000, alignment: 'leading' })]}
        >
          <Text
            modifiers={[
              font({ textStyle: 'caption2', weight: 'semibold' }),
              foregroundStyle('white'),
              opacity(0.7),
            ]}
          >
            RATING
          </Text>
          <HStack spacing={2}>{stars}</HStack>
        </VStack>
      </HStack>
    </VStack>
  );
};

export default createWidget<LastDiveWidgetProps>('LastDive', LastDiveWidget);
