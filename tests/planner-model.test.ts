// AI-generated (Claude)
// The presentation model over what the core really answers: the default plan on
// screen, its stops, its gas rows and its warnings, through the host binary.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CylinderUse, PlanDecoMode, PlanDiveMode, type Cylinder } from '../src/models';
import {
  addCylinder,
  addSegment,
  cylinderInUse,
  defaultPlanDraft,
  defaultPlanWhen,
  depthFromValue,
  depthValue,
  draftProblem,
  fillFromValue,
  fillValue,
  newCylinderDraft,
  patchCylinder,
  patchSegment,
  planCanBeSaved,
  planFailure,
  planGasRows,
  planHasResult,
  planHeadline,
  planInput,
  planStops,
  planTankFrom,
  planWarnings,
  removeCylinder,
  removeSegment,
  setDiveMode,
  surfaceIntervalText,
  tankPatch,
  type PlanDraft,
} from '../src/models/planner';
import { DEFAULT_PLANNER_SETTINGS, type PlannerSettings } from '../src/models/planner-settings';
import { SsrfHost } from './harness/ssrf-host';
import { IMPERIAL_UNITS, METRIC_UNITS, type Units } from '../src/models/units';

let host: SsrfHost;

beforeAll(() => {
  host = new SsrfHost();
});

afterAll(async () => {
  await host.close();
});

const gf = { gfLow: 30, gfHigh: 75 };
const WHEN = 1800000000;

const run = (draft: PlanDraft, settings: PlannerSettings = DEFAULT_PLANNER_SETTINGS, units: Units = METRIC_UNITS) =>
  host.planDive(planInput(draft, settings, units, gf));

/** A deco dive, on a cylinder big enough to take the core's gas warnings out of it. */
const deep = (): PlanDraft => {
  const draft = defaultPlanDraft(METRIC_UNITS, WHEN);
  return patchSegment(draft, draft.segments[0].key, { depthMm: 40000, minutes: 30 });
};

describe('the default plan', () => {
  it('plans in both unit systems with nothing else asked for', async () => {
    for (const system of [METRIC_UNITS, IMPERIAL_UNITS]) {
      const result = await run(defaultPlanDraft(system, WHEN), DEFAULT_PLANNER_SETTINGS, system);
      expect(result.error).toBe('ok');
      expect(planWarnings(result, system, WHEN, [])).toEqual([]);
      expect(planCanBeSaved(result)).toBe(true);
    }
  });

  it('sends 21% as the core\'s air', () => {
    const input = planInput(defaultPlanDraft(METRIC_UNITS, WHEN), DEFAULT_PLANNER_SETTINGS, METRIC_UNITS, gf);
    expect(input.cylinders[0].o2Permille).toBe(0);
    expect(input.cylinders[0].description).toBe('12L 200 bar');
  });

  it('starts an hour from now on the local clock, on the next five minutes', () => {
    // 12:01 UTC in a zone two hours ahead (Date's offset is -120) is 14:01 local.
    const now = Date.UTC(2026, 10, 6, 12, 1, 0);
    const when = defaultPlanWhen(now, -120);
    expect(new Date(when * 1000).toISOString()).toBe('2026-11-06T15:05:00.000Z');
  });

  it('starts an hour after a dive that ends later than that', () => {
    const now = Date.UTC(2026, 10, 6, 12, 0, 0);
    const later = Date.UTC(2026, 10, 7, 10, 0, 0) / 1000;
    const when = defaultPlanWhen(now, 0, [{ when: later, durationSec: 3600 }]);
    expect(new Date(when * 1000).toISOString()).toBe('2026-11-07T12:00:00.000Z');
  });
});

describe('the reply', () => {
  it('reads the stops off the waypoints, shallowest last', async () => {
    const result = await run(deep());
    const stops = planStops(result);
    expect(stops.length).toBeGreaterThan(1);
    expect(stops[stops.length - 1].depthMm).toBe(3000);
    expect(stops.every((stop) => stop.durationSec > 0 && stop.gas === 'Air')).toBe(true);
    const depths = stops.map((stop) => stop.depthMm);
    expect([...depths].sort((a, b) => b - a)).toEqual(depths);
    // Runtime is the bottom time, the stops, and the travel between them.
    const total = stops.reduce((sum, stop) => sum + stop.durationSec, 0);
    expect(total).toBeLessThan(result.runtimeSec - result.bottomTimeSec);
    expect(planHeadline(result).decoLine).toContain(`${stops.length} stops`);
  });

  it('says no stops on a dive with none', async () => {
    const draft = defaultPlanDraft(METRIC_UNITS, WHEN);
    const shallow = patchSegment(draft, draft.segments[0].key, { depthMm: 10000, minutes: 20 });
    const result = await run(shallow);
    expect(planStops(result)).toEqual([]);
    expect(planHeadline(result).decoLine).toContain('No stops');
  });

  it('shows a recreational plan with a safety stop as what it is', async () => {
    const result = await run(defaultPlanDraft(METRIC_UNITS, WHEN), {
      ...DEFAULT_PLANNER_SETTINGS,
      decoMode: PlanDecoMode.Recreational,
    });
    expect(planStops(result).map((stop) => stop.depthMm)).toEqual([5000]);
    expect(planStops(result)[0].durationSec).toBe(180);
  });

  it('does not take the surface segment for a stop', async () => {
    const result = await run(deep(), { ...DEFAULT_PLANNER_SETTINGS, surfaceSegmentSec: 300 });
    expect(planStops(result).every((stop) => stop.depthMm > 0)).toBe(true);
  });

  it('merges the stop pieces back gas breaks do not split', async () => {
    const draft = addCylinder(deep(), { ...newCylinderDraft(METRIC_UNITS), o2Percent: 100, tank: '3L 232 bar', sizeMl: 3000 });
    const breaks = await run(draft, { ...DEFAULT_PLANNER_SETTINGS, o2Breaks: true });
    const stops = planStops(breaks);
    expect(stops.some((stop) => stop.gas === 'Oxygen')).toBe(true);
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i].depthMm === stops[i - 1].depthMm && stops[i].gas === stops[i - 1].gas).toBe(false);
    }
  });

  it('sets the gas used against the gas carried', async () => {
    const [row] = planGasRows(await run(defaultPlanDraft(METRIC_UNITS, WHEN)), METRIC_UNITS);
    expect(row.name).toBe('Air');
    expect(row.usedFraction).toBeGreaterThan(0);
    expect(row.usedFraction).toBeLessThan(1);
    expect(row.usedText).toMatch(/^[\d.]+ l of [\d.]+ l$/);
    expect(row.endText).toMatch(/^Ends at \d+ bar of 200 bar$/);
    expect(row.level).toBe('ok');
  });

  it('marks and warns about more gas than is carried, in the core\'s words', async () => {
    const draft = deep();
    const small = patchCylinder(draft, draft.cylinders[0].key, { sizeMl: 3000 });
    const result = await run(small);
    const [row] = planGasRows(result, METRIC_UNITS);
    expect(row.level).toBe('danger');
    expect(row.usedFraction).toBeGreaterThan(1);
    // The core's cylinder reads negative; nobody should read that.
    expect(row.endText).toMatch(/^Ends at 0 bar/);
    expect(planWarnings(result, METRIC_UNITS, WHEN, []).map((w) => w.text).join()).toContain('more gas than available');
  });

  it('warns below minimum gas, which the notes only colour', async () => {
    // Fine on gas in plain terms, but short of what the core's defaults want kept back.
    const draft = defaultPlanDraft(METRIC_UNITS, WHEN);
    const result = await run(patchSegment(draft, draft.segments[0].key, { depthMm: 18000, minutes: 30 }));
    const [cylinder] = result.cylinders;
    expect(cylinder.minimumGasMbar).toBeGreaterThan(cylinder.ascentStartMbar);
    expect(planWarnings(result, METRIC_UNITS, WHEN, []).map((w) => w.text).join()).toContain('Below minimum gas');
    expect(planGasRows(result, METRIC_UNITS)[0].level).toBe('caution');
  });

  it('surfaces a high pO2 from the notes', async () => {
    const draft = deep();
    const rich = patchCylinder(draft, draft.cylinders[0].key, { o2Percent: 50 });
    const warnings = planWarnings(await run(rich), METRIC_UNITS, WHEN, []);
    expect(warnings.map((w) => w.text).join()).toContain('High pO₂');
    expect(warnings[0].level).toBe('danger');
  });

  it('warns about a level shallower than the ceiling', async () => {
    const deco = deep();
    const up = addSegment(deco);
    const key = up.segments[1].key;
    const result = await run(patchSegment(up, key, { depthMm: 3000, minutes: 1 }));
    expect(result.waypointAboveCeiling).toBe(true);
    expect(planWarnings(result, METRIC_UNITS, WHEN, [])[0].text).toContain('deco ceiling');
  });

  it('warns about a dive in the log the core does not look at', async () => {
    const result = await run(defaultPlanDraft(METRIC_UNITS, WHEN));
    const warned = (when: number) =>
      planWarnings(result, METRIC_UNITS, WHEN, [{ when, durationSec: 600 }]).map((w) => w.text).join();
    // At the same moment, as a plan just saved is, and starting during the plan.
    expect(warned(WHEN)).toContain('overlaps a dive');
    expect(warned(WHEN + 300)).toContain('overlaps a dive');
    // Finished before it, or starting after it.
    expect(warned(WHEN - 600)).toBe('');
    expect(warned(WHEN + result.runtimeSec)).toBe('');
  });

  it('holds back a recreational plan over the limit, and says why', async () => {
    const result = await run(deep(), { ...DEFAULT_PLANNER_SETTINGS, decoMode: PlanDecoMode.Recreational });
    expect(result.error).toBe('recreationalExceedsNdl');
    expect(planHasResult(result)).toBe(true);
    expect(planCanBeSaved(result)).toBe(false);
    expect(planWarnings(result, METRIC_UNITS, WHEN, [])[0].text).toContain('no-decompression limit');
  });

  it('shows the core\'s reason when there is no plan at all', async () => {
    const draft = setDiveMode(deep(), PlanDiveMode.Ccr);
    const result = await run({ ...draft }, { ...DEFAULT_PLANNER_SETTINGS, doBailout: true });
    expect(result.error).toBe('noSuitableBailoutGas');
    expect(planHasResult(result)).toBe(false);
    expect(planCanBeSaved(result)).toBe(false);
    expect(planFailure(result)).toContain('No suitable gas for OC bailout');
  });

  it('prints imperial plans in imperial', async () => {
    const result = await run(defaultPlanDraft(IMPERIAL_UNITS, WHEN), DEFAULT_PLANNER_SETTINGS, IMPERIAL_UNITS);
    const [row] = planGasRows(result, IMPERIAL_UNITS);
    expect(row.usedText).toContain('cuft');
    expect(row.endText).toContain('psi');
  });

  it('mentions the previous dive only when the core counted one', async () => {
    const result = await run(defaultPlanDraft(METRIC_UNITS, WHEN));
    expect(surfaceIntervalText(result)).toBeNull();
    expect(surfaceIntervalText({ ...result, surfaceIntervalSec: 5400 })).toContain('1:30 h');
    expect(surfaceIntervalText({ ...result, surfaceIntervalSec: -60 })).toBeNull();
  });
});

describe('editing the draft', () => {
  it('finds a first level shorter than its descent before the bindings refuse it', () => {
    const draft = defaultPlanDraft(METRIC_UNITS, WHEN);
    const short = patchSegment(draft, draft.segments[0].key, { depthMm: 60000, minutes: 2 });
    // 60 m at 18 m/min takes 200 s.
    expect(draftProblem(short, DEFAULT_PLANNER_SETTINGS, METRIC_UNITS)).toContain('4 min descent');
    expect(draftProblem(draft, DEFAULT_PLANNER_SETTINGS, METRIC_UNITS)).toBeNull();
    expect(draftProblem(short, { ...DEFAULT_PLANNER_SETTINGS, dropStone: false }, METRIC_UNITS)).toBeNull();
  });

  it('never leaves no level or a level with no gas', () => {
    const draft = defaultPlanDraft(METRIC_UNITS, WHEN);
    expect(removeSegment(draft, draft.segments[0].key).segments).toHaveLength(1);
    const two = addCylinder(draft, newCylinderDraft(METRIC_UNITS));
    expect(cylinderInUse(two, draft.cylinders[0].key)).toBe(true);
    expect(removeCylinder(two, draft.cylinders[0].key).cylinders).toHaveLength(2);
    expect(removeCylinder(two, two.cylinders[1].key).cylinders).toHaveLength(1);
  });

  it('starts a new level where the last one ended', () => {
    const draft = addSegment(defaultPlanDraft(METRIC_UNITS, WHEN));
    expect(draft.segments[1].depthMm).toBe(draft.segments[0].depthMm);
    expect(draft.segments[1].key).not.toBe(draft.segments[0].key);
  });

  it('keeps a level on its gas when a cylinder before it goes', () => {
    const draft = defaultPlanDraft(METRIC_UNITS, WHEN);
    const spare = newCylinderDraft(METRIC_UNITS);
    const nitrox = { ...newCylinderDraft(METRIC_UNITS), o2Percent: 32 };
    let edited: PlanDraft = { ...draft, cylinders: [spare, draft.cylinders[0], nitrox] };
    edited = patchSegment(edited, edited.segments[0].key, { cylinderKey: nitrox.key });
    expect(planInput(edited, DEFAULT_PLANNER_SETTINGS, METRIC_UNITS, gf).segments[0].cylinder).toBe(2);
    edited = removeCylinder(edited, spare.key);
    expect(planInput(edited, DEFAULT_PLANNER_SETTINGS, METRIC_UNITS, gf).segments[0].cylinder).toBe(1);
  });

  it('keeps a mix a mix, giving way on the other gas', () => {
    const draft = defaultPlanDraft(METRIC_UNITS, WHEN);
    const key = draft.cylinders[0].key;
    const rich = patchCylinder(patchCylinder(draft, key, { hePercent: 80 }), key, { o2Percent: 50 });
    expect(rich.cylinders[0]).toMatchObject({ o2Percent: 50, hePercent: 50 });
    const helium = patchCylinder(rich, key, { hePercent: 60 });
    expect(helium.cylinders[0]).toMatchObject({ o2Percent: 40, hePercent: 60 });
  });

  it('takes a tank from the core table with its pressure, when it has one', async () => {
    const { tanks } = await host.plannerOptions();
    const d12 = tanks.find((t) => t.name === 'D12 232 bar');
    const bare = tanks.find((t) => t.name === '10.0L');
    expect(tankPatch(d12!)).toEqual({ tank: 'D12 232 bar', sizeMl: 24000, fillMbar: 232000 });
    expect(tankPatch(bare!)).toEqual({ tank: '10.0L', sizeMl: 10000 });
  });

  it('gives a closed loop plan a diluent and takes it back', () => {
    const draft = defaultPlanDraft(METRIC_UNITS, WHEN);
    const ccr = setDiveMode(draft, PlanDiveMode.Ccr);
    expect(ccr.cylinders[0].use).toBe(CylinderUse.Diluent);
    expect(setDiveMode(ccr, PlanDiveMode.OpenCircuit).cylinders[0].use).toBe(CylinderUse.OcGas);
  });

  it('plans CCR at the default setpoint, excluding the loop from the gas used', async () => {
    const draft = setDiveMode(deep(), PlanDiveMode.Ccr);
    const result = await run(draft);
    expect(result.error).toBe('ok');
    expect(result.waypoints[0].setpointMbar).toBe(DEFAULT_PLANNER_SETTINGS.defaultSetpointMbar);
    expect(result.cylinders[0].gasUsedMl).toBe(0);
  });

  it('plans pSCR, with a level on open circuit when asked', async () => {
    const draft = setDiveMode(deep(), PlanDiveMode.Pscr);
    const onLoop = await run(draft);
    expect(onLoop.waypoints[0].diveMode).toBe(PlanDiveMode.Pscr);
    const off = await run(patchSegment(draft, draft.segments[0].key, { onLoop: false }));
    expect(off.waypoints[0].diveMode).toBe(PlanDiveMode.OpenCircuit);
  });

  it('snaps depth to the stepper and keeps the fill exact, in both unit systems', () => {
    expect(depthValue(18000, IMPERIAL_UNITS)).toBe(60);
    expect(depthFromValue(depthValue(depthFromValue(60, IMPERIAL_UNITS), IMPERIAL_UNITS), IMPERIAL_UNITS)).toBe(18288);
    expect(fillValue(200000, METRIC_UNITS)).toBe(200);
    expect(fillValue(232000, METRIC_UNITS)).toBe(232);
    expect(fillValue(fillFromValue(3000, IMPERIAL_UNITS), IMPERIAL_UNITS)).toBe(3000);
  });
});

describe('the default cylinder', () => {
  const al80 = {
    description: 'AL80',
    sizeMl: 11094,
    workingPressureMbar: 206843,
    startMbar: 206843,
  } as unknown as Cylinder;

  it('starts the plan and every added cylinder, full', () => {
    const tank = planTankFrom(al80);
    expect(tank).toEqual({ name: 'AL80', sizeMl: 11094, fillMbar: 206843 });
    expect(defaultPlanDraft(METRIC_UNITS, WHEN, tank).cylinders[0]).toMatchObject({
      tank: 'AL80',
      sizeMl: 11094,
      fillMbar: 206843,
      o2Percent: 21,
    });
    expect(newCylinderDraft(METRIC_UNITS, tank)).toMatchObject({ tank: 'AL80' });
  });

  it('leaves the planner its own tank without one', () => {
    expect(planTankFrom(null)).toBeNull();
    expect(defaultPlanDraft(METRIC_UNITS, WHEN).cylinders[0].tank).not.toBe('AL80');
  });
});
