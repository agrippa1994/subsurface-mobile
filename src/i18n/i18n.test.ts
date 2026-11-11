// AI-generated (Claude)
// The translations: the device's language is picked right, German counts and
// interpolates, and every German string carries the same placeholders as its
// English source, so no value goes missing from a sentence.

import { afterEach, describe, expect, it } from 'vitest';

import i18n, { pickLanguage, setLanguage, t } from './index';
import de from './locales/de';
import en from './locales/en';
import { chartHeadline } from '@/models/stats-chart';
import { changeDone } from '@/models/logbook-history';
import { formatGasMix, METRIC_UNITS, unitsSummary } from '@/models/units';
import type { HistoryEntry, StatsChartConfig } from '@/models';

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [[`${prefix}${key}`, value]] : leaves(value, `${prefix}${key}.`),
  );
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{\s*(\w+)[^}]*\}\}/g)].map((match) => match[1]).sort();
}

afterEach(() => setLanguage('en'));

describe('pickLanguage', () => {
  it('takes the first preferred language the app has', () => {
    expect(pickLanguage(['fr-FR', 'de-AT', 'en-US'])).toBe('de');
    expect(pickLanguage(['en-GB', 'de-DE'])).toBe('en');
    expect(pickLanguage(['de_CH'])).toBe('de');
  });

  it('falls back to English', () => {
    expect(pickLanguage(['fr-FR', 'ja-JP'])).toBe('en');
    expect(pickLanguage([])).toBe('en');
    expect(pickLanguage([null, undefined])).toBe('en');
  });
});

describe('the German bundle', () => {
  const english = new Map(leaves(en as unknown as Tree));
  const german = new Map(leaves(de as unknown as Tree));

  it('has every key English has, and no other', () => {
    expect([...german.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it('leaves no string empty', () => {
    expect([...german].filter(([, text]) => text.trim() === '').map(([key]) => key)).toEqual([]);
  });

  it('uses the same placeholders as English', () => {
    const mismatched = [...english].filter(
      ([key, text]) => placeholders(text).join() !== placeholders(german.get(key) ?? '').join(),
    );
    expect(mismatched.map(([key]) => key)).toEqual([]);
  });
});

describe('translating', () => {
  it('speaks English by default', () => {
    expect(i18n.language).toBe('en');
    expect(t('common.diveCount', { count: 1 })).toBe('1 dive');
    expect(t('common.diveCount', { count: 3 })).toBe('3 dives');
  });

  it('counts in German', () => {
    setLanguage('de');
    expect(t('common.diveCount', { count: 0 })).toBe('0 Tauchgänge');
    expect(t('common.diveCount', { count: 1 })).toBe('1 Tauchgang');
    expect(t('common.diveCount', { count: 12 })).toBe('12 Tauchgänge');
  });

  it('reaches the presentation models', () => {
    setLanguage('de');
    expect(formatGasMix(209, 0)).toBe('Luft');
    expect(formatGasMix(210, 350)).toBe('Trimix 21/35');
    expect(unitsSummary(METRIC_UNITS)).toBe('Meter, bar, Liter, Celsius, Kilogramm.');

    const config = { var1: 'Dive site', var2: null, chart: { type: 'DiscreteCount' } } as unknown as StatsChartConfig;
    expect(chartHeadline(config)).toBe('Tauchgänge nach Tauchplatz');

    const deleted = { kind: 'deleteDive', diveNumber: 42 } as unknown as HistoryEntry;
    expect(changeDone(deleted)).toBe('Tauchgang 42 gelöscht');
  });

  it('switches back without a trace', () => {
    setLanguage('de');
    setLanguage('en');
    expect(formatGasMix(209, 0)).toBe('Air');
  });
});
