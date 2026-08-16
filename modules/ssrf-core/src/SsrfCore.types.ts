// AI-generated (Claude)
// Shared types for the ssrf-core module boundary.
//
// The JSI boundary format is JSON: TypeScript sends a method name plus a JSON
// argument object and gets a JSON envelope back. The native module owns the
// in-memory divelog; nothing is cached here.
//
// Units are the core's own integer units - millimetres, millibar, millikelvin,
// millilitres, grams, seconds, permille, microdegrees. No conversion or
// formatting happens in C++, so the same numbers can be rendered metric or
// imperial. The key mapping is documented in cpp/API.md.

// Native surface exposed by the Swift/Kotlin module definition.
export type SsrfCoreNativeModule = {
  // The whole core API. Returns the JSON envelope described in cpp/api.h.
  call(method: string, argsJson: string): string;

  // Smoke test proving C++ executes over JSI (task 02).
  add(a: number, b: number): number;

  // Task 03 smoke units, backed by the vendored Subsurface core.
  // Serializes a minimal in-memory divelog to Subsurface XML.
  smokeSerializeMinimalLog(): string | null;
  // Parses an SSRF/XML logbook and returns its dive count, -1 on failure.
  smokeCountDivesInFile(path: string): number;
};

// --- Enumerations, mirroring the core's enum values ------------------------

/** `divemode_t` in core/divemode.h. */
export enum DiveMode {
  OC = 0,
  CCR = 1,
  PSCR = 2,
  Freedive = 3,
}

/** `cylinderuse` in core/equipment.h. */
export enum CylinderUse {
  OcGas = 0,
  Diluent = 1,
  Oxygen = 2,
  NotUsed = 3,
}

/** `velocity_t` in core/profile.h. */
export enum Velocity {
  Stable = 0,
  Slow = 1,
  Moderate = 2,
  Fast = 3,
  Crazy = 4,
}

/** `plot_info::dive_type` in core/profile.h. */
export enum ProfileDiveType {
  Air = 0,
  Nitrox = 1,
  Trimix = 2,
  Freediving = 3,
}

/** `event_severity` in core/event.h. */
export enum EventSeverity {
  None = 0,
  Info = 1,
  Warn = 2,
  Alarm = 3,
}

/** `taxonomy_category` in core/taxonomy.h. */
export enum TaxonomyCategory {
  None = 0,
  Ocean = 1,
  Country = 2,
  AdminL1 = 3,
  AdminL2 = 4,
  LocalName = 5,
  AdminL3 = 6,
}

// --- Domain shapes ---------------------------------------------------------

export type GasMix = {
  o2Permille: number;
  hePermille: number;
  /** o2Permille with the "0 means air" sentinel already resolved. */
  o2EffectivePermille: number;
  heEffectivePermille: number;
};

/**
 * One row of the dive list.
 *
 * `id` is the core's runtime handle for the dive. It is stable for as long as
 * the log stays loaded, but it is NOT persisted: after `loadFromXML` the ids
 * are different, so never store one across a load.
 */
export type DiveSummary = {
  id: number;
  number: number;
  /** Unix timestamp in seconds, UTC. */
  when: number;
  durationSec: number;
  maxDepthMm: number;
  meanDepthMm: number;
  waterTempMkelvin: number;
  rating: number;
  visibility: number;
  siteUuid: number;
  siteName: string;
  tripLocation: string;
  buddy: string;
  diveguide: string;
  suit: string;
  tags: string[];
  divemode: DiveMode;
  dcModel: string;
  invalid: boolean;
  /**
   * The descriptions of the dive's cylinders, in order, with the unnamed ones
   * left out. On the summary rather than only on `Dive` because it is the
   * autocomplete corpus for the cylinder editor: the core has no cylinder
   * table, so the dive list is the only record of the tanks a diver uses.
   */
  cylinderDescriptions: string[];
};

export type Cylinder = {
  description: string;
  sizeMl: number;
  workingPressureMbar: number;
  gasmix: GasMix;
  startMbar: number;
  endMbar: number;
  sampleStartMbar: number;
  sampleEndMbar: number;
  depthMm: number;
  manuallyAdded: boolean;
  gasUsedMl: number;
  decoGasUsedMl: number;
  use: CylinderUse;
  bestmixO2: boolean;
  bestmixHe: boolean;
  /**
   * `dive::is_cylinder_used(index)`: the samples or the gas-switch events refer
   * to this cylinder. Such a cylinder cannot be removed - the events would be
   * left pointing at a gas that is no longer there.
   */
  used: boolean;
};

export type WeightSystem = {
  description: string;
  weightGrams: number;
  autoFilled: boolean;
};

export type DiveEvent = {
  timeSec: number;
  type: number;
  flags: number;
  value: number;
  name: string;
  hidden: boolean;
  severity: EventSeverity;
  /** Gas-switch events only. -1 means "unknown, match by gasmix". */
  gasIndex?: number;
  /** Gas-switch events only. */
  gasmix?: GasMix;
  /** Divemode-change events only. */
  divemode?: DiveMode;
};

export type DiveComputer = {
  model: string;
  serial: string;
  fwVersion: string;
  deviceId: number;
  diveId: number;
  when: number;
  durationSec: number;
  surfaceTimeSec: number;
  maxDepthMm: number;
  meanDepthMm: number;
  airTempMkelvin: number;
  waterTempMkelvin: number;
  surfacePressureMbar: number;
  divemode: DiveMode;
  noO2sensors: number;
  salinity: number;
  timezoneOffset: number;
  /** Samples themselves come from `getProfile`, not from here. */
  sampleCount: number;
  events: DiveEvent[];
  extraData: { key: string; value: string }[];
};

export type Dive = DiveSummary & {
  notes: string;
  wavesize: number;
  current: number;
  surge: number;
  chill: number;
  sac: number;
  otu: number;
  cns: number;
  maxcns: number;
  salinity: number;
  userSalinity: number;
  minTempMkelvin: number;
  maxTempMkelvin: number;
  airTempMkelvin: number;
  surfacePressureMbar: number;
  totalWeightGrams: number;
  notrip: boolean;
  cylinders: Cylinder[];
  weightsystems: WeightSystem[];
  dcs: DiveComputer[];
};

export type TaxonomyEntry = {
  category: TaxonomyCategory;
  value: string;
  origin: number;
};

export type DiveSite = {
  uuid: number;
  name: string;
  latUdeg: number;
  lonUdeg: number;
  hasGps: boolean;
  description: string;
  notes: string;
  diveCount: number;
  taxonomy: TaxonomyEntry[];
};

export type DiveSiteInput = {
  /** Omit to create a new site; pass an existing uuid to update one. */
  uuid?: number;
  name?: string;
  latUdeg?: number;
  lonUdeg?: number;
  description?: string;
  notes?: string;
};

/**
 * One entry of `DivePatch.cylinders`. Only the keys present are written, so a
 * patch that changes a start pressure need not restate the gas mix.
 *
 * `sourceIndex` names the cylinder in the dive's *current* list that this entry
 * carries forward; an entry without one is a new cylinder. The array is the
 * whole resulting list, so a cylinder simply left out of it is removed - which
 * the bindings refuse for a cylinder the samples or gas-switch events still use
 * (`dive::is_cylinder_used`). Entries must stay in source order, with the new
 * ones last.
 */
export type CylinderPatch = {
  sourceIndex?: number;
  description?: string;
  sizeMl?: number;
  workingPressureMbar?: number;
  /** Raw permille, sentinel included: 0 with `hePermille` 0 means air. */
  o2Permille?: number;
  hePermille?: number;
  startMbar?: number;
  endMbar?: number;
  use?: CylinderUse;
};

export type DivePatch = {
  notes?: string;
  buddy?: string;
  diveguide?: string;
  suit?: string;
  rating?: number;
  visibility?: number;
  number?: number;
  invalid?: boolean;
  /** Replaces the whole tag list. */
  tags?: string[];
  /** 0 detaches the dive from its site. */
  siteUuid?: number;
  /**
   * The dive's whole cylinder list after the edit. Applying it recomputes the
   * derived `sac`, `otu` and `cns`, because those follow from the cylinders.
   */
  cylinders?: CylinderPatch[];
};

/** One plotted sample. All depths in mm, pressures in mbar, temps in mkelvin. */
export type PlotEntry = {
  sec: number;
  depthMm: number;
  temperatureMkelvin: number;
  ceilingMm: number;
  stopdepthMm: number;
  stoptimeSec: number;
  ndlSec: number;
  ttsSec: number;
  rbtSec: number;
  inDeco: boolean;
  cns: number;
  sac: number;
  smoothedMm: number;
  modMm: number;
  eadMm: number;
  endMm: number;
  eaddMm: number;
  o2pressureMbar: number;
  o2setpointMbar: number;
  scrOcPo2Mbar: number;
  /** Partial pressures in bar. */
  pressures: { o2: number; n2: number; he: number };
  velocity: Velocity;
  speed: number;
  heartbeat: number;
  bearing: number;
  ambpressure: number;
  gfline: number;
  surfaceGf: number;
  currentGf: number;
  density: number;
  icdWarning: boolean;
};

export type PlotInfo = {
  nr: number;
  nrCylinders: number;
  maxtimeSec: number;
  meanDepthMm: number;
  maxDepthMm: number;
  minPressureMbar: number;
  maxPressureMbar: number;
  minHr: number;
  maxHr: number;
  minTempMkelvin: number;
  maxTempMkelvin: number;
  diveType: ProfileDiveType;
  endtempcoord: number;
  maxpp: number;
  waypointAboveCeiling: boolean;
  entry: PlotEntry[];
  /**
   * Flat arrays of `nr * nrCylinders` millibar readings, indexed exactly like
   * the core does it: `cylinder + sampleIndex * nrCylinders`. Use
   * `plotPressureAt` rather than open-coding the arithmetic.
   */
  pressures: { sensor: number[]; interpolated: number[] };
};

export type Stats = {
  /** Year for yearly buckets, month (1-12) for monthly ones, else 0. */
  period: number;
  selectionSize: number;
  totalTimeSec: number;
  totalAverageDepthTimeSec: number;
  shortestTimeSec: number;
  longestTimeSec: number;
  maxDepthMm: number;
  minDepthMm: number;
  avgDepthMm: number;
  combinedMaxDepthMm: number;
  maxSacMlPerMin: number;
  minSacMlPerMin: number;
  avgSacMlPerMin: number;
  totalSacTimeSec: number;
  maxTempMkelvin: number;
  minTempMkelvin: number;
  combinedTempMkelvin: number;
  combinedCount: number;
  isYear: boolean;
  isTrip: boolean;
  location: string;
};

/** One calendar month that has dives, from `StatsSummary.timeline`. */
export type StatsMonth = {
  /** Four-digit year. */
  year: number;
  /** 1-12. */
  month: number;
  dives: number;
  totalTimeSec: number;
  maxDepthMm: number;
};

/** One duration bucket. `toMin` is null on the last, open-ended bucket. */
export type StatsDurationBin = {
  fromMin: number;
  toMin: number | null;
  dives: number;
  totalTimeSec: number;
};

export type StatsSummary = {
  /** Statistics over everything the filter matched. */
  total: Stats;
  matched: number;
  yearly: Stats[];
  /**
   * Grouped by (year, month) in chronological order, but `period` carries only
   * the month - use `timeline` for anything that has to label the year.
   */
  monthly: Stats[];
  byTrip: Stats[];
  /** Indexed by DiveMode + 1; entry 0 is the combined total. */
  byType: Stats[];
  /** 10 m buckets; entry 0 is the combined total. */
  byDepth: Stats[];
  /** 5 C buckets; entry 0 is the combined total. */
  byTemp: Stats[];
  /** Months with dives, chronological. Computed by the bindings, not the core. */
  timeline: StatsMonth[];
  /** 10-minute buckets, the last one open-ended. Bindings, not the core. */
  byDuration: StatsDurationBin[];
  /** Distinct dive sites among the matched dives. Bindings, not the core. */
  siteCount: number;
};

export type StatsFilter = {
  /** Unix seconds, inclusive. */
  fromWhen?: number;
  toWhen?: number;
  siteUuid?: number;
  /** Case-insensitive substring match on any tag. */
  tag?: string;
  /** Case-insensitive substring match on buddy or diveguide. */
  buddy?: string;
  minDepthMm?: number;
  maxDepthMm?: number;
  /** Dives flagged invalid are excluded unless this is set. */
  includeInvalid?: boolean;
};

export type LoadResult = { dives: number; sites: number; trips: number };
export type SaveResult = { path: string; dives: number };
export type ImportResult = {
  /** Dives new to the logbook. */
  added: number;
  /** Dives the core recognized as ones it already had, merged in place. */
  merged: number;
  /** Documents inside an archive that failed to parse (0 for a single file). */
  failed: number;
  /** Total dives in the logbook after the import. */
  dives: number;
  /** Total dive sites after the import. */
  sites: number;
};

/** What is left after ungroupDives(): every dive, and no trips at all. */
export type UngroupResult = { dives: number; trips: number };

/**
 * Cylinder pressure in mbar at one sample, resolving the flat layout the core
 * uses (`cylinder + sampleIndex * nrCylinders`). Falls back to the interpolated
 * series when there is no sensor reading, which is what the desktop profile
 * does when drawing the pressure graph.
 *
 * Lives here rather than in index.ts because it is pure arithmetic over a
 * reply: the app and the Node test suite both use it, and index.ts pulls in the
 * native module.
 */
export function plotPressureAt(pi: PlotInfo, sampleIndex: number, cylinder: number): number {
  if (cylinder < 0 || cylinder >= pi.nrCylinders) {
    return 0;
  }
  const idx = cylinder + sampleIndex * pi.nrCylinders;
  return pi.pressures.sensor[idx] || pi.pressures.interpolated[idx] || 0;
}

/** Thrown by every wrapper in index.ts when the native call reports failure. */
export class SsrfCoreError extends Error {
  /** Messages the C++ core routed through report_error during the call. */
  readonly coreErrors: string[];

  constructor(message: string, coreErrors: string[] = []) {
    super(message);
    this.name = 'SsrfCoreError';
    this.coreErrors = coreErrors;
  }
}
