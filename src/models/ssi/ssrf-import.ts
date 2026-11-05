// AI-generated (Claude)
// SSI `get_divelog` response -> Subsurface SSRF XML.
//
// The inverse of converter.ts, with one structural difference: this file does not
// build dives in memory. It writes the XML document the core's own parser reads,
// so the core stays the only thing that decides what a dive is, and the same text
// serves as the downloadable .ssrf file and as the input to `importFile`.
//
// Everything here reads the raw JSON (`decode: raw => raw`) rather than the
// library's decoded model, because that decoder drops any value whose wire type
// differs from its declaration, and SSI sends numbers, numeric strings and 0/1
// flags interchangeably. Dropping a dive's depth over that would be silent loss.
//
// What the field guide leaves unspecified was settled against two real SSI records
// compared with the same dives downloaded from the computer into SSRF:
//   - `d` is positive metres, `te` Celsius, `t` milliseconds, `ndl` minutes (99 is
//     the computer's own ceiling and appears in the desktop download too).
//   - `alarmDataset[].position` is a 0-based index into the samples: NODECO_2MIN at
//     position 88 is 7:25, where the desktop download shows the limit reach 2 minutes.
//   - `odin_user_log_si_before` is seconds, as converter.ts already sends it.
//   - Time fields in `de` (deco stop) have no real record to check against. They
//     are read as seconds, which is libdivecomputer's unit for them.
//
// SSRF has no slot for the per-sample gradient factors (`gn`, `gs`): the core
// derives those curves from the tissue model when it draws the profile. The
// configured GF and the end-of-dive GF are kept as extra data, under the "GF Low"
// and "GF High" keys the core's own importers use.

import { distanceMeters } from '../site-edit';

/** The app's tag for a dive that exists in SSI. See src/queries/ssi.ts. */
const SSI_TAG = 'ssi';

/** A dive computer's `model` when SSI names none, as desktop Subsurface spells it. */
const MANUAL_MODEL = 'manually added dive';

/** libdivecomputer's event numbers, which is what SSRF stores. */
const EVENT = { decoStop: 1, ascent: 3, violation: 7, gasChange: 25 } as const;

/** Above this a reading is not in bar, and there is no telling what it is in. */
const MAX_PLAUSIBLE_BAR = 500;

const NEARBY_SITE_METERS = 100;
const SAME_NAME_SITE_METERS = 5000;

type Json = Record<string, unknown>;

/** Labels for SSI's numeric codes, by `logbook_vars` table name. All optional. */
export type SsiLogbookLabels = {
  tables: ReadonlyMap<string, ReadonlyMap<number, string>>;
  wildlife: ReadonlyMap<number, string>;
  gear: ReadonlyMap<number, string>;
};

export const NO_SSI_LABELS: SsiLogbookLabels = {
  tables: new Map(),
  wildlife: new Map(),
  gear: new Map(),
};

/** The part of an existing dive needed to recognize it. */
export type ExistingDive = {
  when: number;
  durationSec: number;
  maxDepthMm: number;
  meanDepthMm: number;
};

/** The part of an existing site needed to reuse it instead of adding a copy. */
export type ExistingSite = {
  uuid: number;
  name: string;
  latUdeg: number;
  lonUdeg: number;
  hasGps: boolean;
  description: string;
  notes: string;
};

/** A catalogue entry, for a dive whose site `logbook_sites` does not include. */
export type CatalogueSite = { id: number; name: string; lat: number; lon: number; country: string };

export type SsiToSsrfInput = {
  /** The raw `get_divelog` body. */
  divelog: unknown;
  labels?: SsiLogbookLabels;
  /** Leave empty to convert every dive, for a standalone file. */
  existingDives?: readonly ExistingDive[];
  existingSites?: readonly ExistingSite[];
  catalogue?: readonly CatalogueSite[];
  /** Keys from `previewSsiLogbook`. Leave out to convert every dive. */
  only?: ReadonlySet<string>;
};

/** One SSI dive, for a screen to offer. `when` is in the core's convention. */
export type SsiDivePreview = ExistingDive & {
  key: string;
  number: number | null;
  siteName: string;
  buddy: string;
  /** A dive in `existingDives` matches this one, so importing it would add nothing. */
  inLog: boolean;
};

export type SsiToSsrfResult = {
  xml: string;
  /** Dives written to the XML. */
  dives: number;
  /** SSI dives that match a dive already in the log, and were left out. */
  alreadyPresent: number;
  /** SSI's own duplicates of a dive in the same response. */
  duplicates: number;
  /** Records with no usable date. */
  unreadable: number;
  sites: number;
};

// --- Tolerant reading ------------------------------------------------------

function asObject(value: unknown): Json {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Json)
    : {};
}

/** A number from a number or a numeric string. Null for anything else. */
function num(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** As `num`, for fields where SSI's 0 means nothing was recorded. */
function positive(value: unknown): number | null {
  const parsed = num(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function str(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function flag(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

/** An array, or the JSON text of one, which is how SSI nests its datasets. */
function list(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function fromImperial(metric: unknown, imperial: unknown, factor: number): number | null {
  const direct = positive(metric);
  if (direct !== null) {
    return direct;
  }
  const converted = positive(imperial);
  return converted === null ? null : converted * factor;
}

/**
 * Celsius, where 0 is ambiguous: SSI uses it for "not recorded" too. A Fahrenheit
 * reading tells them apart - a real 0 C arrives with 32 F beside it, an empty field
 * with 0 F or nothing.
 */
function celsius(c: unknown, f: unknown): number | null {
  const metric = num(c);
  if (metric !== null && metric !== 0) {
    return metric;
  }
  const imperial = positive(f);
  return imperial === null ? null : ((imperial - 32) * 5) / 9;
}

// --- XML ------------------------------------------------------------------

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;')
    .replace(/"/g, '&quot;');
}

function attr(name: string, value: string): string {
  return ` ${name}='${escapeXml(value)}'`;
}

function fixed(value: number, digits: number): string {
  return String(Math.round(value * 10 ** digits) / 10 ** digits);
}

/** "12:05 min", the only form SSRF has for a duration. */
function minutes(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')} min`;
}

function element(name: string, text: string): string {
  return text === '' ? '' : `  <${name}>${escapeXml(text)}</${name}>\n`;
}

/** FNV-1a. Stable ids for the core's 32-bit device and dive identifiers. */
function hash32(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Zero means "unset" to the core.
  return hash >>> 0 || 1;
}

function hex32(value: number): string {
  return value.toString(16).padStart(8, '0');
}

// --- Dive time -------------------------------------------------------------

/**
 * The dive's start as the wall-clock reading SSI stores, as Unix seconds in the
 * core's convention: that reading treated as UTC. See localParts in converter.ts.
 */
function readWhen(raw: Json): { date: string; time: string; when: number } | null {
  const datetime = /^(\d{4}-\d{2}-\d{2})[ T+](\d{2}):(\d{2})(?::(\d{2}))?/.exec(
    str(raw.odin_user_log_datetime),
  );
  const date = datetime?.[1] ?? str(raw.odin_user_log_date);
  const clock = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(str(raw.odin_user_log_entry_time));
  const hours = datetime?.[2] ?? clock?.[1] ?? '00';
  const mins = datetime?.[3] ?? clock?.[2] ?? '00';
  const secs = datetime?.[4] ?? clock?.[3] ?? '00';
  const time = `${hours.padStart(2, '0')}:${mins}:${secs}`;

  const when = Date.parse(`${date}T${time}Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(when)) {
    return null;
  }
  return { date, time, when: when / 1000 };
}

// --- Recognizing a dive ----------------------------------------------------

/** dive.cpp `similar`: within `expected`, or within 10% of the larger value. */
function similar(a: number, b: number, expected: number): boolean {
  if (a === 0 && b === 0) {
    return true;
  }
  if (a === 0 || b === 0) {
    return false;
  }
  const diff = Math.abs(a - b);
  return diff < expected || diff * 10 < Math.max(a, b);
}

/**
 * The core's `dive::likely_same`, so a dive skipped here is the dive the core would
 * have merged. Skipped rather than merged because a merge files SSI's 5-second copy
 * as a second dive computer on a dive that already has the original download.
 */
export function isSameDive(a: ExistingDive, b: ExistingDive): boolean {
  if (
    !similar(a.maxDepthMm, b.maxDepthMm, 1000) ||
    (a.meanDepthMm > 0 && b.meanDepthMm > 0 && !similar(a.meanDepthMm, b.meanDepthMm, 1000)) ||
    a.durationSec === 0 ||
    b.durationSec === 0 ||
    !similar(a.durationSec, b.durationSec, 5 * 60)
  ) {
    return false;
  }
  const fuzz = Math.max(Math.floor(Math.max(a.durationSec, b.durationSec) / 2), 60);
  return Math.abs(a.when - b.when) <= fuzz;
}

// --- Samples ---------------------------------------------------------------

type Sample = {
  sec: number;
  depthM: number;
  tempC: number | null;
  pressureBar: [number | null, number | null];
  ndlSec: number | null;
  inDeco: boolean | null;
  stopDepthM: number | null;
  stopSec: number | null;
  ttsSec: number | null;
  cns: number | null;
  heartbeat: number | null;
  bearing: number | null;
  setpointBar: number | null;
  gasIndex: number | null;
};

type NumericField =
  | 'ndlSec'
  | 'ttsSec'
  | 'stopSec'
  | 'stopDepthM'
  | 'cns'
  | 'setpointBar'
  | 'heartbeat'
  | 'bearing';

function plausibleBar(value: unknown): number | null {
  const bar = positive(value);
  return bar !== null && bar <= MAX_PLAUSIBLE_BAR ? bar : null;
}

function nullableSeries(value: unknown): (number | null)[] {
  return list(value).map(num);
}

function readSamples(raw: Json): Sample[] {
  const tankSeries = nullableSeries(raw.odin_user_log_tankPressureDataset);
  const heartSeries = nullableSeries(raw.odin_user_log_heartRateDataset);
  const records = list(raw.odin_user_log_diveSamples).map(asObject);

  if (records.length > 0) {
    const samples: Sample[] = [];
    records.forEach((record, index) => {
      const ms = num(record.t);
      const depth = num(record.d);
      if (ms === null || depth === null) {
        return;
      }
      const tank = asObject(record.pr);
      const tankIndex = num(tank.t) ?? 0;
      const fromRecord = plausibleBar(tank.v);
      const stop = asObject(record.de);
      const stopDepth = num(stop.d);
      const setpoint = positive(record.sp);
      const inDeco = record.dr;
      const ndl = num(record.ndl);

      samples.push({
        sec: Math.round(ms / 1000),
        depthM: Math.abs(depth),
        tempC: num(record.te),
        pressureBar: [
          (tankIndex === 0 ? fromRecord : null) ??
            plausibleBar(record.pressure) ??
            plausibleBar(tankSeries[index]),
          tankIndex === 1 ? fromRecord : null,
        ],
        // Zero is a real reading here: the limit ran out, and the next sample must
        // not inherit the previous minutes.
        ndlSec: ndl === null ? null : ndl * 60,
        inDeco: typeof inDeco === 'boolean' || inDeco === 0 || inDeco === 1 ? flag(inDeco) : null,
        stopDepthM: stopDepth === null ? null : Math.abs(stopDepth),
        stopSec: num(stop.t),
        ttsSec: num(stop.tts),
        cns: num(record.cn),
        heartbeat: num(record.hb) ?? heartSeries[index] ?? null,
        bearing: num(record.b),
        // Bar is the only scale a sensible setpoint fits.
        setpointBar: setpoint !== null && setpoint <= 3 ? setpoint : null,
        gasIndex: num(asObject(record.gm).index),
      });
    });
    return samples.sort((a, b) => a.sec - b.sec);
  }

  // A dive with datasets but no records: the flat arrays have no times, so they
  // are spread evenly across the logged dive.
  const depths = nullableSeries(raw.odin_user_log_depthDataset);
  if (depths.length === 0) {
    return [];
  }
  const temps = nullableSeries(raw.odin_user_log_tempDataset);
  const durationSec = (positive(raw.odin_user_log_divetime) ?? 0) * 60;
  const interval = durationSec > 0 ? Math.max(1, Math.round(durationSec / depths.length)) : 5;

  const samples: Sample[] = [];
  depths.forEach((depth, index) => {
    if (depth === null) {
      return;
    }
    samples.push({
      sec: (index + 1) * interval,
      depthM: Math.abs(depth),
      tempC: temps[index] ?? null,
      pressureBar: [plausibleBar(tankSeries[index]), null],
      ndlSec: null,
      inDeco: null,
      stopDepthM: null,
      stopSec: null,
      ttsSec: null,
      cns: null,
      heartbeat: heartSeries[index] ?? null,
      bearing: null,
      setpointBar: null,
      gasIndex: null,
    });
  });
  return samples;
}

/**
 * Written as the core writes them: a value appears when it changes, because the
 * parser starts each sample as a copy of the previous one (parse.cpp, sample_start).
 * Pressure alone is not carried over, so it is always written.
 */
function samplesXml(samples: readonly Sample[]): string {
  let out = '';
  let previous: Sample | null = null;

  for (const sample of samples) {
    let line = `  <sample${attr('time', minutes(sample.sec))}${attr('depth', `${fixed(sample.depthM, 3)} m`)}`;

    if (sample.tempC !== null && sample.tempC !== previous?.tempC) {
      line += attr('temp', `${fixed(sample.tempC, 2)} C`);
    }
    sample.pressureBar.forEach((bar, index) => {
      if (bar !== null) {
        line += attr(`pressure${index}`, `${fixed(bar, 3)} bar`);
      }
    });
    // Unset is zero to the core, so a first sample has no need to say so.
    const changed = (key: NumericField): boolean => {
      const value = sample[key];
      return value !== null && value !== (previous?.[key] ?? 0);
    };
    const written = <K extends NumericField>(key: K): number => sample[key] as number;

    if (changed('ndlSec')) {
      line += attr('ndl', minutes(written('ndlSec')));
    }
    if (changed('ttsSec')) {
      line += attr('tts', minutes(written('ttsSec')));
    }
    if (sample.inDeco !== null && sample.inDeco !== (previous?.inDeco ?? false)) {
      line += attr('in_deco', sample.inDeco ? '1' : '0');
    }
    if (changed('stopSec')) {
      line += attr('stoptime', minutes(written('stopSec')));
    }
    if (changed('stopDepthM')) {
      line += attr('stopdepth', `${fixed(written('stopDepthM'), 3)} m`);
    }
    if (changed('cns')) {
      line += attr('cns', `${Math.round(written('cns'))}%`);
    }
    if (changed('setpointBar')) {
      line += attr('po2', `${fixed(written('setpointBar'), 3)} bar`);
    }
    if (changed('heartbeat')) {
      line += attr('heartbeat', String(Math.round(written('heartbeat'))));
    }
    if (changed('bearing')) {
      line += attr('bearing', String(Math.round(written('bearing'))));
    }

    out += `${line} />\n`;
    previous = sample;
  }
  return out;
}

// --- Events ----------------------------------------------------------------

type DiveEvent = { sec: number; type: number; name: string; cylinder?: number };

const ALARM_EVENTS: Record<string, { type: number; name: string }> = {
  deco: { type: EVENT.decoStop, name: 'deco stop' },
  violation: { type: EVENT.violation, name: 'violation' },
  // Only for a record with no `fast_ascent`: see readEvents.
  speed: { type: EVENT.ascent, name: 'ascent' },
  fast_ascent: { type: EVENT.ascent, name: 'ascent' },
  UNCONTROLLED_ASCENT: { type: EVENT.ascent, name: 'ascent' },
};

/** Every other alarm key becomes an event under its own name. */
function alarmEvent(key: string): { type: number; name: string } {
  return ALARM_EVENTS[key] ?? { type: 0, name: key.replace(/_/g, ' ').toLowerCase() };
}

/**
 * SSI repeats an alarm on every sample it lasts for. An event is the moment it
 * began, so only the first sample of each unbroken run counts.
 */
function readEvents(raw: Json, samples: readonly Sample[], cylinders: number): DiveEvent[] {
  const events: DiveEvent[] = [];
  const lastSeen = new Map<string, number>();

  const records = list(raw.odin_user_log_alarmDataset)
    .map(asObject)
    .sort((a, b) => (num(a.position) ?? 0) - (num(b.position) ?? 0));

  for (const record of records) {
    const position = num(record.position);
    if (position === null || samples[position] === undefined) {
      continue;
    }
    const startedHere = new Set<string>();
    for (const [key, value] of Object.entries(record)) {
      if (key === 'position' || !flag(value)) {
        continue;
      }
      // `speed` also fires on ascents the computer did not warn about. Compared with
      // the same dive downloaded from a Puck 4, `fast_ascent` starts at the moments
      // the desktop shows an ascent event and `speed` adds others from 9:35 on.
      if (key === 'speed' && 'fast_ascent' in record) {
        continue;
      }
      const { name } = alarmEvent(key);
      const seen = lastSeen.get(name);
      if (seen === undefined || position - seen > 1) {
        startedHere.add(key);
      }
      lastSeen.set(name, position);
    }
    const named = new Set<string>();
    for (const key of startedHere) {
      const event = alarmEvent(key);
      if (!named.has(event.name)) {
        named.add(event.name);
        events.push({ sec: samples[position].sec, ...event });
      }
    }
  }

  let gas: number | null = null;
  for (const sample of samples) {
    const index = sample.gasIndex;
    if (index === null || index === gas) {
      continue;
    }
    if (index >= 0 && index < cylinders) {
      events.push({ sec: sample.sec, type: EVENT.gasChange, name: 'gaschange', cylinder: index });
    }
    gas = index;
  }

  return events.sort((a, b) => a.sec - b.sec);
}

function eventsXml(events: readonly DiveEvent[]): string {
  return events
    .map((event) => {
      const type = event.type > 0 ? attr('type', String(event.type)) : '';
      const cylinder = event.cylinder === undefined ? '' : attr('cylinder', String(event.cylinder));
      return `  <event${attr('time', minutes(event.sec))}${type}${attr('name', event.name)}${cylinder} />\n`;
    })
    .join('');
}

// --- Cylinders -------------------------------------------------------------

type Tank = {
  sizeL: number | null;
  startBar: number | null;
  endBar: number | null;
  o2: number | null;
  he: number | null;
  description: string;
  use?: 'diluent' | 'oxygen';
};

const PSI_TO_BAR = 0.0689476;

function readTank(
  raw: Json,
  names: { vol?: string; start: string; end: string; o2?: string; he?: string },
  description: string,
  use?: Tank['use'],
): Tank | null {
  const sizeL = names.vol ? positive(raw[`${names.vol}_l`]) : null;
  const startBar = fromImperial(raw[`${names.start}_bar`], raw[`${names.start}_psi`], PSI_TO_BAR);
  const endBar = fromImperial(raw[`${names.end}_bar`], raw[`${names.end}_psi`], PSI_TO_BAR);
  const o2 = names.o2 ? positive(raw[names.o2]) : null;
  const he = names.he ? positive(raw[names.he]) : null;

  if (sizeL === null && startBar === null && endBar === null && o2 === null && he === null) {
    return null;
  }
  return { sizeL, startBar, endBar, o2, he, description, use };
}

function readTanks(raw: Json, labels: SsiLogbookLabels): Tank[] {
  const material = labelOf(labels, 'tanktype', raw.odin_user_log_var_tanktype_id);
  const main = readTank(
    raw,
    {
      vol: 'odin_user_log_tank_vol',
      start: 'odin_user_log_pressure_start',
      end: 'odin_user_log_pressure_end',
    },
    material,
  );
  const tanks: Tank[] = [];
  if (main !== null) {
    // A flag and a percentage, and an old record can carry either without the other.
    const percent = positive(raw.odin_user_log_ean_percent);
    main.o2 = percent !== null && (flag(raw.odin_user_log_ean) || percent !== 21) ? percent : null;
    tanks.push(main);
  }

  const families = [
    ['odin_user_log_xr_back', 'Back gas'],
    ['odin_user_log_xr_deco1', 'Deco 1'],
    ['odin_user_log_xr_deco2', 'Deco 2'],
    ['odin_user_log_xr_deco3', 'Deco 3'],
  ] as const;
  for (const [prefix, description] of families) {
    const tank = readTank(
      raw,
      {
        vol: `${prefix}_vol`,
        start: `${prefix}_start`,
        end: `${prefix}_end`,
        o2: `${prefix}_o2`,
        he: `${prefix}_he`,
      },
      description,
    );
    if (tank !== null) {
      tanks.push(tank);
    }
  }

  const other: (readonly [string, string, Tank['use']?])[] = [
    ['odin_user_log_deco_gas', 'Deco gas'],
    ['odin_user_log_scr_bottom', 'SCR bottom'],
    ['odin_user_log_scr_deco', 'SCR deco'],
    ['odin_user_log_ccr_diluent', 'Diluent', 'diluent'],
    ['odin_user_log_ccr_o2', 'Oxygen', 'oxygen'],
    ['odin_user_log_ccr_bailout01', 'Bailout 1'],
    ['odin_user_log_ccr_bailout02', 'Bailout 2'],
    ['odin_user_log_ccr_bailout03', 'Bailout 3'],
  ];
  for (const [prefix, description, use] of other) {
    const tank = readTank(
      raw,
      {
        vol: `${prefix}_tank_vol`,
        start: `${prefix}_start`,
        end: `${prefix}_end`,
        o2: use === 'oxygen' ? undefined : `${prefix}_o2`,
        he: use === 'oxygen' ? undefined : `${prefix}_he`,
      },
      description,
      use,
    );
    if (tank !== null) {
      if (use === 'oxygen') {
        tank.o2 = 100;
      }
      tanks.push(tank);
    }
  }

  return tanks;
}

function tanksXml(tanks: readonly Tank[]): string {
  return tanks
    .map((tank) => {
      let line = '  <cylinder';
      if (tank.sizeL !== null) {
        line += attr('size', `${fixed(tank.sizeL, 3)} l`);
      }
      if (tank.description !== '') {
        line += attr('description', tank.description);
      }
      if (tank.o2 !== null) {
        line += attr('o2', `${fixed(tank.o2, 1)}%`);
      }
      if (tank.he !== null) {
        line += attr('he', `${fixed(tank.he, 1)}%`);
      }
      if (tank.startBar !== null) {
        line += attr('start', `${fixed(tank.startBar, 3)} bar`);
      }
      if (tank.endBar !== null) {
        line += attr('end', `${fixed(tank.endBar, 3)} bar`);
      }
      if (tank.use !== undefined) {
        line += attr('use', tank.use);
      }
      return `${line} />\n`;
    })
    .join('');
}

// --- Sites -----------------------------------------------------------------

type SiteDraft = {
  uuid: number;
  name: string;
  lat: number | null;
  lon: number | null;
  description: string;
  notes: string;
  country: string;
  region: string;
};

function validPosition(lat: number | null, lon: number | null): boolean {
  return (
    lat !== null &&
    lon !== null &&
    (lat !== 0 || lon !== 0) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  );
}

/** The site already in the log that this one is, by position or by name and place. */
function matchExistingSite(
  name: string,
  lat: number | null,
  lon: number | null,
  existing: readonly ExistingSite[],
): ExistingSite | undefined {
  const wanted = name.toLocaleLowerCase();
  const located = validPosition(lat, lon);

  return existing.find((site) => {
    const sameName = site.name.trim().toLocaleLowerCase() === wanted && wanted !== '';
    if (!site.hasGps || !located) {
      return sameName;
    }
    const distance = distanceMeters(
      lat as number,
      lon as number,
      site.latUdeg / 1e6,
      site.lonUdeg / 1e6,
    );
    return distance <= NEARBY_SITE_METERS || (sameName && distance <= SAME_NAME_SITE_METERS);
  });
}

/**
 * The site for one SSI id. An existing site is written with its exact fields, which
 * is what the core's `get_same` compares on import: the dive then lands on that site
 * and no copy is added.
 */
function resolveSite(
  raw: Json,
  ssiSites: ReadonlyMap<number, Json>,
  catalogue: ReadonlyMap<number, CatalogueSite>,
  existing: readonly ExistingSite[],
): SiteDraft | null {
  const id = positive(raw.odin_user_log_dive_sites_id);
  const site = id === null ? undefined : ssiSites.get(id);
  const entry = id === null ? undefined : catalogue.get(id);

  let lat = num(site?.odin_dive_sites_lat) ?? entry?.lat ?? null;
  let lon = num(site?.odin_dive_sites_lon) ?? entry?.lon ?? null;
  if (!validPosition(lat, lon)) {
    lat = num(raw.odin_user_log_pos_start_latitude);
    lon = num(raw.odin_user_log_pos_start_longitude);
  }
  const located = validPosition(lat, lon);

  const named = str(site?.odin_dive_sites_name) || (entry?.name ?? '');
  if (named === '' && id === null && !located) {
    return null;
  }
  const name =
    named !== '' ? named : id !== null ? `SSI site ${id}` : `SSI position ${lat}, ${lon}`;

  const match = matchExistingSite(name, lat, lon, existing);
  if (match) {
    return {
      uuid: match.uuid,
      name: match.name,
      lat: match.hasGps ? match.latUdeg / 1e6 : null,
      lon: match.hasGps ? match.lonUdeg / 1e6 : null,
      description: match.description,
      notes: match.notes,
      country: '',
      region: '',
    };
  }

  return {
    uuid: hash32(id !== null ? `ssi-site-${id}` : `ssi-position-${lat},${lon}`),
    name,
    lat: located ? lat : null,
    lon: located ? lon : null,
    description: '',
    notes: '',
    country: str(site?.odin_dive_sites_meta_country) || (entry?.country ?? ''),
    region: str(site?.odin_dive_sites_regions_name) || str(site?.odin_dive_sites_meta_region),
  };
}

function siteXml(site: SiteDraft): string {
  let line = `<site uuid='${hex32(site.uuid)}'${attr('name', site.name)}`;
  if (site.lat !== null && site.lon !== null) {
    line += ` gps='${site.lat.toFixed(6)} ${site.lon.toFixed(6)}'`;
  }
  if (site.description !== '') {
    line += attr('description', site.description);
  }
  line += '>\n';
  if (site.notes !== '') {
    line += `  <notes>${escapeXml(site.notes)}</notes>\n`;
  }
  // TC_COUNTRY and TC_ADMIN_L1 in core/taxonomy.h; origin 0 is "entered by hand".
  if (site.country !== '') {
    line += `  <geo cat='2' origin='0'${attr('value', site.country)} />\n`;
  }
  if (site.region !== '') {
    line += `  <geo cat='3' origin='0'${attr('value', site.region)} />\n`;
  }
  return `${line}</site>\n`;
}

// --- People and labels -----------------------------------------------------

function labelOf(labels: SsiLogbookLabels, table: string, code: unknown): string {
  const id = positive(code);
  return id === null ? '' : (labels.tables.get(table)?.get(id) ?? '');
}

function buddyName(raw: Json): string {
  const first = str(raw.firstname) || str(raw.forename);
  return [first, str(raw.lastname)].filter((part) => part !== '').join(' ') || str(raw.nickname);
}

/**
 * Every buddy by every id a dive may refer to them by. Deleted ones stay: removing
 * someone from the list does not change who was on a past dive. See buddies.ts for
 * why `id` and `buddy_master_id` are both candidates, with `id` winning a clash.
 */
function buddyNames(raw: readonly Json[]): Map<number, string> {
  const names = new Map<number, string>();
  for (const key of ['buddy_master_id', 'id']) {
    for (const buddy of raw) {
      const id = positive(buddy[key]);
      const name = buddyName(buddy);
      if (id !== null && name !== '') {
        names.set(id, name);
      }
    }
  }
  return names;
}

/** "Casey Brandt #130971" is a name and an SSI number; only the name is a person. */
function withoutLeaderNumber(name: string): string {
  return name.replace(/\s*#\d+\s*$/, '');
}

function readBuddies(raw: Json, names: ReadonlyMap<number, string>): string {
  const people = list(raw.odin_user_log_buddy_ids)
    .map((id) => names.get(num(id) ?? -1) ?? '')
    .concat(withoutLeaderNumber(str(raw.odin_user_log_buddy_confirmed_name)))
    .filter((name) => name !== '');
  return [...new Set(people)].join(', ');
}

function readTags(raw: Json, labels: SsiLogbookLabels): string[] {
  const specials = str(raw.odin_user_log_var_specialdive_id)
    .split(/[,;\s]+/)
    .map((id) => labelOf(labels, 'specialdive', id));
  const tags = [SSI_TAG, labelOf(labels, 'entry', raw.odin_user_log_var_entry_id), ...specials]
    .map((tag) => tag.toLocaleLowerCase())
    .filter((tag) => tag !== '');
  return [...new Set(tags)];
}

/** What SSI records and SSRF has no field for, kept readable under the diver's own notes. */
function readNotes(raw: Json, labels: SsiLogbookLabels, hasSamples: boolean): string {
  const visibility = fromImperial(raw.odin_user_log_vis_m, raw.odin_user_log_vis_ft, 0.3048);
  const namesFrom = (ids: unknown, table: ReadonlyMap<number, string>): string =>
    list(ids)
      .map((id) => table.get(num(id) ?? -1) ?? '')
      .filter((name) => name !== '')
      .join(', ');
  const maxWater = celsius(raw.odin_user_log_watertemp_max_c, raw.odin_user_log_watertemp_max_f);

  const alarms = [
    flag(raw.odin_user_log_alarm_fast_ascent) ? 'fast ascent' : '',
    flag(raw.odin_user_log_alarm_deco_stop) ? 'deco stop' : '',
    flag(raw.odin_user_log_alarm_deco_violation) ? 'deco violation' : '',
  ]
    .filter((alarm) => alarm !== '')
    .join(', ');

  const details: [string, string][] = [
    ['Dive type', labelOf(labels, 'divetype', raw.odin_user_log_var_divetype_id)],
    ['Water body', labelOf(labels, 'water_body', raw.odin_user_log_var_water_body_id)],
    ['Weather', labelOf(labels, 'weather', raw.odin_user_log_var_weather_id)],
    ['Current', labelOf(labels, 'current', raw.odin_user_log_var_current_id)],
    ['Surface', labelOf(labels, 'surface', raw.odin_user_log_var_surface_id)],
    ['Visibility', visibility === null ? '' : `${fixed(visibility, 1)} m`],
    // The samples carry this when there are any; the core reads the maximum from them.
    ['Max water temperature', hasSamples || maxWater === null ? '' : `${fixed(maxWater, 1)} C`],
    ['Dive center', str(raw.odin_user_log_divecenter_confirmed_name)],
    ['Wildlife', namesFrom(raw.odin_user_log_animal_ids, labels.wildlife)],
    ['Gear', namesFrom(raw.odin_user_log_gear, labels.gear)],
    // With an alarm dataset these are events on the profile instead.
    ['Alarms', list(raw.odin_user_log_alarmDataset).length > 0 ? '' : alarms],
  ];
  const lines = details
    .filter(([, value]) => value !== '')
    .map(([label, value]) => `${label}: ${value}`);

  return [str(raw.odin_user_log_comment), lines.join('\n')]
    .filter((part) => part !== '')
    .join('\n\n');
}

function readExtraData(raw: Json): [string, string][] {
  const out: [string, string][] = [];
  const add = (key: string, value: unknown) => {
    const text = str(value);
    if (text !== '' && text !== '0') {
      out.push([key, text]);
    }
  };

  add('Serial', raw.odin_user_log_divecomputer_serial_nr);
  add('FW Version', raw.odin_user_log_divecomputer_firmware);
  add('Deco model', raw.log_extended_data_decomodel);

  // "85 / 85", or the two separate fields a newer record may use instead.
  const combined = /(\d+)\s*\/\s*(\d+)/.exec(str(raw.odin_user_log_gf_set));
  add('GF Low', combined?.[1] ?? raw.odin_user_log_gf_set_1);
  add('GF High', combined?.[2] ?? raw.odin_user_log_gf_set_2);
  add('GF at end', raw.odin_user_log_gf_end);
  add('CNS at start', raw.odin_user_log_cns_start);
  add('OTU at start', raw.odin_user_log_otu_start);
  // The dive attributes hold these too, but the core recalculates both from the
  // profile, so SSI's own figures survive only here.
  add('CNS at end', raw.odin_user_log_cns_end);
  add('OTU at end', raw.odin_user_log_otu_end);
  add('Deco time', raw.odin_user_log_deco_time);

  add('SSI log id', raw.odin_user_log_id);
  add('SSI dive number', raw.odin_user_log_nr);
  add('SSI dive reference', raw.odin_user_log_divecomputer_dive_ref);
  return out;
}

// --- Dives -----------------------------------------------------------------

/** What SSI records about the rig, in terms of the core's dive modes. */
function readDiveMode(raw: Json): string {
  if (positive(raw.odin_user_log_ccr_unit_id) !== null) {
    return 'CCR';
  }
  if (positive(raw.odin_user_log_scr_unit_id) !== null) {
    return 'PSCR';
  }
  return str(raw.odin_user_log_frddisc) !== '' ||
    positive(raw.odin_user_log_frd_weight_kg) !== null
    ? 'Freedive'
    : '';
}

type Converted = {
  key: string;
  number: number | null;
  buddy: string;
  identity: ExistingDive;
  xml: string;
  site: SiteDraft | null;
  hasSamples: boolean;
};

function convertDive(
  raw: Json,
  context: {
    labels: SsiLogbookLabels;
    buddies: ReadonlyMap<number, string>;
    ssiSites: ReadonlyMap<number, Json>;
    catalogue: ReadonlyMap<number, CatalogueSite>;
    existingSites: readonly ExistingSite[];
  },
): Converted | null {
  const when = readWhen(raw);
  if (when === null) {
    return null;
  }

  const { labels } = context;
  const samples = readSamples(raw);
  const tanks = readTanks(raw, labels);
  // The core has nowhere to keep a pressure reading without a cylinder to put it on,
  // and SSI logs them independently. The readings themselves describe this one.
  const readings = samples.flatMap((sample) => sample.pressureBar[0] ?? []);
  if (tanks.length === 0 && readings.length > 0) {
    tanks.push({
      sizeL: null,
      startBar: readings[0],
      endBar: readings[readings.length - 1],
      o2: null,
      he: null,
      description: '',
    });
  }
  const events = readEvents(raw, samples, tanks.length);
  const site = resolveSite(raw, context.ssiSites, context.catalogue, context.existingSites);

  const sampleEnd = samples.length === 0 ? 0 : samples[samples.length - 1].sec;
  const durationSec = sampleEnd || Math.round((positive(raw.odin_user_log_divetime) ?? 0) * 60);
  const sampleDepth = samples.reduce((deepest, sample) => Math.max(deepest, sample.depthM), 0);
  const maxDepth =
    fromImperial(raw.odin_user_log_depth_m, raw.odin_user_log_depth_ft, 0.3048) ?? sampleDepth;
  const meanDepth = fromImperial(
    raw.odin_user_log_avg_depth_m,
    raw.odin_user_log_avg_depth_ft,
    0.3048,
  );

  // Attributes of <dive>
  let dive = '<dive';
  const number = positive(raw.odin_user_log_nr);
  if (number !== null) {
    dive += ` number='${Math.round(number)}'`;
  }
  const rating = positive(raw.odin_user_log_rating);
  if (rating !== null && rating <= 5) {
    dive += ` rating='${Math.round(rating)}'`;
  }
  const sac = positive(raw.odin_user_log_amv_l);
  if (sac !== null) {
    dive += ` sac='${sac.toFixed(3)} l/min'`;
  }
  const otu = positive(raw.odin_user_log_otu_end);
  if (otu !== null) {
    dive += ` otu='${Math.round(otu)}'`;
  }
  const cns = positive(raw.odin_user_log_cns_end);
  if (cns !== null) {
    dive += ` cns='${Math.round(cns)}%'`;
  }
  if (site !== null) {
    dive += ` divesiteid='${hex32(site.uuid)}'`;
  }
  const tags = readTags(raw, labels);
  dive += attr('tags', tags.join(', '));
  dive += ` date='${when.date}' time='${when.time}' duration='${minutes(durationSec)}'>\n`;

  // Children of <dive>
  dive += element('divemaster', withoutLeaderNumber(str(raw.odin_user_log_leader_confirmed_name)));
  dive += element('buddy', readBuddies(raw, context.buddies));
  dive += element('notes', readNotes(raw, labels, samples.length > 0));
  dive += element('suit', labelOf(labels, 'suit', raw.odin_user_log_frd_suit));
  dive += tanksXml(tanks);
  const weight = fromImperial(raw.odin_user_log_weight_kg, raw.odin_user_log_weight_lb, 0.453592);
  if (weight !== null) {
    dive += `  <weightsystem weight='${fixed(weight, 3)} kg' />\n`;
  }

  // The dive computer
  const computer = str(raw.odin_user_log_divecomputer_name) || str(raw.odin_user_log_diveComputer);
  const manufacturer = str(raw.odin_user_log_divecomputer_manufacturer);
  const model = [manufacturer, computer].filter((part) => part !== '').join(' ');
  const serial = str(raw.odin_user_log_divecomputer_serial_nr);
  const identity = str(raw.odin_user_log_id) || `${when.date} ${when.time}`;

  dive += '  <divecomputer';
  dive += attr('model', model || MANUAL_MODEL);
  if (model !== '') {
    dive += ` deviceid='${hex32(hash32(`ssi-${model}-${serial}`))}'`;
    dive += ` diveid='${hex32(hash32(`ssi-dive-${identity}`))}'`;
  }
  const mode = readDiveMode(raw);
  if (mode !== '') {
    dive += attr('dctype', mode);
  }
  dive += ` date='${when.date}' time='${when.time}' duration='${minutes(durationSec)}'>\n`;

  let depth = '  <depth';
  if (maxDepth > 0) {
    depth += ` max='${fixed(maxDepth, 3)} m'`;
  }
  if (meanDepth !== null) {
    depth += ` mean='${fixed(meanDepth, 3)} m'`;
  }
  if (depth !== '  <depth') {
    dive += `${depth} />\n`;
  }
  const water = celsius(raw.odin_user_log_watertemp_c, raw.odin_user_log_watertemp_f);
  const air = celsius(raw.odin_user_log_airtemp_c, raw.odin_user_log_airtemp_f);
  if (water !== null || air !== null) {
    dive += '  <temperature';
    dive += air === null ? '' : ` air='${fixed(air, 2)} C'`;
    dive += water === null ? '' : ` water='${fixed(water, 2)} C'`;
    dive += ' />\n';
  }
  const surfaceInterval = positive(raw.odin_user_log_si_before);
  if (surfaceInterval !== null) {
    dive += `  <surfacetime>${minutes(surfaceInterval)}</surfacetime>\n`;
  }
  // Fresh and salt are the only two water types SSI has, and the only ones it needs.
  const waterType = positive(raw.odin_user_log_var_watertype_id);
  if (waterType === 4 || waterType === 5) {
    dive += `  <water salinity='${waterType === 4 ? 1000 : 1030} g/l' />\n`;
  }
  for (const [key, value] of readExtraData(raw)) {
    dive += `  <extradata${attr('key', key)}${attr('value', value)} />\n`;
  }
  dive += eventsXml(events);
  dive += samplesXml(samples);
  dive += '  </divecomputer>\n</dive>\n';

  return {
    key: identity,
    number,
    buddy: readBuddies(raw, context.buddies),
    identity: {
      when: when.when,
      durationSec,
      maxDepthMm: Math.round(maxDepth * 1000),
      meanDepthMm: Math.round((meanDepth ?? 0) * 1000),
    },
    xml: dive,
    site,
    hasSamples: samples.length > 0,
  };
}

function byId(raw: readonly Json[], key: string): Map<number, Json> {
  const map = new Map<number, Json>();
  for (const entry of raw) {
    const id = positive(entry[key]);
    if (id !== null) {
      map.set(id, entry);
    }
  }
  return map;
}

/** Every readable SSI dive, sorted out into the new and the already present. */
function collectDives({
  divelog,
  labels = NO_SSI_LABELS,
  existingDives = [],
  existingSites = [],
  catalogue = [],
}: SsiToSsrfInput) {
  const body = asObject(divelog);
  const records = list(body.logbook_details).map(asObject);
  const context = {
    labels,
    buddies: buddyNames(list(body.logbook_buddies).map(asObject)),
    ssiSites: byId(list(body.logbook_sites).map(asObject), 'odin_dive_sites_id'),
    catalogue: new Map(catalogue.map((site) => [site.id, site])),
    existingSites,
  };

  const kept: Converted[] = [];
  const present: Converted[] = [];
  let duplicates = 0;
  let unreadable = 0;

  for (const raw of records) {
    if (flag(raw.odin_user_log_deleted)) {
      continue;
    }
    const converted = convertDive(raw, context);
    if (converted === null) {
      unreadable++;
      continue;
    }
    if (existingDives.some((dive) => isSameDive(dive, converted.identity))) {
      // SSI's own duplicates count once here too, so a list of these adds up.
      if (present.some((other) => isSameDive(other.identity, converted.identity))) {
        duplicates++;
      } else {
        present.push(converted);
      }
      continue;
    }

    const twin = kept.findIndex((other) => isSameDive(other.identity, converted.identity));
    if (twin >= 0) {
      duplicates++;
      // The copy with a profile is the one worth having.
      if (!kept[twin].hasSamples && converted.hasSamples) {
        kept[twin] = converted;
      }
      continue;
    }
    kept.push(converted);
  }

  return { kept, present, duplicates, unreadable };
}

/**
 * The SSRF document for an SSI logbook. Deleted dives are left out, and so is any
 * dive that matches one in `existingDives`, which is what makes a second import of
 * the same logbook add nothing. With `only`, the counts describe the chosen dives.
 */
export function convertSsiLogbookToSsrf(input: SsiToSsrfInput): SsiToSsrfResult {
  const { only } = input;
  const collected = collectDives(input);
  const chosen = (dive: Converted) => only === undefined || only.has(dive.key);

  const kept = collected.kept.filter(chosen).sort((a, b) => a.identity.when - b.identity.when);

  const sites = new Map<number, SiteDraft>();
  for (const { site } of kept) {
    if (site !== null) {
      sites.set(site.uuid, site);
    }
  }

  const xml =
    "<divelog program='subsurface' version='3'>\n" +
    '<divesites>\n' +
    [...sites.values()].map(siteXml).join('') +
    '</divesites>\n' +
    '<dives>\n' +
    kept.map((dive) => dive.xml).join('') +
    '</dives>\n' +
    '</divelog>\n';

  return {
    xml,
    dives: kept.length,
    alreadyPresent: collected.present.filter(chosen).length,
    duplicates: only === undefined ? collected.duplicates : 0,
    unreadable: only === undefined ? collected.unreadable : 0,
    sites: sites.size,
  };
}

/** The SSI dives as a list to choose from, newest first. */
export function previewSsiLogbook(input: SsiToSsrfInput): SsiDivePreview[] {
  const { kept, present } = collectDives(input);
  const preview = (dive: Converted, inLog: boolean): SsiDivePreview => ({
    ...dive.identity,
    key: dive.key,
    number: dive.number,
    siteName: dive.site?.name ?? '',
    buddy: dive.buddy,
    inLog,
  });
  return [...kept.map((dive) => preview(dive, false)), ...present.map((dive) => preview(dive, true))]
    .sort((a, b) => b.when - a.when);
}

/** Dives that exist in the log and not in SSI: what replacing the log would lose. */
export function countDivesOnlyInLog(
  existing: readonly ExistingDive[],
  ssi: readonly ExistingDive[],
): number {
  return existing.filter((dive) => !ssi.some((other) => isSameDive(dive, other))).length;
}

/** The result in a sentence, for the screen that ran the import. */
export function describeSsiImport(result: SsiToSsrfResult): string {
  const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;
  const parts = [`${count(result.dives, 'dive')} added.`];
  if (result.alreadyPresent > 0) {
    parts.push(`${count(result.alreadyPresent, 'dive')} already in the logbook.`);
  }
  if (result.duplicates > 0) {
    parts.push(`${count(result.duplicates, 'duplicate')} in SSI skipped.`);
  }
  if (result.unreadable > 0) {
    parts.push(`${count(result.unreadable, 'record')} had no usable date and could not be read.`);
  }
  return parts.join(' ');
}
