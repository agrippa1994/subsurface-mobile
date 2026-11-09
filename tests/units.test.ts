// AI-generated (Claude)
// Units chosen one by one, where the core writes the text itself.
//
// Most of the app formats in TypeScript (src/models/units.ts), but three things
// are written by the core: the planner's notes, the configurable statistics'
// binners and axis titles, and the CSV stylesheets. Each takes the app's
// per-quantity `units` (cpp/bindings/marshal.cpp, units_from_json) and must show
// a mixed choice - feet with bar, say - rather than all metric or all imperial.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { CoreUnitsInput, PlanInput } from '../src/models';
import { IMPERIAL_UNITS, METRIC_UNITS } from '../src/models/units';
import { fixture, tempDir } from './harness/fixtures';
import { SsrfHost } from './harness/ssrf-host';

let host: SsrfHost;

beforeAll(async () => {
  host = new SsrfHost();
  await host.configure();
  await host.loadFromXML(fixture('abitofeverything.ssrf'));
});

afterAll(async () => {
  await host.close();
});

/** Feet with bar and litres: the case a unit system alone cannot express. */
const FEET_AND_BAR: CoreUnitsInput = { ...METRIC_UNITS, depth: 'ft' };
/** The other way round: metres with psi and cubic feet. */
const METRES_AND_PSI: CoreUnitsInput = { ...IMPERIAL_UNITS, depth: 'm', temperature: 'C' };

describe('planner notes', () => {
  const plan = (units: CoreUnitsInput): PlanInput => ({
    units,
    surfacePressureMbar: 1013,
    cylinders: [{ o2Permille: 210, hePermille: 0, sizeMl: 12000, pressureMbar: 200000 }],
    segments: [
      { depthMm: 30000, durationSec: 120, cylinder: 0 },
      { depthMm: 30000, durationSec: 20 * 60, cylinder: 0 },
    ],
  });

  it('writes depths in feet and pressures in bar when asked for that pair', async () => {
    const result = await host.planDive(plan(FEET_AND_BAR));
    expect(result.error).toBe('ok');
    expect(result.notes).toMatch(/\d+\s*ft/);
    expect(result.notes).not.toMatch(/\d+\s*m\b/);
    expect(result.notes).toMatch(/\d+\s*bar/);
    expect(result.notes).not.toMatch(/psi/);
  });

  it('writes metres with psi the other way round', async () => {
    const result = await host.planDive(plan(METRES_AND_PSI));
    expect(result.error).toBe('ok');
    expect(result.notes).toMatch(/\d+\s*m\b/);
    expect(result.notes).not.toMatch(/\d+\s*ft\b/);
    expect(result.notes).toMatch(/psi/);
  });

  it('refuses a unit it does not know', async () => {
    await expect(
      host.call('planDive', { ...plan(METRIC_UNITS), units: { depth: 'furlongs' } }),
    ).rejects.toThrow(/units.depth/);
  });
});

describe('statistics binners', () => {
  it('cuts and labels depth in the depth unit, whatever the others are', async () => {
    const metric = await host.statsChart({ config: { var1: 'Max. Depth' }, units: METRIC_UNITS });
    const feet = await host.statsChart({ config: { var1: 'Max. Depth' }, units: FEET_AND_BAR });
    expect(metric.options.binners1.join(' ')).toContain(' m ');
    expect(feet.options.binners1.join(' ')).toContain(' ft ');
    expect(JSON.stringify(feet.chart)).toContain('Max. Depth [ft]');
  });

  it('labels temperature in the temperature unit alone', async () => {
    const result = await host.statsChart({
      config: { var1: 'Water temperature' },
      units: { ...METRIC_UNITS, temperature: 'F' },
    });
    expect(JSON.stringify(result.chart)).toMatch(/°F|\bF\]/);
  });

  it('leaves the next call metric: the units are for one call only', async () => {
    await host.statsChart({ config: { var1: 'Max. Depth' }, units: IMPERIAL_UNITS });
    const after = await host.statsChart({ config: { var1: 'Max. Depth' } });
    expect(after.options.binners1.join(' ')).toContain(' m ');
  });
});

describe('CSV export', () => {
  async function firstDiveWithSamples(): Promise<number> {
    for (const summary of await host.listDives()) {
      const dive = await host.getDive(summary.id);
      if ((dive.dcs[0]?.sampleCount ?? 0) > 0) {
        return summary.id;
      }
    }
    throw new Error('no dive with samples');
  }

  const header = (path: string) => readFileSync(path, 'utf8').split('\n')[0];

  it('writes each column of "summary" in its own unit', async () => {
    const id = await firstDiveWithSamples();
    const path = join(tempDir(), 'summary.csv');
    await host.exportDiveCSV(id, path, { format: 'summary', units: FEET_AND_BAR });
    const line = header(path);
    expect(line).toContain('maxdepth [ft]');
    expect(line).toContain('startpressure (1) [bar]');
    expect(line).toContain('cylinder size (1) [l]');
    expect(line).toContain('watertemp [C]');
  });

  it('writes each column of "details" in its own unit', async () => {
    const id = await firstDiveWithSamples();
    const path = join(tempDir(), 'details.csv');
    await host.exportDiveCSV(id, path, { format: 'details', units: METRES_AND_PSI });
    const line = header(path);
    expect(line).toContain('"sample depth (m)"');
    expect(line).toContain('"sample temperature (C)"');
    expect(line).toContain('"sample pressure (psi)"');
  });

  it('writes the same file for a preset as the old switch does', async () => {
    const id = await firstDiveWithSamples();
    const dir = tempDir();
    for (const format of ['details', 'summary'] as const) {
      const viaSwitch = join(dir, `${format}-switch.csv`);
      const viaUnits = join(dir, `${format}-units.csv`);
      await host.exportDiveCSV(id, viaSwitch, { format, imperial: true });
      await host.exportDiveCSV(id, viaUnits, { format, units: IMPERIAL_UNITS });
      expect(readFileSync(viaUnits, 'utf8')).toBe(readFileSync(viaSwitch, 'utf8'));
    }
  });
});
