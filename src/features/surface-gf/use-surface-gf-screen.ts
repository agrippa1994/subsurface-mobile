// AI-generated (Claude)
// State and derived values of the surface GF timeline screen, shared by its
// iOS, Android and React Native variants so they cannot behave differently.
//
// What the screen holds itself (not persisted): the time cursor, the span the
// chart shows, the "below X %" threshold, and for testing the dive the interval
// follows and an "as of" instant that stands in for now. The planned entry,
// the pressure source and the altitude are preferences (settings.json).
import { useCallback, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { latestDive, useSurfaceGf } from './use-surface-gf';
import { formatDiveDate } from '@/models/date-format';
import {
  altitudeStepMm,
  ALTITUDE_RANGE_MM,
  belowText,
  cursorReadout,
  formatAltitude,
  gfAxisMax,
  plannedEntry,
  plannedFromPreset,
  timelineWindow,
  type PressureSource,
  type TimelineSpanKey,
} from '@/models/surface-gf';
import { useDives } from '@/queries/logbook';
import { useUnits } from '@/queries/settings';
import { useSetSurfaceGfSettings, useSurfaceGfSettings } from '@/queries/surface-gf';

/** Dives offered as the reference, newest first. */
const REFERENCE_DIVES = 40;

export const PRESSURE_SOURCE_OPTIONS: readonly { value: PressureSource; label: string }[] = [
  { value: 'barometer', label: 'Phone barometer' },
  { value: 'altitude', label: 'Manual altitude' },
];

export function useSurfaceGfScreen() {
  const units = useUnits();
  const settings = useSurfaceGfSettings();
  const setSettings = useSetSurfaceGfSettings();
  const [span, setSpan] = useState<TimelineSpanKey>('12h');
  const [cursor, setCursor] = useState<number | null>(null);
  const [threshold, setThreshold] = useState(30);
  const [diveId, setDiveId] = useState<number | null>(null);
  const [asOfOverride, setAsOfOverride] = useState<number | null>(null);

  const surface = useSurfaceGf({ diveId, asOfMs: asOfOverride });
  const { timeline, asOf } = surface;

  const dives = useDives().data;
  const referenceOptions = useMemo(() => {
    const sorted = [...(dives ?? [])].filter((dive) => !dive.invalid).sort((a, b) => b.when - a.when);
    const latest = dives ? latestDive(dives) : null;
    return [
      { value: -1, label: latest ? `Latest (#${latest.number}, ${formatDiveDate(latest.when)})` : 'Latest' },
      ...sorted.slice(0, REFERENCE_DIVES).map((dive) => ({
        value: dive.id,
        label: `#${dive.number}, ${formatDiveDate(dive.when)}`,
      })),
    ];
  }, [dives]);

  // The cursor follows "now" until moved, and stays inside the series.
  const cursorMs = useMemo(() => {
    if (!timeline) {
      return asOf;
    }
    const wanted = cursor ?? asOf;
    return Math.min(timeline.endMs, Math.max(timeline.startMs, wanted));
  }, [timeline, cursor, asOf]);

  const window = useMemo(
    () => (timeline ? timelineWindow(timeline, span, [asOf, cursorMs, settings.plannedEntryMs]) : null),
    [timeline, span, asOf, cursorMs, settings.plannedEntryMs],
  );

  const planned = useMemo(
    () =>
      timeline && settings.plannedEntryMs !== null
        ? plannedEntry(timeline, settings.plannedEntryMs, asOf)
        : null,
    [timeline, settings.plannedEntryMs, asOf],
  );

  const { width } = useWindowDimensions();

  const setPlannedEntry = useCallback(
    (ms: number | null) => setSettings({ plannedEntryMs: ms }),
    [setSettings],
  );

  return {
    units,
    settings,
    surface,
    timeline,
    asOf,
    window,
    yMax: timeline ? gfAxisMax(timeline, surface.gfHigh) : 100,
    readout: timeline ? cursorReadout(timeline, cursorMs, asOf) : null,
    /** The series ended before "now": an old log seen without an "as of". */
    pastSeries: timeline !== null && asOf > timeline.endMs,
    chartWidth: Math.min(width, 700) - 72,
    span,
    setSpan,
    cursorMs,
    cursorFollowsNow: cursor === null,
    setCursor,
    resetCursor: () => setCursor(null),
    threshold,
    setThreshold,
    belowText: timeline ? belowText(timeline, threshold, asOf) : null,
    planned,
    setPlannedEntry,
    applyPreset: (minutes: number) => setPlannedEntry(plannedFromPreset(asOf, minutes)),
    setPressureSource: (pressureSource: PressureSource) => setSettings({ pressureSource }),
    altitudeText: formatAltitude(settings.altitudeMm, units.depth),
    altitudeStepMm: altitudeStepMm(units.depth),
    altitudeRangeMm: ALTITUDE_RANGE_MM,
    setAltitudeMm: (altitudeMm: number) =>
      setSettings({
        altitudeMm: Math.min(ALTITUDE_RANGE_MM.max, Math.max(ALTITUDE_RANGE_MM.min, Math.round(altitudeMm))),
      }),
    referenceOptions,
    referenceValue: diveId ?? -1,
    setReference: (value: number) => {
      setDiveId(value === -1 ? null : value);
      setCursor(null);
    },
    asOfOverride,
    setAsOfOverride: (ms: number | null) => {
      setAsOfOverride(ms);
      setCursor(null);
    },
    /** For the "as of" switch: a time just after the reference dive ended. */
    asOfDefault: timeline ? timeline.startMs + 30 * 60_000 : asOf,
  };
}

export type SurfaceGfScreenState = ReturnType<typeof useSurfaceGfScreen>;
