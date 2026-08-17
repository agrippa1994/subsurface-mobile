// AI-generated (Claude)
// Unit tests for the Subsurface -> SSI converter. Pure TypeScript: the dive and
// its plot are handed in as literals rather than read out of the native module,
// so this file runs anywhere and describes the mapping rather than the core.
import { describe, expect, it } from 'vitest';

import { DiveMode, Velocity, type Dive, type DiveSite, type PlotEntry, type PlotInfo } from '../index';
import type { DiveSample } from './create-dive';
import { buildSsiSamples, convertDiveToSsi, SAMPLE_INTERVAL_SEC } from './converter';
import expectedKeys from './__fixtures__/ssi-create-dive-keys.json';

function plotEntry(overrides: Partial<PlotEntry> = {}): PlotEntry {
  return {
    sec: 0,
    depthMm: 0,
    temperatureMkelvin: 0,
    ceilingMm: 0,
    stopdepthMm: 0,
    stoptimeSec: 0,
    ndlSec: 5940,
    ttsSec: 0,
    rbtSec: 0,
    inDeco: false,
    cns: 0,
    sac: 0,
    smoothedMm: 0,
    modMm: 0,
    eadMm: 0,
    endMm: 0,
    eaddMm: 0,
    o2pressureMbar: 0,
    o2setpointMbar: 0,
    scrOcPo2Mbar: 0,
    pressures: { o2: 0, n2: 0, he: 0 },
    velocity: Velocity.Stable,
    speed: 0,
    heartbeat: 0,
    bearing: 0,
    ambpressure: 0,
    gfline: 0,
    surfaceGf: 0,
    currentGf: 0,
    density: 0,
    icdWarning: false,
    ...overrides,
  };
}

/** A plot one second apart, so the 5 s resampling has something to do. */
function plot(entries: PlotEntry[], overrides: Partial<PlotInfo> = {}): PlotInfo {
  return {
    nr: entries.length,
    nrCylinders: 0,
    maxtimeSec: entries.length === 0 ? 0 : entries[entries.length - 1].sec,
    meanDepthMm: 0,
    maxDepthMm: 0,
    minPressureMbar: 0,
    maxPressureMbar: 0,
    minHr: 0,
    maxHr: 0,
    minTempMkelvin: 0,
    maxTempMkelvin: 0,
    diveType: 0,
    endtempcoord: 0,
    maxpp: 0,
    waypointAboveCeiling: false,
    entry: entries,
    pressures: { sensor: [], interpolated: [] },
    ...overrides,
  } as PlotInfo;
}

function dive(overrides: Partial<Dive> = {}): Dive {
  return {
    id: 7,
    number: 42,
    // 2026-03-14T10:59:59Z, which is 11:59:59 in the +01:00 the computer logged.
    when: 1773485999,
    durationSec: 2790,
    maxDepthMm: 10250,
    meanDepthMm: 7510,
    waterTempMkelvin: 284150,
    rating: 0,
    visibility: 0,
    siteUuid: 3,
    siteName: 'Blue Hole',
    tripLocation: '',
    buddy: '',
    diveguide: '',
    suit: '',
    tags: [],
    divemode: DiveMode.OC,
    dcModel: 'Suunto Vaasa',
    invalid: false,
    cylinderDescriptions: [],
    notes: 'Nice one',
    wavesize: 0,
    current: 0,
    surge: 0,
    chill: 0,
    sac: 15000,
    otu: 0,
    cns: 0,
    maxcns: 0,
    salinity: 0,
    userSalinity: 0,
    minTempMkelvin: 284150,
    maxTempMkelvin: 287150,
    airTempMkelvin: 0,
    surfacePressureMbar: 0,
    totalWeightGrams: 6000,
    notrip: false,
    cylinders: [],
    weightsystems: [],
    dcs: [
      {
        model: 'Suunto Vaasa',
        serial: '260510001342',
        fwVersion: '2.49.32',
        deviceId: 0,
        diveId: 0,
        when: 1773485999,
        durationSec: 2790,
        surfaceTimeSec: 188,
        maxDepthMm: 10250,
        meanDepthMm: 7510,
        airTempMkelvin: 0,
        waterTempMkelvin: 284150,
        surfacePressureMbar: 0,
        divemode: DiveMode.OC,
        noO2sensors: 0,
        salinity: 0,
        timezoneOffset: 3600,
        sampleCount: 0,
        events: [],
        extraData: [],
      },
    ],
    ...overrides,
  };
}

function site(overrides: Partial<DiveSite> = {}): DiveSite {
  return {
    uuid: 3,
    name: 'Blue Hole',
    latUdeg: 28_572_100,
    lonUdeg: 34_536_900,
    hasGps: true,
    description: '',
    notes: '',
    diveCount: 1,
    taxonomy: [],
    ...overrides,
  };
}

function convert(overrides: Partial<Parameters<typeof convertDiveToSsi>[0]> = {}) {
  return convertDiveToSsi({
    dive: dive(),
    profile: plot([plotEntry()]),
    site: site(),
    ssiSiteId: 2367,
    nr: 126,
    ...overrides,
  });
}

describe('convertDiveToSsi', () => {
  it('sends every field the real SSI app sends, and no others', () => {
    // SSI does not treat a missing key like an explicit null, so a field this
    // converter forgets is a field silently lost on import - which a shape
    // check catches and a value check never would. The fixture is the key set
    // of a captured `save_divelog` request from the SSI mobile app; see the
    // note at the top of it.
    expect(Object.keys(convert()).sort()).toEqual(expectedKeys);
  });

  it('reads the date on the diver clock, not the phone clock', () => {
    // The computer logged +01:00, so 10:59:59 UTC is a dive at 11:59:59.
    const created = convert();
    expect(created.odin_user_log_date).toBe('2026-03-14');
    expect(created.odin_user_log_entry_time).toBe('11:59');
    expect(created.odin_user_log_datetime).toBe('2026-03-14+11:59:59.000');
  });

  it('sends depths and durations in both unit systems', () => {
    const created = convert();
    expect(created.odin_user_log_depth_m).toBe(10.25);
    expect(created.odin_user_log_depth_ft).toBeCloseTo(33.63, 2);
    expect(created.odin_user_log_avg_depth_m).toBe(7.51);
    expect(created.odin_user_log_divetime).toBe(46.5);
  });

  it('sends the temperature range, in Celsius and Fahrenheit', () => {
    const created = convert();
    expect(created.odin_user_log_watertemp_c).toBe(11);
    expect(created.odin_user_log_watertemp_f).toBeCloseTo(51.8, 2);
    expect(created.odin_user_log_watertemp_max_c).toBe(14);
  });

  it('falls back to the dive water temperature when there is no range', () => {
    const created = convert({
      dive: dive({ minTempMkelvin: 0, maxTempMkelvin: 0, waterTempMkelvin: 284150 }),
    });
    expect(created.odin_user_log_watertemp_c).toBe(11);
    expect(created.odin_user_log_watertemp_max_c).toBeNull();
  });

  it('takes the position from the site, since a dive carries none', () => {
    const created = convert();
    expect(created.odin_user_log_pos_start_latitude).toBe(28.5721);
    expect(created.odin_user_log_pos_start_longitude).toBe(34.5369);
  });

  it('sends no position for a site without one, and for no site at all', () => {
    expect(convert({ site: site({ hasGps: false }) }).odin_user_log_pos_start_latitude).toBeNull();
    expect(convert({ site: undefined }).odin_user_log_pos_start_latitude).toBeNull();
  });

  it('splits the computer model into a manufacturer and builds a stable ref', () => {
    const created = convert();
    expect(created.odin_user_log_divecomputer_manufacturer).toBe('Suunto');
    expect(created.odin_user_log_divecomputer_name).toBe('Suunto Vaasa');
    expect(created.odin_user_log_divecomputer_ref).toBe('Suunto Vaasa_260510001342');
    expect(created.odin_user_log_divecomputer_dive_ref).toBe('2026-03-14T10:59:59.000Z');
  });

  it('survives a dive with no computer at all', () => {
    const created = convert({ dive: dive({ dcs: [] }) });
    expect(created.odin_user_log_divecomputer_name).toBeNull();
    expect(created.odin_user_log_divecomputer_manufacturer).toBeNull();
    expect(created.odin_user_log_si_before).toBeNull();
    // With no computer there is no zone either, so the timestamp stays UTC.
    expect(created.odin_user_log_entry_time).toBe('10:59');
  });

  it('takes cylinder pressures from the samples when the diver logged none', () => {
    const created = convert({
      dive: dive({
        cylinders: [
          {
            description: 'AL80',
            sizeMl: 11000,
            workingPressureMbar: 232000,
            gasmix: { o2Permille: 0, hePermille: 0, o2EffectivePermille: 209, heEffectivePermille: 0 },
            startMbar: 0,
            endMbar: 0,
            sampleStartMbar: 200000,
            sampleEndMbar: 50000,
            depthMm: 0,
            manuallyAdded: false,
            gasUsedMl: 0,
            decoGasUsedMl: 0,
            use: 0,
            bestmixO2: false,
            bestmixHe: false,
            used: true,
          },
        ],
      }),
    });

    expect(created.odin_user_log_pressure_start_bar).toBe(200);
    expect(created.odin_user_log_pressure_start_psi).toBe(2901);
    expect(created.odin_user_log_pressure_end_bar).toBe(50);
    expect(created.odin_user_log_tank_vol_l).toBe(11);
  });

  it('leaves an empty note null rather than sending an empty string', () => {
    expect(convert({ dive: dive({ notes: '   ' }) }).odin_user_log_comment).toBeNull();
  });

  it('files the dive under the number and site it was given', () => {
    const created = convert();
    expect(created.odin_user_log_nr).toBe(126);
    expect(created.odin_user_log_dive_sites_id).toBe(2367);
  });

  it('serializes the datasets into strings, which is what SSI expects', () => {
    const created = convert({
      profile: plot([plotEntry({ sec: 0, depthMm: 0 }), plotEntry({ sec: 5, depthMm: 5000 })]),
    });

    expect(created.odin_user_log_depthDataset).toBe('[0,5]');
    expect(typeof created.odin_user_log_diveSamples).toBe('string');
    expect(JSON.parse(created.odin_user_log_diveSamples as string)).toHaveLength(2);
  });

  it('sends no pressure datasets when the dive has no cylinder readings', () => {
    const created = convert();
    expect(created.odin_user_log_tankPressureDataset).toBeNull();
    expect(created.odin_user_log_pressureDataset).toBeNull();
  });
});

describe('buildSsiSamples', () => {
  function seconds(count: number, build: (sec: number) => Partial<PlotEntry>): PlotEntry[] {
    return Array.from({ length: count }, (_, sec) => plotEntry({ sec, ...build(sec) }));
  }

  it('resamples a per-second plot onto the SSI interval', () => {
    const samples = buildSsiSamples(plot(seconds(21, (sec) => ({ depthMm: sec * 1000 }))));

    expect(samples.map((sample) => sample.t)).toEqual([0, 5000, 10000, 15000, 20000]);
    expect(samples.map((sample) => sample.d)).toEqual([0, 5, 10, 15, 20]);
    expect(samples.map((sample) => sample.n)).toEqual([1, 2, 3, 4, 5]);
  });

  it('takes the last reading at or before each grid second', () => {
    // A plot that jumps over a grid point must not invent a value for it.
    const samples = buildSsiSamples(
      plot([plotEntry({ sec: 0, depthMm: 1000 }), plotEntry({ sec: 8, depthMm: 9000 })])
    );

    expect(samples.map((sample) => [sample.t, sample.d])).toEqual([
      [0, 1],
      [5000, 1],
    ]);
  });

  it('fills temperature gaps from the nearest reading', () => {
    // 0 mkelvin means "not measured"; sent as-is it would plot as -273 C.
    const samples = buildSsiSamples(
      plot([
        plotEntry({ sec: 0, temperatureMkelvin: 0 }),
        plotEntry({ sec: 5, temperatureMkelvin: 284150 }),
        plotEntry({ sec: 10, temperatureMkelvin: 0 }),
      ])
    );

    expect(samples.map((sample) => sample.te)).toEqual([11, 11, 11]);
  });

  it('leaves temperature at zero when the dive measured none at all', () => {
    const samples = buildSsiSamples(plot(seconds(6, () => ({}))));
    expect(samples.every((sample) => sample.te === 0)).toBe(true);
  });

  it('caps the no-decompression limit at 99 minutes and reports it in minutes', () => {
    const samples = buildSsiSamples(
      plot([plotEntry({ sec: 0, ndlSec: 99999 }), plotEntry({ sec: 5, ndlSec: 600 })])
    );
    expect(samples.map((sample) => sample.ndl)).toEqual([99, 10]);
  });

  it('carries both gradient factors, which the Suunto path could not', () => {
    const samples = buildSsiSamples(plot([plotEntry({ sec: 0, surfaceGf: 42.5, currentGf: 12.25 })]));
    expect(samples[0].gs).toBe(42.5);
    expect(samples[0].gn).toBe(12.25);
  });

  it('omits the pressure of a sample with no cylinder reading', () => {
    const withPressure = plot([plotEntry({ sec: 0 }), plotEntry({ sec: 5 })], {
      nrCylinders: 1,
      pressures: { sensor: [200000, 0], interpolated: [0, 0] },
    });

    const samples: DiveSample[] = buildSsiSamples(withPressure);
    expect(samples[0].pressure).toBe(200);
    expect(samples[1].pressure).toBeUndefined();
  });

  it('returns nothing for a plot with no entries', () => {
    expect(buildSsiSamples(plot([]))).toEqual([]);
  });

  it('agrees with the interval it documents', () => {
    expect(SAMPLE_INTERVAL_SEC).toBe(5);
  });
});
