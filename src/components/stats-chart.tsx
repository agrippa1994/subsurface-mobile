// AI-generated (Claude)
// One statistics chart on a Skia canvas: columns, boxes, a pie, or dots. Rows have no
// canvas: StatsRow draws them, since each is a label and a bar anyway.
//
// Each series is one path and the dots one Points node, so that a tap, which only
// redraws the selection on top, does not touch what thousands of marks cost to build.
// Labels are React Native text over the canvas, the same split as the profile chart,
// for the platform's font and Dynamic Type.
//
// The canvas is one element to VoiceOver, labelled with the chart's summary. The rows
// under the chart carry the values one by one.
import { Canvas, Circle, Group, Line, Path, Points, Skia, vec } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { ThemedText } from '@/components/themed-text';
import { ChartColors, type ChartPalette } from '@/constants/chart-theme';
import { Spacing } from '@/constants/theme';
import type { StatsChart, StatsChartConfig } from '@/models';
import { binLabel, formatStat, type ChartSelection } from '@/models/stats-chart';
import {
  bandOutline,
  buildScene,
  hitTest,
  type BarMark,
  type ChartScene,
} from '@/models/stats-chart-layout';
import { t } from '@/i18n';

const BAR_RADIUS = 4;
/** Columns thinner than this get no value above them. */
const MIN_LABELLED_BAR = 24;

export type StatsChartViewProps = {
  chart: StatsChart;
  config: StatsChartConfig;
  height: number;
  summary: string;
  selection: ChartSelection;
  onSelect: (selection: ChartSelection) => void;
};

export function seriesColor(colors: ChartPalette, series: number): string {
  return colors.series[Math.min(series, colors.series.length - 1)];
}

export function StatsChartView({ chart, config, height, summary, selection, onSelect }: StatsChartViewProps) {
  const colors = ChartColors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [width, setWidth] = useState(0);
  const scene = useMemo(() => buildScene(chart, width, height), [chart, width, height]);

  // A tap selects; a sideways drag scrubs across a chart with slots, and a vertical
  // drag is left to the scroll view around it.
  const gesture = useMemo(() => {
    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd((event, success) => {
        if (success) {
          onSelect(hitTest(scene, event.x, event.y));
        }
      });
    const scrub = Gesture.Pan()
      .runOnJS(true)
      .activeOffsetX([-8, 8])
      .failOffsetY([-12, 12])
      .onUpdate((event) => onSelect(hitTest(scene, event.x, event.y)));
    return Gesture.Race(scrub, tap);
  }, [scene, onSelect]);

  const yTitle = chart.valAxis?.title;
  const xTitle = chart.catAxis?.title;

  return (
    <View style={styles.container}>
      {yTitle && chart.family !== 'pie' ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.yTitle} numberOfLines={1}>
          {yTitle}
        </ThemedText>
      ) : null}
      <GestureDetector gesture={gesture}>
        <View
          style={{ height }}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          collapsable={false}
          accessible
          accessibilityRole="image"
          accessibilityLabel={summary}>
          <Canvas style={StyleSheet.absoluteFill}>
            <Marks scene={scene} config={config} colors={colors} />
            <Selection scene={scene} selection={selection} colors={colors} />
          </Canvas>
          <AxisLabels scene={scene} />
          {config.features.labels ? <ValueLabels scene={scene} /> : null}
          {xTitle && chart.family !== 'pie' ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.xTitle} numberOfLines={1}>
              {xTitle}
            </ThemedText>
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
}

function Marks({ scene, config, colors }: { scene: ChartScene; config: StatsChartConfig; colors: ChartPalette }) {
  const grid = useMemo(() => {
    const { plot, yGrid } = scene;
    const path = Skia.PathBuilder.Make();
    for (const y of yGrid) {
      path.moveTo(plot.left, y);
      path.lineTo(plot.left + plot.width, y);
    }
    return path.detach();
  }, [scene]);

  const seriesPaths = useMemo(() => scene.bars.map(barsToPath), [scene]);
  const boxes = useMemo(() => {
    const body = Skia.PathBuilder.Make();
    const whiskers = Skia.PathBuilder.Make();
    const medians = Skia.PathBuilder.Make();
    for (const box of scene.boxes) {
      const half = box.width / 2;
      body.addRect(Skia.XYWHRect(box.center - half, box.top, box.width, Math.max(1, box.bottom - box.top)));
      whiskers.moveTo(box.center, box.whiskerTop).lineTo(box.center, box.top);
      whiskers.moveTo(box.center, box.bottom).lineTo(box.center, box.whiskerBottom);
      whiskers.moveTo(box.center - half / 2, box.whiskerTop).lineTo(box.center + half / 2, box.whiskerTop);
      whiskers.moveTo(box.center - half / 2, box.whiskerBottom).lineTo(box.center + half / 2, box.whiskerBottom);
      medians.moveTo(box.center - half, box.median).lineTo(box.center + half, box.median);
    }
    return { body: body.detach(), whiskers: whiskers.detach(), medians: medians.detach() };
  }, [scene]);
  const slices = useMemo(() => {
    const pie = scene.pie;
    if (!pie) {
      return [];
    }
    const oval = Skia.XYWHRect(pie.cx - pie.r, pie.cy - pie.r, pie.r * 2, pie.r * 2);
    return pie.slices.map((slice) => {
      const sweep = ((slice.to - slice.from) * 180) / Math.PI;
      const path = Skia.PathBuilder.Make();
      if (sweep >= 359.99) {
        path.addCircle(pie.cx, pie.cy, pie.r);
      } else {
        path.moveTo(pie.cx, pie.cy);
        path.arcToOval(oval, (slice.from * 180) / Math.PI - 90, sweep, false);
        path.close();
      }
      return { key: slice.item, path: path.detach() };
    });
  }, [scene]);
  const points = useMemo(() => scene.points.map((p) => vec(p.x, p.y)), [scene]);
  const band = useMemo(() => {
    const outline = bandOutline(scene.band);
    if (outline.length < 3) {
      return null;
    }
    const path = Skia.PathBuilder.Make();
    outline.forEach((point, index) => (index === 0 ? path.moveTo(point.x, point.y) : path.lineTo(point.x, point.y)));
    path.close();
    return path.detach();
  }, [scene]);
  const quartiles = useMemo(() => {
    const path = Skia.PathBuilder.Make();
    for (const mark of scene.quartiles) {
      for (const y of mark.ys) {
        path.moveTo(mark.x - mark.width / 2, y).lineTo(mark.x + mark.width / 2, y);
      }
    }
    return path.detach();
  }, [scene]);

  const { plot, line, meanX, medianX } = scene;
  // Upstream draws dots smaller as there are more; so that a crowd reads as a crowd.
  const dotSize = scene.points.length > 1000 ? 4 : scene.points.length > 200 ? 6 : 8;

  return (
    <Group>
      <Path path={grid} style="stroke" strokeWidth={1} color={colors.grid} />
      {seriesPaths.map((path, series) => (
        <Path key={series} path={path} color={colors.series[Math.min(series, colors.series.length - 1)]} />
      ))}
      <Path path={boxes.body} color={colors.series[0]} opacity={0.3} />
      <Path path={boxes.whiskers} style="stroke" strokeWidth={1.5} color={colors.series[0]} />
      <Path path={boxes.medians} style="stroke" strokeWidth={2.5} color={colors.series[0]} />
      {slices.map((slice) => (
        <Group key={slice.key}>
          <Path path={slice.path} color={colors.series[Math.min(slice.key, colors.series.length - 1)]} />
          <Path path={slice.path} style="stroke" strokeWidth={2} color={colors.surface} />
        </Group>
      ))}
      {band && config.features.confidence ? <Path path={band} color={colors.trendFill} /> : null}
      {points.length > 0 ? (
        <Points
          points={points}
          mode="points"
          strokeWidth={dotSize}
          strokeCap="round"
          color={colors.dot}
          opacity={points.length > 200 ? 0.75 : 1}
        />
      ) : null}
      {line && config.features.regression ? (
        <Line p1={vec(line.x1, line.y1)} p2={vec(line.x2, line.y2)} strokeWidth={2} color={colors.trend} />
      ) : null}
      {config.features.quartiles ? <Path path={quartiles} style="stroke" strokeWidth={2} color={colors.trend} /> : null}
      {meanX !== null && config.features.mean ? (
        <Line p1={vec(meanX, plot.top)} p2={vec(meanX, plot.top + plot.height)} strokeWidth={2} color={colors.trend} />
      ) : null}
      {medianX !== null && config.features.median ? (
        <Line p1={vec(medianX, plot.top)} p2={vec(medianX, plot.top + plot.height)} strokeWidth={2} color={colors.median} />
      ) : null}
    </Group>
  );
}

function barsToPath(marks: BarMark[]) {
  const path = Skia.PathBuilder.Make();
  for (const mark of marks) {
    const r = mark.rounded ? Math.min(BAR_RADIUS, mark.width / 2, mark.height) : 0;
    const { x, y, width, height } = mark;
    if (r < 1) {
      path.addRect(Skia.XYWHRect(x, y, width, height));
      continue;
    }
    // Rounded at the data end only; the baseline end stays square on the axis.
    path
      .moveTo(x, y + height)
      .lineTo(x, y + r)
      .quadTo(x, y, x + r, y)
      .lineTo(x + width - r, y)
      .quadTo(x + width, y, x + width, y + r)
      .lineTo(x + width, y + height)
      .close();
  }
  return path.detach();
}

/** The selection, on top: an outline in ink, since a bar may be any of eight hues. */
function Selection({ scene, selection, colors }: { scene: ChartScene; selection: ChartSelection; colors: ChartPalette }) {
  const outline = useMemo(() => {
    if (!selection) {
      return null;
    }
    if (selection.kind === 'point') {
      return null;
    }
    const path = Skia.PathBuilder.Make();
    let any = false;
    for (const marks of scene.bars) {
      for (const mark of marks) {
        if (mark.item === selection.item && (selection.segment === null || selection.segment === mark.series)) {
          path.addRect(Skia.XYWHRect(mark.x, mark.y, mark.width, mark.height));
          any = true;
        }
      }
    }
    for (const box of scene.boxes) {
      if (box.item === selection.item) {
        path.addRect(Skia.XYWHRect(box.center - box.width / 2, box.whiskerTop, box.width, box.whiskerBottom - box.whiskerTop));
        any = true;
      }
    }
    for (const mark of scene.quartiles) {
      if (mark.item === selection.item) {
        const half = mark.width / 2;
        path.addRect(Skia.XYWHRect(mark.x - half, mark.ys[2], mark.width, Math.max(1, mark.ys[0] - mark.ys[2])));
        any = true;
      }
    }
    const pie = scene.pie;
    if (pie) {
      const slice = pie.slices.find((s) => s.item === selection.item);
      if (slice) {
        const sweep = ((slice.to - slice.from) * 180) / Math.PI;
        const oval = Skia.XYWHRect(pie.cx - pie.r, pie.cy - pie.r, pie.r * 2, pie.r * 2);
        if (sweep >= 359.99) {
          path.addCircle(pie.cx, pie.cy, pie.r);
        } else {
          path.moveTo(pie.cx, pie.cy);
          path.arcToOval(oval, (slice.from * 180) / Math.PI - 90, sweep, false);
          path.close();
        }
        any = true;
      }
    }
    return any ? path.detach() : null;
  }, [scene, selection]);

  if (selection?.kind === 'point') {
    const point = scene.points[selection.point];
    return point ? (
      <Group>
        <Circle cx={point.x} cy={point.y} r={7} color={colors.surface} />
        <Circle cx={point.x} cy={point.y} r={5} color={colors.crosshair} />
      </Group>
    ) : null;
  }
  return outline ? <Path path={outline} style="stroke" strokeWidth={2} color={colors.crosshair} /> : null;
}

function AxisLabels({ scene }: { scene: ChartScene }) {
  const { plot } = scene;
  return (
    <>
      {scene.yLabels.map((label) => (
        <ThemedText
          key={label.text}
          type="small"
          themeColor="textSecondary"
          style={[styles.yLabel, { top: label.at - 8, width: plot.left - 4 }]}>
          {label.text}
        </ThemedText>
      ))}
      {scene.xLabels.map((label) => (
        <ThemedText
          key={`${label.at}`}
          type="small"
          themeColor="textSecondary"
          numberOfLines={1}
          style={[styles.xLabel, { top: plot.top + plot.height + 8, left: label.at - 60 }]}>
          {label.text}
        </ThemedText>
      ))}
    </>
  );
}

/** Upstream's labels: a count above a column, a percentage in a slice. */
function ValueLabels({ scene }: { scene: ChartScene }) {
  const { chart, bars, pie, plot } = scene;
  if (pie) {
    const total = pie.slices.length;
    return (
      <>
        {pie.slices.map((slice) => {
          const item = chart.items?.[slice.item];
          const share = item && item.total ? (item.count * 100) / item.total : 0;
          if (share < 7 || total === 0) {
            return null;
          }
          const angle = (slice.from + slice.to) / 2;
          const x = pie.cx + Math.sin(angle) * pie.r * 0.68;
          const y = pie.cy - Math.cos(angle) * pie.r * 0.68;
          return (
            <ThemedText
              key={slice.item}
              type="small"
              style={[styles.pieLabel, { left: x - 30, top: y - 8 }]}
              numberOfLines={1}>
              {`${share.toFixed(0)}%`}
            </ThemedText>
          );
        })}
      </>
    );
  }
  if (chart.family !== 'bar' || chart.stacked || scene.barWidth < MIN_LABELLED_BAR) {
    return null;
  }
  const decimals = chart.valAxis?.kind === 'value' ? chart.valAxis.decimals : 0;
  return (
    <>
      {bars.flat().map((mark) => {
        const item = chart.items?.[mark.item];
        if (!item) {
          return null;
        }
        const value = item.segments ? item.segments[mark.series]?.count : item.value;
        if (value === null || value === undefined) {
          return null;
        }
        return (
          <ThemedText
            key={`${mark.item}/${mark.series}`}
            type="small"
            themeColor="textSecondary"
            numberOfLines={1}
            style={[
              styles.valueLabel,
              { left: mark.x + mark.width / 2 - 30, top: Math.max(plot.top - 2, mark.y - 16) },
            ]}>
            {formatStat(value, decimals)}
          </ThemedText>
        );
      })}
    </>
  );
}

/**
 * Names every series, always in text: hue is never all that tells two apart, and three
 * of the light-mode slots are under 3:1 against the surface. A chart of one series has
 * none, its title names it.
 */
export function StatsLegend({ chart }: { chart: StatsChart }) {
  const colors = ChartColors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const names = chart.series ?? [];
  if (names.length < 2) {
    return null;
  }
  return (
    <View
      style={styles.legend}
      accessible
      accessibilityLabel={t('charts.legend', { names: names.map((name) => binLabel(name)).join(', ') })}>
      {names.map((name, series) => (
        <View key={name} style={styles.legendEntry}>
          <View style={[styles.swatch, { backgroundColor: seriesColor(colors, series) }]} />
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {binLabel(name)}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

/** The markers a numeric histogram can carry, spelled out next to it. */
export function StatsMarkers({ chart, config }: { chart: StatsChart; config: StatsChartConfig }) {
  const colors = ChartColors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const axis = chart.catAxis?.title.match(/\[(.*)\]$/)?.[1] ?? '';
  const markers = [
    config.features.mean && chart.mean != null ? { label: t('stats.readout.mean'), value: chart.mean, color: colors.trend } : null,
    config.features.median && chart.median != null ? { label: t('stats.readout.median'), value: chart.median, color: colors.median } : null,
  ].filter((marker) => marker !== null);
  if (markers.length === 0) {
    return null;
  }
  return (
    <View style={styles.legend}>
      {markers.map((marker) => (
        <View key={marker.label} style={styles.legendEntry} accessible>
          <View style={[styles.line, { backgroundColor: marker.color }]} />
          <ThemedText type="small" themeColor="textSecondary">
            {`${marker.label} ${formatStat(marker.value, 1, axis)}`}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.half,
  },
  yTitle: {
    fontSize: 11,
    lineHeight: 14,
  },
  xTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
  },
  yLabel: {
    position: 'absolute',
    left: 0,
    textAlign: 'right',
    fontSize: 11,
    lineHeight: 16,
  },
  xLabel: {
    position: 'absolute',
    width: 120,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
  },
  valueLabel: {
    position: 'absolute',
    width: 60,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
  },
  pieLabel: {
    position: 'absolute',
    width: 60,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.three,
    rowGap: Spacing.half,
  },
  legendEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    maxWidth: '100%',
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  line: {
    width: 14,
    height: 2,
    borderRadius: 1,
  },
});
