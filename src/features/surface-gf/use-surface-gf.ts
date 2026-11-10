// AI-generated (Claude)
// Everything the surface GF card and timeline read: the ambient pressure (and
// where it came from), the core's series on the phone's clock, and "now".
//
// Now ticks every 30 seconds and on every return to the foreground, so the card
// counts down without a pull to refresh. The detail screen can pin it to
// another instant ("as of") to look at an old log as if the dive were today.
import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { useBarometer } from './use-barometer';
import type { DiveSummary } from '@/models';
import {
  resolveAmbient,
  toTimeline,
  type Ambient,
  type BarometerState,
  type SurfaceGfTimeline,
} from '@/models/surface-gf';
import { useDives } from '@/queries/logbook';
import { useGradientFactors } from '@/queries/settings';
import { useSurfaceGfSeries, useSurfaceGfSettings } from '@/queries/surface-gf';

const TICK_MS = 30_000;
/** The longest series the core computes; a dive further back is clean. */
const SERIES_MAX_MS = 72 * 3600_000;

/** The wall clock, re-read every 30 s and when the app comes back. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setNow(Date.now());
      }
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  return now;
}

/** The latest valid dive by end time, the one the core picks without an id. */
export function latestDive(dives: readonly DiveSummary[]): DiveSummary | null {
  let latest: DiveSummary | null = null;
  for (const dive of dives) {
    if (dive.invalid) {
      continue;
    }
    if (!latest || dive.when + dive.durationSec > latest.when + latest.durationSec) {
      latest = dive;
    }
  }
  return latest;
}

export type SurfaceGfState = {
  ambient: Ambient;
  barometer: BarometerState;
  timeline: SurfaceGfTimeline | null;
  isPending: boolean;
  error: Error | null;
  /** The real wall clock. */
  now: number;
  /** The instant everything is shown for: `now`, or the "as of" override. */
  asOf: number;
  gfHigh: number;
};

export function useSurfaceGf({
  diveId = null,
  asOfMs = null,
  skipStale = false,
}: {
  /** The dive the surface interval follows; null for the latest. */
  diveId?: number | null;
  /** Show everything as of this instant instead of now. */
  asOfMs?: number | null;
  /** Do not ask the core when the latest dive ended longer ago than any series reaches. */
  skipStale?: boolean;
} = {}): SurfaceGfState {
  const settings = useSurfaceGfSettings();
  const gf = useGradientFactors();
  const now = useNow();
  const asOf = asOfMs ?? now;

  const dives = useDives().data;
  const latest = useMemo(() => (dives ? latestDive(dives) : null), [dives]);
  const offsetMinutes = new Date(asOf).getTimezoneOffset();
  const stale =
    skipStale &&
    diveId === null &&
    asOfMs === null &&
    latest !== null &&
    asOf - ((latest.when + latest.durationSec) * 1000 + offsetMinutes * 60_000) > SERIES_MAX_MS;
  const hasDives = latest !== null;

  // Only listened to when there is a series to compute: on iOS the first read
  // asks for Motion & Fitness access, which must not pop up over a dive list
  // whose last dive is weeks old.
  const barometer = useBarometer(settings.pressureSource === 'barometer' && hasDives && !stale);
  const ambient = useMemo(
    () => resolveAmbient(settings.pressureSource, settings.altitudeMm, barometer),
    [settings.pressureSource, settings.altitudeMm, barometer],
  );

  const query = useSurfaceGfSeries(diveId, gf, ambient.mbar, hasDives && !stale);
  const timeline = useMemo(
    () => (query.data && !stale ? toTimeline(query.data, offsetMinutes) : null),
    [query.data, stale, offsetMinutes],
  );

  return {
    ambient,
    barometer,
    timeline,
    isPending: hasDives && !stale && query.isPending,
    error: query.error,
    now,
    asOf,
    gfHigh: gf.gfHigh,
  };
}
