// AI-generated (Claude)
import { describe, expect, it } from 'vitest';

import type { SurfaceGfSeries } from './index';
import {
  altitudeToMbar,
  belowText,
  DEFAULT_SURFACE_GF_SETTINGS,
  formatAltitude,
  formatClock,
  formatDuration,
  formatGf,
  gfAxisMax,
  hourTicks,
  cursorReadout,
  timelineWindow,
  gfAt,
  mbarToAltitudeMm,
  parseAltitude,
  parseSurfaceGfSettings,
  phaseAt,
  plannedEntry,
  plannedFromPreset,
  resolveAmbient,
  samplePoints,
  surfaceGfCard,
  timeBelow,
  toTimeline,
  type SurfaceGfTimeline,
} from './surface-gf';

const MIN = 60_000;
const HOUR = 60 * MIN;

/** 60, 50, 40, ... 0, 0, 0 per 10 minutes: GF 0 after an hour, clean at 2 h. */
function series(overrides: Partial<SurfaceGfSeries> = {}): SurfaceGfSeries {
  return {
    diveId: 7,
    diveNumber: 42,
    diveWhen: 1_700_000_000 - 3600,
    diveEndWhen: 1_700_000_000 - 20,
    startWhen: 1_700_000_000,
    diveSurfaceMbar: 1013,
    ambientMbar: 1013,
    stepSec: 600,
    endSurfaceGf: 60,
    surfaceGf: [60, 50, 40, 30, 20, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    leadingCompartment: new Array(19).fill(4),
    gfZeroSec: 3600,
    cleanSec: 7200,
    residualFromSec: null,
    ...overrides,
  };
}

function timeline(overrides: Partial<SurfaceGfSeries> = {}): SurfaceGfTimeline {
  return toTimeline(series(overrides), 0);
}

const START = 1_700_000_000_000;

describe('pressure', () => {
  it("uses the core's barometric formula", () => {
    expect(altitudeToMbar(0)).toBe(1013);
    // core/units.h: 1013 * exp(-h / 7800 m)
    expect(altitudeToMbar(1_000_000)).toBe(Math.round(1013 * Math.exp(-1000 / 7800)));
    expect(altitudeToMbar(1_000_000)).toBe(891);
    expect(altitudeToMbar(2_000_000)).toBe(784);
    expect(mbarToAltitudeMm(1013)).toBe(0);
    expect(Math.abs(mbarToAltitudeMm(altitudeToMbar(1_500_000)) - 1_500_000)).toBeLessThan(10_000);
  });

  it('takes the barometer first when chosen', () => {
    const ambient = resolveAmbient('barometer', 1_000_000, { kind: 'reading', mbar: 1008.4 });
    expect(ambient).toMatchObject({ mbar: 1008, source: 'barometer', fallbackNote: null });
    expect(ambient.label).toBe('Phone barometer, 1008 mbar');
  });

  it('falls back to the altitude, then sea level, and says why', () => {
    expect(resolveAmbient('barometer', 1_000_000, { kind: 'unavailable' })).toMatchObject({
      mbar: 891,
      source: 'altitude',
      fallbackNote: 'This phone has no barometer.',
    });
    expect(resolveAmbient('barometer', 0, { kind: 'unavailable' })).toMatchObject({
      mbar: 1013,
      source: 'default',
    });
    expect(resolveAmbient('barometer', 0, { kind: 'pending' }).fallbackNote).toBe('Waiting for the barometer.');
    expect(resolveAmbient('barometer', 0, { kind: 'reading', mbar: 50 }).source).toBe('default');
  });

  it('ignores the barometer when the altitude is chosen', () => {
    expect(resolveAmbient('altitude', 2_000_000, { kind: 'reading', mbar: 1013 })).toMatchObject({
      mbar: 784,
      source: 'altitude',
      fallbackNote: null,
    });
    expect(resolveAmbient('altitude', 0, { kind: 'reading', mbar: 900 })).toMatchObject({
      mbar: 1013,
      source: 'default',
    });
  });

  it('formats and parses the altitude in the depth unit', () => {
    expect(formatAltitude(1_234_000, 'm')).toBe('1230 m');
    expect(formatAltitude(1_000_000, 'ft')).toBe('3280 ft');
    expect(parseAltitude('1500', 'm')).toBe(1_500_000);
    expect(parseAltitude('1000', 'ft')).toBe(304_800);
    expect(parseAltitude('-5', 'm')).toBe(0);
    expect(parseAltitude('abc', 'm')).toBeNull();
    expect(parseAltitude('', 'm')).toBeNull();
  });
});

describe('settings', () => {
  it('defaults anything missing or malformed', () => {
    expect(parseSurfaceGfSettings(undefined)).toEqual(DEFAULT_SURFACE_GF_SETTINGS);
    expect(parseSurfaceGfSettings({ pressureSource: 'gps', altitudeMm: 'high', plannedEntryMs: 'soon' })).toEqual(
      DEFAULT_SURFACE_GF_SETTINGS,
    );
    expect(parseSurfaceGfSettings({ altitudeMm: 99_000_000 }).altitudeMm).toBe(5_000_000);
  });
});

describe('timeline', () => {
  it("puts the core's wall clock on the phone's", () => {
    const t = toTimeline(series(), -60);
    expect(t.startMs).toBe(START - HOUR);
    expect(t.stepMs).toBe(10 * MIN);
    expect(t.endMs).toBe(t.startMs + 18 * 10 * MIN);
    expect(t.gfZeroMs).toBe(t.startMs + HOUR);
    expect(t.cleanMs).toBe(t.startMs + 2 * HOUR);
    expect(toTimeline(series({ cleanSec: null }), 0).cleanMs).toBeNull();
  });

  it('interpolates between steps, is null before the start and holds the last value', () => {
    const t = timeline();
    expect(gfAt(t, START - 1)).toBeNull();
    expect(gfAt(t, START)).toBe(60);
    expect(gfAt(t, START + 5 * MIN)).toBeCloseTo(55);
    expect(gfAt(t, START + 25 * MIN)).toBeCloseTo(35);
    expect(gfAt(t, START + 100 * HOUR)).toBe(0);
  });

  it('finds when it drops below a threshold', () => {
    const t = timeline();
    expect(timeBelow(t, 30, START)).toBe(START + 30 * MIN);
    expect(timeBelow(t, 35, START)).toBe(START + 25 * MIN);
    // From a later point it is that point when already below.
    expect(timeBelow(t, 30, START + 40 * MIN)).toBe(START + 40 * MIN);
    // Before the start it searches from the start.
    expect(timeBelow(t, 70, START - HOUR)).toBe(START);
    expect(timeBelow(timeline({ surfaceGf: [60, 55, 50] }), 10, START)).toBeNull();
  });

  it('names the phase', () => {
    const t = timeline();
    expect(phaseAt(t, START - MIN)).toBe('diving');
    expect(phaseAt(t, START + 30 * MIN)).toBe('supersaturated');
    expect(phaseAt(t, START + 90 * MIN)).toBe('residual');
    expect(phaseAt(t, START + 2 * HOUR)).toBe('clean');
    // A series cut short before clean never claims clean.
    expect(phaseAt(timeline({ cleanSec: null }), START + 100 * HOUR)).toBe('residual');
  });

  it('samples evenly for a sparkline', () => {
    const points = samplePoints(timeline(), START, START + HOUR, 7);
    expect(points.map((p) => p.y)).toEqual([60, 50, 40, 30, 20, 10, 0]);
    expect(points[3].x).toBeCloseTo(0.5);
    expect(samplePoints(timeline(), START, START, 7)).toEqual([]);
  });
});

describe('planned entry', () => {
  it('rounds a preset up to five minutes', () => {
    const now = Date.UTC(2026, 10, 9, 14, 2, 30);
    expect(plannedFromPreset(now, 30)).toBe(Date.UTC(2026, 10, 9, 14, 35));
    expect(plannedFromPreset(now, 60)).toBe(Date.UTC(2026, 10, 9, 15, 5));
  });

  it('reports the GF at the planned time', () => {
    const t = timeline();
    const entry = plannedEntry(t, START + 30 * MIN, START + 10 * MIN);
    expect(entry.gf).toBeCloseTo(30);
    expect(entry.past).toBe(false);
    expect(entry.gfText).toBe('Surface GF 30 %');
    expect(entry.whenText.startsWith('In 20 min, ')).toBe(true);
  });

  it('says so for a time already over or before the dive ended', () => {
    const t = timeline();
    expect(plannedEntry(t, START + 10 * MIN, START + 20 * MIN).past).toBe(true);
    expect(plannedEntry(t, START - HOUR, START + 20 * MIN)).toMatchObject({
      gf: null,
      gfText: 'Before this dive ended',
    });
  });
});

describe('card', () => {
  const options = { gfHigh: 75, plannedEntryMs: null };

  it('shows the GF now, time to 0 % and time since surfacing', () => {
    const card = surfaceGfCard(timeline(), START + 15 * MIN, options)!;
    expect(card.phase).toBe('supersaturated');
    expect(card.gfText).toBe('45 %');
    expect(card.untilText).toBe('0 % in 45 min');
    expect(card.sinceText).toBe('Surfaced 15 min ago');
    expect(card.aboveGfHigh).toBe(false);
    expect(card.sparkline.length).toBeGreaterThan(10);
    expect(card.nowX).toBeGreaterThan(0);
    expect(card.accessibilityLabel).toContain('Surface GF 45 %');
  });

  it('collapses to residual nitrogen and hides once clean', () => {
    const residual = surfaceGfCard(timeline(), START + 90 * MIN, options)!;
    expect(residual.phase).toBe('residual');
    expect(residual.untilText).toBe('Residual nitrogen, clean in 30 min');
    expect(surfaceGfCard(timeline(), START + 2 * HOUR, options)).toBeNull();
    expect(surfaceGfCard(timeline(), START - MIN, options)).toBeNull();
  });

  it('flags a surface GF above gf high', () => {
    expect(surfaceGfCard(timeline(), START, { gfHigh: 55, plannedEntryMs: null })!.aboveGfHigh).toBe(true);
  });

  it('carries a planned entry that is still ahead', () => {
    const now = START + 10 * MIN;
    expect(surfaceGfCard(timeline(), now, { gfHigh: 75, plannedEntryMs: now + 20 * MIN })!.planned?.gfText).toBe(
      'Surface GF 30 %',
    );
    expect(surfaceGfCard(timeline(), now, { gfHigh: 75, plannedEntryMs: now - MIN })!.planned).toBeNull();
  });

  it('answers "when below X"', () => {
    const now = START + 10 * MIN;
    expect(belowText(timeline(), 30, now).startsWith('In 20 min, ')).toBe(true);
    expect(belowText(timeline(), 80, now)).toBe('Already at or below 80 %');
    expect(belowText(timeline({ surfaceGf: [60, 55, 50] }), 10, now)).toBe(
      'Stays above 10 % for the whole series',
    );
  });
});

describe('texts', () => {
  it('formats durations and percentages', () => {
    expect(formatDuration(45 * MIN)).toBe('45 min');
    expect(formatDuration(125 * MIN)).toBe('2 h 05 min');
    expect(formatDuration(31 * HOUR)).toBe('1 d 7 h');
    expect(formatDuration(-5 * MIN)).toBe('0 min');
    expect(formatGf(54.6)).toBe('55 %');
    expect(formatGf(-0.2)).toBe('0 %');
  });

  it('names the day when it is not today', () => {
    const now = new Date(2026, 10, 9, 12, 0).getTime();
    expect(formatClock(new Date(2026, 10, 9, 15, 30).getTime(), now)).toBe('15:30');
    expect(formatClock(new Date(2026, 10, 10, 9, 5).getTime(), now)).toBe('tomorrow 09:05');
    expect(formatClock(new Date(2026, 10, 8, 22, 0).getTime(), now)).toBe('yesterday 22:00');
    expect(formatClock(new Date(2026, 2, 12, 14, 0).getTime(), now)).toBe('12 Mar 14:00');
    expect(formatClock(new Date(2025, 2, 12, 14, 0).getTime(), now)).toBe('12 Mar 2025 14:00');
  });
});

describe('timeline chart', () => {
  it('windows the span and reaches out to what must be shown', () => {
    const long = timeline({ surfaceGf: new Array(200).fill(10), stepSec: 600 });
    expect(timelineWindow(long, '6h', [])).toEqual({ fromMs: START, toMs: START + 6 * HOUR });
    expect(timelineWindow(long, '6h', [START + 8 * HOUR]).toMs).toBe(START + 8.5 * HOUR);
    expect(timelineWindow(long, 'all', []).toMs).toBe(long.endMs);
    expect(timelineWindow(long, '6h', [START + 1000 * HOUR]).toMs).toBe(long.endMs);
  });

  it('sizes the GF axis to the curve and gf high', () => {
    expect(gfAxisMax(timeline(), 75)).toBe(100);
    expect(gfAxisMax(timeline(), 30)).toBe(75);
    expect(gfAxisMax(timeline({ surfaceGf: [110, 0] }), 75)).toBe(125);
    expect(gfAxisMax(timeline({ surfaceGf: [5, 0] }), 20)).toBe(50);
  });

  it('puts ticks on whole hours, four to eight of them', () => {
    // TZ is UTC in the test run.
    const from = Date.UTC(2026, 10, 9, 10, 20);
    expect(hourTicks(from, from + 5 * HOUR)).toEqual(
      [11, 12, 13, 14, 15].map((h) => Date.UTC(2026, 10, 9, h)),
    );
    const day = hourTicks(from, from + 24 * HOUR);
    expect(day.length).toBeLessThanOrEqual(8);
    expect(day.every((tick) => new Date(tick).getUTCHours() % 3 === 0)).toBe(true);
  });

  it('reads out the cursor', () => {
    const readout = cursorReadout(timeline(), START + 30 * MIN, START + 10 * MIN);
    expect(readout.gfText).toBe('30 %');
    expect(readout.whenText).toMatch(/, in 20 min$/);
    expect(readout.phaseText).toBe('Supersaturated');
    expect(cursorReadout(timeline(), START - HOUR, START).gfText).toBe('-');
    expect(cursorReadout(timeline(), START, START).whenText.startsWith('Now, ')).toBe(true);
  });
});
