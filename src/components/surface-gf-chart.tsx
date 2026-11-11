// AI-generated (Claude)
// Surface GF over time: the timeline chart of the surface GF screen, and the
// sparkline of the dive list's card on Android and the web (iOS draws its own
// with Swift Charts).
//
// Skia draws the marks, React Native text the labels, as in the profile chart
// (profile-chart.tsx): labels then follow the platform font and Dynamic Type.
// Every number comes from src/models/surface-gf.ts.
//
// A one-finger drag or a tap moves the time cursor; the screen shows the GF at
// the cursor above the chart. The callbacks run on the JS thread: a move only
// redraws two marks, and the screen's readout is React state anyway.
import { Canvas, Circle, DashPathEffect, Line, Path, Skia, vec } from '@shopify/react-native-skia';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { ChartColors } from '@/constants/chart-theme';
import { useTheme } from '@/hooks/use-theme';
import { formatInstantTime } from '@/models/date-format';
import {
  gfAt,
  hourTicks,
  samplePoints,
  type SurfaceGfTimeline,
} from '@/models/surface-gf';
import { t } from '@/i18n';

const PAD = { left: 36, right: 12, top: 12, bottom: 22 };
/** Points per drawn curve; the series is up to 4320 values. */
const CURVE_POINTS = 240;
const GF_TICKS = [0, 25, 50, 75, 100, 125, 150];

export type SurfaceGfChartProps = {
  timeline: SurfaceGfTimeline;
  fromMs: number;
  toMs: number;
  /** Top of the GF axis, percent. */
  yMax: number;
  nowMs: number;
  cursorMs: number;
  onCursorChange: (ms: number) => void;
  plannedMs: number | null;
  gfHigh: number;
  height?: number;
  accessibilityLabel: string;
};

export function SurfaceGfChart({
  timeline,
  fromMs,
  toMs,
  yMax,
  nowMs,
  cursorMs,
  onCursorChange,
  plannedMs,
  gfHigh,
  height = 220,
  accessibilityLabel,
}: SurfaceGfChartProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = ChartColors[scheme];
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const plotWidth = Math.max(1, width - PAD.left - PAD.right);
  const plotHeight = Math.max(1, height - PAD.top - PAD.bottom);

  const xOf = useCallback(
    (ms: number) => PAD.left + ((ms - fromMs) / (toMs - fromMs)) * plotWidth,
    [fromMs, toMs, plotWidth],
  );
  const yOf = useCallback(
    (gf: number) => PAD.top + plotHeight - (Math.min(gf, yMax) / yMax) * plotHeight,
    [plotHeight, yMax],
  );

  const paths = useMemo(() => {
    if (width === 0) {
      return null;
    }
    const points = samplePoints(timeline, fromMs, toMs, CURVE_POINTS);
    const line = Skia.PathBuilder.Make();
    const area = Skia.PathBuilder.Make();
    points.forEach((point, index) => {
      const x = xOf(point.ms);
      const y = yOf(point.y);
      if (index === 0) {
        line.moveTo(x, y);
        area.moveTo(x, yOf(0));
        area.lineTo(x, y);
      } else {
        line.lineTo(x, y);
        area.lineTo(x, y);
      }
    });
    if (points.length > 0) {
      area.lineTo(xOf(points[points.length - 1].ms), yOf(0));
      area.close();
    }
    const grid = Skia.PathBuilder.Make();
    for (const tick of GF_TICKS.filter((value) => value <= yMax)) {
      grid.moveTo(PAD.left, yOf(tick));
      grid.lineTo(PAD.left + plotWidth, yOf(tick));
    }
    return { line: line.build(), area: area.build(), grid: grid.build() };
  }, [timeline, fromMs, toMs, width, xOf, yOf, yMax, plotWidth]);

  const ticks = useMemo(() => hourTicks(fromMs, toMs), [fromMs, toMs]);

  const moveTo = useCallback(
    (x: number) => {
      const fraction = Math.min(1, Math.max(0, (x - PAD.left) / plotWidth));
      onCursorChange(Math.round(fromMs + fraction * (toMs - fromMs)));
    },
    [fromMs, toMs, plotWidth, onCursorChange],
  );

  const gesture = useMemo(() => {
    const drag = Gesture.Pan()
      .runOnJS(true)
      .maxPointers(1)
      // Up or down is the page scrolling.
      .activeOffsetX([-6, 6])
      .failOffsetY([-10, 10])
      .onBegin((event) => moveTo(event.x))
      .onUpdate((event) => moveTo(event.x));
    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd((event) => moveTo(event.x));
    return Gesture.Exclusive(drag, tap);
  }, [moveTo]);

  const inWindow = (ms: number | null): ms is number => ms !== null && ms >= fromMs && ms <= toMs;
  const cursorGf = gfAt(timeline, cursorMs);
  const bottom = PAD.top + plotHeight;

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={{ height }}
        collapsable={false}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={t('ui.dragToMoveTheTimeSwipe')}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          const step = event.nativeEvent.actionName === 'increment' ? 15 * 60_000 : -15 * 60_000;
          onCursorChange(Math.min(toMs, Math.max(fromMs, cursorMs + step)));
        }}>
        {paths ? (
          <Canvas style={StyleSheet.absoluteFill}>
            <Path path={paths.grid} style="stroke" strokeWidth={1} color={colors.grid} />
            <Path path={paths.area} style="fill" color={colors.gfSurface} opacity={0.18} />
            <Path path={paths.line} style="stroke" strokeWidth={2.5} color={colors.gfSurface} />
            {gfHigh <= yMax ? (
              <Line
                p1={vec(PAD.left, yOf(gfHigh))}
                p2={vec(PAD.left + plotWidth, yOf(gfHigh))}
                color={theme.warning}
                strokeWidth={1.5}>
                <DashPathEffect intervals={[6, 4]} />
              </Line>
            ) : null}
            {inWindow(nowMs) ? (
              <Line
                p1={vec(xOf(nowMs), PAD.top)}
                p2={vec(xOf(nowMs), bottom)}
                color={theme.textSecondary}
                strokeWidth={1}>
                <DashPathEffect intervals={[3, 3]} />
              </Line>
            ) : null}
            {inWindow(plannedMs) ? (
              <Line
                p1={vec(xOf(plannedMs), PAD.top)}
                p2={vec(xOf(plannedMs), bottom)}
                color={colors.depth}
                strokeWidth={2}
              />
            ) : null}
            {inWindow(cursorMs) ? (
              <>
                <Line
                  p1={vec(xOf(cursorMs), PAD.top)}
                  p2={vec(xOf(cursorMs), bottom)}
                  color={theme.text}
                  strokeWidth={1}
                />
                {cursorGf !== null ? (
                  <Circle cx={xOf(cursorMs)} cy={yOf(cursorGf)} r={5} color={colors.gfSurface} />
                ) : null}
              </>
            ) : null}
          </Canvas>
        ) : null}

        {width > 0
          ? GF_TICKS.filter((value) => value <= yMax).map((value) => (
              <Text
                key={`y${value}`}
                style={[styles.yLabel, { top: yOf(value) - 8, color: theme.textSecondary }]}>
                {`${value}`}
              </Text>
            ))
          : null}
        {width > 0
          ? ticks.map((tick) => (
              <Text
                key={`x${tick}`}
                style={[styles.xLabel, { left: xOf(tick) - 24, top: bottom + 4, color: theme.textSecondary }]}>
                {formatInstantTime(tick)}
              </Text>
            ))
          : null}
        {width > 0 && inWindow(nowMs) ? (
          <Text style={[styles.marker, { left: xOf(nowMs) + 3, color: theme.textSecondary }]}>{t('charts.now')}</Text>
        ) : null}
        {width > 0 && inWindow(plannedMs) ? (
          <Text style={[styles.marker, { left: xOf(plannedMs) + 3, top: 26, color: colors.depth }]}>
            {t('ui.entry')}
          </Text>
        ) : null}
        {width > 0 && gfHigh <= yMax ? (
          <Text
            style={[styles.marker, { right: PAD.right + 2, left: undefined, top: yOf(gfHigh) - 16, color: theme.warning }]}>
            {t('charts.gfHigh', { value: gfHigh })}
          </Text>
        ) : null}
      </View>
    </GestureDetector>
  );
}

/** A small curve for the card: the shape of the next hours, now as a dot. */
export function SurfaceGfSparkline({
  points,
  nowX,
  width = 120,
  height = 44,
}: {
  points: readonly { x: number; y: number }[];
  nowX: number;
  width?: number;
  height?: number;
}) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = ChartColors[scheme];
  const yMax = Math.max(25, ...points.map((point) => point.y));
  const path = useMemo(() => {
    const builder = Skia.PathBuilder.Make();
    points.forEach((point, index) => {
      const x = point.x * (width - 4) + 2;
      const y = height - 2 - (point.y / yMax) * (height - 4);
      if (index === 0) {
        builder.moveTo(x, y);
      } else {
        builder.lineTo(x, y);
      }
    });
    return builder.build();
  }, [points, width, height, yMax]);
  const nowY = (() => {
    const near = points.reduce<{ x: number; y: number } | null>(
      (best, point) => (best === null || Math.abs(point.x - nowX) < Math.abs(best.x - nowX) ? point : best),
      null,
    );
    return near ? height - 2 - (near.y / yMax) * (height - 4) : height - 2;
  })();
  return (
    <View style={{ width, height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Canvas style={{ width, height }}>
        <Path path={path} style="stroke" strokeWidth={2} color={colors.gfSurface} />
        <Circle cx={nowX * (width - 4) + 2} cy={nowY} r={3.5} color={colors.gfSurface} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  yLabel: {
    position: 'absolute',
    left: 0,
    width: PAD.left - 6,
    textAlign: 'right',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  xLabel: {
    position: 'absolute',
    width: 48,
    textAlign: 'center',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  marker: {
    position: 'absolute',
    top: PAD.top,
    fontSize: 11,
    fontWeight: '600',
  },
});
