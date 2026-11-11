// AI-generated (Claude)
// What the About section says.
//
// The licence text is a requirement, not a courtesy: the app links the
// Subsurface core, which is GPL-2.0, so the binary is a derivative work and has
// to name the licence, say which core it was built against and point at the
// source. Keeping it here rather than in the screen means both Settings
// variants say the same thing and the wording is covered by a test.


import { t } from '@/i18n';

export type AboutInfo = {
  /** From app.config.ts `version`. */
  appVersion: string;
  /** The build (iOS `CFBundleVersion`); empty when running outside a build. */
  buildNumber: string;
  /** The pinned upstream commit the core was vendored from. */
  coreCommit: string;
  /** The core's own version string, e.g. "6.0.5789". */
  coreVersion: string;
  sourceUrl: string;
};

export type AboutRow = { label: string; value: string };

export function aboutRows(info: AboutInfo): AboutRow[] {
  const rows: AboutRow[] = [
    {
      label: t('about.version'),
      value: info.buildNumber ? `${info.appVersion} (${info.buildNumber})` : info.appVersion,
    },
    { label: t('about.core'), value: info.coreVersion },
    { label: t('about.coreCommit'), value: info.coreCommit },
  ];
  return rows;
}

export function licenseNotice(): string {
  return t('about.license');
}

export function privacyNotice(): string {
  return t('about.privacy');
}

/** The line under the source link, telling the user what the link is for. */
export function sourceNotice(): string {
  return t('about.source');
}
