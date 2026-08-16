// AI-generated (Claude)
// Tests for the About section.
//
// The licence wording is checked because it is a GPL-2.0 obligation rather than
// a piece of copy: the app links the Subsurface core, so it has to name the
// licence and point at the source.

import { describe, expect, it } from 'vitest';

import { aboutRows, LICENSE_NOTICE, PRIVACY_NOTICE, type AboutInfo } from './about';

const INFO: AboutInfo = {
  appVersion: '1.0.0',
  buildNumber: '7',
  coreCommit: 'e412ccb85',
  coreVersion: '6.0.5658',
  sourceUrl: 'https://github.com/agrippa1994/subsurface-mobile',
};

describe('aboutRows', () => {
  it('names the app build and the core it was built against', () => {
    expect(aboutRows(INFO)).toEqual([
      { label: 'Version', value: '1.0.0 (7)' },
      { label: 'Subsurface core', value: '6.0.5658' },
      { label: 'Core commit', value: 'e412ccb85' },
    ]);
  });

  it('leaves out the build number when there is none, rather than showing ()', () => {
    expect(aboutRows({ ...INFO, buildNumber: '' })[0].value).toBe('1.0.0');
  });
});

describe('the notices', () => {
  it('names the licence and disclaims warranty', () => {
    expect(LICENSE_NOTICE).toContain('GNU General Public License version 2');
    expect(LICENSE_NOTICE).toContain('no warranty');
  });

  it('states that nothing is sent anywhere', () => {
    expect(PRIVACY_NOTICE).toContain('sends nothing anywhere');
    expect(PRIVACY_NOTICE).toContain('no analytics');
  });
});
