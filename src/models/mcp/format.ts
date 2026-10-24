// AI-generated (Claude)
// What the MCP tools reply with: the module's dives, sites and statistics in
// units a person or a model reads without a lookup table - metres, minutes,
// degrees Celsius, bar, litres, kilograms, percent. The unit is in every key
// name, so a reply is unambiguous on its own. Unknown values are null rather
// than the core's 0, which for a temperature would read as absolute zero.
//
// The conversions themselves are ../units, the app's one copy of the core's
// constants; this file only adds the null rule and the rounding.

import {
  CylinderUse,
  DiveMode,
  EventSeverity,
  TaxonomyCategory,
  type Cylinder,
  type Dive,
  type DiveComputer,
  type DiveSite,
  type DiveSummary,
  type GasMix,
  type Stats,
  type StatsDurationBin,
  type StatsSummary,
} from '../index';
import {
  gramsToKg,
  mbarToBar,
  mkelvinToCelsius,
  mlToLiters,
  mmToMeters,
  udegToDegrees,
} from '../units';

export type Json = Record<string, unknown>;

export function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** A conversion of a core value where 0 means "not recorded", rounded. */
function known(convert: (raw: number) => number, digits: number) {
  return (raw: number): number | null => (raw > 0 ? round(convert(raw), digits) : null);
}

const meters = known(mmToMeters, 2);
const minutes = known((sec) => sec / 60, 1);
const celsius = known(mkelvinToCelsius, 1);
const bar = known(mbarToBar, 1);
const liters = known(mlToLiters, 1);
const wholeLiters = known(mlToLiters, 0);
const kilograms = known(gramsToKg, 2);

/**
 * `dive::when` is the wall-clock time the diver logged, stored as if it were
 * UTC (see models/dive-list.ts), so the UTC reading of it is the local time of
 * the dive. No zone suffix: the zone is not known.
 */
export function wallClock(when: number): string {
  return new Date(when * 1000).toISOString().slice(0, 19);
}

/** `mm:ss` of a time into the dive. */
function clock(sec: number): string {
  const sign = sec < 0 ? '-' : '';
  const abs = Math.abs(sec);
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
}

export function gasName(mix: GasMix): string {
  const o2 = Math.round(mix.o2EffectivePermille / 10);
  const he = Math.round(mix.heEffectivePermille / 10);
  if (he > 0) {
    return `Tx${o2}/${he}`;
  }
  if (o2 === 21) {
    return 'air';
  }
  return o2 === 100 ? 'oxygen' : `EAN${o2}`;
}

const DIVE_MODES: Record<DiveMode, string> = {
  [DiveMode.OC]: 'open circuit',
  [DiveMode.CCR]: 'CCR',
  [DiveMode.PSCR]: 'pSCR',
  [DiveMode.Freedive]: 'freedive',
};

const CYLINDER_USES: Record<CylinderUse, string> = {
  [CylinderUse.OcGas]: 'OC gas',
  [CylinderUse.Diluent]: 'diluent',
  [CylinderUse.Oxygen]: 'oxygen',
  [CylinderUse.NotUsed]: 'not used',
};

const SEVERITIES: Record<EventSeverity, string> = {
  [EventSeverity.None]: 'none',
  [EventSeverity.Info]: 'info',
  [EventSeverity.Warn]: 'warning',
  [EventSeverity.Alarm]: 'alarm',
};

/** A label from one of the tables above; a value the core added later reads as its number. */
function label<K extends number>(table: Record<K, string>, value: K): string {
  return table[value] ?? String(value);
}

// --- Dives -----------------------------------------------------------------

/** One row of `list_dives`. */
export function diveRow(dive: DiveSummary): Json {
  return {
    id: dive.id,
    number: dive.number,
    dateTime: wallClock(dive.when),
    durationMin: minutes(dive.durationSec),
    maxDepthM: meters(dive.maxDepthMm),
    meanDepthM: meters(dive.meanDepthMm),
    waterTempC: celsius(dive.waterTempMkelvin),
    site: dive.siteName || null,
    siteUuid: dive.siteUuid || null,
    trip: dive.tripLocation || null,
    buddy: dive.buddy || null,
    diveguide: dive.diveguide || null,
    suit: dive.suit || null,
    tags: dive.tags,
    rating: dive.rating,
    visibility: dive.visibility,
    mode: label(DIVE_MODES, dive.divemode),
    diveComputer: dive.dcModel || null,
    invalid: dive.invalid,
  };
}

function cylinderOut(cylinder: Cylinder, index: number): Json {
  const pressureDrop =
    cylinder.startMbar > 0 && cylinder.endMbar > 0 ? cylinder.startMbar - cylinder.endMbar : 0;
  return {
    index,
    description: cylinder.description || null,
    sizeL: liters(cylinder.sizeMl),
    workingPressureBar: bar(cylinder.workingPressureMbar),
    gas: gasName(cylinder.gasmix),
    o2Percent: round(cylinder.gasmix.o2EffectivePermille / 10, 1),
    hePercent: round(cylinder.gasmix.heEffectivePermille / 10, 1),
    // The pressures the user entered, else the first and last sample.
    startPressureBar: bar(cylinder.startMbar || cylinder.sampleStartMbar),
    endPressureBar: bar(cylinder.endMbar || cylinder.sampleEndMbar),
    pressureDropBar: bar(pressureDrop),
    gasUsedL: wholeLiters(cylinder.gasUsedMl),
    decoGasUsedL: wholeLiters(cylinder.decoGasUsedMl),
    modM: meters(cylinder.depthMm),
    use: label(CYLINDER_USES, cylinder.use),
    usedInDive: cylinder.used,
  };
}

function diveComputerOut(dc: DiveComputer, index: number): Json {
  return {
    index,
    model: dc.model || null,
    serial: dc.serial || null,
    firmware: dc.fwVersion || null,
    dateTime: wallClock(dc.when),
    durationMin: minutes(dc.durationSec),
    maxDepthM: meters(dc.maxDepthMm),
    meanDepthM: meters(dc.meanDepthMm),
    waterTempC: celsius(dc.waterTempMkelvin),
    airTempC: celsius(dc.airTempMkelvin),
    surfaceIntervalMin: minutes(dc.surfaceTimeSec),
    mode: label(DIVE_MODES, dc.divemode),
    sampleCount: dc.sampleCount,
    events: dc.events
      .filter((event) => !event.hidden)
      .map((event) => ({
        time: clock(event.timeSec),
        timeSec: event.timeSec,
        name: event.name,
        value: event.value,
        severity: label(SEVERITIES, event.severity),
        ...(event.gasmix ? { gas: gasName(event.gasmix) } : {}),
        ...(event.gasIndex !== undefined && event.gasIndex >= 0
          ? { cylinderIndex: event.gasIndex }
          : {}),
      })),
    extraData: Object.fromEntries(dc.extraData.map((entry) => [entry.key, entry.value])),
  };
}

/** Everything `get_dive` returns. */
export function diveOut(dive: Dive, site: DiveSite | undefined): Json {
  return {
    ...diveRow(dive),
    notes: dive.notes || null,
    siteDetails: site ? siteOut(site) : null,
    airTempC: celsius(dive.airTempMkelvin),
    minWaterTempC: celsius(dive.minTempMkelvin),
    maxWaterTempC: celsius(dive.maxTempMkelvin),
    surfacePressureBar: known(mbarToBar, 3)(dive.surfacePressureMbar),
    // g/10 l: 10000 fresh water, 10300 sea water. 0: not recorded.
    salinity: dive.userSalinity || dive.salinity || null,
    sacLPerMin: liters(dive.sac),
    otu: dive.otu,
    cnsPercent: dive.cns,
    maxCnsPercent: dive.maxcns,
    conditions: {
      wavesize: dive.wavesize,
      current: dive.current,
      surge: dive.surge,
      chill: dive.chill,
    },
    totalWeightKg: kilograms(dive.totalWeightGrams),
    weights: dive.weightsystems.map((weight, index) => ({
      index,
      description: weight.description || null,
      weightKg: kilograms(weight.weightGrams),
    })),
    cylinders: dive.cylinders.map(cylinderOut),
    diveComputers: dive.dcs.map(diveComputerOut),
  };
}

// --- Sites -----------------------------------------------------------------

export function siteOut(site: DiveSite): Json {
  const taxonomy = (category: TaxonomyCategory) =>
    site.taxonomy.find((entry) => entry.category === category)?.value || null;
  return {
    uuid: site.uuid,
    name: site.name,
    latitude: site.hasGps ? round(udegToDegrees(site.latUdeg), 6) : null,
    longitude: site.hasGps ? round(udegToDegrees(site.lonUdeg), 6) : null,
    country: taxonomy(TaxonomyCategory.Country),
    region: taxonomy(TaxonomyCategory.AdminL1),
    locality: taxonomy(TaxonomyCategory.LocalName) ?? taxonomy(TaxonomyCategory.AdminL2),
    ocean: taxonomy(TaxonomyCategory.Ocean),
    description: site.description || null,
    notes: site.notes || null,
    diveCount: site.diveCount,
  };
}

// --- Statistics ------------------------------------------------------------

export function statsOut(stats: Stats): Json {
  const dives = stats.selectionSize;
  return {
    dives,
    totalTimeMin: round(stats.totalTimeSec / 60, 0),
    avgTimeMin: dives > 0 ? minutes(stats.totalTimeSec / dives) : null,
    shortestMin: minutes(stats.shortestTimeSec),
    longestMin: minutes(stats.longestTimeSec),
    maxDepthM: meters(stats.maxDepthMm),
    minDepthM: meters(stats.minDepthMm),
    // Time-weighted mean depth, as desktop Subsurface reports it.
    avgDepthM: meters(stats.avgDepthMm),
    avgMaxDepthM: dives > 0 ? meters(stats.combinedMaxDepthMm / dives) : null,
    avgSacLPerMin: liters(stats.avgSacMlPerMin),
    minSacLPerMin: liters(stats.minSacMlPerMin),
    maxSacLPerMin: liters(stats.maxSacMlPerMin),
    minWaterTempC: celsius(stats.minTempMkelvin),
    maxWaterTempC: celsius(stats.maxTempMkelvin),
    avgWaterTempC:
      stats.combinedCount > 0 ? celsius(stats.combinedTempMkelvin / stats.combinedCount) : null,
  };
}

/**
 * The non-empty buckets of a breakdown whose entry 0 is the combined total;
 * `name` receives the bucket's own index.
 */
function buckets(list: readonly Stats[], name: (index: number) => Json): Json[] {
  return list
    .slice(1)
    .flatMap((stats, index) =>
      stats.selectionSize > 0 ? [{ ...name(index), ...statsOut(stats) }] : [],
    );
}

function durationOut(bin: StatsDurationBin): Json {
  return {
    durationBandMin: bin.toMin === null ? `${bin.fromMin}+` : `${bin.fromMin}-${bin.toMin}`,
    dives: bin.dives,
    totalTimeMin: round(bin.totalTimeSec / 60, 0),
  };
}

/** The breakdowns `get_statistics` offers, each with the key it is returned under. */
export const BREAKDOWNS = {
  year: (summary: StatsSummary) => ({
    byYear: summary.yearly.map((s) => ({ year: s.period, ...statsOut(s) })),
  }),
  // The core's monthly buckets carry the month only; `timeline` is built over
  // the same dives in the same order and carries the year.
  month: (summary: StatsSummary) => ({
    byMonth: summary.monthly.map((s, index) => {
      const entry = summary.timeline[index];
      const month = entry
        ? `${entry.year}-${String(entry.month).padStart(2, '0')}`
        : String(s.period);
      return { month, ...statsOut(s) };
    }),
  }),
  trip: (summary: StatsSummary) => ({
    byTrip: summary.byTrip.map((s) => ({ trip: s.location || null, ...statsOut(s) })),
  }),
  // Entry n + 1 of byType is DiveMode n.
  mode: (summary: StatsSummary) => ({
    byMode: buckets(summary.byType, (mode) => ({ mode: label(DIVE_MODES, mode as DiveMode) })),
  }),
  // 10 m bands of the dive's maximum depth (STATS_DEPTH_BUCKET).
  depth: (summary: StatsSummary) => ({
    byDepth: buckets(summary.byDepth, (band) => ({ depthBandM: `${band * 10}-${band * 10 + 10}` })),
  }),
  // 5 C bands of the dive's minimum water temperature (STATS_TEMP_BUCKET).
  temperature: (summary: StatsSummary) => ({
    byTemperature: buckets(summary.byTemp, (band) => ({
      waterTempBandC: `${band * 5}-${band * 5 + 5}`,
    })),
  }),
  duration: (summary: StatsSummary) => ({
    byDuration: summary.byDuration.filter((bin) => bin.dives > 0).map(durationOut),
  }),
} satisfies Record<string, (summary: StatsSummary) => Json>;

export type Breakdown = keyof typeof BREAKDOWNS;
