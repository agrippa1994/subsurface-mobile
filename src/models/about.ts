// AI-generated (Claude)
// What the About section says.
//
// The licence text is a requirement, not a courtesy: the app links the
// Subsurface core, which is GPL-2.0, so the binary is a derivative work and has
// to name the licence, say which core it was built against and point at the
// source. Keeping it here rather than in the screen means both Settings
// variants say the same thing and the wording is covered by a test.

export type AboutInfo = {
  /** From app.config.ts `version`. */
  appVersion: string;
  /** The build (iOS `CFBundleVersion`); empty when running outside a build. */
  buildNumber: string;
  /** The pinned upstream commit the core was vendored from. */
  coreCommit: string;
  /** The core's own version string, e.g. "6.0.5658". */
  coreVersion: string;
  sourceUrl: string;
};

export type AboutRow = { label: string; value: string };

export function aboutRows(info: AboutInfo): AboutRow[] {
  const rows: AboutRow[] = [
    { label: 'Version', value: info.buildNumber ? `${info.appVersion} (${info.buildNumber})` : info.appVersion },
    { label: 'Subsurface core', value: info.coreVersion },
    { label: 'Core commit', value: info.coreCommit },
  ];
  return rows;
}

export const LICENSE_NOTICE =
  'Subsurface Mobile is free software, licensed under the GNU General Public ' +
  'License version 2. It is built on the Subsurface dive log core, which carries ' +
  'the same licence. It comes with no warranty.';

export const PRIVACY_NOTICE =
  'The app sends nothing anywhere. Dives, sites and buddies stay in the logbook ' +
  'file on this device, and are shared only when you export or share one ' +
  'yourself. There is no analytics and no crash reporting service; problems are ' +
  'written to a log you can read and share below.';

/** The line under the source link, telling the user what the link is for. */
export const SOURCE_NOTICE =
  'The GPL gives you the right to the source of what you are running. This is it.';
