// AI-generated (Claude)
// The month labels the core writes itself follow the device's region.
//
// The configurable statistics' monthly binner labels its bins through
// `monthname()` (core/time.cpp), which the gettext shim maps to the names the app
// hands `configure` (cpp/shim/gettext.cpp). Everything else the app shows is
// formatted in TypeScript (src/models/date-format.ts); this is the one place the
// core spells a month.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { fixture } from './harness/fixtures';
import { SsrfHost } from './harness/ssrf-host';

let host: SsrfHost;

beforeAll(async () => {
  host = new SsrfHost();
  await host.loadFromXML(fixture('abitofeverything.ssrf'));
});

afterAll(async () => {
  await host.close();
});

const GERMAN = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];

async function monthlyLabels(): Promise<string> {
  const { options } = await host.statsChart({ config: { var1: 'Date' } });
  const monthly = options.binners1.findIndex((name) => /month/i.test(name));
  expect(monthly).toBeGreaterThan(-1);
  const result = await host.statsChart({ config: { var1: 'Date', binner1: monthly } });
  return JSON.stringify(result.chart);
}

describe('month names', () => {
  it('are English until the app says otherwise', async () => {
    expect(await monthlyLabels()).toMatch(/"Dec 2011"|Dec/);
  });

  it('follow the names configure hands over', async () => {
    await host.configurePreferences({ monthNames: GERMAN });
    const labels = await monthlyLabels();
    expect(labels).toContain('Dez.');
    expect(labels).not.toMatch(/\bDec\b/);
  });

  it('refuses a list that is not twelve strings', async () => {
    await expect(host.configurePreferences({ monthNames: ['Jan'] })).rejects.toThrow(/12 strings/);
  });
});
