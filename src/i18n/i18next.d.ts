// AI-generated (Claude)
// Typed keys: `t('dives.title')` is checked against the English bundle, so a
// typo or a removed key fails `tsc` rather than showing a raw key on screen.
// The German bundle is typed against the same shape (src/i18n/locales/de), so a
// missing translation fails too.

import 'i18next';

import type en from './locales/en';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
    returnNull: false;
  }
}
