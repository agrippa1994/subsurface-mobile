// AI-generated (Claude)
// Tells the date formatters (src/models/date-format.ts) and the core what the
// device says about dates: its region and whether the clock is 24-hour. And
// tells the translations (src/i18n) which of the app's languages to speak: the
// first of the device's preferred languages it has, else English. On iOS that
// list starts with the app's own language when one is set in Settings > Apps.
//
// Applied once as this module loads, before the root layout renders, so the very
// first frame of the dive list already reads the device's way; and again when
// the device's answer changes while the app runs.

import { getCalendars, getLocales, useCalendars, useLocales } from 'expo-localization';
import { useEffect } from 'react';

import { pickLanguage, setLanguage } from '@/i18n';
import { setDeviceClock, shortMonthNames } from '@/models/date-format';
import { configurePreferences } from '../../modules/ssrf-core/src';

let applied: string | null = null;

function apply(tag: string | undefined, uses24Hour: boolean | undefined, languages: readonly string[]): void {
  setLanguage(pickLanguage(languages));
  const key = `${tag ?? ''}|${String(uses24Hour)}`;
  if (key === applied) {
    return;
  }
  applied = key;
  setDeviceClock({ locale: tag, uses24Hour });
  try {
    // The core's own month labels (statistics binners, trip titles) follow too.
    configurePreferences({ monthNames: shortMonthNames() });
  } catch {
    // The native module missing (web) leaves the core's English names: harmless.
  }
}

function read(): [string | undefined, boolean | undefined, string[]] {
  try {
    const locales = getLocales();
    return [
      locales[0]?.languageTag || undefined,
      getCalendars()[0]?.uses24hourClock ?? undefined,
      locales.map((locale) => locale.languageTag),
    ];
  } catch {
    return [undefined, undefined, []];
  }
}

apply(...read());

export function useDeviceClock(): void {
  const [calendar] = useCalendars();
  const locales = useLocales();
  const uses24Hour = calendar?.uses24hourClock ?? undefined;
  const tag = locales[0]?.languageTag || undefined;
  const languages = locales.map((locale) => locale.languageTag).join(',');
  useEffect(() => apply(tag, uses24Hour, languages.split(',')), [tag, uses24Hour, languages]);
}
