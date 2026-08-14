// AI-generated (Claude)
// Public TypeScript API of the ssrf-core native module.
//
// Everything here is a thin typed wrapper over a single native entry point
// (`call(method, argsJson)`). The native module owns the in-memory divelog;
// this file holds no state.
//
// All values are the core's raw integer units - see SsrfCore.types.ts.
import SsrfCoreModule from './SsrfCoreModule';
import {
  SsrfCoreError,
  type Dive,
  type DivePatch,
  type DiveSite,
  type DiveSiteInput,
  type DiveSummary,
  type ImportResult,
  type LoadResult,
  type PlotInfo,
  type SaveResult,
  type StatsFilter,
  type StatsSummary,
} from './SsrfCore.types';

export * from './SsrfCore.types';

type Envelope<T> =
  { ok: true; result: T; errors?: string[] } | { ok: false; error: string; errors?: string[] };

function call<T>(method: string, args: Record<string, unknown> = {}): T {
  const reply = JSON.parse(SsrfCoreModule.call(method, JSON.stringify(args))) as Envelope<T>;
  if (!reply.ok) {
    throw new SsrfCoreError(reply.error, reply.errors ?? []);
  }
  return reply.result;
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Buffers cross the JSI boundary as base64 inside the JSON argument object.
// Hand-rolled because React Native has no Buffer and btoa does not take bytes.
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += BASE64_ALPHABET[(chunk >> 18) & 63];
    out += BASE64_ALPHABET[(chunk >> 12) & 63];
    out += i + 1 < bytes.length ? BASE64_ALPHABET[(chunk >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? BASE64_ALPHABET[chunk & 63] : '=';
  }
  return out;
}

function sourceArgs(pathOrBuffer: string | ArrayBuffer): Record<string, unknown> {
  return typeof pathOrBuffer === 'string'
    ? { path: pathOrBuffer }
    : { base64: toBase64(pathOrBuffer) };
}

// --- Logbook I/O -----------------------------------------------------------

/**
 * Parses an SSRF/XML logbook into the module's in-memory divelog, replacing
 * whatever was loaded before. Dive ids are reassigned on every load.
 */
export function loadFromXML(pathOrBuffer: string | ArrayBuffer): LoadResult {
  return call<LoadResult>('loadFromXML', sourceArgs(pathOrBuffer));
}

/**
 * Serializes the current divelog to `path`. The write is atomic: the core
 * writes `path.tmp` first and renames it into place.
 */
export function saveToXML(path: string): SaveResult {
  return call<SaveResult>('saveToXML', { path });
}

/** Drops the in-memory divelog. */
export function clear(): void {
  call<Record<string, never>>('clear');
}

/**
 * Imports a Suunto DM4 or DM5 database into the current divelog, merging with
 * the dives already loaded.
 */
export function importSuunto(pathOrBuffer: string | ArrayBuffer): ImportResult {
  return call<ImportResult>('importSuunto', sourceArgs(pathOrBuffer));
}

// --- Reads -----------------------------------------------------------------

export function listDives(): DiveSummary[] {
  return call<DiveSummary[]>('listDives');
}

export function getDive(id: number): Dive {
  return call<Dive>('getDive', { id });
}

/** Builds the plotted profile of one divecomputer (index 0 by default). */
export function getProfile(id: number, dcIndex = 0): PlotInfo {
  return call<PlotInfo>('getProfile', { id, dcIndex });
}

export function getStatistics(filter?: StatsFilter): StatsSummary {
  return call<StatsSummary>('getStatistics', filter ? { filter } : {});
}

export function listDiveSites(): DiveSite[] {
  return call<DiveSite[]>('listDiveSites');
}

/** Messages the C++ core reported during the previous call, joined with "; ". */
export function getLastError(): string {
  return call<string>('getLastError');
}

// --- Writes ----------------------------------------------------------------

/** Creates a site (no uuid) or updates the named one. Returns the uuid. */
export function upsertDiveSite(site: DiveSiteInput): number {
  return call<{ uuid: number }>('upsertDiveSite', site as Record<string, unknown>).uuid;
}

/** Removes a site and detaches every dive that referenced it. */
export function deleteDiveSite(uuid: number): void {
  call<{ sites: number }>('deleteDiveSite', { uuid });
}

/** Applies a partial update; absent fields are left alone. */
export function updateDive(id: number, patch: DivePatch): Dive {
  return call<Dive>('updateDive', { id, patch });
}

// `plotPressureAt` is re-exported from ./SsrfCore.types by the `export *` above:
// it is pure arithmetic over a reply, so it must stay importable without
// pulling in the native module (the Node test suite does exactly that).

// The task 02/03 smoke units (add, smokeSerializeMinimalLog,
// smokeCountDivesInFile) are still exposed by the native module, but no longer
// wrapped here: the app screens that called them went away with the template in
// task 07, and everything they proved is covered by the API above.

export default SsrfCoreModule;
