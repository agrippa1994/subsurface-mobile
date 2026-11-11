// AI-generated (Claude)
// The app's translations: one i18next instance, used the same way by screens and
// by the presentation models.
//
// Why i18next: it follows the CLDR plural rules through Intl.PluralRules (keys
// ending in `_one`, `_other`, ... picked by `count`), interpolates values and
// supports context variants, so a sentence such as "3 dives selected" is written
// once per language rather than assembled from fragments.
//
// The instance is initialised synchronously with every language bundled, so a
// `t()` call made while a module loads or in a vitest run (which never touches
// React Native) already answers in English. The device's language is applied by
// src/lib/device-clock.ts, before the first screen renders.
//
// Every string is looked up when it is shown, never cached in a module-level
// constant, so the root layout can re-render the whole tree after a language
// change (see `useLanguage`).

import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from './locales/de';
import en from './locales/en';

export const SUPPORTED_LANGUAGES = ['en', 'de'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'en';

export const resources = {
  en: { translation: en },
  de: { translation: de },
} as const;

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: [...SUPPORTED_LANGUAGES],
  // Everything is bundled: no backend, so initialisation can finish before this
  // module returns.
  initAsync: false,
  // React Native renders text, not HTML: nothing to escape.
  interpolation: { escapeValue: false },
  returnNull: false,
  // Keys are nested objects ("dives.title"), never literal sentences.
  keySeparator: '.',
  nsSeparator: false,
  react: { useSuspense: false },
});

export default i18n;

/** The translation function, for code outside a component. */
export const t = i18n.t.bind(i18n);

/**
 * The first of the device's preferred languages the app has, else English.
 * Takes BCP 47 tags in preference order ("de-AT", "en-US", ...).
 */
export function pickLanguage(tags: readonly (string | null | undefined)[]): Language {
  for (const tag of tags) {
    const code = tag?.toLowerCase().split(/[-_]/)[0];
    const found = SUPPORTED_LANGUAGES.find((language) => language === code);
    if (found) {
      return found;
    }
  }
  return DEFAULT_LANGUAGE;
}

/** Switches the UI language; a no-op when it is already in force. */
export function setLanguage(language: Language): void {
  if (i18n.language !== language) {
    void i18n.changeLanguage(language);
  }
}

/** The UI language in force. */
export function currentLanguage(): Language {
  return pickLanguage([i18n.language]);
}

/**
 * An option whose `label` is looked up each time it is read, for the option
 * lists modules export as constants: `labelled({ value: 'salt' }, () =>
 * t('planner.water.salt'))`.
 */
export function labelled<T extends object>(base: T, label: () => string): T & { readonly label: string } {
  return Object.defineProperty({ ...base }, 'label', { get: label, enumerable: true }) as T & {
    readonly label: string;
  };
}
