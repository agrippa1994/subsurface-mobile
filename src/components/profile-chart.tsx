// AI-generated (Claude)
// The dive profile diagram.
//
// Skia draws the marks; every number it draws comes from src/models/
// profile-plot.ts, which is where the series, the ticks and the scrubber
// readout are decided (and tested). Axis labels and the readout are React
// Native text on top of the canvas rather than Skia text, so they inherit the
// platform's font and Dynamic Type without shipping a font asset.
//
// Interaction: pinch zooms the time axis around the focal point, a two-finger
// drag pans it, a one-finger drag scrubs, and a double tap resets. The gesture
// callbacks run on the JS thread on purpose - a zoom rebuilds the drawn paths,
// which is a JS-side job, and the series are thinned to a few hundred points
// first (see windowPoints) so a rebuild per frame stays cheap.
import {
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  LinearGradient,
  Path,
  Skia,
  vec,
  type SkPath,
} from '@shopify/react-native-skia';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { ChartColors } from '@/constants/chart-theme';
import { Spacing } from '@/constants/theme';
import type { PlotInfo, UnitSystem } from '@/models';
import { formatDuration, mmToFeet, mmToMeters } from '@/models';
import {
  depthTicks,
  nearestSampleIndex,
  profileSummary,
  readoutAt,
  temperatureValue,
  timeTicks,
  windowPoints,
  type Point,
  type ProfilePlot,
} from '@/models/profile-plot';

const PAD = { left: 34, right: 10, top: 10, bottom: 20 };
/** Points drawn per series. Beyond this the curve is thinned, keeping extremes. */
const MAX_POINTS = 600;
/** The temperature series lives in the bottom band, out of the depth curve's way. */
const TEMPERATURE_BAND = { top: 0.72, bottom: 0.97 };
/** Tank pressure lives in the top band, where the depth curve rarely goes. */
const PRESSURE_BAND = { top: 0.03, bottom: 0.3 };
/**
 * The gradient factors take the middle, between the pressure and the
 * temperature band. They cross the depth curve there, which is why they are thin
 * strokes over its fill rather than another filled shape.
 */
const GF_BAND = { top: 0.34, bottom: 0.66 };
const MAX_ZOOM = 40;

export type ProfileChartProps = {
  plot: ProfilePlot;
  /** The same plot_info the plot was built from; the scrubber reads it. */
  pi: PlotInfo;
  unitSystem: UnitSystem;
  height?: number;
  /** Gradient factor of the leading tissue at depth. Off by default. */
  showGfNow?: boolean;
  /** Gradient factor the diver would surface with. Off by default. */
  showGfSurface?: boolean;
};

/** The visible slice of the time axis, in seconds. */
type TimeWindow = { from: number; to: number };

function clampWindow(view: TimeWindow, maxSec: number): TimeWindow {
  const minSpan = Math.max(30, maxSec / MAX_ZOOM);
  const span = Math.min(Math.max(view.to - view.from, minSpan), maxSec);
  const from = Math.min(Math.max(view.from, 0), Math.max(0, maxSec - span));
  return { from, to: from + span };
}

function buildLine(points: Point[], x: (sec: number) => number, y: (v: number) => number): SkPath {
  const path = Skia.Path.Make();
  points.forEach((point, index) => {
    const px = x(point.sec);
    const py = y(point.value);
    if (index === 0) {
      path.moveTo(px, py);
    } else {
      path.lineTo(px, py);
    }
  });
  return path;
}

function buildArea(
  points: Point[],
  x: (sec: number) => number,
  y: (v: number) => number,
  baselineY: number
): SkPath {
  const path = buildLine(points, x, y);
  if (points.length > 0) {
    path.lineTo(x(points[points.length - 1].sec), baselineY);
    path.lineTo(x(points[0].sec), baselineY);
    path.close();
  }
  return path;
}

export function ProfileChart({
  plot,
  pi,
  unitSystem,
  height = 260,
  showGfNow = false,
  showGfSurface = false,
}: ProfileChartProps) {
  const colors = ChartColors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [width, setWidth] = useState(0);
  const [view, setView] = useState<TimeWindow>({ from: 0, to: plot.maxSec });
  const [scrubSec, setScrubSec] = useState<number | null>(null);

  const chartWidth = Math.max(0, width - PAD.left - PAD.right);
  const chartHeight = Math.max(0, height - PAD.top - PAD.bottom);

  // The depth axis is rounded out to the next gridline so the deepest point is
  // not glued to the bottom edge.
  const depthAxisMax = useMemo(() => {
    const ticks = depthTicks(plot.maxDepthMm, unitSystem);
    const step = ticks.length > 1 ? ticks[1].value - ticks[0].value : plot.maxDepthMm || 1;
    return Math.max(step, Math.ceil((plot.maxDepthMm || 1) / step) * step);
  }, [plot.maxDepthMm, unitSystem]);

  const span = Math.max(1, view.to - view.from);
  const x = useCallback(
    (sec: number) => PAD.left + ((sec - view.from) / span) * chartWidth,
    [chartWidth, span, view.from]
  );
  const yDepth = useCallback(
    (mm: number) => PAD.top + (mm / depthAxisMax) * chartHeight,
    [chartHeight, depthAxisMax]
  );
  const bandY = useCallback(
    (value: number, min: number, max: number, band: { top: number; bottom: number }) => {
      const usable = max - min || 1;
      const t = (value - min) / usable;
      const top = PAD.top + band.top * chartHeight;
      const bottom = PAD.top + band.bottom * chartHeight;
      return bottom - t * (bottom - top);
    },
    [chartHeight]
  );

  const paths = useMemo(() => {
    if (chartWidth <= 0 || chartHeight <= 0 || plot.depth.length === 0) {
      return null;
    }
    const depthPoints = windowPoints(plot.depth, view.from, view.to, MAX_POINTS);
    const ceilingPoints = windowPoints(plot.ceiling, view.from, view.to, MAX_POINTS);
    const temperaturePoints = windowPoints(plot.temperature, view.from, view.to, MAX_POINTS);

    const tempMin = temperatureValue(plot.temperatureRange.min, unitSystem);
    const tempMax = temperatureValue(plot.temperatureRange.max, unitSystem);

    const gfLine = (points: Point[], enabled: boolean): SkPath | null => {
      if (!enabled) {
        return null;
      }
      const windowed = windowPoints(points, view.from, view.to, MAX_POINTS);
      return windowed.length > 1
        ? buildLine(windowed, x, (percent) =>
            bandY(percent, plot.gfRange.min, plot.gfRange.max, GF_BAND)
          )
        : null;
    };

    return {
      depthArea: buildArea(depthPoints, x, yDepth, PAD.top + chartHeight),
      depthLine: buildLine(depthPoints, x, yDepth),
      // The ceiling is drawn as the water column the diver may not ascend into:
      // from the surface down to the ceiling depth.
      ceilingArea:
        ceilingPoints.length > 1 ? buildArea(ceilingPoints, x, yDepth, PAD.top) : null,
      ceilingLine: ceilingPoints.length > 1 ? buildLine(ceilingPoints, x, yDepth) : null,
      gfNow: gfLine(plot.gfNow, showGfNow),
      gfSurface: gfLine(plot.gfSurface, showGfSurface),
      temperature:
        temperaturePoints.length > 1
          ? buildLine(temperaturePoints, x, (mkelvin) =>
              bandY(temperatureValue(mkelvin, unitSystem), tempMin, tempMax, TEMPERATURE_BAND)
            )
          : null,
      pressures: plot.pressures
        .map((series) => ({
          cylinder: series.cylinder,
          path: buildLine(
            windowPoints(series.points, view.from, view.to, MAX_POINTS),
            x,
            (mbar) =>
              bandY(mbar, plot.pressureRange.min, plot.pressureRange.max, PRESSURE_BAND)
          ),
        }))
        .filter((series) => series.path.countPoints() > 1),
    };
  }, [
    bandY,
    chartHeight,
    chartWidth,
    plot,
    showGfNow,
    showGfSurface,
    unitSystem,
    view.from,
    view.to,
    x,
    yDepth,
  ]);

  const grid = useMemo(() => {
    const path = Skia.Path.Make();
    for (const tick of depthTicks(depthAxisMax, unitSystem)) {
      const y = yDepth(tick.value);
      path.moveTo(PAD.left, y);
      path.lineTo(PAD.left + chartWidth, y);
    }
    for (const tick of timeTicks(plot.maxSec)) {
      if (tick.value < view.from || tick.value > view.to) {
        continue;
      }
      path.moveTo(x(tick.value), PAD.top);
      path.lineTo(x(tick.value), PAD.top + chartHeight);
    }
    return path;
  }, [chartHeight, chartWidth, depthAxisMax, plot.maxSec, unitSystem, view, x, yDepth]);

  const visibleEvents = useMemo(
    () => plot.events.filter((event) => event.sec >= view.from && event.sec <= view.to),
    [plot.events, view.from, view.to]
  );

  const readout = scrubSec === null ? null : readoutAt(pi, scrubSec, unitSystem);

  // One string per field rather than one joined line: the row wraps, so a dive
  // carrying temperature, several cylinders, both gradient factors and a ceiling
  // reads in full instead of being clipped at the right edge.
  const readoutFields = readout
    ? [
        readout.timeText,
        readout.depthText,
        readout.temperatureText,
        ...readout.pressureTexts,
        showGfNow && readout.gfNowText ? `GF ${readout.gfNowText}` : null,
        showGfSurface && readout.gfSurfaceText ? `sGF ${readout.gfSurfaceText}` : null,
        readout.inDeco && readout.ceilingText ? `ceiling ${readout.ceilingText}` : null,
        !readout.inDeco && readout.ndlText ? `NDL ${readout.ndlText}` : null,
      ].filter((field): field is string => Boolean(field))
    : [];

  // --- Gestures ------------------------------------------------------------

  // Zooming keeps the second under the pinch's focal point where it is, which
  // is what makes a pinch feel attached to the curve rather than to the view.
  const zoomAround = useCallback(
    (factor: number, focalX: number) => {
      setView((current) => {
        const ratio = Math.min(Math.max((focalX - PAD.left) / Math.max(1, chartWidth), 0), 1);
        const currentSpan = current.to - current.from;
        const anchorSec = current.from + ratio * currentSpan;
        const nextSpan = currentSpan / factor;
        return clampWindow(
          { from: anchorSec - ratio * nextSpan, to: anchorSec + (1 - ratio) * nextSpan },
          plot.maxSec
        );
      });
    },
    [chartWidth, plot.maxSec]
  );

  const panBy = useCallback(
    (deltaX: number) => {
      setView((current) => {
        const seconds = (deltaX / Math.max(1, chartWidth)) * (current.to - current.from);
        return clampWindow({ from: current.from - seconds, to: current.to - seconds }, plot.maxSec);
      });
    },
    [chartWidth, plot.maxSec]
  );

  const scrubTo = useCallback(
    (px: number) => {
      const ratio = (px - PAD.left) / Math.max(1, chartWidth);
      const sec = view.from + Math.min(Math.max(ratio, 0), 1) * (view.to - view.from);
      setScrubSec(Math.round(sec));
    },
    [chartWidth, view.from, view.to]
  );

  // `onChange` hands over the per-frame delta, so no gesture state is kept
  // here: zoom takes scaleChange, pan takes changeX.
  const gesture = useMemo(() => {
    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onChange((event) => zoomAround(event.scaleChange, event.focalX));

    const drag = Gesture.Pan()
      .runOnJS(true)
      .minPointers(2)
      .onChange((event) => panBy(event.changeX));

    const scrub = Gesture.Pan()
      .runOnJS(true)
      .maxPointers(1)
      .onBegin((event) => scrubTo(event.x))
      .onUpdate((event) => scrubTo(event.x));

    const reset = Gesture.Tap()
      .runOnJS(true)
      .numberOfTaps(2)
      .onEnd(() => {
        setView({ from: 0, to: plot.maxSec });
        setScrubSec(null);
      });

    return Gesture.Simultaneous(pinch, drag, Gesture.Exclusive(reset, scrub));
  }, [panBy, plot.maxSec, scrubTo, zoomAround]);

  // --- Labels --------------------------------------------------------------

  const depthLabel = (mm: number) =>
    unitSystem === 'imperial' ? `${Math.round(mmToFeet(mm))}` : `${Math.round(mmToMeters(mm))}`;

  const zoomed = view.to - view.from < plot.maxSec - 1;

  if (plot.depth.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={[styles.emptyText, { color: colors.label }]}>
          This dive has no profile samples.
        </Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.readoutRow}>
        {readoutFields.length > 0 ? (
          readoutFields.map((field, index) => (
            <Text key={`${index}-${field}`} style={[styles.readout, { color: colors.label }]}>
              {field}
            </Text>
          ))
        ) : (
          <Text style={[styles.readout, { color: colors.label }]}>
            Drag to scrub, pinch to zoom, double tap to reset
          </Text>
        )}
      </View>

      <GestureDetector gesture={gesture}>
        <View
          style={{ height }}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          collapsable={false}
          // One element to VoiceOver rather than a canvas plus a scatter of axis
          // labels: the label describes the shape of the dive, since neither the
          // curve nor the scrubber gesture is reachable without a pointer.
          accessible
          accessibilityRole="image"
          accessibilityLabel={profileSummary(plot, unitSystem, { showGfNow, showGfSurface })}>
          <Canvas style={StyleSheet.absoluteFill}>
            <Path path={grid} style="stroke" strokeWidth={1} color={colors.grid} />

            {paths?.ceilingArea ? (
              <Path path={paths.ceilingArea} style="fill" color={colors.ceilingFill} />
            ) : null}
            {paths?.ceilingLine ? (
              <Path
                path={paths.ceilingLine}
                style="stroke"
                strokeWidth={2}
                color={colors.ceiling}
              />
            ) : null}

            {paths ? (
              <Path path={paths.depthArea} style="fill">
                <LinearGradient
                  start={vec(0, PAD.top)}
                  end={vec(0, PAD.top + chartHeight)}
                  colors={[colors.depthFill, 'transparent']}
                />
              </Path>
            ) : null}
            {paths ? (
              <Path
                path={paths.depthLine}
                style="stroke"
                strokeWidth={2}
                strokeJoin="round"
                strokeCap="round"
                color={colors.depth}
              />
            ) : null}

            {paths?.pressures.map((series) => (
              <Path
                key={series.cylinder}
                path={series.path}
                style="stroke"
                strokeWidth={2}
                color={colors.pressure}
              />
            ))}

            {paths?.temperature ? (
              <Path
                path={paths.temperature}
                style="stroke"
                strokeWidth={2}
                color={colors.temperature}
              />
            ) : null}

            {paths?.gfNow ? (
              <Path path={paths.gfNow} style="stroke" strokeWidth={2} color={colors.gfNow} />
            ) : null}
            {/* Dashed, so it is told from gf at depth without relying on the tint. */}
            {paths?.gfSurface ? (
              <Path
                path={paths.gfSurface}
                style="stroke"
                strokeWidth={2}
                color={colors.gfSurface}>
                <DashPathEffect intervals={[5, 4]} />
              </Path>
            ) : null}

            <Group>
              {visibleEvents.map((event, index) => (
                <Circle
                  key={`${event.sec}-${index}`}
                  cx={x(event.sec)}
                  cy={yDepth(event.depthMm)}
                  r={4}
                  color={colors.event}
                />
              ))}
            </Group>

            {scrubSec !== null && readout ? (
              <Group>
                <Path
                  path={(() => {
                    const path = Skia.Path.Make();
                    path.moveTo(x(readout.sec), PAD.top);
                    path.lineTo(x(readout.sec), PAD.top + chartHeight);
                    return path;
                  })()}
                  style="stroke"
                  strokeWidth={1}
                  color={colors.crosshair}
                />
                <Circle
                  cx={x(readout.sec)}
                  cy={yDepth(pi.entry[nearestSampleIndex(pi, readout.sec)]?.depthMm ?? 0)}
                  r={4}
                  color={colors.depth}
                />
              </Group>
            ) : null}
          </Canvas>

          {depthTicks(depthAxisMax, unitSystem).map((tick) => (
            <Text
              key={`depth-${tick.value}`}
              style={[
                styles.axisLabel,
                { color: colors.label, top: yDepth(tick.value) - 7, left: 0, width: PAD.left - 4 },
              ]}>
              {depthLabel(tick.value)}
            </Text>
          ))}

          {timeTicks(plot.maxSec)
            .filter((tick) => tick.value >= view.from && tick.value <= view.to)
            .map((tick) => (
              <Text
                key={`time-${tick.value}`}
                style={[
                  styles.axisLabel,
                  styles.timeLabel,
                  { color: colors.label, left: x(tick.value) - 16, top: height - PAD.bottom + 2 },
                ]}>
                {tick.label}
              </Text>
            ))}
        </View>
      </GestureDetector>

      <View style={styles.legend}>
        <LegendItem
          color={colors.depth}
          textColor={colors.label}
          label={`Depth (${unitSystem === 'imperial' ? 'ft' : 'm'})`}
        />
        {plot.temperature.length > 1 ? (
          <LegendItem
            color={colors.temperature}
            textColor={colors.label}
            label={`Temperature (${unitSystem === 'imperial' ? 'F' : 'C'})`}
          />
        ) : null}
        {plot.pressures.length > 0 ? (
          <LegendItem
            color={colors.pressure}
            textColor={colors.label}
            label={`Tank pressure (${unitSystem === 'imperial' ? 'psi' : 'bar'})`}
          />
        ) : null}
        {plot.ceiling.length > 0 ? (
          <LegendItem color={colors.ceiling} textColor={colors.label} label="Deco ceiling" />
        ) : null}
        {showGfNow && plot.gfNow.length > 1 ? (
          <LegendItem color={colors.gfNow} textColor={colors.label} label="GF at depth (%)" />
        ) : null}
        {showGfSurface && plot.gfSurface.length > 1 ? (
          <LegendItem color={colors.gfSurface} textColor={colors.label} label="Surface GF (%)" />
        ) : null}
        {plot.events.length > 0 ? (
          <LegendItem color={colors.event} textColor={colors.label} label="Events" />
        ) : null}
      </View>

      <Text style={[styles.footnote, { color: colors.label }]}>
        {zoomed
          ? `Showing ${formatDuration(view.from)} to ${formatDuration(view.to)} - double tap to reset`
          : `Time (minutes), total ${formatDuration(plot.maxSec)}`}
      </Text>
    </View>
  );
}

// Every series is named in text, never by colour alone - which is also the
// relief the light-mode aqua needs, being below 3:1 on white.
function LegendItem({
  color,
  textColor,
  label,
}: {
  color: string;
  textColor: string;
  label: string;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendLabel, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  readoutRow: {
    minHeight: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: Spacing.three,
  },
  readout: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  axisLabel: {
    position: 'absolute',
    fontSize: 10,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  timeLabel: {
    width: 32,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 12,
  },
  footnote: {
    marginTop: Spacing.one,
    fontSize: 11,
  },
});
