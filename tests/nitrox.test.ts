// AI-generated (Claude)
// The nitrox calculator on the Tools tab, through the same bindings the app
// runs. Expectations are the textbook values the core's formulas must land on,
// not numbers copied back out of the bindings.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SsrfCoreError } from '../src/models';
import { SsrfHost } from './harness/ssrf-host';

let host: SsrfHost;

beforeAll(() => {
  host = new SsrfHost();
});

afterAll(async () => {
  await host.close();
});

describe('nitroxPlan', () => {
  it('computes the MOD of EAN32 in sea water', async () => {
    const plan = await host.nitroxPlan({ depthMm: 30000, o2Permille: 320 });
    // 1.4 / 0.32 = 4.375 bar ambient; (4375 - 1013) mbar at 0.10104 mbar/mm.
    expect(plan.modMm).toBeGreaterThan(33000);
    expect(plan.modMm).toBeLessThan(33500);
    expect(plan.contingencyModMm).toBeGreaterThan(39000);
    expect(plan.contingencyModMm).toBeLessThan(39700);
    expect(plan.po2Mbar).toBe(Math.round((plan.ambientMbar * 320) / 1000));
  });

  it('gives fresh water a deeper MOD than sea water', async () => {
    const salt = await host.nitroxPlan({ depthMm: 20000, o2Permille: 360 });
    const fresh = await host.nitroxPlan({ depthMm: 20000, o2Permille: 360, salinity: 10000 });
    expect(fresh.modMm).toBeGreaterThan(salt.modMm);
  });

  it('picks the richest mix the working pO2 allows', async () => {
    // 30 m sea water is ~4.04 bar: 1.4 / 4.04 = 34.6%, rounded down to 34.
    const plan = await host.nitroxPlan({ depthMm: 30000, o2Permille: 320 });
    expect(plan.bestMixPermille).toBe(340);
  });

  it('gives nitrox a longer NDL than air, and air a plausible Buehlmann one', async () => {
    const plan = await host.nitroxPlan({
      depthMm: 18000,
      o2Permille: 320,
      gfLow: 100,
      gfHigh: 100,
    });
    // Pure ZHL-16C on air at 18 m is just under an hour.
    expect(plan.airNdlMin).toBeGreaterThan(50);
    expect(plan.airNdlMin).toBeLessThan(65);
    expect(plan.ndlMin).toBeGreaterThan(plan.airNdlMin ?? Infinity);
  });

  it('gets more conservative with a lower GF high', async () => {
    const liberal = await host.nitroxPlan({
      depthMm: 30000,
      o2Permille: 210,
      gfLow: 100,
      gfHigh: 100,
    });
    const strict = await host.nitroxPlan({
      depthMm: 30000,
      o2Permille: 210,
      gfLow: 30,
      gfHigh: 70,
    });
    expect(strict.airNdlMin).toBeLessThan(liberal.airNdlMin ?? 0);
  });

  it('reports no limit on a shallow dive', async () => {
    const plan = await host.nitroxPlan({ depthMm: 6000, o2Permille: 400 });
    expect(plan.ndlMin).toBeNull();
  });

  it('rejects out-of-range arguments', async () => {
    await expect(host.nitroxPlan({ depthMm: 1000, o2Permille: 320 })).rejects.toThrow(
      SsrfCoreError,
    );
    await expect(host.nitroxPlan({ depthMm: 20000, o2Permille: 150 })).rejects.toThrow(
      SsrfCoreError,
    );
    await expect(
      host.nitroxPlan({ depthMm: 20000, o2Permille: 320, maxPo2Mbar: 2000 }),
    ).rejects.toThrow(SsrfCoreError);
  });
});
