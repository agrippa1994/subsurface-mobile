// AI-generated (Claude)
// Every date and time the app shows, in one place.
//
// The legacy app had its own date and time format settings, with a preview. A
// native app follows the device instead: the region decides the order of day,
// month and year and the month names, and the clock setting decides 12 or 24
// hours. Both are already the diver's choice, made once for every app, so the
// app adds no setting of its own - it only has to apply them everywhere alike,
// which is what this file is for.
//
// Two kinds of moment:
//  - A dive's `when` is not a UTC instant: the core stores the wall-clock time the
//    dive was logged at as if it were UTC (see dive-list.ts). It is formatted in
//    UTC, so a dive at 15:25 in Egypt reads 15:25 wherever the phone is.
//  - A real instant (a sync, a download) is formatted in the phone's zone.
//
// The region comes from Intl, which Hermes answers from the device. The 12/24
// hour choice does not always reach Intl (on iOS the switch in Settings is apart
// from the region), so the app tells this file what the device says
// (src/lib/device-clock.ts) and every time is formatted with an explicit hour
// cycle.

export type DeviceClock = {
  /** BCP 47 tag of the device region, or undefined for Intl's own default. */
  locale?: string;
  /** True for a 24-hour clock. Undefined leaves it to the locale. */
  uses24Hour?: boolean;
};

let clock: DeviceClock = {};

/** Set once at startup and again when the app comes back to the foreground. */
export function setDeviceClock(next: DeviceClock): void {
  clock = { ...next };
  cache.clear();
}

export function deviceClock(): DeviceClock {
  return clock;
}

const cache = new Map<string, Intl.DateTimeFormat>();

/** Building an Intl.DateTimeFormat is the slow part, and a list formats thousands. */
function formatter(key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  let found = cache.get(key);
  if (!found) {
    found = new Intl.DateTimeFormat(clock.locale, options);
    cache.set(key, found);
  }
  return found;
}

/**
 * The hour of a time: "06:35" on a 24-hour clock, as the system's own clock
 * writes it, "6:35 AM" on a 12-hour one.
 */
function hourOptions(): Pick<Intl.DateTimeFormatOptions, 'hour' | 'hourCycle'> {
  const h24 = uses24HourClock();
  return { hour: h24 ? '2-digit' : 'numeric', ...(clock.uses24Hour === undefined ? {} : { hourCycle: h24 ? 'h23' : 'h12' }) };
}

/** Whether times read 24-hour: the device's choice, else the region's. */
export function uses24HourClock(): boolean {
  if (clock.uses24Hour !== undefined) {
    return clock.uses24Hour;
  }
  const { hourCycle } = new Intl.DateTimeFormat(clock.locale, { hour: 'numeric' }).resolvedOptions();
  return hourCycle === 'h23' || hourCycle === 'h24';
}

const MS = 1000;

// --- A dive's wall-clock `when` --------------------------------------------------

/** "12 Mar 2024", in the device's order. */
export function formatDiveDate(when: number): string {
  return formatter('dive-date', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    when * MS
  );
}

/** "09:14" or "9:14 AM", by the device's clock. */
export function formatDiveTime(when: number): string {
  return formatter('dive-time', { minute: '2-digit', timeZone: 'UTC', ...hourOptions() }).format(
    when * MS
  );
}

/** "12 Mar 2024, 09:14". */
export function formatDiveDateTime(when: number): string {
  return formatter('dive-date-time', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    ...hourOptions(),
  }).format(when * MS);
}

/** "Mar 12, 2024" in the region's medium style, for the date rows of editors. */
export function formatDiveDateMedium(when: number): string {
  return formatter('dive-date-medium', { dateStyle: 'medium', timeZone: 'UTC' }).format(when * MS);
}

/** "March", for search. */
export function formatDiveMonthLong(when: number): string {
  return formatter('dive-month-long', { month: 'long', timeZone: 'UTC' }).format(when * MS);
}

/** The region's numeric date, "12/03/2024", for search. */
export function formatDiveDateNumeric(when: number): string {
  return formatter('dive-date-numeric', { timeZone: 'UTC' }).format(when * MS);
}

// --- Calendar parts --------------------------------------------------------------

/** The short name of a month, 1 to 12: "Mar", "mars", "März". */
export function shortMonthName(month: number): string {
  return formatter('month-short', { month: 'short', timeZone: 'UTC' }).format(Date.UTC(2000, month - 1, 15));
}

/** All twelve, January first: what the core's own month labels are mapped to. */
export function shortMonthNames(): string[] {
  return Array.from({ length: 12 }, (_, index) => shortMonthName(index + 1));
}

/** "Mar 2024", in the region's order. */
export function formatMonthYear(year: number, month: number): string {
  return formatter('month-year', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    Date.UTC(year, month - 1, 15)
  );
}

/** A day counted from 1970 (the statistics' date axis): "12 Mar 2024". */
export function formatDayNumber(days: number): string {
  return formatDiveDate(days * 86400);
}

// --- Real instants ---------------------------------------------------------------

/** "12 Mar 2024, 14:02" in the phone's zone, for a sync or a download. */
export function formatInstant(ms: number): string {
  const { hourCycle } = hourOptions();
  return formatter('instant', { dateStyle: 'medium', timeStyle: 'short', ...(hourCycle ? { hourCycle } : {}) }).format(ms);
}

/** "12 Mar 2024" in the phone's zone. */
export function formatInstantDate(ms: number): string {
  return formatter('instant-date', { dateStyle: 'medium' }).format(ms);
}
