// AI-generated (Claude)
// The tools the MCP server in Settings offers: read-only queries over the
// loaded logbook, plus the per-dive CSV exports.
//
// Every number comes from the native module (see modules/ssrf-core); this file
// only picks what a tool returns and converts the core's integer units into the
// ones a person or a model reads without a lookup table - metres, minutes,
// degrees Celsius, bar, litres, kilograms, percent. The unit is in every key
// name so a reply is unambiguous on its own. Unknown values are null rather
// than the core's 0, which for a temperature would read as absolute zero.
//
// The data source is the `McpLogbook` interface rather than the module itself,
// so the vitest suite drives the same tools through the host binary.

import {
  CylinderUse,
  DiveMode,
  EventSeverity,
  TaxonomyCategory,
  type CsvExportOptions,
  type CsvFormat,
  type Cylinder,
  type Dive,
  type DiveSite,
  type DiveSummary,
  type GasMix,
  type GradientFactors,
  type Stats,
  type StatsFilter,
  type StatsSummary,
} from '../index';
import { ZERO_C_IN_MKELVIN } from '../units';

type Awaitable<T> = T | Promise<T>;

/** What the tools read from. In the app, the ssrf-core module. */
export type McpLogbook = {
  listDives(): Awaitable<DiveSummary[]>;
  getDive(id: number): Awaitable<Dive>;
  listDiveSites(): Awaitable<DiveSite[]>;
  getStatistics(filter?: StatsFilter): Awaitable<StatsSummary>;
  /** The file `exportDiveCSV` writes, as text. */
  exportDiveCsv(id: number, options: CsvExportOptions): Awaitable<string>;
  /** The gradient factors the app plots with, the default for the computed profile. */
  gradientFactors(): GradientFactors;
};

/** A JSON Schema for a tool's arguments, as `tools/list` publishes it. */
export type JsonSchema = Record<string, unknown>;

export type McpToolResult = {
  /** JSON-serializable data, sent as both text and `structuredContent`. */
  data?: Record<string, unknown>;
  /** Plain text, sent as is (the CSV exports). */
  text?: string;
};

export type McpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  /** MCP tool annotations; every tool here is read-only. */
  annotations?: Record<string, boolean>;
  run(args: Record<string, unknown>, logbook: McpLogbook): Promise<McpToolResult>;
};

/** A bad argument. Reported to the client as a tool error it can correct. */
export class ToolArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolArgumentError';
  }
}

// --- Unit conversion -------------------------------------------------------

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Null for the core's "not recorded" zero. */
function meters(mm: number): number | null {
  return mm > 0 ? round(mm / 1000, 2) : null;
}

function minutes(sec: number): number | null {
  return sec > 0 ? round(sec / 60, 1) : null;
}

function celsius(mkelvin: number): number | null {
  return mkelvin > 0 ? round((mkelvin - ZERO_C_IN_MKELVIN) / 1000, 1) : null;
}

function bar(mbar: number): number | null {
  return mbar > 0 ? round(mbar / 1000, 1) : null;
}

function liters(ml: number, digits = 1): number | null {
  return ml > 0 ? round(ml / 1000, digits) : null;
}

function kilograms(grams: number): number | null {
  return grams > 0 ? round(grams / 1000, 2) : null;
}

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

// --- Shapes the tools return -----------------------------------------------

function diveRow(dive: DiveSummary): Record<string, unknown> {
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
    mode: DIVE_MODES[dive.divemode] ?? String(dive.divemode),
    diveComputer: dive.dcModel || null,
    invalid: dive.invalid,
  };
}

function cylinderOut(cylinder: Cylinder, index: number): Record<string, unknown> {
  const pressureDrop =
    cylinder.startMbar > 0 && cylinder.endMbar > 0 ? cylinder.startMbar - cylinder.endMbar : 0;
  return {
    index,
    description: cylinder.description || null,
    sizeL: liters(cylinder.sizeMl),
    workingPressureBar: bar(cylinder.workingPressureMbar),
    gas: gasName(cylinder.gasmix),
    o2Percent: round(cylinder.gasmix.o2EffectivePermille / 10),
    hePercent: round(cylinder.gasmix.heEffectivePermille / 10),
    // The pressures the user entered, else the first and last sample.
    startPressureBar: bar(cylinder.startMbar || cylinder.sampleStartMbar),
    endPressureBar: bar(cylinder.endMbar || cylinder.sampleEndMbar),
    pressureDropBar: bar(pressureDrop),
    gasUsedL: liters(cylinder.gasUsedMl, 0),
    decoGasUsedL: liters(cylinder.decoGasUsedMl, 0),
    modM: meters(cylinder.depthMm),
    use: CYLINDER_USES[cylinder.use] ?? String(cylinder.use),
    usedInDive: cylinder.used,
  };
}

function siteOut(site: DiveSite): Record<string, unknown> {
  const taxonomy = (category: TaxonomyCategory) =>
    site.taxonomy.find((entry) => entry.category === category)?.value || null;
  return {
    uuid: site.uuid,
    name: site.name,
    latitude: site.hasGps ? round(site.latUdeg / 1e6, 6) : null,
    longitude: site.hasGps ? round(site.lonUdeg / 1e6, 6) : null,
    country: taxonomy(TaxonomyCategory.Country),
    region: taxonomy(TaxonomyCategory.AdminL1),
    locality: taxonomy(TaxonomyCategory.LocalName) ?? taxonomy(TaxonomyCategory.AdminL2),
    ocean: taxonomy(TaxonomyCategory.Ocean),
    description: site.description || null,
    notes: site.notes || null,
    diveCount: site.diveCount,
  };
}

function diveOut(dive: Dive, site: DiveSite | undefined): Record<string, unknown> {
  return {
    ...diveRow(dive),
    notes: dive.notes || null,
    siteDetails: site ? siteOut(site) : null,
    airTempC: celsius(dive.airTempMkelvin),
    minWaterTempC: celsius(dive.minTempMkelvin),
    maxWaterTempC: celsius(dive.maxTempMkelvin),
    surfacePressureBar:
      dive.surfacePressureMbar > 0 ? round(dive.surfacePressureMbar / 1000, 3) : null,
    // g/10 l: 10000 fresh water, 10300 sea water. 0: not recorded.
    salinity: dive.userSalinity || dive.salinity || null,
    sacLPerMin: liters(dive.sac, 1),
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
    diveComputers: dive.dcs.map((dc, index) => ({
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
      mode: DIVE_MODES[dc.divemode] ?? String(dc.divemode),
      sampleCount: dc.sampleCount,
      events: dc.events
        .filter((event) => !event.hidden)
        .map((event) => ({
          time: clock(event.timeSec),
          timeSec: event.timeSec,
          name: event.name,
          value: event.value,
          severity: SEVERITIES[event.severity] ?? String(event.severity),
          ...(event.gasmix ? { gas: gasName(event.gasmix) } : {}),
          ...(event.gasIndex !== undefined && event.gasIndex >= 0
            ? { cylinderIndex: event.gasIndex }
            : {}),
        })),
      extraData: Object.fromEntries(dc.extraData.map((entry) => [entry.key, entry.value])),
    })),
  };
}

function statsOut(stats: Stats): Record<string, unknown> {
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
 * The non-empty buckets of a breakdown whose entry 0 is the combined total, so
 * that `label` receives the bucket's own index.
 */
function buckets(
  list: readonly Stats[],
  label: (index: number) => Record<string, unknown>,
): Record<string, unknown>[] {
  return list
    .slice(1)
    .flatMap((stats, index) =>
      stats.selectionSize > 0 ? [{ ...label(index), ...statsOut(stats) }] : [],
    );
}

// --- Argument parsing ------------------------------------------------------

function optional<T>(
  args: Record<string, unknown>,
  key: string,
  type: 'string' | 'number' | 'boolean',
): T | undefined {
  const value = args[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== type || (type === 'number' && !Number.isFinite(value))) {
    throw new ToolArgumentError(`"${key}" must be a ${type}`);
  }
  return value as T;
}

const optString = (args: Record<string, unknown>, key: string) =>
  optional<string>(args, key, 'string');
const optNumber = (args: Record<string, unknown>, key: string) =>
  optional<number>(args, key, 'number');
const optBoolean = (args: Record<string, unknown>, key: string) =>
  optional<boolean>(args, key, 'boolean');

/** `YYYY-MM-DD` (or a full ISO date-time) to dive-time seconds. */
function parseDate(
  args: Record<string, unknown>,
  key: string,
  endOfDay: boolean,
): number | undefined {
  const text = optString(args, key);
  if (text === undefined) {
    return undefined;
  }
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
  // Dive times are wall-clock times stored as UTC, so the bounds are read as UTC.
  const millis = Date.parse(dateOnly ? `${text}T00:00:00Z` : text.replace(/Z?$/, 'Z'));
  if (Number.isNaN(millis)) {
    throw new ToolArgumentError(`"${key}" must be a date such as 2026-08-14`);
  }
  const seconds = Math.floor(millis / 1000);
  return dateOnly && endOfDay ? seconds + 86399 : seconds;
}

function contains(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/** The dive an `id` or `number` argument names. */
async function resolveDiveId(args: Record<string, unknown>, logbook: McpLogbook): Promise<number> {
  const id = optNumber(args, 'id');
  if (id !== undefined) {
    return id;
  }
  const number = optNumber(args, 'number');
  if (number === undefined) {
    throw new ToolArgumentError('Pass "id" (from list_dives) or the dive "number"');
  }
  const dive = (await logbook.listDives()).find((summary) => summary.number === number);
  if (!dive) {
    throw new ToolArgumentError(`No dive is numbered ${number}`);
  }
  return dive.id;
}

// --- Schemas ---------------------------------------------------------------

const DIVE_REF_PROPERTIES = {
  id: {
    type: 'integer',
    description:
      'The dive id from list_dives. Ids are valid while the app keeps the logbook open; they change when it is reloaded.',
  },
  number: { type: 'integer', description: 'The dive number in the logbook, instead of an id.' },
};

const FILTER_PROPERTIES = {
  from: {
    type: 'string',
    description: 'First day, inclusive, YYYY-MM-DD (local time of the dive).',
  },
  to: { type: 'string', description: 'Last day, inclusive, YYYY-MM-DD.' },
  siteUuid: {
    type: 'integer',
    description: 'Only dives at this dive site (uuid from list_dive_sites).',
  },
  tag: {
    type: 'string',
    description: 'Only dives with a tag containing this text (case-insensitive).',
  },
  buddy: {
    type: 'string',
    description: 'Only dives whose buddy or dive guide contains this text (case-insensitive).',
  },
  minDepthM: { type: 'number', description: 'Only dives at least this deep, in metres.' },
  maxDepthM: { type: 'number', description: 'Only dives at most this deep, in metres.' },
};

const GROUPINGS = ['year', 'month', 'trip', 'mode', 'depth', 'temperature', 'duration'] as const;
type Grouping = (typeof GROUPINGS)[number];

const CSV_FORMATS: readonly CsvFormat[] = ['profile', 'details', 'summary'];

function statsFilter(args: Record<string, unknown>): StatsFilter | undefined {
  const filter: StatsFilter = {};
  const fromWhen = parseDate(args, 'from', false);
  const toWhen = parseDate(args, 'to', true);
  const siteUuid = optNumber(args, 'siteUuid');
  const tag = optString(args, 'tag');
  const buddy = optString(args, 'buddy');
  const minDepth = optNumber(args, 'minDepthM');
  const maxDepth = optNumber(args, 'maxDepthM');
  const includeInvalid = optBoolean(args, 'includeInvalid');
  if (fromWhen !== undefined) filter.fromWhen = fromWhen;
  if (toWhen !== undefined) filter.toWhen = toWhen;
  if (siteUuid !== undefined) filter.siteUuid = siteUuid;
  if (tag) filter.tag = tag;
  if (buddy) filter.buddy = buddy;
  if (minDepth !== undefined) filter.minDepthMm = Math.round(minDepth * 1000);
  if (maxDepth !== undefined) filter.maxDepthMm = Math.round(maxDepth * 1000);
  if (includeInvalid) filter.includeInvalid = true;
  return Object.keys(filter).length > 0 ? filter : undefined;
}

// --- The tools -------------------------------------------------------------

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

const listDives: McpTool = {
  name: 'list_dives',
  title: 'List dives',
  description:
    'Lists the dives in the logbook, newest first unless asked otherwise: date, duration, depth, ' +
    'water temperature, site, buddy, tags. Filters combine. Use get_dive for notes, cylinders and ' +
    'weights. Results are paged; "total" is the number of dives the filters matched.',
  inputSchema: {
    type: 'object',
    properties: {
      ...FILTER_PROPERTIES,
      site: { type: 'string', description: 'Only dives whose site name contains this text.' },
      includeInvalid: {
        type: 'boolean',
        description: 'Include dives flagged invalid (default true).',
      },
      order: { type: 'string', enum: ['newest', 'oldest'], description: 'Default newest.' },
      limit: { type: 'integer', minimum: 1, maximum: 1000, description: 'Default 200.' },
      offset: { type: 'integer', minimum: 0, description: 'Default 0.' },
    },
    additionalProperties: false,
  },
  async run(args, logbook) {
    const fromWhen = parseDate(args, 'from', false);
    const toWhen = parseDate(args, 'to', true);
    const siteUuid = optNumber(args, 'siteUuid');
    const site = optString(args, 'site');
    const tag = optString(args, 'tag');
    const buddy = optString(args, 'buddy');
    const minDepth = optNumber(args, 'minDepthM');
    const maxDepth = optNumber(args, 'maxDepthM');
    const includeInvalid = optBoolean(args, 'includeInvalid') ?? true;
    const order = optString(args, 'order') ?? 'newest';
    if (order !== 'newest' && order !== 'oldest') {
      throw new ToolArgumentError('"order" must be "newest" or "oldest"');
    }
    const limit = Math.min(Math.max(Math.trunc(optNumber(args, 'limit') ?? 200), 1), 1000);
    const offset = Math.max(Math.trunc(optNumber(args, 'offset') ?? 0), 0);

    const matched = (await logbook.listDives())
      .filter(
        (dive) =>
          (fromWhen === undefined || dive.when >= fromWhen) &&
          (toWhen === undefined || dive.when <= toWhen) &&
          (siteUuid === undefined || dive.siteUuid === siteUuid) &&
          (site === undefined || contains(dive.siteName, site)) &&
          (tag === undefined || dive.tags.some((t) => contains(t, tag))) &&
          (buddy === undefined || contains(dive.buddy, buddy) || contains(dive.diveguide, buddy)) &&
          (minDepth === undefined || dive.maxDepthMm >= minDepth * 1000) &&
          (maxDepth === undefined || dive.maxDepthMm <= maxDepth * 1000) &&
          (includeInvalid || !dive.invalid),
      )
      .sort((a, b) => (order === 'newest' ? b.when - a.when : a.when - b.when));

    const page = matched.slice(offset, offset + limit);
    return {
      data: {
        total: matched.length,
        offset,
        returned: page.length,
        ...(offset + page.length < matched.length ? { nextOffset: offset + page.length } : {}),
        dives: page.map(diveRow),
      },
    };
  },
};

const getDive: McpTool = {
  name: 'get_dive',
  title: 'Get a dive',
  description:
    'Everything logged for one dive: notes, buddy, dive guide, suit, tags, rating, conditions, ' +
    'site with GPS, cylinders (size, gas, pressures, gas used), weights, SAC, OTU/CNS, and each ' +
    'dive computer with its events (gas switches, alarms, bookmarks).',
  inputSchema: {
    type: 'object',
    properties: DIVE_REF_PROPERTIES,
    additionalProperties: false,
  },
  async run(args, logbook) {
    const dive = await logbook.getDive(await resolveDiveId(args, logbook));
    const site =
      dive.siteUuid !== 0
        ? (await logbook.listDiveSites()).find((s) => s.uuid === dive.siteUuid)
        : undefined;
    return { data: diveOut(dive, site) };
  },
};

const getStatistics: McpTool = {
  name: 'get_statistics',
  title: 'Dive statistics',
  description:
    'Aggregate statistics computed by the Subsurface core, identical to desktop Subsurface: dive ' +
    'count, total and average bottom time, depths, SAC, water temperatures, distinct sites. ' +
    'Optionally filtered, and broken down by year, month, trip, dive mode, 10 m depth band, ' +
    '5 C temperature band or 10 min duration band. Dives flagged invalid are left out unless ' +
    'includeInvalid is set.',
  inputSchema: {
    type: 'object',
    properties: {
      ...FILTER_PROPERTIES,
      includeInvalid: {
        type: 'boolean',
        description: 'Count dives flagged invalid (default false).',
      },
      groupBy: {
        type: 'array',
        items: { type: 'string', enum: GROUPINGS },
        description: 'Breakdowns to include besides the total. Default ["year"].',
      },
    },
    additionalProperties: false,
  },
  async run(args, logbook) {
    const rawGroups = args.groupBy ?? ['year'];
    if (!Array.isArray(rawGroups) || rawGroups.some((g) => !GROUPINGS.includes(g as Grouping))) {
      throw new ToolArgumentError(`"groupBy" must be a list of: ${GROUPINGS.join(', ')}`);
    }
    const groups = new Set(rawGroups as Grouping[]);
    const filter = statsFilter(args);
    const summary = await logbook.getStatistics(filter);

    const data: Record<string, unknown> = {
      matched: summary.matched,
      distinctSites: summary.siteCount,
      total: statsOut(summary.total),
    };
    if (groups.has('year')) {
      data.byYear = summary.yearly.map((s) => ({ year: s.period, ...statsOut(s) }));
    }
    if (groups.has('month')) {
      // The core's monthly buckets carry the month only; `timeline` is built
      // over the same dives in the same order and carries the year.
      data.byMonth = summary.monthly.map((s, index) => {
        const entry = summary.timeline[index];
        const label = entry
          ? `${entry.year}-${String(entry.month).padStart(2, '0')}`
          : String(s.period);
        return { month: label, ...statsOut(s) };
      });
    }
    if (groups.has('trip')) {
      data.byTrip = summary.byTrip.map((s) => ({ trip: s.location || null, ...statsOut(s) }));
    }
    if (groups.has('mode')) {
      // Entry 0 is the combined total; entry n + 1 is DiveMode n.
      data.byMode = buckets(summary.byType, (mode) => ({
        mode: DIVE_MODES[mode as DiveMode] ?? String(mode),
      }));
    }
    if (groups.has('depth')) {
      // 10 m bands of the dive's maximum depth (STATS_DEPTH_BUCKET).
      data.byDepth = buckets(summary.byDepth, (band) => ({
        depthBandM: `${band * 10}-${band * 10 + 10}`,
      }));
    }
    if (groups.has('temperature')) {
      // 5 C bands of the dive's minimum water temperature (STATS_TEMP_BUCKET).
      data.byTemperature = buckets(summary.byTemp, (band) => ({
        waterTempBandC: `${band * 5}-${band * 5 + 5}`,
      }));
    }
    if (groups.has('duration')) {
      data.byDuration = summary.byDuration
        .filter((bin) => bin.dives > 0)
        .map((bin) => ({
          durationBandMin: bin.toMin === null ? `${bin.fromMin}+` : `${bin.fromMin}-${bin.toMin}`,
          dives: bin.dives,
          totalTimeMin: round(bin.totalTimeSec / 60, 0),
        }));
    }
    return { data };
  },
};

const listDiveSites: McpTool = {
  name: 'list_dive_sites',
  title: 'List dive sites',
  description:
    'The dive sites in the logbook with GPS position, country and region, description, notes ' +
    'and how many dives were logged there.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Only sites whose name, description or location contains this text.',
      },
      uuid: { type: 'integer', description: 'Only the site with this uuid.' },
    },
    additionalProperties: false,
  },
  async run(args, logbook) {
    const query = optString(args, 'query');
    const uuid = optNumber(args, 'uuid');
    const sites = (await logbook.listDiveSites())
      .filter((site) => uuid === undefined || site.uuid === uuid)
      .filter(
        (site) =>
          query === undefined ||
          contains(site.name, query) ||
          contains(site.description, query) ||
          site.taxonomy.some((entry) => contains(entry.value, query)),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    return { data: { total: sites.length, sites: sites.map(siteOut) } };
  },
};

const exportDiveCsv: McpTool = {
  name: 'export_dive_csv',
  title: 'Export a dive as CSV',
  description:
    "One dive as CSV text, written by the same code as desktop Subsurface's export dialog. " +
    'format "profile" (the default) is the computed profile: every value the profile diagram ' +
    'computes for each sample - depth, ceiling, NDL, TTS, stops, partial pressures, CNS, SAC, ' +
    "gradient factors - in the core's raw integer units (mm, mbar, seconds, mkelvin), with the " +
    'deco model run at the given gradient factors (default: the app\'s settings). "details" is ' +
    'the raw dive computer samples, "summary" one row of dive data.',
  inputSchema: {
    type: 'object',
    properties: {
      ...DIVE_REF_PROPERTIES,
      format: { type: 'string', enum: CSV_FORMATS, description: 'Default "profile".' },
      gfLow: {
        type: 'integer',
        minimum: 10,
        maximum: 150,
        description: 'Gradient factor low, percent.',
      },
      gfHigh: {
        type: 'integer',
        minimum: 10,
        maximum: 150,
        description: 'Gradient factor high, percent.',
      },
      imperial: {
        type: 'boolean',
        description: 'Imperial units in the "details" and "summary" formats (default false).',
      },
    },
    additionalProperties: false,
  },
  async run(args, logbook) {
    const format = (optString(args, 'format') ?? 'profile') as CsvFormat;
    if (!CSV_FORMATS.includes(format)) {
      throw new ToolArgumentError(`"format" must be one of: ${CSV_FORMATS.join(', ')}`);
    }
    const defaults = logbook.gradientFactors();
    const gf = {
      gfLow: optNumber(args, 'gfLow') ?? defaults.gfLow,
      gfHigh: optNumber(args, 'gfHigh') ?? defaults.gfHigh,
    };
    const id = await resolveDiveId(args, logbook);
    const text = await logbook.exportDiveCsv(id, {
      format,
      imperial: optBoolean(args, 'imperial') ?? false,
      gf,
    });
    return { text };
  },
};

export const MCP_TOOLS: readonly McpTool[] = [
  listDives,
  getDive,
  getStatistics,
  listDiveSites,
  exportDiveCsv,
].map((tool) => ({ ...tool, annotations: READ_ONLY }));
