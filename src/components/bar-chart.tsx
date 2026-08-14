// AI-generated (Claude)
// The bar chart used by every statistics chart.
//
// One series per chart - a count - so there is no legend and no categorical
// cycling: every bar wears the first categorical slot, and only the tapped bar
// changes colour. Skia draws the marks; the axis labels and the readout are
// React Native text on top of the canvas, the same split the profile chart
// uses, so they inherit the platform font and Dynamic Type.
//
// Interaction is the touch equivalent of a hover tooltip: tapping or dragging
// across the plot selects the bar under the finger and its caption replaces the
// hint line above the chart. That caption is also the accessibility label, so
// the numbers are reachable without reading colour or geometry.
import { Canvas, Path, RoundedRect, Skia } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { ThemedText } from '@/components/themed-text';
import { ChartColors } from '@/constants/chart-theme';
import { Spacing } from '@/constants/theme';
import { countAxis, type StatBar } from '@/models/statistics';

const PAD = { left: 28, right: 6, top: 6, bottom: 18 };
/** Surface gap between neighbouring bars, per the mark specs. */
const BAR_GAP = 2;
const BAR_RADIUS = 4;
/** Below this width an x label is dropped rather than allowed to collide. */
const MIN_LABEL_WIDTH = 26;

export type BarChartProps = {
  title: string;
  bars: StatBar[];
  /** Unit shown once beside the axis, e.g. "m" or "min". Bars carry bare numbers. */
  axisUnit?: string;
  height?: number;
  /** Shown instead of the chart when there is nothing to draw. */
  emptyText?: string;
};

export function BarChart({
  title,
  bars,
  axisUnit,
  height = 160,
  emptyText = 'No dives match this filter.',
}: BarChartProps) {
  const colors = ChartColors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const axis = useMemo(() => countAxis(bars), [bars]);
  const chartWidth = Math.max(0, width - PAD.left - PAD.right);
  const chartHeight = Math.max(0, height - PAD.top - PAD.bottom);
  const slot = bars.length > 0 ? chartWidth / bars.length : 0;
  const barWidth = Math.max(1, slot - BAR_GAP);

  const grid = useMemo(() => {
    const path = Skia.Path.Make();
    for (const tick of axis.ticks) {
      const y = PAD.top + chartHeight - (tick / axis.max) * chartHeight;
      path.moveTo(PAD.left, y);
      path.lineTo(PAD.left + chartWidth, y);
    }
    return path;
  }, [axis, chartHeight, chartWidth]);

  // Labels are thinned rather than rotated or shrunk: with a bar per month over
  // two years there is no width for all of them, and a skipped label is easier
  // to read than an overlapping one.
  const labelEvery = Math.max(1, Math.ceil(MIN_LABEL_WIDTH / Math.max(1, slot)));

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .onBegin((event) => setSelected(barAt(event.x)))
        .onUpdate((event) => setSelected(barAt(event.x))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bars.length, slot]
  );

  function barAt(px: number): number | null {
    if (bars.length === 0 || slot <= 0) {
      return null;
    }
    const index = Math.floor((px - PAD.left) / slot);
    return index >= 0 && index < bars.length ? index : null;
  }

  const caption = selected !== null && bars[selected] ? bars[selected].caption : '';

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {caption || (bars.length > 0 ? 'Tap a bar for its count' : ' ')}
      </ThemedText>

      {bars.length === 0 ? (
        <View style={[styles.empty, { height }]}>
          <ThemedText type="small" themeColor="textSecondary">
            {emptyText}
          </ThemedText>
        </View>
      ) : (
        <GestureDetector gesture={gesture}>
          <View
            style={{ height }}
            onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
            collapsable={false}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`${title}. ${bars.map((bar) => bar.caption).join('. ')}`}>
            <Canvas style={StyleSheet.absoluteFill}>
              <Path path={grid} style="stroke" strokeWidth={1} color={colors.grid} />
              {bars.map((bar, index) => {
                const barHeight = (bar.value / axis.max) * chartHeight;
                if (barHeight <= 0) {
                  return null;
                }
                return (
                  <RoundedRect
                    key={bar.key}
                    x={PAD.left + index * slot + BAR_GAP / 2}
                    y={PAD.top + chartHeight - barHeight}
                    width={barWidth}
                    // Overdrawn by the radius so only the data end is rounded;
                    // the baseline end stays square on the axis.
                    height={barHeight + BAR_RADIUS}
                    r={BAR_RADIUS}
                    color={index === selected ? colors.barSelected : colors.bar}
                  />
                );
              })}
            </Canvas>

            {axis.ticks.map((tick) => (
              <ThemedText
                key={tick}
                type="small"
                themeColor="textSecondary"
                style={[
                  styles.yLabel,
                  { top: PAD.top + chartHeight - (tick / axis.max) * chartHeight - 8 },
                ]}>
                {tick}
              </ThemedText>
            ))}

            {bars.map((bar, index) =>
              index % labelEvery === 0 ? (
                <ThemedText
                  key={bar.key}
                  type="small"
                  themeColor="textSecondary"
                  numberOfLines={1}
                  style={[
                    styles.xLabel,
                    { left: PAD.left + index * slot, width: slot * labelEvery },
                  ]}>
                  {bar.label}
                </ThemedText>
              ) : null
            )}

            {axisUnit ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.unit}>
                {axisUnit}
              </ThemedText>
            ) : null}
          </View>
        </GestureDetector>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.half,
    marginTop: Spacing.four,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  yLabel: {
    position: 'absolute',
    left: 0,
    width: PAD.left - 4,
    textAlign: 'right',
    fontSize: 11,
    lineHeight: 16,
  },
  xLabel: {
    position: 'absolute',
    bottom: 0,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
  },
  unit: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    fontSize: 11,
    lineHeight: 16,
  },
});
