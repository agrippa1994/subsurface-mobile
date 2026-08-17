// AI-generated (Claude)
// Subsurface dive -> SSI `save_divelog` payload.
//
// The ssi-log project converts a raw Suunto JSON export; this app never sees
// one. It has the dive already parsed by the Subsurface core, which is a
// strictly better source: depth, temperature, NDL and both gradient factors
// come out of the same plot the profile screen draws, so what SSI receives is
// what the diver looked at.
//
// Everything here is pure so it stays covered by vitest in Node. The units the
// core hands over (mm, mbar, mkelvin, ml, g, microdegrees) are converted with
// the helpers in ../units - never inline, so metric and imperial cannot drift.
//
// Two deliberate limits:
//   - Only the first dive computer and the first cylinder are represented. SSI
//     has no multi-computer concept, and its single-tank fields are what its
//     own app fills.
//   - CCR, pSCR and freedives are posted as open-circuit dives. SSI models
//     those with whole separate field families (the `_ccr_`, `_scr_` and
//     `_frd_` blocks) that we have no capture of.

import {
  mbarToBar,
  mbarToPsi,
  mkelvinToCelsius,
  mlToLiters,
  mmToFeet,
  mmToMeters,
  udegToDegrees,
} from '../units';
import { CylinderUse, plotPressureAt } from '../index';
import type { Cylinder, Dive, DiveSite, PlotInfo } from '../index';
import { gfNowPercent } from '../profile-plot';
import { DivePhaseFlag, type CreateDive, type DiveSample } from './create-dive';

/**
 * The interval the SSI app records at, and therefore the grid the datasets are
 * resampled onto. The core's plot is per-sample - often every second, and
 * denser still around events - which would trip SSI's payload limits on a long
 * dive and buy nothing: its charts cannot resolve it.
 */
export const SAMPLE_INTERVAL_SEC = 5;

/**
 * Field values lifted verbatim from the request the real SSI app sends
 * (ssi-log/samples/create-dive.json). They are opaque ids into taxonomies we
 * have no listing of, so they are copied rather than derived.
 */
const SSI_CONSTANTS = {
  diveType: 0,
  varDivetypeId: 24,
  varWatertypeId: 4,
  varTanktypeId: 19,
  frdDivetypeId: 50,
} as const;

export type SsiConversionInput = {
  dive: Dive;
  profile: PlotInfo;
  /** The dive's site, for its position. Absent when the dive has none. */
  site?: DiveSite;
  /** The SSI site the dive is being filed under. */
  ssiSiteId: number;
  /** The dive's number in the SSI logbook, which is not `dive.number`. */
  nr: number;
};

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

/** A value the core uses 0 for when it has nothing, mapped to SSI's null. */
function orNull(value: number): number | null {
  return value > 0 ? value : null;
}

/**
 * The cylinder the dive was breathed from, which SSI's single set of tank
 * fields describes.
 *
 * Not simply `cylinders[0]`: a dive's list can lead with a deco or oxygen
 * cylinder, or with one the diver added and never used, and filing a stage
 * bottle's size and pressures as the dive's tank would be plainly wrong. So
 * open-circuit cylinders come first, and among those the one the samples or
 * gas-switch events actually refer to. The final fallback keeps a dive whose
 * cylinders are all marked unused from losing its pressures entirely.
 */
function primaryCylinder(dive: Dive): Cylinder | undefined {
  const breathing = dive.cylinders.filter((cylinder) => cylinder.use === CylinderUse.OcGas);
  return breathing.find((cylinder) => cylinder.used) ?? breathing[0] ?? dive.cylinders[0];
}

/**
 * Seconds east of UTC the dive was logged at, or 0 when the computer did not
 * record a zone.
 *
 * The core spells "no zone" as TIMEZONE_OFFSET_INVALID, which is INT_MAX
 * (subsurface/core/divecomputer.h:23) - a sentinel, not an offset, and most
 * dives carry it. Adding it to a timestamp moves the dive 68 years into the
 * future, so anything outside the range real zones live in is refused. UTC-12
 * to UTC+14 is the whole inhabited span, and the half- and quarter-hour zones
 * inside it are covered by the seconds this is measured in.
 */
const MAX_TIMEZONE_OFFSET_SEC = 14 * 3600;

function timezoneOffsetSec(dive: Dive): number {
  const offset = dive.dcs[0]?.timezoneOffset ?? 0;
  return Number.isFinite(offset) && Math.abs(offset) <= MAX_TIMEZONE_OFFSET_SEC ? offset : 0;
}

/**
 * The dive's start as the diver's own clock read it.
 *
 * `dive.when` is UTC seconds and the offset above is the seconds to add to
 * reach local time, so the shifted timestamp read with the UTC getters is the
 * local wall clock. SSI stores no zone, only the reading, which is why the
 * date must not be formatted in the phone's zone: a dive logged in Egypt would
 * otherwise move an hour or two on import.
 */
function localParts(dive: Dive): {
  date: string;
  time: string;
  datetime: string;
  iso: string;
} {
  const local = new Date((dive.when + timezoneOffsetSec(dive)) * 1000);

  const pad = (value: number, width = 2) => String(value).padStart(width, '0');
  const date = `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
  const hours = pad(local.getUTCHours());
  const minutes = pad(local.getUTCMinutes());
  const seconds = pad(local.getUTCSeconds());

  return {
    date,
    time: `${hours}:${minutes}`,
    // The separator really is a '+' rather than a space or a 'T'. SSI is
    // lenient about it - the captured request has something odder still - but
    // this is the form its own importer emits.
    datetime: `${date}+${hours}:${minutes}:${seconds}.${pad(local.getUTCMilliseconds(), 3)}`,
    iso: new Date(dive.when * 1000).toISOString(),
  };
}

/**
 * The plot's entries on the fixed grid, one per interval: for each grid second
 * the last entry at or before it, so a resampled point is a reading that
 * happened rather than an interpolation between two.
 */
function resample(profile: PlotInfo): { entryIndex: number; sec: number }[] {
  const entries = profile.entry;
  if (entries.length === 0) {
    return [];
  }

  const end = entries[entries.length - 1].sec;
  const points: { entryIndex: number; sec: number }[] = [];

  let cursor = 0;
  for (let sec = 0; sec <= end; sec += SAMPLE_INTERVAL_SEC) {
    while (cursor + 1 < entries.length && entries[cursor + 1].sec <= sec) {
      cursor++;
    }
    points.push({ entryIndex: cursor, sec });
  }

  return points;
}

/**
 * Temperatures with the gaps closed. The core reports 0 mkelvin for a sample
 * the computer did not take a reading at, and a 0 would land in SSI's chart as
 * -273 C, so each gap takes the nearest reading on either side - the same
 * nearest-neighbour fill the Suunto converter does.
 */
function filledTemperatures(profile: PlotInfo, points: { entryIndex: number }[]): number[] {
  const raw = points.map((point) => profile.entry[point.entryIndex].temperatureMkelvin);

  let lastKnown = -1;
  const forward: number[] = new Array(raw.length).fill(0);
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] > 0) {
      lastKnown = i;
    }
    forward[i] = lastKnown;
  }

  let nextKnown = -1;
  const backward: number[] = new Array(raw.length).fill(0);
  for (let i = raw.length - 1; i >= 0; i--) {
    if (raw[i] > 0) {
      nextKnown = i;
    }
    backward[i] = nextKnown;
  }

  return raw.map((value, i) => {
    if (value > 0) {
      return mkelvinToCelsius(value);
    }
    const before = forward[i];
    const after = backward[i];
    if (before < 0 && after < 0) {
      return 0;
    }
    if (before < 0) {
      return mkelvinToCelsius(raw[after]);
    }
    if (after < 0) {
      return mkelvinToCelsius(raw[before]);
    }
    return mkelvinToCelsius(i - before <= after - i ? raw[before] : raw[after]);
  });
}

/** The per-sample records SSI stores alongside the flat datasets. */
export function buildSsiSamples(profile: PlotInfo): DiveSample[] {
  const points = resample(profile);
  const temperatures = filledTemperatures(profile, points);

  return points.map((point, index) => {
    const entry = profile.entry[point.entryIndex];
    const pressureMbar = plotPressureAt(profile, point.entryIndex, 0);
    const sample: DiveSample = {
      n: index + 1,
      t: point.sec * 1000,
      d: round(mmToMeters(entry.depthMm), 2),
      // The core carries velocity as an enum band rather than a rate, so there
      // is no honest number to put here. SSI's own importer sends 0 as well.
      s: 0,
      te: round(temperatures[index], 2),
      ndl: round(Math.min(entry.ndlSec / 60, 99), 1),
      // SSI wants both as percentages. The core does not hand them over in the
      // same unit - surfaceGf already is one, currentGf is a raw fraction of
      // the M-value - so only the latter is scaled. See gfNowPercent.
      gs: round(entry.surfaceGf, 2),
      gn: round(gfNowPercent(entry), 2),
      // Alarms and phase would have to be inferred from the profile; the flags
      // are documented in ./create-dive.ts for whoever wants to try.
      a: 0,
      mf: DivePhaseFlag.DIVE,
      o: false,
      dr: false,
    };

    if (pressureMbar > 0) {
      sample.pressure = round(mbarToBar(pressureMbar), 2);
    }

    return sample;
  });
}

/**
 * A dataset field: SSI takes these as a JSON array serialized *into* a string
 * field, not as a nested array.
 */
function dataset(values: (number | null)[]): string {
  return JSON.stringify(values);
}

export function convertDiveToSsi({
  dive,
  profile,
  site,
  ssiSiteId,
  nr,
}: SsiConversionInput): CreateDive {
  const when = localParts(dive);
  const dc = dive.dcs[0];
  // One cylinder feeds the volume and both pressures, so the three always
  // describe the same tank.
  const cylinder = primaryCylinder(dive);
  const samples = buildSsiSamples(profile);

  const minTempMkelvin = dive.minTempMkelvin || dive.waterTempMkelvin;
  const maxTempMkelvin = dive.maxTempMkelvin;
  const minTempC = minTempMkelvin > 0 ? round(mkelvinToCelsius(minTempMkelvin), 2) : null;
  const maxTempC = maxTempMkelvin > 0 ? round(mkelvinToCelsius(maxTempMkelvin), 2) : null;

  const startMbar = cylinder ? cylinder.startMbar || cylinder.sampleStartMbar : 0;
  const endMbar = cylinder ? cylinder.endMbar || cylinder.sampleEndMbar : 0;

  const hasPressure = samples.some((sample) => sample.pressure !== undefined);
  const tankPressureDataset = hasPressure
    ? dataset(samples.map((sample) => sample.pressure ?? null))
    : null;

  // "Suunto EON Steel" -> manufacturer "Suunto", which is how SSI groups
  // computers. A model with no space is its own manufacturer.
  const model = dc?.model ?? '';
  const manufacturer = model.split(' ')[0] || null;
  const serial = dc?.serial || null;

  const latitude = site?.hasGps ? round(udegToDegrees(site.latUdeg), 6) : null;
  const longitude = site?.hasGps ? round(udegToDegrees(site.lonUdeg), 6) : null;

  return {
    // --- Bookkeeping ---
    odin_user_log_id: null,
    odin_user_log_nr: nr,
    localSiteId: null,
    localBuddyIds: [],
    odin_user_log_crdate: null,
    reset_profile_divelog_number_with_deletion: null,
    needsUpload: true,
    needsVerificationUpload: null,
    needsUnverifyUpload: null,
    uploadError: null,

    // --- Core dive data ---
    odin_user_log_datetime: when.datetime,
    odin_user_log_date: when.date,
    odin_user_log_entry_time: when.time,
    odin_user_log_depth_m: round(mmToMeters(dive.maxDepthMm), 2),
    odin_user_log_depth_ft: round(mmToFeet(dive.maxDepthMm), 2),
    odin_user_log_avg_depth_m: round(mmToMeters(dive.meanDepthMm), 2),
    odin_user_log_avg_depth_ft: round(mmToFeet(dive.meanDepthMm), 2),
    odin_user_log_divetime: round(dive.durationSec / 60, 1),
    odin_user_log_dive_type: SSI_CONSTANTS.diveType,
    odin_user_log_rating: null,
    odin_user_log_airtemp_c: null,
    odin_user_log_airtemp_f: null,
    odin_user_log_watertemp_c: minTempC,
    odin_user_log_watertemp_f: minTempC === null ? null : round(celsiusToFahrenheit(minTempC), 2),
    odin_user_log_watertemp_max_c: maxTempC,
    odin_user_log_watertemp_max_f:
      maxTempC === null ? null : round(celsiusToFahrenheit(maxTempC), 2),

    // --- Pressure ---
    odin_user_log_pressure_start_bar: startMbar > 0 ? round(mbarToBar(startMbar), 2) : null,
    odin_user_log_pressure_start_psi: startMbar > 0 ? Math.round(mbarToPsi(startMbar)) : null,
    odin_user_log_pressure_end_bar: endMbar > 0 ? round(mbarToBar(endMbar), 2) : null,
    odin_user_log_pressure_end_psi: endMbar > 0 ? Math.round(mbarToPsi(endMbar)) : null,

    // --- Site, buddies, gear ---
    odin_user_log_dive_sites_id: ssiSiteId,
    odin_user_log_buddy_ids: [],
    odin_user_log_animal_ids: [],
    odin_user_log_gear: [],
    odin_user_log_gear_details: null,
    odin_user_log_user_master_id: null,
    odin_user_log_leader_nr: null,
    odin_user_log_comment: dive.notes.trim() === '' ? null : dive.notes,
    odin_user_log_deleted: false,

    // --- Variables ---
    odin_user_log_var_divetype_id: SSI_CONSTANTS.varDivetypeId,
    odin_user_log_var_water_body_id: null,
    odin_user_log_var_watertype_id: SSI_CONSTANTS.varWatertypeId,
    odin_user_log_var_entry_id: null,
    odin_user_log_var_current_id: null,
    odin_user_log_var_surface_id: null,
    odin_user_log_var_weather_id: null,
    odin_user_log_var_tanktype_id: SSI_CONSTANTS.varTanktypeId,
    odin_user_log_vis_m: null,
    odin_user_log_vis_ft: null,
    odin_user_log_weight_kg: dive.totalWeightGrams > 0 ? round(dive.totalWeightGrams / 1000, 2) : null,
    odin_user_log_weight_lb: null,
    // Null when the logbook has no size for the tank, which is the normal
    // state of a dive straight off a computer: a dive computer does not know
    // what cylinder it was breathing. Filling it in the dive editor is what
    // gives SSI a number here. Left in litres alone because that is what the
    // real SSI request does - it sends tank_vol_l and leaves cuft null, unlike
    // every other measurement, which it sends in both units.
    odin_user_log_tank_vol_l:
      cylinder && cylinder.sizeMl > 0 ? round(mlToLiters(cylinder.sizeMl), 2) : null,
    odin_user_log_tank_vol_cuft: null,
    odin_user_log_ean: null,
    odin_user_log_ean_percent: null,
    odin_user_log_var_specialdive_id: null,
    odin_user_log_amv_l: dive.sac > 0 ? round(mlToLiters(dive.sac), 2) : null,
    odin_user_log_amv_psi: null,

    // --- Freediving ---
    odin_user_log_frd_suit: null,
    odin_user_log_frd_weight_kg: null,
    odin_user_log_frd_weight_lb: null,
    odin_user_log_frd_neutral_m: null,
    odin_user_log_frd_neutral_ft: null,
    odin_user_log_frd_divetype_id: SSI_CONSTANTS.frdDivetypeId,
    odin_user_log_frdwater_body_id: null,
    odin_user_log_frddisc_STA: null,
    odin_user_log_frddisc_STA_WU: null,
    odin_user_log_frddisc_STA_MAX: null,
    odin_user_log_frddisc_STA_CT: null,
    odin_user_log_frddisc_STATT: null,
    odin_user_log_frddisc_STATT_RP: null,
    odin_user_log_frddisc_STATT_MAX: null,
    odin_user_log_frddisc_WAPN: null,
    odin_user_log_frddisc_WAPN_WU: null,
    odin_user_log_frddisc_WAPN_RP: null,
    odin_user_log_frddisc_WAPN_MAX: null,
    odin_user_log_frddisc_DYN: null,
    odin_user_log_frddisc_DYN_WU: null,
    odin_user_log_frddisc_DYN_MAX_m: null,
    odin_user_log_frddisc_DYN_MAX_ft: null,
    odin_user_log_frddisc_DYNTT: null,
    odin_user_log_frddisc_DYNTT_RP: null,
    odin_user_log_frddisc_DYNTT_MAX_m: null,
    odin_user_log_frddisc_DYNTT_MAX_ft: null,
    odin_user_log_frddisc_FIM: null,
    odin_user_log_frddisc_FIM_WU: null,
    odin_user_log_frddisc_FIM_MAX_m: null,
    odin_user_log_frddisc_FIM_MAX_ft: null,
    odin_user_log_frddisc_FIM_TIME: null,
    odin_user_log_frddisc_CWT: null,
    odin_user_log_frddisc_CWT_WU: null,
    odin_user_log_frddisc_CWT_MAX_m: null,
    odin_user_log_frddisc_CWT_MAX_ft: null,
    odin_user_log_frddisc_CWT_TIME: null,
    odin_user_log_frddisc_CNF: null,
    odin_user_log_frddisc_CNF_WU: null,
    odin_user_log_frddisc_CNF_MAX_m: null,
    odin_user_log_frddisc_CNF_MAX_ft: null,
    odin_user_log_frddisc_CNF_TIME: null,
    odin_user_log_frddisc_VWT: null,
    odin_user_log_frddisc_VWT_WU: null,
    odin_user_log_frddisc_VWT_MAX_m: null,
    odin_user_log_frddisc_VWT_MAX_ft: null,
    odin_user_log_frddisc_VWT_TIME: null,
    odin_user_log_frddisc_FRC: null,
    odin_user_log_frddisc_FRC_RP: null,
    odin_user_log_frddisc_FRC_MAX_m: null,
    odin_user_log_frddisc_FRC_MAX_ft: null,
    odin_user_log_frddisc_DNF: null,
    odin_user_log_frddisc_DNF_WU: null,
    odin_user_log_frddisc_DNF_MAX_m: null,
    odin_user_log_frddisc_DNF_MAX_ft: null,
    odin_user_log_frd_NOTES: null,
    odin_user_log_frddisc: null,

    // --- XR (extended range / tech diving) ---
    odin_user_log_xr_divetype_id: null,
    odin_user_log_xr_planned_bottom_time: null,
    odin_user_log_xr_total_deco_time: null,
    odin_user_log_xr_planned_depth: null,
    odin_user_log_xr_planned_deco_time: null,
    odin_user_log_xr_back: null,
    odin_user_log_xr_back_tanktype_id: null,
    odin_user_log_xr_deco_tanktype_id: null,
    odin_user_log_xr_back_vol_l: null,
    odin_user_log_xr_back_vol_cuft: null,
    odin_user_log_xr_back_ean: null,
    odin_user_log_xr_back_tmx: null,
    odin_user_log_xr_back_o2: null,
    odin_user_log_xr_back_he: null,
    odin_user_log_xr_back_start_bar: null,
    odin_user_log_xr_back_end_bar: null,
    odin_user_log_xr_back_start_psi: null,
    odin_user_log_xr_back_end_psi: null,
    odin_user_log_xr_deco1: null,
    odin_user_log_xr_deco1_tanktype_id: null,
    odin_user_log_xr_deco1_vol_l: null,
    odin_user_log_xr_deco1_vol_cuft: null,
    odin_user_log_xr_deco1_ean: null,
    odin_user_log_xr_deco1_tmx: null,
    odin_user_log_xr_deco1_o2: null,
    odin_user_log_xr_deco1_he: null,
    odin_user_log_xr_deco1_start_bar: null,
    odin_user_log_xr_deco1_end_bar: null,
    odin_user_log_xr_deco1_start_psi: null,
    odin_user_log_xr_deco1_end_psi: null,
    odin_user_log_xr_deco2: null,
    odin_user_log_xr_deco2_tanktype_id: null,
    odin_user_log_xr_deco2_vol_l: null,
    odin_user_log_xr_deco2_vol_cuft: null,
    odin_user_log_xr_deco2_ean: null,
    odin_user_log_xr_deco2_tmx: null,
    odin_user_log_xr_deco2_o2: null,
    odin_user_log_xr_deco2_he: null,
    odin_user_log_xr_deco2_start_bar: null,
    odin_user_log_xr_deco2_end_bar: null,
    odin_user_log_xr_deco2_start_psi: null,
    odin_user_log_xr_deco2_end_psi: null,
    odin_user_log_xr_deco3: null,
    odin_user_log_xr_deco3_tanktype_id: null,
    odin_user_log_xr_deco3_vol_l: null,
    odin_user_log_xr_deco3_vol_cuft: null,
    odin_user_log_xr_deco3_ean_o2: null,
    odin_user_log_xr_deco3_o2: null,
    odin_user_log_xr_deco3_he: null,
    odin_user_log_xr_deco3_start_bar: null,
    odin_user_log_xr_deco3_end_bar: null,
    odin_user_log_xr_deco3_start_psi: null,
    odin_user_log_xr_deco3_end_psi: null,
    odin_user_log_xr_sac_bottom_l: null,
    odin_user_log_xr_sac_bottom_psi: null,
    odin_user_log_xr_sac_deco_l: null,
    odin_user_log_xr_sac_deco_psi: null,

    // --- Confirmation / verification ---
    odin_user_log_divecenter_confirmed: null,
    odin_user_log_divecenter_confirmed_id: null,
    odin_user_log_divecenter_confirmed_name: null,
    odin_user_log_divecenter_confirmed_logo: null,
    odin_user_log_leader_confirmed_id: null,
    odin_user_log_leader_confirmed_name: null,
    odin_user_log_user_confirmed_id: null,
    odin_user_log_user_confirmed_name: null,
    odin_user_log_transferDate: null,
    odin_user_log_confirmed: null,
    odin_user_log_verified: null,
    timestamp: null,

    // --- Dive computer ---
    odin_user_log_diveComputer: model || null,
    odin_user_log_diveComputerData: null,
    odin_user_log_divecomputer_id: null,
    odin_user_log_divecomputer_name: model || null,
    odin_user_log_divecomputer_serial_nr: serial,
    odin_user_log_divecomputer_ble_id: null,
    odin_user_log_divecomputer_firmware: dc?.fwVersion || null,
    odin_user_log_divecomputer_manufacturer: manufacturer,
    // How SSI recognises "the same computer" and "the same dive" across
    // imports, so re-syncing updates rather than duplicating on its side.
    odin_user_log_divecomputer_ref: model ? `${model}_${serial ?? ''}` : null,
    odin_user_log_divecomputer_dive_ref: when.iso,
    odin_user_log_divecomputer_imported: false,
    odin_user_log_divecomputer_raw_data_header: null,
    odin_user_log_divecomputer_raw_data_details: null,
    odin_user_log_divecomputer_max_sensor_depth: null,
    odin_user_log_divecomputer_bottomtimer: null,
    odin_user_log_divecomputer_productname: null,

    // --- Datasets ---
    odin_user_log_depthDataset: dataset(samples.map((sample) => sample.d)),
    odin_user_log_tempDataset: dataset(samples.map((sample) => sample.te)),
    odin_user_log_alarmDataset: null,
    // Unlike the Suunto path, which had no reliable gf-at-depth series, both
    // curves come out of the core's plot - the same two the profile draws.
    odin_user_log_gfnowDataset: dataset(samples.map((sample) => sample.gn ?? 0)),
    odin_user_log_gfSurfDataset: dataset(samples.map((sample) => sample.gs)),
    odin_user_log_deepestDecoDataset: null,
    odin_user_log_tankPressureDataset: tankPressureDataset,
    odin_user_log_pressureDataset: tankPressureDataset,
    odin_user_log_freeDiveSessionCharts: null,
    odin_user_log_locationDataset: null,
    odin_user_log_diveSamples: JSON.stringify(samples),

    // --- Decompression ---
    odin_user_log_si_before: orNull(dc?.surfaceTimeSec ?? 0),
    odin_user_log_gf_set: null,
    odin_user_log_gf_set_1: null,
    odin_user_log_gf_set_2: null,
    odin_user_log_gf_end: null,
    odin_user_log_cns_start: null,
    odin_user_log_cns_end: null,
    odin_user_log_otu_start: null,
    odin_user_log_otu_end: null,
    odin_user_log_deco_dive: null,
    odin_user_log_deco_time: null,
    odin_user_log_deco_gas: null,
    odin_user_log_deco_gas_tanktype_id: null,
    odin_user_log_deco_gas_tank_vol_l: null,
    odin_user_log_deco_gas_tank_vol_cuft: null,
    odin_user_log_deco_gas_o2: null,
    odin_user_log_deco_gas_start_bar: null,
    odin_user_log_deco_gas_end_bar: null,
    odin_user_log_deco_gas_start_psi: null,
    odin_user_log_deco_gas_end_psi: null,
    odin_user_log_alarm_fast_ascent: null,
    odin_user_log_alarm_deco_stop: null,
    odin_user_log_alarm_deco_violation: null,

    // --- SCR (semi-closed rebreather) ---
    odin_user_log_scr_unit_id: null,
    odin_user_log_scr_total_deco_time: null,
    odin_user_log_scr_sac_bailout_l: null,
    odin_user_log_scr_sac_bailout_psi: null,
    odin_user_log_scr_sac_deco_l: null,
    odin_user_log_scr_sac_deco_psi: null,
    odin_user_log_scr_bottom_tanktype_id: null,
    odin_user_log_scr_bottom_tank_vol_l: null,
    odin_user_log_scr_bottom_tank_vol_cuft: null,
    odin_user_log_scr_bottom_o2: null,
    odin_user_log_scr_bottom_setpoint: null,
    odin_user_log_scr_bottom_start_bar: null,
    odin_user_log_scr_bottom_start_psi: null,
    odin_user_log_scr_bottom_end_bar: null,
    odin_user_log_scr_bottom_end_psi: null,
    odin_user_log_scr_deco: null,
    odin_user_log_scr_deco_tanktype_id: null,
    odin_user_log_scr_deco_tank_vol_l: null,
    odin_user_log_scr_deco_tank_vol_cuft: null,
    odin_user_log_scr_deco_o2: null,
    odin_user_log_scr_deco_setpoint: null,
    odin_user_log_scr_deco_start_bar: null,
    odin_user_log_scr_deco_start_psi: null,
    odin_user_log_scr_deco_end_bar: null,
    odin_user_log_scr_deco_end_psi: null,
    odin_user_log_scr_start_time: null,
    odin_user_log_scr_end_time: null,
    odin_user_log_scr_oc: null,

    // --- CCR (closed-circuit rebreather) ---
    odin_user_log_ccr_unit_id: null,
    odin_user_log_ccr_total_deco_time: null,
    odin_user_log_ccr_sac_bailout_l: null,
    odin_user_log_ccr_sac_bailout_psi: null,
    odin_user_log_ccr_sac_deco_l: null,
    odin_user_log_ccr_sac_deco_psi: null,
    odin_user_log_ccr_bottom_tank_vol_cuft: null,
    odin_user_log_ccr_bailout01: null,
    odin_user_log_ccr_bailout01_tanktype_id: null,
    odin_user_log_ccr_bailout01_tank_vol_l: null,
    odin_user_log_ccr_bailout01_tank_vol_cuft: null,
    odin_user_log_ccr_bailout01_o2: null,
    odin_user_log_ccr_bailout01_he: null,
    odin_user_log_ccr_bailout01_start_bar: null,
    odin_user_log_ccr_bailout01_start_psi: null,
    odin_user_log_ccr_bailout01_end_bar: null,
    odin_user_log_ccr_bailout01_end_psi: null,
    odin_user_log_ccr_bailout02: null,
    odin_user_log_ccr_bailout02_tanktype_id: null,
    odin_user_log_ccr_bailout02_tank_vol_l: null,
    odin_user_log_ccr_bailout02_tank_vol_cuft: null,
    odin_user_log_ccr_bailout02_o2: null,
    odin_user_log_ccr_bailout02_he: null,
    odin_user_log_ccr_bailout02_start_bar: null,
    odin_user_log_ccr_bailout02_start_psi: null,
    odin_user_log_ccr_bailout02_end_bar: null,
    odin_user_log_ccr_bailout02_end_psi: null,
    odin_user_log_ccr_bailout03: null,
    odin_user_log_ccr_bailout03_tanktype_id: null,
    odin_user_log_ccr_bailout03_tank_vol_l: null,
    odin_user_log_ccr_bailout03_tank_vol_cuft: null,
    odin_user_log_ccr_bailout03_o2: null,
    odin_user_log_ccr_bailout03_he: null,
    odin_user_log_ccr_bailout03_start_bar: null,
    odin_user_log_ccr_bailout03_start_psi: null,
    odin_user_log_ccr_bailout03_end_bar: null,
    odin_user_log_ccr_bailout03_end_psi: null,
    odin_user_log_ccr_diluent_gas: null,
    odin_user_log_ccr_diluent_tanktype_id: null,
    odin_user_log_ccr_diluent_tank_vol_l: null,
    odin_user_log_ccr_diluent_tank_vol_cuft: null,
    odin_user_log_ccr_diluent_o2: null,
    odin_user_log_ccr_diluent_he: null,
    odin_user_log_ccr_diluent_start_bar: null,
    odin_user_log_ccr_diluent_start_psi: null,
    odin_user_log_ccr_diluent_end_bar: null,
    odin_user_log_ccr_diluent_end_psi: null,
    odin_user_log_ccr_o2_tanktype_id: null,
    odin_user_log_ccr_o2_tank_vol_l: null,
    odin_user_log_ccr_o2_tank_vol_cuft: null,
    odin_user_log_ccr_o2_start_bar: null,
    odin_user_log_ccr_o2_start_psi: null,
    odin_user_log_ccr_o2_end_bar: null,
    odin_user_log_ccr_o2_end_psi: null,

    // --- Linked / extended ---
    log_linked_facility_id: null,
    log_linked_brevet_rule_id: null,
    odin_user_log_gearconfiguration_id: null,
    log_extended_data_cleanup_weight_kg: null,
    log_extended_data_cleanup_weight_lb: null,

    // --- GPS ---
    odin_user_log_pos_start_latitude: latitude,
    odin_user_log_pos_start_longitude: longitude,
    odin_user_log_pos_end_latitude: null,
    odin_user_log_pos_end_longitude: null,

    // --- Apple Watch ---
    odin_user_log_apple_watch: 0,
    odin_user_log_apple_watch_log_id: null,
    odin_user_log_apple_watch_id: null,
    odin_user_log_apple_watch_app_version: null,
    odin_user_log_apple_watch_os_version: null,

    // --- Sensor datasets ---
    odin_user_log_heartRateMin: null,
    odin_user_log_heartRateMax: null,
    odin_user_log_heartRateAvg: null,
    odin_user_log_heartRateDataset: null,
    odin_user_log_batteryLevelDataset: null,
    odin_user_log_batteryLevelStart: null,
    odin_user_log_batteryLevelEnd: null,
    odin_user_log_accelerationDataset: null,
    odin_user_log_gyroDataset: null,

    // --- Misc ---
    odin_user_log_dive_on_own_risk: 0,
    odin_user_log_dive_on_own_risk_os_app: null,
    odin_user_log_housing_local_dive_media: null,
  } satisfies CreateDive;
}
