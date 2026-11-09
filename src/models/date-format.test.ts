// AI-generated (Claude)
import { afterEach, describe, expect, it } from 'vitest';

import {
  formatDayNumber,
  formatDiveDate,
  formatDiveDateTime,
  formatDiveTime,
  formatInstant,
  formatMonthYear,
  setDeviceClock,
  shortMonthName,
  shortMonthNames,
  uses24HourClock,
} from './date-format';
import { sectionSubtitle, toDiveRow } from './dive-list';
import { METRIC_UNITS } from './units';
import type { DiveSummary } from './index';

// 2011-12-13 06:35 and 18:05, wall clock, as the core stores a dive's start.
const MORNING = 1323758100;
const EVENING = 1323799500;

afterEach(() => {
  // Back to what tests/setup-device-clock.ts sets for every file.
  setDeviceClock({ locale: 'en-GB', uses24Hour: true });
});

describe('the device clock', () => {
  it('writes 24-hour times with a leading zero, as the system clock does', () => {
    setDeviceClock({ locale: 'en-GB', uses24Hour: true });
    expect(formatDiveTime(MORNING)).toBe('06:35');
    expect(formatDiveTime(EVENING)).toBe('18:05');
  });

  it('writes 12-hour times when the device asks for them, whatever the region', () => {
    setDeviceClock({ locale: 'en-GB', uses24Hour: false });
    expect(formatDiveTime(EVENING)).toMatch(/^6:05\s?pm$/i);
    expect(uses24HourClock()).toBe(false);
  });

  it('writes 24-hour times in a 12-hour region when the device asks', () => {
    setDeviceClock({ locale: 'en-US', uses24Hour: true });
    expect(formatDiveTime(EVENING)).toBe('18:05');
  });

  it('falls back to the region when the device does not say', () => {
    setDeviceClock({ locale: 'en-US' });
    expect(uses24HourClock()).toBe(false);
    setDeviceClock({ locale: 'de-DE' });
    expect(uses24HourClock()).toBe(true);
  });

  it('formats a real instant with the same hour cycle', () => {
    setDeviceClock({ locale: 'en-GB', uses24Hour: false });
    expect(formatInstant(Date.UTC(2024, 2, 12, 18, 5))).toMatch(/6:05\s?pm/i);
  });
});

describe('the region', () => {
  it('orders the date and names the month as the region does', () => {
    setDeviceClock({ locale: 'en-US', uses24Hour: false });
    expect(formatDiveDate(MORNING)).toBe('Dec 13, 2011');
    setDeviceClock({ locale: 'de-DE', uses24Hour: true });
    expect(formatDiveDate(MORNING)).toBe('13. Dez. 2011');
    expect(formatDiveDateTime(MORNING)).toContain('06:35');
  });

  it('names months in the region language, for the statistics', () => {
    setDeviceClock({ locale: 'de-DE', uses24Hour: true });
    expect(shortMonthName(3)).toBe('Mär');
    expect(shortMonthNames()).toHaveLength(12);
    expect(formatMonthYear(2024, 3)).toMatch(/^März? 2024$/);
  });

  it('reads the date axis of a chart the same way', () => {
    expect(formatDayNumber(MORNING / 86400)).toBe('13 Dec 2011');
  });
});

describe('everywhere alike', () => {
  const dive = {
    id: 1,
    number: 12,
    when: EVENING,
    durationSec: 2535,
    maxDepthMm: 20100,
    siteName: 'Tauchsee',
    tripLocation: '',
    rating: 0,
  } as unknown as DiveSummary;

  it('gives the dive list rows and section headers the device clock', () => {
    setDeviceClock({ locale: 'en-US', uses24Hour: true });
    const row = toDiveRow(dive, METRIC_UNITS);
    expect(row.timeText).toBe('18:05');
    expect(row.dateText).toBe('Dec 13, 2011');
    expect(
      sectionSubtitle({ dives: [dive], newestWhen: EVENING, oldestWhen: EVENING } as never),
    ).toBe('1 dive - Dec 13, 2011');
  });
});
