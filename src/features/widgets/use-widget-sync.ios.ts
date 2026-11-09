// AI-generated (Claude)
// Keeps the home screen and Lock Screen widgets current.
//
// The widgets cannot read the logbook: it lives in this process's native
// module, and a widget runs in an extension of its own. So the app pushes what
// they show - computed by src/models/widgets.ts - whenever that changes: when
// the dive list is re-read (every load, import, edit, undo), when the unit
// system changes, and when the app comes to the foreground, since "this year"
// and "the last twelve months" move on with the calendar while it sleeps.
//
// Each widget is sent only what changed. WidgetKit budgets how often a widget
// may reload, and most mutations (a renamed buddy on an old dive) leave most
// widgets as they were.

import Constants from 'expo-constants';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getProfile } from '../../../modules/ssrf-core/src';
import { recordProblem } from '@/lib/diagnostics';
import type { PlotEntry } from '@/models';
import { buildWidgetSnapshot, latestDive, type WidgetSnapshot } from '@/models/widgets';
import { useDives } from '@/queries/logbook';
import { useGradientFactors, useUnits } from '@/queries/settings';
import DiveActivity from '@/widgets/dive-activity';
import LastDive from '@/widgets/last-dive';
import LogbookTotals from '@/widgets/logbook-totals';
import SurfaceInterval from '@/widgets/surface-interval';

// A tap on a widget opens this app with the widget's URL whatever its scheme,
// so the debug build (registered as subsurface-dev) handles these links too.
const scheme = (() => {
  const configured = Constants.expoConfig?.scheme;
  return (Array.isArray(configured) ? configured[0] : configured) ?? 'subsurface';
})();

function appUrl(path: string): string {
  return `${scheme}://${path.replace(/^\//, '')}`;
}

/** Pushes `next` to every widget whose props differ from what it was last sent. */
function push(next: WidgetSnapshot, sent: Map<string, string>): void {
  const updates: [string, unknown, (props: never) => void][] = [
    ['lastDive', next.lastDive, (props) => LastDive.updateSnapshot(props)],
    ['totals', next.totals, (props) => LogbookTotals.updateSnapshot(props)],
    ['activity', next.activity, (props) => DiveActivity.updateSnapshot(props)],
    ['surfaceInterval', next.surfaceInterval, (props) => SurfaceInterval.updateSnapshot(props)],
  ];
  for (const [key, props, update] of updates) {
    const serialized = JSON.stringify(props);
    if (sent.get(key) === serialized) {
      continue;
    }
    try {
      update(props as never);
      sent.set(key, serialized);
    } catch (error) {
      // A widget that could not be updated keeps what it showed; the app goes on.
      recordProblem(`widget ${key}`, error);
    }
  }
}

export function useWidgetSync(): void {
  const { data: dives } = useDives();
  const units = useUnits();
  const gf = useGradientFactors();
  const sent = useRef(new Map<string, string>());
  // Bumped when the app returns to the foreground, so the calendar-relative
  // figures are recomputed even when no dive changed.
  const [wake, setWake] = useState(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setWake((n) => n + 1);
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!dives) {
      return;
    }
    const latest = latestDive(dives);
    let lastProfile: PlotEntry[] | null = null;
    if (latest) {
      try {
        lastProfile = getProfile(latest.id, 0, gf).entry;
      } catch (error) {
        // The widget shows the dive without its profile rather than not at all.
        recordProblem('widget profile', error);
      }
    }
    const now = Date.now();
    push(
      buildWidgetSnapshot({
        dives,
        lastProfile,
        units,
        now,
        timezoneOffsetMinutes: new Date(now).getTimezoneOffset(),
        links: { url: appUrl },
      }),
      sent.current,
    );
  }, [dives, units, gf, wake]);
}
