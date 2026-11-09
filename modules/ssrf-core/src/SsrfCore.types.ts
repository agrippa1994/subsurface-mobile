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

/**
 * The core's `prefs.units` for one call, one unit per quantity (core/units.h,
 * `struct units`). Only the calls whose output the core formats itself take
 * it: planner notes, statistics chart labels and the CSV stylesheets.
 */
export type CoreUnitsInput = {
  depth: 'm' | 'ft';
  pressure: 'bar' | 'psi';
  volume: 'l' | 'cuft';
  temperature: 'C' | 'F';
  weight: 'kg' | 'lbs';
};

/**
 * App preferences the core reads itself, set with `configurePreferences`. Each is
 * applied when present and left as it was when absent.
 */
export type CorePreferences = {
  /** The device region's twelve short month names, January first. */
  monthNames?: string[];
  /**
   * The core's `default_cylinder`: a cylinder type's name from the tank table
   * (`plannerOptions().tanks`), or "" for none. New dives, the planner's
   * cylinders and downloaded dives whose computer gave no size start from it.
   */
  defaultCylinder?: string;
};

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
  /** The trip the dive is in, 0 for none. Process-local, like a dive id. */
  tripId: number;
  tripLocation: string;
  buddy: string;
  diveguide: string;
  suit: string;
  tags: string[];
  divemode: DiveMode;
  dcModel: string;
  /** Has a dive computer the planner made: it was planned, not dived. */
  planned: boolean;
  invalid: boolean;
  /**
   * The descriptions of the dive's cylinders, in order, with the unnamed ones
   * left out. On the summary rather than only on `Dive` because it is the
   * autocomplete corpus for the cylinder editor: the core has no cylinder
   * table, so the dive list is the only record of the tanks a diver uses.
   */
  cylinderDescriptions: string[];
  /** The same, for the weight editor: `weightsystem_t::description`. */
  weightDescriptions: string[];
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
  /**
   * Seconds east of UTC the computer reported. `TIMEZONE_OFFSET_INVALID`
   * (2147483647, the core's INT_MAX - see subsurface/core/divecomputer.h:23)
   * when it reported none, which is the common case. That value is a sentinel
   * and not an offset: adding it to a timestamp moves the dive 68 years on.
   */
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

/**
 * One entry of `DivePatch.weightsystems`, on the same terms as `CylinderPatch`:
 * only the keys present are written, `sourceIndex` names the weightsystem in
 * the dive's *current* list that this entry carries forward, an entry without
 * one is new, and the array is the whole resulting list so anything left out is
 * removed. Entries must stay in source order, with the new ones last.
 *
 * Unlike a cylinder, a weightsystem is never referred to from elsewhere in the
 * dive, so any of them can be removed.
 */
export type WeightSystemPatch = {
  sourceIndex?: number;
  description?: string;
  weightGrams?: number;
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
  /** The dive's whole weightsystem list after the edit. */
  weightsystems?: WeightSystemPatch[];
  /**
   * Unix seconds, like `DiveSummary.when`. Moves the dive in the list; it keeps
   * its trip and its number, as in the core.
   */
  when?: number;
  /** 0 clears it, unless a dive computer reported one, which then shows again. */
  airTempMkelvin?: number;
  waterTempMkelvin?: number;
  /**
   * These three are for a manually added dive only, and refused on any other,
   * whose figures come from its samples. Any of them redraws the profile. A new
   * depth or duration without `meanDepthMm` drops the average for a new one.
   */
  durationSec?: number;
  maxDepthMm?: number;
  /** Less than the maximum depth; 0 for no particular average. */
  meanDepthMm?: number;
};

/** `addDive`: a dive by its figures, plus whatever else the diver filled in. */
export type NewDiveInput = Omit<DivePatch, 'invalid'> & {
  when: number;
  durationSec: number;
  maxDepthMm: number;
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
  /**
   * Subsurface's own NDL, TTS and next stop, from the Buehlmann model with the
   * gradient factors `getProfile` was given, and with the tissues loaded by
   * the earlier dives in the log. The fields above without `Calc` are what the
   * dive computer recorded. All zero in a planner profile.
   */
  ndlCalcSec: number;
  ttsCalcSec: number;
  stoptimeCalcSec: number;
  stopdepthCalcMm: number;
  inDecoCalc: boolean;
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

/**
 * Buehlmann gradient factors, in percent, as `getProfile` takes them. The core
 * clamps each to 10-150 and raises `gfHigh` to `gfLow` if the pair is inverted.
 */
export type GradientFactors = {
  gfLow: number;
  gfHigh: number;
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
  /**
   * Seconds on the surface since the previous dive that still loads the
   * tissues at the start of this one; null for a dive with none (a 48h gap,
   * or the first dive). `getProfile` only.
   */
  surfaceIntervalSec?: number | null;
  /**
   * The same calculation run as if the dive had started with clean tissues,
   * one value per `entry`. Null when nothing loaded the tissues, since it would
   * equal the `*Calc` fields. `getProfile` only.
   */
  fresh?: FreshDeco | null;
};

/** Calculated NDL/TTS for a dive started with no residual nitrogen. */
export type FreshDeco = {
  ndlCalcSec: number[];
  ttsCalcSec: number[];
  inDecoCalc: boolean[];
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
  /** The earliest and latest matched dive's `when`; 0 when nothing matched. */
  firstWhen: number;
  lastWhen: number;
  /** Matched dives with a cylinder richer than air (legacy summary's "EAN dives"). */
  nitroxDives: number;
  /** Matched dives deeper than 39 m (legacy summary's "Deep dives"). */
  deepDives: number;
  /** With `recentMonths`, the `when` the period starts after; 0 otherwise. */
  periodStartWhen: number;
};

export type StatsFilter = {
  /** Unix seconds, inclusive. */
  fromWhen?: number;
  toWhen?: number;
  siteUuid?: number;
  /** Only the dives of this trip (`Trip.id`). */
  tripId?: number;
  /** Case-insensitive substring match on any tag. */
  tag?: string;
  /** Case-insensitive substring match on buddy or diveguide. */
  buddy?: string;
  minDepthMm?: number;
  maxDepthMm?: number;
  /** Dives flagged invalid are excluded unless this is set. */
  includeInvalid?: boolean;
  /** Leaves out dives that were planned rather than dived. Desktop counts them. */
  excludePlanned?: boolean;
  /**
   * The legacy dive summary's periods: only dives after this many calendar months
   * before now, on the wall clock dives are logged in (DiveSummaryModel::calc).
   */
  recentMonths?: number;
  /** "Now" for `recentMonths`, as a wall-clock `when`. The device's time when absent; for tests. */
  nowWhen?: number;
};

// --- Dive planner -------------------------------------------------------------

/** `enum deco_mode` in core/pref.h. */
export const PlanDecoMode = { Buehlmann: 0, Recreational: 1, VpmB: 2 } as const;
export type PlanDecoMode = (typeof PlanDecoMode)[keyof typeof PlanDecoMode];

/** `enum divemode_t` in core/divemode.h, the three a plan can be in. */
export const PlanDiveMode = { OpenCircuit: 0, Ccr: 1, Pscr: 2 } as const;
export type PlanDiveMode = (typeof PlanDiveMode)[keyof typeof PlanDiveMode];

export type PlanCylinderInput = {
  description?: string;
  sizeMl: number;
  /** What the cylinder is filled to; the plan starts from it. */
  pressureMbar: number;
  o2Permille: number;
  hePermille?: number;
  use?: CylinderUse;
};

export type PlanSegmentInput = {
  /** The depth at the end of the segment. */
  depthMm: number;
  durationSec: number;
  /** Index into `cylinders`. */
  cylinder: number;
  /** Closed loop only. */
  setpointMbar?: number;
  /** Which mode this segment is in on a pSCR dive. */
  diveMode?: PlanDiveMode;
};

/** The core's planner preferences. Anything left out is the core's default. See cpp/API.md. */
export type PlanSettingsInput = {
  /** Units the notes are written in and the stop table steps by (3 m or 10 ft). */
  units?: CoreUnitsInput;
  /** Shorthand for every unit imperial; `units` wins over it. */
  imperial?: boolean;
  decoMode?: PlanDecoMode;
  gfLow?: number;
  gfHigh?: number;
  vpmbConservatism?: number;
  /** mm/s, like everything the core calls a rate. */
  ascrate75?: number;
  ascrate50?: number;
  ascratestops?: number;
  ascratelast6m?: number;
  descrate?: number;
  dropStone?: boolean;
  lastStop6m?: boolean;
  o2Breaks?: boolean;
  switchAtRequiredStop?: boolean;
  minSwitchSec?: number;
  surfaceSegmentSec?: number;
  reserveGasMbar?: number;
  safetyStop?: boolean;
  bottomSacMl?: number;
  decoSacMl?: number;
  /** In percent: 400 is a factor of 4.0. */
  sacFactor?: number;
  problemSolvingMin?: number;
  bottomPo2Mbar?: number;
  decoPo2Mbar?: number;
  defaultSetpointMbar?: number;
  bestMixEndMm?: number;
  o2Narcotic?: boolean;
  doBailout?: boolean;
  displayRuntime?: boolean;
  displayDuration?: boolean;
  displayTransitions?: boolean;
  verbatim?: boolean;
  displayVariations?: boolean;
  showIcd?: boolean;
};

export type PlanInput = PlanSettingsInput & {
  /** Seconds, local wall clock as if UTC, like every `when` in the core. */
  when?: number;
  diveMode?: PlanDiveMode;
  /** g/10l: 10300 sea, 10200 EN13319, 10000 fresh. */
  salinity?: number;
  surfacePressureMbar?: number;
  cylinders: PlanCylinderInput[];
  segments: PlanSegmentInput[];
};

export type PlanError =
  | 'ok'
  | 'timeout'
  | 'inappropriateGas'
  | 'noSuitableBailoutGas'
  | 'recreationalExceedsNdl';

export type PlannedCylinder = {
  /** Its index in the input: a first segment's cylinder is moved to the front. */
  inputIndex: number;
  description: string;
  o2Permille: number;
  hePermille: number;
  name: string;
  use: CylinderUse;
  sizeMl: number;
  switchDepthMm: number;
  startMbar: number;
  endMbar: number;
  /** What it reads when the ascent starts; held against the minimum gas. */
  ascentStartMbar: number;
  gasUsedMl: number;
  decoGasUsedMl: number;
  gasCarriedMl: number;
  /** 0 unless this is the last bottom gas of an open circuit deco plan. */
  minimumGasMbar: number;
};

/** One point of the finished plan: entered by the diver, or added by the core. */
export type PlanWaypoint = {
  timeSec: number;
  depthMm: number;
  /** One past the cylinders is the core's "breathing air at the surface". */
  cylinder: number;
  setpointMbar: number;
  entered: boolean;
  diveMode: number;
};

export type PlanResult = {
  error: PlanError;
  /** The core's notes, in HTML. Always there; all there is on a failed plan. */
  notes: string;
  runtimeSec: number;
  maxDepthMm: number;
  bottomTimeSec: number;
  cns: number;
  otu: number;
  /** Since the last dive before this one; negative when they overlap. */
  surfaceIntervalSec: number;
  effectiveGfLow: number;
  effectiveGfHigh: number;
  disclaimer: string;
  waypoints: PlanWaypoint[];
  cylinders: PlannedCylinder[];
  waypointAboveCeiling: boolean;
  /** Null when `error` means there is no ascent to show. */
  profile: PlotInfo | null;
  dive: Dive | null;
};

export type SavePlanResult = { id: number; dives: number };

export type GasInfoInput = {
  o2Permille: number;
  hePermille?: number;
  o2Narcotic?: boolean;
  salinity?: number;
  surfacePressureMbar?: number;
  bestMix?: { depthMm: number; bottomPo2Mbar?: number; bestMixEndMm?: number };
};

export type GasInfoRow = { po2Mbar: number; modMm: number; narcoticDepthMm: number };

export type GasInfo = {
  name: string;
  /** Whether `narcoticDepthMm` is an END (true) or an EAD. */
  o2Narcotic: boolean;
  rows: GasInfoRow[];
  minDepthMm: number;
  best?: { o2Permille: number; hePermille: number };
};

export type PlanTank = { name: string; sizeMl: number; workingPressureMbar: number };

export type PlannerOptions = { tanks: PlanTank[] };

export type PlannerSurface = { surfacePressureMbar: number; altitudeMm: number };

/** Arguments of `nitroxPlan`. Gradient factors default to the core's 30/75. */
export type NitroxPlanInput = {
  depthMm: number;
  /** 210-1000. */
  o2Permille: number;
  /** Working pO2 limit, 1000-1600. Defaults to 1400. */
  maxPo2Mbar?: number;
  /** g/10l: 10300 sea water (the default), 10000 fresh. */
  salinity?: number;
  gfLow?: number;
  gfHigh?: number;
};

/** Result of `nitroxPlan` - see cpp/API.md. */
export type NitroxPlan = {
  /** Maximum operating depth at the working pO2. */
  modMm: number;
  /** Maximum operating depth at 1.6 bar. */
  contingencyModMm: number;
  /** Air's maximum operating depth at the working pO2. */
  airModMm: number;
  /** Richest mix the working pO2 allows at the depth, rounded down to a percent. */
  bestMixPermille: number;
  ambientMbar: number;
  /** pO2 of the mix at the depth. */
  po2Mbar: number;
  /** No-decompression limit of a square dive on the mix; null past 300 min. */
  ndlMin: number | null;
  /** The same on air. */
  airNdlMin: number | null;
};

/** Arguments of `surfaceGf` - see cpp/API.md. */
export type SurfaceGfInput = GradientFactors & {
  /** The dive the surface interval follows. Default: the latest valid dive by end time. */
  id?: number;
  /** Ambient pressure on the surface, 500-1100 mbar. Default: the dive's own surface pressure. */
  ambientMbar?: number;
  /** Spacing of the series, 10-600 s. Default 60. */
  stepSec?: number;
  /** Length of the series, up to 72 h. Default: until clean plus an hour, at most 72 h. */
  horizonSec?: number;
};

/**
 * Result of `surfaceGf`: the Buehlmann surface gradient factor over the surface
 * interval after one dive - see cpp/API.md. Times are the core's: wall clock
 * written as if it were UTC, in seconds.
 */
export type SurfaceGfSeries = {
  diveId: number;
  diveNumber: number;
  diveWhen: number;
  /** `dive::endtime()`, where the core starts counting a surface interval. */
  diveEndWhen: number;
  /** When the series starts: the profile's last plotted point, at or just after diveEndWhen. */
  startWhen: number;
  diveSurfaceMbar: number;
  ambientMbar: number;
  stepSec: number;
  /** Surface GF of the profile's last point against the dive's surface pressure, percent. */
  endSurfaceGf: number;
  /** Surface GF in percent, one value per `stepSec` from `startWhen`. Never below 0. */
  surfaceGf: number[];
  /** The compartment (0-15) that decides each value of `surfaceGf`. */
  leadingCompartment: number[];
  /** Seconds after startWhen until no compartment is supersaturated (GF 0 %); null past the series. */
  gfZeroSec: number | null;
  /**
   * Seconds after startWhen until every compartment is within 2 % of its
   * equilibrium with surface air; null past the series.
   */
  cleanSec: number | null;
  /** The surface interval before the dive when earlier dives loaded its tissues, else null. */
  residualFromSec: number | null;
};

export type LoadResult = { dives: number; sites: number; trips: number };
export type SaveResult = { path: string; dives: number };

/**
 * The three CSV flavours of desktop Subsurface's export dialog:
 *
 *  - `details`: the samples as downloaded from the dive computer
 *    ("CSV details", xml2detailscsv.xslt)
 *  - `summary`: one row of dive information, no profile
 *    ("CSV summary", xml2summarycsv.xslt)
 *  - `profile`: the computed profile panel data ("Profile data",
 *    save-profiledata.cpp), in the core's raw integer units
 */
export type CsvFormat = 'details' | 'summary' | 'profile';

export type CsvExportOptions = {
  format: CsvFormat;
  /** Units of `details` and `summary`, one per quantity; `profile` has none. Metric by default. */
  units?: CoreUnitsInput;
  /** Shorthand for every unit imperial; `units` wins over it. */
  imperial?: boolean;
  /** Gradient factors `profile` computes the ceiling with, as for getProfile. */
  gf?: GradientFactors;
};

export type CsvExportResult = { path: string; format: CsvFormat };
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

/** A trip with at least one dive. Its dives carry its id as `tripId`. */
export type Trip = {
  /** Process-local and reassigned on every load, like a dive id. */
  id: number;
  location: string;
  notes: string;
  diveCount: number;
  /** Start of the first dive, in the same wall-clock seconds as `Dive.when`. */
  when: number;
  /** Start of the last dive. Equals `when` for a trip of one dive. */
  lastDiveWhen: number;
};

/** The fields of a trip the user edits. Absent fields are left alone. */
export type TripPatch = {
  location?: string;
  notes?: string;
};

/** What is left after removeDivesFromTrip(). */
export type RemoveFromTripResult = { trips: number };

/** Two neighbouring dives that mergeDives() takes. See api.cpp, may_merge(). */
export type MergePair = {
  earlierId: number;
  laterId: number;
  /** Time on the surface between them; 0 when they overlap. */
  surfaceIntervalSec: number;
};

/** What mergeDives() would leave behind. Nothing has changed yet. */
export type MergePreview = {
  /** The merged dive. Its id is not one the log knows. */
  dive: Dive;
  surfaceIntervalSec: number;
  /** How many later dives would have their number changed. */
  renumberedDives: number;
};

/** The merged dive's new id, and what the logbook holds now. */
export type MergeResult = { id: number; dives: number; trips: number };

/** What the logbook holds after deleteDive(): the trip count can drop too. */
export type DeleteDiveResult = { dives: number; trips: number };

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

// --- Downloading from a dive computer ---------------------------------------

/** A vendor and the products of it the app can reach (dcListComputers). */
export type DiveComputerVendor = { vendor: string; products: string[] };

export type DiveComputerIdentity = { vendor: string; product: string };

export type DownloadOptions = DiveComputerIdentity & {
  /** The BLE address: a CoreBluetooth UUID on iOS, a MAC address on Android. */
  address: string;
  /** The advertised name; a few dive computers derive something from it. */
  btName?: string;
  /** Downloads every dive instead of stopping at the ones already known. */
  force?: boolean;
  /** Sets the dive computer's clock once the download has worked. */
  syncTime?: boolean;
};

export type DownloadState = 'idle' | 'running' | 'finished' | 'failed' | 'cancelled';

export type DownloadedDive = {
  /** What dcDownloadAccept selects by. Stable until the session ends. */
  index: number;
  /** Seconds since 1970, in the dive's local time like every core timestamp. */
  when: number;
  durationSec: number;
  maxDepthMm: number;
};

export type DownloadStatus = {
  state: DownloadState;
  /** The latest message from the downloader, in English. */
  text: string;
  /** 0 to 1. Stays at 0 for as long as the device does not say how much is coming. */
  fraction: number;
  /** Why it failed. Empty unless `state` is 'failed' or 'cancelled'. */
  error: string;
  /** The more specific reasons, in the order they happened. */
  errors: string[];
  /** Possibly corrected: the device says what it is during the download. */
  vendor: string;
  product: string;
  address: string;
  serial: number;
  firmware: number;
  diveCount: number;
  /** Empty while running. A failed or cancelled download can still have some. */
  dives: DownloadedDive[];
  /** libdivecomputer's log of this download, for a bug report. Empty if not configured. */
  logPath: string;
};

export type BleAdapterState = 'unknown' | 'unsupported' | 'unauthorized' | 'off' | 'on';

export type BleDevice = {
  address: string;
  /** Empty for a device known from before that has not advertised yet. */
  name: string;
  rssi: number;
  /** Set when the name is a dive computer the app knows. */
  vendor: string | null;
  product: string | null;
};

export type BleScanStatus = {
  adapter: BleAdapterState;
  scanning: boolean;
  /** False where the module has no Bluetooth driver at all. */
  available: boolean;
  devices: BleDevice[];
};

/** What the native module pushes between calls (onCoreEvent). */
export type CoreEvent =
  | { type: 'download'; state: DownloadState; text: string; fraction: number }
  | { type: 'ble'; adapter?: BleAdapterState; device?: BleDevice };

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

// --- Undo and redo (cpp/bindings/history.cpp) ------------------------------

/**
 * The facts of one change, as the bindings saw them. `kind` is the method that made
 * it; which of the other fields are there depends on the kind. Worded by
 * src/models/logbook-history.ts.
 */
export type HistoryEntry = {
  kind: string;
  /** Tells entries apart: a label need not be unique. */
  serial: number;
  divesBefore: number;
  divesAfter: number;
  tripsBefore: number;
  tripsAfter: number;
  diveNumber?: number;
  diveSite?: string;
  diveNumbers?: number[];
  diveCount?: number;
  isNew?: boolean;
  siteName?: string;
  siteDives?: number;
  tripLocation?: string;
  /** makeFirstDiveComputer: the model of the computer moved to the front. */
  computerModel?: string;
};

export type HistoryAction = 'none' | 'change' | 'undo' | 'redo' | 'clear';

export type HistoryState = {
  canUndo: boolean;
  canRedo: boolean;
  undo: HistoryEntry | null;
  redo: HistoryEntry | null;
  undoDepth: number;
  redoDepth: number;
  /** What the kept states of the log hold in memory, shared parts counted once. */
  bytes: number;
  /** Counts up with every change to the history. */
  revision: number;
  /** What the last change to the history was. */
  lastAction: HistoryAction;
};

export type HistoryStepResult = {
  /** The change that was undone or redone. */
  entry: HistoryEntry;
  /** False if dive and trip ids could not be put back, so that none can be trusted. */
  idsKept: boolean;
  state: HistoryState;
};

// --- Configurable statistics (statsChart) --------------------------------------
//
// See cpp/API.md. The configuration is what StatsState holds on the desktop; the app
// persists it and hands it back, and the bindings rebuild the state from it.

export type StatsChartType =
  | 'DiscreteBar'
  | 'DiscreteValue'
  | 'DiscreteCount'
  | 'DiscreteBox'
  | 'DiscreteScatter'
  | 'Pie'
  | 'HistogramCount'
  | 'HistogramValue'
  | 'HistogramBox'
  | 'HistogramStacked'
  | 'ScatterPlot'
  | 'Invalid';

export type StatsChartSubtype =
  | 'Vertical'
  | 'VerticalGrouped'
  | 'VerticalStacked'
  | 'Horizontal'
  | 'HorizontalGrouped'
  | 'HorizontalStacked'
  | 'Dots'
  | 'Box'
  | 'Pie';

export type StatsOperationName =
  | 'Median'
  | 'Mean'
  | 'TimeWeightedMean'
  | 'Sum'
  | 'Min'
  | 'Max'
  | 'Invalid';

export type StatsSortMode = 'Bin' | 'Count' | 'Value';

export type StatsFeature =
  | 'labels'
  | 'legend'
  | 'median'
  | 'mean'
  | 'quartiles'
  | 'regression'
  | 'confidence';

export type StatsChartConfig = {
  /** The variable's name in `stats_variables`. */
  var1: string;
  var2: string | null;
  /** Index into `StatsChartOptions.binners1`, -1 when that list is empty. */
  binner1: number;
  binner2: number;
  operation: StatsOperationName;
  chart: { type: StatsChartType; subtype: StatsChartSubtype };
  sort: StatsSortMode;
  features: Record<StatsFeature, boolean>;
};

/** A partial configuration is completed the way StatsState would. */
export type StatsChartConfigInput = Partial<StatsChartConfig>;

/** One user choice, as StatsState's var1Changed() and friends take it. */
export type StatsChartChange =
  | { kind: 'var1'; value: string }
  | { kind: 'var2'; value: string | null }
  | { kind: 'binner1' | 'binner2'; value: number }
  | { kind: 'operation'; value: StatsOperationName }
  | { kind: 'chart'; value: { type: StatsChartType; subtype: StatsChartSubtype } }
  | { kind: 'sort'; value: StatsSortMode }
  | { kind: 'feature'; value: { key: StatsFeature; on: boolean } };

export type StatsVariableKind = 'discrete' | 'continuous' | 'numeric';

export type StatsVariableOption = { name: string; type: StatsVariableKind; unit: string };

export type StatsChartOption = {
  type: StatsChartType;
  subtype: StatsChartSubtype;
  name: string;
  subtypeName: string;
  /** Valid but not recommended for these variables. */
  warning: boolean;
  selected: boolean;
};

/** Only what the current choices allow: StatsState::getUIState(). */
export type StatsChartOptions = {
  var1: StatsVariableOption[];
  /** Without var1. Null in the configuration is "none". */
  var2: StatsVariableOption[];
  /** Empty when there is nothing to choose. */
  binners1: string[];
  binners2: string[];
  operations: { key: StatsOperationName; name: string }[];
  sorts: { key: StatsSortMode; name: string }[];
  charts: StatsChartOption[];
  features: { key: StatsFeature; on: boolean }[];
};

export type StatsAxis =
  | { kind: 'count' | 'value'; title: string; min: number | null; max: number | null; decimals: number; unit: string }
  | { kind: 'category'; title: string }
  | { kind: 'histogram'; title: string; lastLabel: string; lastBound: number }
  | { kind: 'date'; title: string; min: number; max: number };

export type StatsOperationResults = {
  median: number | null;
  mean: number | null;
  timeWeightedMean: number | null;
  sum: number | null;
  min: number | null;
  max: number | null;
};

export type StatsSegment = { count: number; dives: number[] };

export type StatsBox = { min: number; q1: number; q2: number; q3: number; max: number };

/**
 * One bar, slice or box. Positions run along the category axis: bin numbers around
 * whole numbers for a category axis, the binner's bounds for a histogram, cumulative
 * dive counts for a slice.
 */
export type StatsChartItem = {
  from: number;
  to: number;
  /** The bin alone, for an axis. Empty for a bin without a name. */
  label: string;
  /** With its unit, for a readout. */
  full: string;
  count: number;
  /** All dives of the chart's bins, where a percentage means something. */
  total?: number;
  /** A count, or the operation's result. Null when no dive of the bin has one. */
  value?: number | null;
  operations?: StatsOperationResults;
  segments?: StatsSegment[];
  dives?: number[];
  box?: StatsBox | null;
  quartiles?: { q1: number; q2: number; q3: number };
  /** Histogram: the tick at `from`, and whether it is worth keeping when thinning. */
  tick?: string;
  prefer?: boolean;
  /** Pie: what the "other" slice holds. */
  other?: { name: string; count: number }[];
};

export type StatsRegression = {
  a: number;
  b: number;
  r2: number;
  n: number;
  fromX: number;
  toX: number;
  /** The 95% confidence area, empty with two points. */
  band: { x: number; low: number; high: number }[];
};

export type StatsChart = {
  family: 'bar' | 'pie' | 'box' | 'scatter' | 'empty';
  title: string;
  horizontal: boolean;
  stacked: boolean;
  histogram: boolean;
  catAxis?: StatsAxis;
  valAxis?: StatsAxis;
  series?: string[];
  items?: StatsChartItem[];
  /** Parallel arrays: thousands of points are cheaper this way than as objects. */
  points?: { x: number[]; y: number[]; dives: number[] };
  regression?: StatsRegression | null;
  mean?: number | null;
  median?: number | null;
};

export type StatsChartResult = {
  /** Complete, and what the state settled on: persist this one. */
  config: StatsChartConfig;
  options: StatsChartOptions;
  /** How many dives the filter let through. */
  dives: number;
  /** Absent when asked with `plot: false`. */
  chart?: StatsChart;
};

export type StatsChartRequest = {
  config?: StatsChartConfigInput;
  change?: StatsChartChange;
  filter?: StatsFilter;
  /** Units the binners cut and label in. Metric by default. */
  units?: CoreUnitsInput;
  /** Shorthand for every unit imperial; `units` wins over it. */
  imperial?: boolean;
  /** False when only the configuration and its options are of interest. */
  plot?: boolean;
};
