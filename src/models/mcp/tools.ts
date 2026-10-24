// AI-generated (Claude)
// The tools the MCP server in Settings offers: read-only queries over the
// loaded logbook, plus the per-dive CSV exports.
//
// Every number comes from the native module (see modules/ssrf-core); what a
// reply looks like is ./format, how arguments are declared and checked is
// ./args. The data source is the `McpLogbook` interface rather than the module
// itself, so the vitest suite drives the same tools through the host binary.

import type {
  CsvExportOptions,
  CsvFormat,
  Dive,
  DiveSite,
  DiveSummary,
  GradientFactors,
  StatsFilter,
  StatsSummary,
} from '../index';
import { inputSchema, parseArgs, ToolArgumentError, type Args, type Params } from './args';
import {
  BREAKDOWNS,
  diveOut,
  diveRow,
  siteOut,
  statsOut,
  type Breakdown,
  type Json,
} from './format';

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

/** Structured data (sent as JSON and `structuredContent`), or plain text (the CSV exports). */
export type ToolOutput = Json | string;

export type McpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Checks `args` against the tool's parameters and runs it. */
  call(args: Record<string, unknown>, logbook: McpLogbook): Promise<ToolOutput>;
};

/** Every tool here is read-only; `tools/list` sends this with each. */
export const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

function defineTool<const P extends Params>(spec: {
  name: string;
  title: string;
  description: string;
  params: P;
  run(args: Args<P>, logbook: McpLogbook): Awaitable<ToolOutput>;
}): McpTool {
  return {
    name: spec.name,
    title: spec.title,
    description: spec.description,
    inputSchema: inputSchema(spec.params),
    call: async (args, logbook) => spec.run(parseArgs(spec.params, args), logbook),
  };
}

// --- Shared parameters -----------------------------------------------------

const DIVE_REF = {
  id: {
    type: 'integer',
    description:
      'The dive id from list_dives. Ids are valid while the app keeps the logbook open; they change when it is reloaded.',
  },
  number: { type: 'integer', description: 'The dive number in the logbook, instead of an id.' },
} as const satisfies Params;

/** The dive an `id` or `number` argument names. */
async function resolveDiveId(args: Args<typeof DIVE_REF>, logbook: McpLogbook): Promise<number> {
  if (args.id !== undefined) {
    return args.id;
  }
  if (args.number === undefined) {
    throw new ToolArgumentError('Pass "id" (from list_dives) or the dive "number"');
  }
  const dive = (await logbook.listDives()).find((summary) => summary.number === args.number);
  if (!dive) {
    throw new ToolArgumentError(`No dive is numbered ${args.number}`);
  }
  return dive.id;
}

/** The filter `list_dives` and `get_statistics` share. */
const FILTER = {
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
} as const satisfies Params;

/** `YYYY-MM-DD` (or a full ISO date-time) to dive-time seconds. */
function parseDate(key: string, text: string, endOfDay: boolean): number {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
  // Dive times are wall-clock times stored as UTC, so the bounds are read as UTC.
  const millis = Date.parse(dateOnly ? `${text}T00:00:00Z` : text.replace(/Z?$/, 'Z'));
  if (Number.isNaN(millis)) {
    throw new ToolArgumentError(`"${key}" must be a date such as 2026-08-14`);
  }
  const seconds = Math.floor(millis / 1000);
  return dateOnly && endOfDay ? seconds + 86399 : seconds;
}

/** The arguments as the core's `StatsFilter`, the one filter both tools apply. */
function toFilter(args: Args<typeof FILTER>, includeInvalid: boolean): StatsFilter {
  const filter: StatsFilter = {};
  if (args.from !== undefined) filter.fromWhen = parseDate('from', args.from, false);
  if (args.to !== undefined) filter.toWhen = parseDate('to', args.to, true);
  if (args.siteUuid !== undefined) filter.siteUuid = args.siteUuid;
  if (args.tag) filter.tag = args.tag;
  if (args.buddy) filter.buddy = args.buddy;
  if (args.minDepthM !== undefined) filter.minDepthMm = Math.round(args.minDepthM * 1000);
  if (args.maxDepthM !== undefined) filter.maxDepthMm = Math.round(args.maxDepthM * 1000);
  if (includeInvalid) filter.includeInvalid = true;
  return filter;
}

function contains(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Whether a dive passes a `StatsFilter`: apply_stats_filter() in
 * cpp/bindings/api.cpp, clause for clause, so a list and the statistics for
 * the same filter always count the same dives.
 */
export function matchesFilter(dive: DiveSummary, filter: StatsFilter): boolean {
  const { tag, buddy } = filter;
  return (
    (filter.includeInvalid || !dive.invalid) &&
    (!filter.fromWhen || dive.when >= filter.fromWhen) &&
    (!filter.toWhen || dive.when <= filter.toWhen) &&
    (!filter.siteUuid || dive.siteUuid === filter.siteUuid) &&
    (!filter.minDepthMm || dive.maxDepthMm >= filter.minDepthMm) &&
    (!filter.maxDepthMm || dive.maxDepthMm <= filter.maxDepthMm) &&
    (!buddy || contains(dive.buddy, buddy) || contains(dive.diveguide, buddy)) &&
    (!tag || dive.tags.some((name) => contains(name, tag)))
  );
}

// --- The tools -------------------------------------------------------------

const listDives = defineTool({
  name: 'list_dives',
  title: 'List dives',
  description:
    'Lists the dives in the logbook, newest first unless asked otherwise: date, duration, depth, ' +
    'water temperature, site, buddy, tags. Filters combine. Use get_dive for notes, cylinders and ' +
    'weights. Results are paged; "total" is the number of dives the filters matched.',
  params: {
    ...FILTER,
    site: { type: 'string', description: 'Only dives whose site name contains this text.' },
    includeInvalid: {
      type: 'boolean',
      description: 'Include dives flagged invalid (default true).',
    },
    order: { type: 'string', choices: ['newest', 'oldest'], description: 'Default newest.' },
    limit: { type: 'integer', minimum: 1, maximum: 1000, description: 'Default 200.' },
    offset: { type: 'integer', minimum: 0, description: 'Default 0.' },
  },
  async run(args, logbook) {
    const filter = toFilter(args, args.includeInvalid ?? true);
    const { site, limit = 200, offset = 0 } = args;
    const direction = args.order === 'oldest' ? 1 : -1;
    const matched = (await logbook.listDives())
      .filter((dive) => matchesFilter(dive, filter) && (!site || contains(dive.siteName, site)))
      .sort((a, b) => direction * (a.when - b.when));

    const page = matched.slice(offset, offset + limit);
    const next = offset + page.length;
    return {
      total: matched.length,
      offset,
      returned: page.length,
      ...(next < matched.length && { nextOffset: next }),
      dives: page.map(diveRow),
    };
  },
});

const getDive = defineTool({
  name: 'get_dive',
  title: 'Get a dive',
  description:
    'Everything logged for one dive: notes, buddy, dive guide, suit, tags, rating, conditions, ' +
    'site with GPS, cylinders (size, gas, pressures, gas used), weights, SAC, OTU/CNS, and each ' +
    'dive computer with its events (gas switches, alarms, bookmarks).',
  params: DIVE_REF,
  async run(args, logbook) {
    const dive = await logbook.getDive(await resolveDiveId(args, logbook));
    const site =
      dive.siteUuid !== 0
        ? (await logbook.listDiveSites()).find((s) => s.uuid === dive.siteUuid)
        : undefined;
    return diveOut(dive, site);
  },
});

const getStatistics = defineTool({
  name: 'get_statistics',
  title: 'Dive statistics',
  description:
    'Aggregate statistics computed by the Subsurface core, identical to desktop Subsurface: dive ' +
    'count, total and average bottom time, depths, SAC, water temperatures, distinct sites. ' +
    'Optionally filtered, and broken down by year, month, trip, dive mode, 10 m depth band, ' +
    '5 C temperature band or 10 min duration band. Dives flagged invalid are left out unless ' +
    'includeInvalid is set.',
  params: {
    ...FILTER,
    includeInvalid: {
      type: 'boolean',
      description: 'Count dives flagged invalid (default false).',
    },
    groupBy: {
      type: 'choices',
      choices: Object.keys(BREAKDOWNS) as Breakdown[],
      description: 'Breakdowns to include besides the total. Default ["year"].',
    },
  },
  async run(args, logbook) {
    const summary = await logbook.getStatistics(toFilter(args, args.includeInvalid ?? false));
    const breakdowns = (args.groupBy ?? ['year']).map((name) => BREAKDOWNS[name](summary));
    return Object.assign(
      {
        matched: summary.matched,
        distinctSites: summary.siteCount,
        total: statsOut(summary.total),
      },
      ...breakdowns,
    );
  },
});

const listDiveSites = defineTool({
  name: 'list_dive_sites',
  title: 'List dive sites',
  description:
    'The dive sites in the logbook with GPS position, country and region, description, notes ' +
    'and how many dives were logged there.',
  params: {
    query: {
      type: 'string',
      description: 'Only sites whose name, description or location contains this text.',
    },
    uuid: { type: 'integer', description: 'Only the site with this uuid.' },
  },
  async run({ query, uuid }, logbook) {
    const sites = (await logbook.listDiveSites())
      .filter(
        (site) =>
          (uuid === undefined || site.uuid === uuid) &&
          (query === undefined ||
            contains(site.name, query) ||
            contains(site.description, query) ||
            site.taxonomy.some((entry) => contains(entry.value, query))),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    return { total: sites.length, sites: sites.map(siteOut) };
  },
});

const CSV_FORMATS = ['profile', 'details', 'summary'] as const satisfies readonly CsvFormat[];

const exportDiveCsv = defineTool({
  name: 'export_dive_csv',
  title: 'Export a dive as CSV',
  description:
    "One dive as CSV text, written by the same code as desktop Subsurface's export dialog. " +
    'format "profile" (the default) is the computed profile: every value the profile diagram ' +
    'computes for each sample - depth, ceiling, NDL, TTS, stops, partial pressures, CNS, SAC, ' +
    "gradient factors - in the core's raw integer units (mm, mbar, seconds, mkelvin), with the " +
    'deco model run at the given gradient factors (default: the app\'s settings). "details" is ' +
    'the raw dive computer samples, "summary" one row of dive data.',
  params: {
    ...DIVE_REF,
    format: { type: 'string', choices: CSV_FORMATS, description: 'Default "profile".' },
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
  async run(args, logbook) {
    const defaults = logbook.gradientFactors();
    return logbook.exportDiveCsv(await resolveDiveId(args, logbook), {
      format: args.format ?? 'profile',
      imperial: args.imperial ?? false,
      gf: { gfLow: args.gfLow ?? defaults.gfLow, gfHigh: args.gfHigh ?? defaults.gfHigh },
    });
  },
});

export const MCP_TOOLS: readonly McpTool[] = [
  listDives,
  getDive,
  getStatistics,
  listDiveSites,
  exportDiveCsv,
];
