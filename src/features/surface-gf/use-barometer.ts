// AI-generated (Claude)
// The phone's air pressure, for the surface interval's ambient pressure.
//
// expo-sensors' Barometer: CMAltimeter on iOS (Motion & Fitness permission,
// asked by the system on first use), the pressure sensor on Android, where many
// phones have none. A phone without one, a refused permission or a sensor that
// never answers all end as `unavailable`, and the model falls back to the
// altitude setting (src/models/surface-gf.ts, resolveAmbient).
//
// The reading is smoothed to whole millibars and only passed on when it moves
// by one, so a pressure that wobbles in its last decimal does not recompute
// the series several times a second.
import { Barometer } from 'expo-sensors';
import { useEffect, useState } from 'react';

import type { BarometerState } from '@/models/surface-gf';

/** How long to wait for a first reading before calling the barometer unavailable. */
const FIRST_READING_TIMEOUT_MS = 5000;

export function useBarometer(enabled: boolean): BarometerState {
  const [state, setState] = useState<BarometerState>({ kind: 'pending' });

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    let subscription: { remove(): void } | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    void (async () => {
      try {
        const available = await Barometer.isAvailableAsync();
        if (cancelled) {
          return;
        }
        if (!available) {
          setState({ kind: 'unavailable' });
          return;
        }
        timeout = setTimeout(() => {
          if (!cancelled) {
            setState((current) => (current.kind === 'pending' ? { kind: 'unavailable' } : current));
          }
        }, FIRST_READING_TIMEOUT_MS);
        subscription = Barometer.addListener(({ pressure }) => {
          if (cancelled || !Number.isFinite(pressure)) {
            return;
          }
          const mbar = Math.round(pressure);
          setState((current) =>
            current.kind === 'reading' && current.mbar === mbar ? current : { kind: 'reading', mbar },
          );
        });
      } catch {
        if (!cancelled) {
          setState({ kind: 'unavailable' });
        }
      }
    })();

    return () => {
      cancelled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      subscription?.remove();
    };
  }, [enabled]);

  return enabled ? state : { kind: 'unavailable' };
}
