// AI-generated (Claude)
// The dive planner, through the same bindings the app runs.
//
// The plans and expectations are subsurface/tests/testplan.cpp's: what the core's
// own regression test says a plan must come to, not numbers copied back out of the
// bindings. Runtimes are the "known Subsurface runtime" there, the value that test
// reports a change against. Where it asks for a gas change at a depth, so does this.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { CylinderUse, SsrfCoreError } from '../src/models';
import type { PlanInput, PlanResult, PlanSegmentInput } from '../src/models';
import { SsrfHost } from './harness/ssrf-host';

let host: SsrfHost;

beforeAll(() => {
  host = new SsrfHost();
});

afterAll(async () => {
  await host.close();
});

beforeEach(async () => {
  await host.clear();
});

const FT = 304.8;
/** `m_or_ft()`. */
const mOrFt = (imperial: boolean, m: number, ft: number) =>
  imperial ? Math.round(ft * FT) : m * 1000;

/** setupPrefs() */
function prefs(imperial = false): Partial<PlanInput> {
  // feet_to_mm(30) / 60 and feet_to_mm(10) / 60, truncated like the C++.
  const rate30 = Math.trunc((30 * 304.8) / 60);
  const rate10 = Math.trunc((10 * 304.8) / 60);
  return {
    imperial,
    ascrate50: rate30,
    ascrate75: rate30,
    ascratestops: rate30,
    ascratelast6m: rate10,
    lastStop6m: true,
    gfLow: 100,
    gfHigh: 100,
  };
}

/** setupPrefsVpmb() */
function prefsVpmb(): Partial<PlanInput> {
  const rate = Math.trunc(10000 / 60);
  return {
    decoMode: 2,
    ascrate50: rate,
    ascrate75: rate,
    ascratestops: rate,
    ascratelast6m: rate,
    descrate: Math.trunc(99000 / 60),
    lastStop6m: false,
    vpmbConservatism: 0,
  };
}

const gas = (o2: number, he = 0, sizeL = 0, bar = 0) => ({
  o2Permille: o2 * 10,
  hePermille: he * 10,
  sizeMl: sizeL * 1000,
  pressureMbar: bar * 1000,
});

/** The two segments every setup in testplan.cpp ends with: down, then the rest of the time. */
function square(
  depthMm: number,
  minutes: number,
  descentMmPerMin: number,
  cylinder = 0,
): PlanSegmentInput[] {
  const droptime = Math.trunc((depthMm * 60) / descentMmPerMin);
  return [
    { depthMm, durationSec: droptime, cylinder },
    { depthMm, durationSec: minutes * 60 - droptime, cylinder },
  ];
}

/** `lrint(minimum_gas.mbar / 1000.0)` of the waypoint that has one. */
function minimumGasBar(result: PlanResult): number {
  const cylinder = result.cylinders.find((c) => c.minimumGasMbar !== 0);
  return cylinder ? Math.round(cylinder.minimumGasMbar / 1000) : 0;
}

/** `get_depth_at_time(dc, ev->time)` for the nth gas change. */
function gasChange(result: PlanResult, n: number) {
  const events = (result.dive?.dcs[0].events ?? []).filter((e) => e.gasIndex !== undefined);
  const event = events[n];
  const entries = result.profile?.entry ?? [];
  const entry = entries.find((e) => e.sec >= event.timeSec);
  return { index: event.gasIndex, o2: event.gasmix?.o2Permille, depthMm: entry?.depthMm };
}

describe('planDive against testplan.cpp', () => {
  const input79m = (imperial: boolean): PlanInput => ({
    ...prefs(imperial),
    surfacePressureMbar: 1013,
    cylinders: [gas(15, 45, 36, 232), gas(36), gas(100)],
    segments: square(mOrFt(imperial, 79, 260), 30, mOrFt(imperial, 23, 75)),
  });

  it('testMetric', async () => {
    const result = await host.planDive(input79m(false));
    expect(result.error).toBe('ok');
    expect(minimumGasBar(result)).toBe(148);
    expect(gasChange(result, 0)).toEqual({ index: 1, o2: 360, depthMm: 33000 });
    expect(gasChange(result, 1)).toEqual({ index: 2, o2: 1000, depthMm: 6000 });
    expect(result.runtimeSec).toBe(109 * 60);
  });

  it('testImperial', async () => {
    const result = await host.planDive(input79m(true));
    expect(result.error).toBe('ok');
    expect(minimumGasBar(result)).toBe(155);
    expect(gasChange(result, 0)).toEqual({ index: 1, o2: 360, depthMm: 33528 });
    expect(gasChange(result, 1)).toEqual({ index: 2, o2: 1000, depthMm: 6096 });
    expect(result.runtimeSec).toBe(111 * 60 - 2);
  });

  it('testVpmbMetric45m30minTx', async () => {
    const result = await host.planDive({
      ...prefsVpmb(),
      cylinders: [gas(21, 35, 24, 232), gas(50), gas(100)],
      segments: square(45000, 30, 23000),
    });
    expect(minimumGasBar(result)).toBe(108);
  });

  it('testVpmbMetric60m10minTx', async () => {
    const result = await host.planDive({
      ...prefsVpmb(),
      cylinders: [gas(18, 45, 24, 232), gas(50, 15), gas(100)],
      segments: square(60000, 10, 23000),
    });
    expect(minimumGasBar(result)).toBe(162);
  });

  it('testVpmbMetric60m30minAir', async () => {
    const result = await host.planDive({
      ...prefsVpmb(),
      cylinders: [gas(21, 0, 100, 232)],
      segments: square(60000, 30, 99000),
    });
    expect(minimumGasBar(result)).toBe(180);
    expect(result.runtimeSec).toBe(139 * 60 + 20);
  });

  it('testVpmbMetric60m30minEan50', async () => {
    const result = await host.planDive({
      ...prefsVpmb(),
      cylinders: [gas(21, 0, 36, 232), gas(50)],
      segments: square(60000, 30, 99000),
    });
    expect(minimumGasBar(result)).toBe(155);
    expect(gasChange(result, 0)).toEqual({ index: 1, o2: 500, depthMm: 21000 });
    expect(result.runtimeSec).toBe(96 * 60 + 20);
  });

  it('testVpmbMetric60m30minTx', async () => {
    const result = await host.planDive({
      ...prefsVpmb(),
      cylinders: [gas(18, 45, 36, 232), gas(50)],
      segments: square(60000, 30, 99000),
    });
    expect(minimumGasBar(result)).toBe(159);
    expect(gasChange(result, 0)).toEqual({ index: 1, o2: 500, depthMm: 21000 });
    expect(result.runtimeSec).toBe(89 * 60 + 20);
  });

  it('testVpmbMetric100m60min', async () => {
    const result = await host.planDive({
      ...prefsVpmb(),
      cylinders: [gas(18, 45, 200, 232), gas(50), gas(100)],
      segments: square(100000, 60, 99000),
    });
    expect(minimumGasBar(result)).toBe(157);
    expect(gasChange(result, 0)).toEqual({ index: 1, o2: 500, depthMm: 21000 });
    expect(gasChange(result, 1)).toEqual({ index: 2, o2: 1000, depthMm: 6000 });
    expect(result.runtimeSec).toBe(315 * 60 + 20);
  });

  it('testVpmbMetricMultiLevelAir', async () => {
    const result = await host.planDive({
      ...prefsVpmb(),
      cylinders: [gas(21, 0, 200, 232)],
      segments: [
        ...square(20000, 10, 99000),
        { depthMm: 60000, durationSec: 60, cylinder: 0 },
        { depthMm: 60000, durationSec: 29 * 60, cylinder: 0 },
      ],
    });
    expect(minimumGasBar(result)).toBe(101);
    expect(result.runtimeSec).toBe(169 * 60 + 20);
  });

  it('testVpmbMetric100m10min', async () => {
    const result = await host.planDive({
      ...prefsVpmb(),
      cylinders: [gas(18, 45, 60, 232), gas(50), gas(100)],
      segments: square(100000, 10, 99000),
    });
    expect(minimumGasBar(result)).toBe(175);
    expect(gasChange(result, 0)).toEqual({ index: 1, o2: 500, depthMm: 21000 });
    expect(gasChange(result, 1)).toEqual({ index: 2, o2: 1000, depthMm: 6000 });
    expect(result.runtimeSec).toBe(57 * 60 + 20);
  });

  it('testMultipleGases', async () => {
    const result = await host.planDive({
      ...prefsVpmb(),
      cylinders: [gas(36, 0, 36, 232), gas(11, 50)],
      segments: [
        { depthMm: 40000, durationSec: 120, cylinder: 0 },
        { depthMm: 40000, durationSec: 18 * 60, cylinder: 0 },
        { depthMm: 10000, durationSec: 10 * 60, cylinder: 1 },
        { depthMm: 10000, durationSec: 5 * 60, cylinder: 0 },
      ],
    });
    expect(result.runtimeSec).toBe(2480);
  });

  it('testCcrBailoutGasSelection', async () => {
    const result = await host.planDive({
      ...prefs(),
      // setupPlanCcr()
      gfLow: 50,
      gfHigh: 70,
      diveMode: 1,
      doBailout: true,
      cylinders: [
        { ...gas(20, 21, 3, 200), use: CylinderUse.Diluent },
        gas(53),
        gas(19, 33),
      ],
      segments: [{ depthMm: 60000, durationSec: 20 * 60, cylinder: 0, setpointMbar: 1300 }],
    });
    expect(result.error).toBe('ok');
    const at = (sec: number) =>
      result.waypoints.find((w) => w.timeSec >= sec)?.cylinder;
    // Diluent to the end of the bottom time, then the deep bailout, then the shallow one.
    expect(at(20 * 60 - 1)).toBe(0);
    expect(at(20 * 60 + 1)).toBe(2);
    expect(at(30 * 60)).toBe(1);
    expect(result.runtimeSec).toBe(51 * 60);
  });

  it('testRecreationalWithinNDL', async () => {
    const result = await host.planDive({
      ...prefs(),
      decoMode: 1,
      reserveGasMbar: 40000,
      cylinders: [gas(21, 0, 24, 232)],
      segments: square(20000, 20, 23000),
    });
    expect(result.error).toBe('ok');
    // Recreational mode stays down until the limit or the reserve, so the bottom
    // time is the answer, not what was entered.
    expect(result.bottomTimeSec).toBeGreaterThanOrEqual(20 * 60);
    expect(result.notes).not.toContain('Warning:');
  });

  it('testRecreationalExceedingNDL', async () => {
    const result = await host.planDive({
      ...prefs(),
      decoMode: 1,
      reserveGasMbar: 40000,
      cylinders: [gas(21, 0, 24, 232)],
      segments: square(50000, 50, 23000),
    });
    expect(result.error).toBe('recreationalExceedsNdl');
    expect(result.notes).toContain('exceeds the no-decompression limit');
    // Kept for the diver to see why, unlike the errors with no ascent to show.
    expect(result.profile).not.toBeNull();
  });

  it('testZeroDurationO2SwitchSampleOrder', async () => {
    const result = await host.planDive({
      gfLow: 35,
      gfHigh: 75,
      diveMode: 2,
      cylinders: [gas(32, 0, 18, 232), gas(50, 0, 11, 232), gas(100, 0, 7, 232)],
      segments: square(30000, 20, 18000).map((s) => ({ ...s, diveMode: 2 as const })),
    });
    expect(result.error).toBe('ok');
    const times = result.profile?.entry.map((e) => e.sec) ?? [];
    expect(times.length).toBeGreaterThan(1);
    expect(times.every((t, i) => i === 0 || t >= times[i - 1])).toBe(true);
  });
});

describe('planDive around the core', () => {
  const simple = (extra: Partial<PlanInput> = {}): PlanInput => ({
    cylinders: [gas(21, 0, 12, 200)],
    segments: [{ depthMm: 30000, durationSec: 20 * 60, cylinder: 0 }],
    dropStone: true,
    ...extra,
  });

  it('leaves the preferences as it found them', async () => {
    await host.nitroxPlan({ depthMm: 30000, o2Permille: 320 });
    const before = await host.nitroxPlan({ depthMm: 30000, o2Permille: 320 });
    await host.planDive(simple({ imperial: true, decoMode: 2, gfLow: 10, gfHigh: 20 }));
    const after = await host.nitroxPlan({ depthMm: 30000, o2Permille: 320 });
    expect(after).toEqual(before);
  });

  it('keeps the entered time when dropping to the first depth', async () => {
    const result = await host.planDive(simple());
    expect(result.bottomTimeSec).toBe(20 * 60);
    // 30 m at the core's default 18 m/min is 100 s, and the time at depth makes up the rest.
    const entered = result.waypoints.filter((w) => w.entered);
    expect(entered.map((w) => w.timeSec)).toEqual([100, 20 * 60]);
  });

  it('refuses a first segment shorter than its descent', async () => {
    await expect(
      host.planDive(simple({ segments: [{ depthMm: 30000, durationSec: 60, cylinder: 0 }] })),
    ).rejects.toThrow('shorter than the descent');
  });

  it('moves the first gas to the front, and says which it was', async () => {
    const result = await host.planDive(
      simple({
        cylinders: [gas(50, 0, 7, 200), gas(21, 0, 12, 200)],
        segments: [{ depthMm: 30000, durationSec: 20 * 60, cylinder: 1 }],
      }),
    );
    expect(result.cylinders.map((c) => c.o2Permille)).toEqual([210, 500]);
    expect(result.cylinders.map((c) => c.inputIndex)).toEqual([1, 0]);
    // Air from the first second: the first gas change is the EAN50 on the way up.
    expect(gasChange(result, 0).o2).toBe(500);
  });

  it('takes o2Permille 0 as the core\'s air, which is not an exact 21%', async () => {
    const at = (o2Permille: number) =>
      host.planDive(simple({ cylinders: [{ o2Permille, sizeMl: 12000, pressureMbar: 200000 }] }));
    const [air, exact] = [await at(0), await at(210)];
    expect(air.cylinders[0].o2Permille).toBe(209);
    expect(exact.cylinders[0].o2Permille).toBe(210);
    expect(air.cylinders[0].name).toBe('Air');
  });

  it('reports the gas used against the gas carried', async () => {
    const result = await host.planDive(simple());
    const [cyl] = result.cylinders;
    expect(cyl.startMbar).toBe(200000);
    expect(cyl.endMbar).toBeLessThan(cyl.startMbar);
    expect(cyl.gasCarriedMl).toBeGreaterThan(2000000);
    expect(cyl.gasUsedMl).toBeGreaterThan(1000000);
    expect(cyl.decoGasUsedMl).toBeLessThan(cyl.gasUsedMl);
    expect(cyl.switchDepthMm).toBeGreaterThan(60000);
  });

  it('warns about using more gas than is carried', async () => {
    const result = await host.planDive(simple({ cylinders: [gas(21, 0, 3, 200)] }));
    expect(result.notes).toContain('more gas than available');
  });

  it('warns about a high pO2 on an entered segment', async () => {
    const result = await host.planDive(simple({ cylinders: [gas(50, 0, 24, 200)] }));
    expect(result.notes).toContain('high pO₂');
  });

  it('warns about a low pO2', async () => {
    const result = await host.planDive(
      simple({
        cylinders: [gas(10, 70, 24, 200)],
        segments: [{ depthMm: 3000, durationSec: 20 * 60, cylinder: 0 }],
      }),
    );
    expect(result.notes).toContain('low pO₂');
  });

  it('warns about isobaric counterdiffusion', async () => {
    const result = await host.planDive({
      cylinders: [gas(18, 45, 24, 232), gas(50)],
      segments: [{ depthMm: 60000, durationSec: 20 * 60, cylinder: 0 }],
    });
    expect(result.notes).toContain('Isobaric counterdiffusion');
  });

  it('reports an unusable cylinder with no ascent to show', async () => {
    const result = await host.planDive(
      simple({
        cylinders: [gas(21, 0, 12, 200), { ...gas(21, 0, 3, 200), use: CylinderUse.Diluent }],
        segments: [{ depthMm: 30000, durationSec: 20 * 60, cylinder: 1 }],
      }),
    );
    expect(result.error).toBe('inappropriateGas');
    expect(result.notes).toContain('inappropriate');
    expect(result.profile).toBeNull();
  });

  it('reports a bailout with no suitable gas', async () => {
    const result = await host.planDive({
      diveMode: 1,
      doBailout: true,
      cylinders: [{ ...gas(20, 21, 3, 200), use: CylinderUse.Diluent }, gas(100, 0, 3, 200)],
      segments: [{ depthMm: 60000, durationSec: 20 * 60, cylinder: 0, setpointMbar: 1300 }],
    });
    expect(result.error).toBe('noSuitableBailoutGas');
    expect(result.profile).toBeNull();
  });

  it('is more conservative with a higher VPM-B setting', async () => {
    const at = (vpmbConservatism: number) =>
      host.planDive({
        decoMode: 2,
        vpmbConservatism,
        cylinders: [gas(21, 0, 24, 232)],
        segments: square(45000, 25, 18000),
      });
    const [nominal, plus4] = [await at(0), await at(4)];
    expect(plus4.runtimeSec).toBeGreaterThan(nominal.runtimeSec);
    expect(plus4.notes).toContain('+4 conservatism');
    expect(nominal.notes).toContain('nominal conservatism');
  });

  it('prints the notes in the units asked for', async () => {
    const metric = await host.planDive(simple());
    const imperial = await host.planDive(simple({ imperial: true }));
    expect(metric.notes).toMatch(/\d\s*m\b/);
    expect(imperial.notes).toMatch(/\d\s*ft\b/);
    expect(imperial.notes).toContain('psi');
  });

  it('computes the variations and leaves no token in the notes', async () => {
    const result = await host.planDive(simple({ displayVariations: true }));
    expect(result.notes).toContain('Stop times:');
    expect(result.notes).not.toContain('VARIATIONS');
  });

  it('plans a plan on air at altitude as staying longer than at sea level', async () => {
    const sea = await host.planDive(simple());
    const high = await host.planDive(simple({ surfacePressureMbar: 700 }));
    expect(high.runtimeSec).toBeGreaterThan(sea.runtimeSec);
    expect(high.notes).toContain('ATM pressure');
  });

  // Patch 0010: the core's stop limit was on the dive's clock, and a dive running past
  // two days sent wait_until() into a recursion that ended in a stack overflow.
  it('survives a plan whose runtime passes two days', async () => {
    const result = await host.planDive({
      decoMode: 2,
      dropStone: true,
      cylinders: [gas(10, 70, 200, 232), gas(50), gas(100)],
      segments: [{ depthMm: 300000, durationSec: 360 * 60, cylinder: 0 }],
    });
    expect(['ok', 'timeout']).toContain(result.error);
  });

  it('rejects what it cannot plan', async () => {
    await expect(host.planDive(simple({ cylinders: [] }))).rejects.toThrow(SsrfCoreError);
    await expect(host.planDive(simple({ segments: [] }))).rejects.toThrow(SsrfCoreError);
    await expect(host.planDive(simple({ ascrate75: 0 }))).rejects.toThrow('ascrate75');
    await expect(
      host.planDive(simple({ cylinders: [gas(60, 50, 12, 200)] })),
    ).rejects.toThrow('100%');
    await expect(
      host.planDive(simple({ segments: [{ depthMm: 30000, durationSec: 600, cylinder: 3 }] })),
    ).rejects.toThrow('cylinder');
    await expect(host.planDive(simple({ gfLow: 90, gfHigh: 40 }))).rejects.toThrow('gfLow');
  });
});

describe('savePlan', () => {
  const when = 1800000000;
  const plan: PlanInput = {
    when,
    dropStone: true,
    cylinders: [gas(21, 0, 12, 200)],
    segments: [{ depthMm: 30000, durationSec: 20 * 60, cylinder: 0 }],
  };

  it('adds a dive recognisable as planned, with the disclaimer in its notes', async () => {
    const preview = await host.planDive(plan);
    const { id } = await host.savePlan(plan);
    const [summary] = await host.listDives();
    expect(summary.id).toBe(id);
    expect(summary.planned).toBe(true);
    expect(summary.number).toBe(1);
    expect(summary.dcModel).toBe('planned dive');
    expect(summary.durationSec).toBe(preview.runtimeSec);
    const dive = await host.getDive(id);
    expect(dive.notes).toContain('DISCLAIMER');
    expect(dive.notes).toContain('Runtime:');
    expect(preview.notes).not.toContain('DISCLAIMER');
    expect(preview.disclaimer).toContain('BUHLMANN');
  });

  it('survives a round trip through the file', async () => {
    const { id } = await host.savePlan(plan);
    const before = await host.getDive(id);
    const path = `${process.env.TMPDIR ?? '/tmp'}/planned-${process.pid}.ssrf`;
    await host.saveToXML(path);
    await host.clear();
    await host.loadFromXML(path);
    const [after] = await host.listDives();
    expect(after.planned).toBe(true);
    expect(after.durationSec).toBe(before.durationSec);
    expect((await host.getDive(after.id)).notes).toContain('Runtime:');
  });

  it('counts a saved plan as tissue loading for the next one', async () => {
    const alone = await host.planDive(plan);
    await host.savePlan(plan);
    const next = await host.planDive({ ...plan, when: when + alone.runtimeSec + 3600 });
    expect(next.surfaceIntervalSec).toBe(3600);
    expect(next.runtimeSec).toBeGreaterThan(alone.runtimeSec);
    expect(next.notes).toContain('surface interval');
  });

  it('reports an overlap with a dive in the log', async () => {
    await host.savePlan(plan);
    const overlap = await host.planDive({ ...plan, when: when + 60 });
    expect(overlap.surfaceIntervalSec).toBeLessThan(0);
    expect(overlap.notes).toContain('overlapping dives');
  });

  it('refuses a plan the core would not stand behind', async () => {
    await expect(
      host.savePlan({
        decoMode: 1,
        cylinders: [gas(21, 0, 24, 232)],
        segments: square(50000, 50, 23000),
      }),
    ).rejects.toThrow('recreationalExceedsNdl');
    expect(await host.listDives()).toEqual([]);
  });
});

describe('gasInfo', () => {
  it('gives the MOD of air and an END equal to the depth with oxygen narcotic', async () => {
    const info = await host.gasInfo({ o2Permille: 210 });
    expect(info.name).toBe('Air');
    const row14 = info.rows.find((r) => r.po2Mbar === 1400);
    // 1.4 / 0.21 = 6.67 bar ambient: about 56 m of sea water.
    expect(row14?.modMm).toBeGreaterThan(55500);
    expect(row14?.modMm).toBeLessThan(56500);
    expect(Math.abs((row14?.narcoticDepthMm ?? 0) - (row14?.modMm ?? 0))).toBeLessThan(10);
    expect(info.rows.map((r) => r.po2Mbar)).toEqual([
      1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000,
    ]);
    expect(info.minDepthMm).toBe(0);
  });

  it('agrees with nitroxPlan on the MOD', async () => {
    const info = await host.gasInfo({ o2Permille: 320 });
    const nitrox = await host.nitroxPlan({ depthMm: 30000, o2Permille: 320 });
    expect(info.rows.find((r) => r.po2Mbar === 1400)?.modMm).toBe(nitrox.modMm);
    expect(info.rows.find((r) => r.po2Mbar === 1600)?.modMm).toBe(nitrox.contingencyModMm);
  });

  it('reduces the END with helium, and the EAD by the nitrogen alone', async () => {
    const end = await host.gasInfo({ o2Permille: 180, hePermille: 450 });
    const row = end.rows.find((r) => r.po2Mbar === 1400);
    expect(row?.narcoticDepthMm).toBeLessThan((row?.modMm ?? 0) * 0.65);
    const ead = await host.gasInfo({ o2Permille: 180, hePermille: 450, o2Narcotic: false });
    expect(ead.rows.find((r) => r.po2Mbar === 1400)?.narcoticDepthMm).toBeLessThan(
      row?.narcoticDepthMm ?? 0,
    );
    expect(ead.o2Narcotic).toBe(false);
  });

  it('says how deep a hypoxic mix starts to be breathable', async () => {
    const info = await host.gasInfo({ o2Permille: 100, hePermille: 700 });
    // 0.16 / 0.10 = 1.6 bar ambient: about 6 m.
    expect(info.minDepthMm).toBeGreaterThan(5500);
    expect(info.minDepthMm).toBeLessThan(6500);
  });

  it('gives fresh water a deeper MOD than sea water', async () => {
    const salt = await host.gasInfo({ o2Permille: 320 });
    const fresh = await host.gasInfo({ o2Permille: 320, salinity: 10000 });
    expect(fresh.rows[4].modMm).toBeGreaterThan(salt.rows[4].modMm);
  });

  it('finds the best mix for a depth', async () => {
    const info = await host.gasInfo({
      o2Permille: 210,
      bestMix: { depthMm: 60000, bottomPo2Mbar: 1400, bestMixEndMm: 30000 },
    });
    // 1.4 / 7.07 = 19%; (1 - 4.04 / 7.07) = 42.9% helium, rounded to whole percents.
    expect(info.best?.o2Permille).toBe(190);
    expect(info.best?.hePermille).toBe(430);
  });

  it('rejects a mix that is not one', async () => {
    await expect(host.gasInfo({ o2Permille: 600, hePermille: 500 })).rejects.toThrow('100%');
    await expect(host.gasInfo({ o2Permille: 0 })).rejects.toThrow(SsrfCoreError);
  });
});

describe('plannerOptions and plannerSurface', () => {
  it('lists the core table of cylinders with their sizes', async () => {
    const { tanks } = await host.plannerOptions();
    const al80 = tanks.find((t) => t.name === 'AL80');
    expect(al80?.sizeMl).toBeGreaterThan(11000);
    expect(al80?.workingPressureMbar).toBeGreaterThan(200000);
    expect(tanks.every((t) => t.sizeMl > 0)).toBe(true);
  });

  it('converts altitude and pressure back and forth', async () => {
    const atSea = await host.plannerSurface({ altitudeMm: 0 });
    expect(atSea.surfacePressureMbar).toBe(1013);
    expect(atSea.altitudeMm).toBeLessThan(10);
    const up = await host.plannerSurface({ altitudeMm: 2000000 });
    expect(up.surfacePressureMbar).toBeGreaterThan(780);
    expect(up.surfacePressureMbar).toBeLessThan(810);
    const back = await host.plannerSurface({ surfacePressureMbar: up.surfacePressureMbar });
    expect(Math.abs(back.altitudeMm - 2000000)).toBeLessThan(10000);
  });

  it('never goes below sea level or past the range the planner takes', async () => {
    expect((await host.plannerSurface({ surfacePressureMbar: 1100 })).altitudeMm).toBe(0);
    expect((await host.plannerSurface({ altitudeMm: 9000000 })).surfacePressureMbar).toBe(689);
  });
});
