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
  type BleScanStatus,
  type CorePreferences,
  type Cylinder,
  type CoreEvent,
  type CsvExportOptions,
  type CsvExportResult,
  type DeleteDiveResult,
  type Dive,
  type DivePatch,
  type NewDiveInput,
  type DiveSite,
  type DiveSiteInput,
  type DiveSummary,
  type DiveComputerIdentity,
  type DiveComputerVendor,
  type DownloadOptions,
  type DownloadStatus,
  type GradientFactors,
  type HistoryState,
  type HistoryStepResult,
  type ImportResult,
  type LoadResult,
  type NitroxPlan,
  type NitroxPlanInput,
  type GasInfo,
  type GasInfoInput,
  type PlanInput,
  type PlannerOptions,
  type PlannerSurface,
  type PlanResult,
  type SavePlanResult,
  type PlotInfo,
  type MergePair,
  type MergePreview,
  type MergeResult,
  type SaveResult,
  type StatsChartRequest,
  type StatsChartResult,
  type StatsFilter,
  type StatsSummary,
  type RemoveFromTripResult,
  type Trip,
  type TripPatch,
  type UngroupResult,
} from './SsrfCore.types';

export * from './SsrfCore.types';

type Envelope<T> = (
  { ok: true; result: T; errors?: string[] } | { ok: false; error: string; errors?: string[] }
) & { history?: HistoryState };

const historyListeners = new Set<(state: HistoryState) => void>();

/**
 * Told whenever the undo history changes, whichever call changed it: the reply of any
 * method carries the new state if it did, so a new mutation needs nothing here.
 */
export function subscribeHistory(listener: (state: HistoryState) => void): () => void {
  historyListeners.add(listener);
  return () => {
    historyListeners.delete(listener);
  };
}

function call<T>(method: string, args: Record<string, unknown> = {}): T {
  const reply = JSON.parse(SsrfCoreModule.call(method, JSON.stringify(args))) as Envelope<T>;
  if (reply.history) {
    for (const listener of historyListeners) {
      listener(reply.history);
    }
  }
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

/**
 * Writes one dive to `path` as CSV, in one of the formats desktop Subsurface's
 * export dialog offers. The writers are the core's own, so the file matches a
 * desktop export of the same dive byte for byte. See api.cpp, export_dive_csv().
 */
export function exportDiveCSV(
  id: number,
  path: string,
  { format, imperial = false, units, gf }: CsvExportOptions,
): CsvExportResult {
  return call<CsvExportResult>('exportDiveCSV', {
    id,
    path,
    format,
    units: imperial ? 1 : 0,
    ...(units ? { unitPrefs: units } : {}),
    ...gf,
  });
}

/** Drops the in-memory divelog. */
export function clear(): void {
  call<Record<string, never>>('clear');
}

/**
 * Imports a Suunto DM4 or DM5 database into the current divelog, merging with
 * the dives already loaded. `importFile` handles the same files and everything
 * else besides; this stays for callers that want the format pinned.
 */
export function importSuunto(pathOrBuffer: string | ArrayBuffer): ImportResult {
  return call<ImportResult>('importSuunto', sourceArgs(pathOrBuffer));
}

/**
 * Merges a file of any supported format into the current divelog, keeping the
 * dives already loaded. The format is detected from the contents, not the name:
 *
 *  - a Suunto DM4/DM5 sqlite database (`.db`, `.sql`)
 *  - a zip archive of dive documents (`.sde`, `.dld`, `.zip`)
 *  - XML: SSRF logbooks, and every format the core's XSLT table covers
 *    (Suunto DM4 / DM3 SDM, UDDF, MacDive, DivingLog, ...)
 *
 * Importing the same file twice merges rather than duplicates: the core matches
 * dives it already has, which is what `merged` in the reply counts.
 *
 * Note that this does not save - the caller persists the logbook afterwards.
 */
export function importFile(pathOrBuffer: string | ArrayBuffer): ImportResult {
  return call<ImportResult>('importFile', sourceArgs(pathOrBuffer));
}

/**
 * Points the core at the directory holding the XSLT stylesheets, which is how
 * every non-SSRF XML format is read. The native module does this once by itself
 * with the stylesheets it ships (see `modules/ssrf-core/resources/xslt`); the
 * Node test harness calls it with the submodule's copy.
 */
export function configure(paths: { xsltDir: string }): void {
  call<{ xsltDir: string }>('configure', paths);
}

/**
 * Hands the core the app's preferences it reads itself (see CorePreferences).
 * Kept in the core's global `prefs`, so it lasts until the next call.
 */
export function configurePreferences(preferences: CorePreferences): void {
  call('configure', preferences);
}

/**
 * A new cylinder as the core makes one with the default cylinder set
 * (`create_new_cylinder()`): the type's size and working pressure, filled to it,
 * air. Null when no default cylinder is set.
 */
export function defaultCylinder(): Cylinder | null {
  return call<Cylinder | null>('defaultCylinder');
}

// --- Reads -----------------------------------------------------------------

export function listDives(): DiveSummary[] {
  return call<DiveSummary[]>('listDives');
}

export function getDive(id: number): Dive {
  return call<Dive>('getDive', { id });
}

/**
 * Builds the plotted profile of one divecomputer (index 0 by default).
 *
 * `gf` sets the gradient factors the deco ceiling is computed with; omitted, the
 * core's 30/75 apply. They ride on the call because the core keeps them in a
 * global that the last caller wins - see cpp/API.md.
 */
export function getProfile(id: number, dcIndex = 0, gf?: GradientFactors): PlotInfo {
  return call<PlotInfo>('getProfile', { id, dcIndex, ...gf });
}

/**
 * Aggregate statistics over the dives the filter matches. The aggregation runs
 * in C++ (the core's statistics.cpp, plus `timeline` / `byDuration` /
 * `siteCount` from the bindings), so a narrowed filter is recomputed there
 * rather than by filtering rows in JS - which is what keeps the numbers
 * identical to desktop Subsurface's.
 */
export function getStatistics(filter?: StatsFilter): StatsSummary {
  return call<StatsSummary>('getStatistics', filter ? { filter } : {});
}

/**
 * One chart of the configurable statistics, and what its choices allow. The variables,
 * binners, operations and valid combinations are the desktop's own, compiled from
 * stats/statsvariables.cpp and stats/statsstate.cpp; see cpp/API.md.
 */
export function statsChart(request: StatsChartRequest = {}): StatsChartResult {
  return call<StatsChartResult>('statsChart', request);
}

/**
 * Nitrox calculator: MOD, best mix, pO2 and the no-decompression limit of a
 * square dive on the mix and on air. Pure core math (gas_mod, best_o2 and the
 * Buehlmann model in deco.cpp); it reads nothing from the logbook.
 */
export function nitroxPlan(input: NitroxPlanInput): NitroxPlan {
  return call<NitroxPlan>('nitroxPlan', input);
}

/**
 * Runs the core's plan() and returns the result, notes included. Touches nothing
 * in the logbook, though the dives before `when` are part of the calculation.
 */
export function planDive(input: PlanInput): PlanResult {
  return call<PlanResult>('planDive', input);
}

/** Plans again and adds the result to the logbook as a planned dive. */
export function savePlan(input: PlanInput): SavePlanResult {
  return call<SavePlanResult>('savePlan', input);
}

/** MOD and END or EAD per pO2 for one mix, and optionally the best mix for a depth. */
export function gasInfo(input: GasInfoInput): GasInfo {
  return call<GasInfo>('gasInfo', input);
}

/** The core's table of cylinder types. */
export function plannerOptions(): PlannerOptions {
  return call<PlannerOptions>('plannerOptions');
}

/** Altitude to surface pressure or back, whichever is given. */
export function plannerSurface(
  input: { altitudeMm: number } | { surfacePressureMbar: number },
): PlannerSurface {
  return call<PlannerSurface>('plannerSurface', input);
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

/**
 * Applies a partial update; absent fields are left alone. `historyKind` files the
 * change under something other than an edit, for one the diver did not make as such.
 */
export function updateDive(id: number, patch: DivePatch, historyKind?: string): Dive {
  return call<Dive>('updateDive', { id, patch, ...(historyKind ? { historyKind } : {}) });
}

/**
 * Adds a dive by hand, on a dive computer called "manually added dive", with a
 * profile the core draws from the figures. Numbered as the core numbers a new dive.
 */
export function addDive(input: NewDiveInput): Dive {
  return call<Dive>('addDive', input);
}

/** The dive `addDive(input)` would add, without adding it. */
export function previewNewDive(input: NewDiveInput): Dive {
  return call<Dive>('previewNewDive', input);
}

/** Takes the log back to before the newest change. Throws if there is none. */
export function undo(): HistoryStepResult {
  return call<HistoryStepResult>('undo');
}

/** Puts back the change last undone. Throws if there is none. */
export function redo(): HistoryStepResult {
  return call<HistoryStepResult>('redo');
}

export function getHistoryState(): HistoryState {
  return call<HistoryState>('historyState');
}

/** Forgets the history, for changes that came from elsewhere (a git sync's merge). */
export function clearHistory(): void {
  call<HistoryState>('clearHistory');
}

/**
 * Removes a dive, detaching it from its dive site and its trip on the way out.
 * A trip this was the last dive of goes with it. See api.cpp, delete_dive().
 */
export function deleteDive(id: number): DeleteDiveResult {
  return call<DeleteDiveResult>('deleteDive', { id });
}

/**
 * The dive as `updateDive(id, patch)` would leave it, without applying it.
 *
 * This is a read: the log is untouched and `siteUuid` is ignored. It exists so
 * the editor can show the SAC rate that follows from the cylinder sizes and
 * pressures being typed, computed by the core rather than by a second
 * implementation of gas compressibility in TypeScript. See api.cpp,
 * preview_dive().
 */
export function previewDive(id: number, patch: DivePatch): Dive {
  return call<Dive>('previewDive', { id, patch });
}

/**
 * Takes every dive out of its trip and drops the trips. For logbooks a build
 * that still autogrouped has written trips into - the app cannot recognise
 * those on its own, so this is the user's undo. See api.cpp, ungroup_dives().
 */
export function ungroupDives(): UngroupResult {
  return call<UngroupResult>('ungroupDives');
}

// --- Downloading from a dive computer ---------------------------------------
//
// The download runs on a native thread into a log of its own. Nothing touches
// the logbook until dcDownloadAccept merges the selected dives.

/** Every dive computer the app can reach, by vendor. */
export function dcListComputers(): DiveComputerVendor[] {
  return call<DiveComputerVendor[]>('dcListComputers');
}

/** Which dive computer a Bluetooth name belongs to, or null. */
export function dcDetect(name: string): DiveComputerIdentity | null {
  return call<DiveComputerIdentity | null>('dcDetect', { name });
}

/** Where the downloader keeps its fingerprint cache and its log. */
export function configureDownloads(dataDir: string): void {
  call('configure', { dataDir });
}

export function dcDownloadStart(options: DownloadOptions): void {
  call('dcDownloadStart', options);
}

/** The whole state of the session; onCoreEvent says when it is worth asking. */
export function dcDownloadStatus(): DownloadStatus {
  return call<DownloadStatus>('dcDownloadStatus');
}

export function dcDownloadCancel(): void {
  call('dcDownloadCancel');
}

/**
 * Merges the selected dives into the logbook and ends the session. As an import,
 * this is not on disk until the caller persists it.
 */
export function dcDownloadAccept(indices: number[]): ImportResult {
  return call<ImportResult>('dcDownloadAccept', { indices });
}

export function dcDownloadDiscard(): void {
  call('dcDownloadDiscard');
}

/** `knownAddresses`: dive computers that may have stopped advertising once bonded. */
export function bleScanStart(knownAddresses: string[] = []): void {
  call('bleScanStart', { knownAddresses });
}

export function bleScanStop(): void {
  call('bleScanStop');
}

export function bleScanStatus(): BleScanStatus {
  return call<BleScanStatus>('bleScanStatus');
}

/** Native pushes: download progress, scan results, the state of the adapter. */
export function addCoreEventListener(listener: (event: CoreEvent) => void): { remove(): void } {
  return SsrfCoreModule.addListener('onCoreEvent', ({ json }: { json: string }) => {
    listener(JSON.parse(json) as CoreEvent);
  });
}

/** Every trip that has dives, oldest first. */
export function listTrips(): Trip[] {
  return call<Trip[]>('listTrips');
}

/**
 * A new trip holding these dives, which leave any trip they were in. Named after
 * the site of the oldest dive unless `location` is given.
 */
export function createTrip(diveIds: number[], location?: string): Trip {
  return call<Trip>('createTrip', location === undefined ? { diveIds } : { diveIds, location });
}

/** Moves dives into a trip. A trip left without dives goes away. */
export function addDivesToTrip(diveIds: number[], tripId: number): Trip {
  return call<Trip>('addDivesToTrip', { diveIds, tripId });
}

/**
 * Takes dives out of their trips and marks them not to be grouped again. A trip
 * left without dives goes away, its location and notes with it.
 */
export function removeDivesFromTrip(diveIds: number[]): RemoveFromTripResult {
  return call<RemoveFromTripResult>('removeDivesFromTrip', { diveIds });
}

/** Applies a partial update to a trip's location and notes. */
export function updateTrip(id: number, patch: TripPatch): Trip {
  return call<Trip>('updateTrip', { id, ...patch });
}

/** The neighbouring dives that can be merged, oldest first. */
export function listMergePairs(): MergePair[] {
  return call<MergePair[]>('listMergePairs');
}

/** What mergeDives() would leave behind. A read: nothing changes. */
export function previewMerge(diveIds: number[]): MergePreview {
  return call<MergePreview>('previewMerge', { diveIds });
}

/**
 * Replaces neighbouring dives with one merged dive, which has a new id. Numbers
 * of later dives can change, and a trip left without dives goes away. There is no
 * undo. See api.cpp, merge_dives().
 */
export function mergeDives(diveIds: number[]): MergeResult {
  return call<MergeResult>('mergeDives', { diveIds });
}

/**
 * Moves dive computer `dcIndex` to the front of the dive, desktop's "Make first dive
 * computer". The dive keeps its id; what reads the first computer (the summary's mode,
 * SSI upload, CSV export) reads this one afterwards. Index 0 changes nothing; an index
 * out of range throws. Undoable. See api.cpp, make_first_dive_computer().
 */
export function makeFirstDiveComputer(id: number, dcIndex: number): Dive {
  return call<Dive>('makeFirstDiveComputer', { id, dcIndex });
}

// `plotPressureAt` is re-exported from ./SsrfCore.types by the `export *` above:
// it is pure arithmetic over a reply, so it must stay importable without
// pulling in the native module (the Node test suite does exactly that).

// The task 02/03 smoke units (add, smokeSerializeMinimalLog,
// smokeCountDivesInFile) are still exposed by the native module, but no longer
// wrapped here: the app screens that called them went away with the template in
// task 07, and everything they proved is covered by the API above.

export default SsrfCoreModule;

/**
 * Android only: copies a `content://` file (what "Open with" hands the app)
 * into the cache under its display name and returns the plain path the core
 * can read. Throws on any other platform, where no such URL arrives.
 */
export function copyContentUri(uri: string): Promise<string> {
  if (!SsrfCoreModule.copyContentUri) {
    throw new Error('copyContentUri is only available on Android');
  }
  return SsrfCoreModule.copyContentUri(uri);
}
