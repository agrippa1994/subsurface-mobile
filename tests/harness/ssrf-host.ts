// AI-generated (Claude)
// vitest harness for the ssrf-core native module.
//
// The tests must exercise the *same* bindings the app runs, not a TypeScript
// reimplementation of them. modules/ssrf-core/scripts/build-host.sh compiles
// the identical cpp/ tree (vendored core + shim + cpp/bindings) for macOS and
// links tests/main.cpp; its `repl` subcommand speaks the same
// `call(method, argsJson) -> envelope` protocol that the JSI bridge speaks.
// This file drives that binary over a pipe.
//
// One process per test file, because the divelog lives in the process: loading
// a logbook and then querying it has to happen in the same one.

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface, type Interface } from 'node:readline';

import type {
  CsvExportOptions,
  CsvExportResult,
  DeleteDiveResult,
  Dive,
  DivePatch,
  DiveSite,
  DiveSiteInput,
  DiveSummary,
  GradientFactors,
  HistoryState,
  HistoryStepResult,
  ImportResult,
  LoadResult,
  NewDiveInput,
  NitroxPlan,
  NitroxPlanInput,
  GasInfo,
  GasInfoInput,
  PlanInput,
  PlannerOptions,
  PlannerSurface,
  PlanResult,
  SavePlanResult,
  PlotInfo,
  SaveResult,
  StatsChartRequest,
  StatsChartResult,
  StatsFilter,
  StatsSummary,
  RemoveFromTripResult,
  Trip,
  TripPatch,
  UngroupResult,
  MergePair,
  MergePreview,
  MergeResult,
} from '../../src/models';
import { SsrfCoreError } from '../../src/models';
import { HOST_BINARY, XSLT_DIR } from './fixtures';

type Envelope<T> =
  | { ok: true; result: T; errors?: string[] }
  | { ok: false; error: string; errors?: string[] };

/**
 * A running host binary. Mirrors modules/ssrf-core/src/index.ts method by
 * method, except that every call is async - the reply comes back over a pipe
 * rather than over JSI.
 */
export class SsrfHost {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly lines: Interface;
  private readonly pending: ((line: string) => void)[] = [];
  private stderr = '';
  private exited?: string;

  constructor(binary: string = HOST_BINARY) {
    this.child = spawn(binary, ['repl'], { stdio: ['pipe', 'pipe', 'pipe'] });
    this.lines = createInterface({ input: this.child.stdout });
    this.lines.on('line', (line) => this.pending.shift()?.(line));
    this.child.stderr.on('data', (chunk: Buffer) => {
      this.stderr += chunk.toString();
    });
    this.child.on('exit', (code, signal) => {
      this.exited = `ssrf-smoke exited (code ${code}, signal ${signal})\n${this.stderr}`;
      // Unblock anything still waiting rather than hanging the test run.
      while (this.pending.length > 0) {
        this.pending.shift()?.(JSON.stringify({ ok: false, error: this.exited }));
      }
    });
  }

  /** Runs one API method. Throws SsrfCoreError when the core reports failure. */
  async call<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
    if (this.exited) {
      throw new Error(this.exited);
    }
    const line = await new Promise<string>((resolve) => {
      this.pending.push(resolve);
      this.child.stdin.write(`${method}\t${JSON.stringify(args)}\n`);
    });
    const reply = JSON.parse(line) as Envelope<T>;
    if (!reply.ok) {
      throw new SsrfCoreError(reply.error, reply.errors ?? []);
    }
    return reply.result;
  }

  /**
   * Whatever the binary wrote to stderr, which for a sanitizer build is where
   * a report lands. Empty for a clean run.
   */
  get diagnostics(): string {
    return this.stderr;
  }

  async close(): Promise<void> {
    this.child.stdin.end();
    this.lines.close();
    await new Promise<void>((resolve) => {
      if (this.exited) {
        resolve();
        return;
      }
      this.child.on('exit', () => resolve());
    });
  }

  // --- The module API, one wrapper per method ------------------------------

  undo(): Promise<HistoryStepResult> {
    return this.call<HistoryStepResult>('undo');
  }

  redo(): Promise<HistoryStepResult> {
    return this.call<HistoryStepResult>('redo');
  }

  historyState(): Promise<HistoryState> {
    return this.call<HistoryState>('historyState');
  }

  clearHistory(): Promise<HistoryState> {
    return this.call<HistoryState>('clearHistory');
  }

  loadFromXML(path: string): Promise<LoadResult> {
    return this.call<LoadResult>('loadFromXML', { path });
  }

  saveToXML(path: string): Promise<SaveResult> {
    return this.call<SaveResult>('saveToXML', { path });
  }

  exportDiveCSV(
    id: number,
    path: string,
    { format, imperial = false, gf }: CsvExportOptions,
  ): Promise<CsvExportResult> {
    return this.call<CsvExportResult>('exportDiveCSV', {
      id,
      path,
      format,
      units: imperial ? 1 : 0,
      ...gf,
    });
  }

  clear(): Promise<Record<string, never>> {
    return this.call<Record<string, never>>('clear');
  }

  importSuunto(path: string): Promise<ImportResult> {
    return this.call<ImportResult>('importSuunto', { path });
  }

  importFile(path: string): Promise<ImportResult> {
    return this.call<ImportResult>('importFile', { path });
  }

  /**
   * Points the core at the stylesheets. On device the native module does this
   * itself with the copy it bundles; here they come out of the submodule, so a
   * test can never pass against a stale vendored copy.
   */
  configure(xsltDir: string = XSLT_DIR): Promise<{ xsltDir: string }> {
    return this.call<{ xsltDir: string }>('configure', { xsltDir });
  }

  listDives(): Promise<DiveSummary[]> {
    return this.call<DiveSummary[]>('listDives');
  }

  ungroupDives(): Promise<UngroupResult> {
    return this.call<UngroupResult>('ungroupDives');
  }

  listTrips(): Promise<Trip[]> {
    return this.call<Trip[]>('listTrips');
  }

  createTrip(diveIds: number[], location?: string): Promise<Trip> {
    return this.call<Trip>('createTrip', location === undefined ? { diveIds } : { diveIds, location });
  }

  addDivesToTrip(diveIds: number[], tripId: number): Promise<Trip> {
    return this.call<Trip>('addDivesToTrip', { diveIds, tripId });
  }

  removeDivesFromTrip(diveIds: number[]): Promise<RemoveFromTripResult> {
    return this.call<RemoveFromTripResult>('removeDivesFromTrip', { diveIds });
  }

  updateTrip(id: number, patch: TripPatch): Promise<Trip> {
    return this.call<Trip>('updateTrip', { id, ...patch });
  }

  listMergePairs(): Promise<MergePair[]> {
    return this.call<MergePair[]>('listMergePairs');
  }

  previewMerge(diveIds: number[]): Promise<MergePreview> {
    return this.call<MergePreview>('previewMerge', { diveIds });
  }

  mergeDives(diveIds: number[]): Promise<MergeResult> {
    return this.call<MergeResult>('mergeDives', { diveIds });
  }

  makeFirstDiveComputer(id: number, dcIndex: number): Promise<Dive> {
    return this.call<Dive>('makeFirstDiveComputer', { id, dcIndex });
  }

  getDive(id: number): Promise<Dive> {
    return this.call<Dive>('getDive', { id });
  }

  getProfile(id: number, dcIndex = 0, gf?: GradientFactors): Promise<PlotInfo> {
    return this.call<PlotInfo>('getProfile', { id, dcIndex, ...gf });
  }

  getStatistics(filter?: StatsFilter): Promise<StatsSummary> {
    return this.call<StatsSummary>('getStatistics', filter ? { filter } : {});
  }

  statsChart(request: StatsChartRequest = {}): Promise<StatsChartResult> {
    return this.call<StatsChartResult>('statsChart', request);
  }

  nitroxPlan(input: NitroxPlanInput): Promise<NitroxPlan> {
    return this.call<NitroxPlan>('nitroxPlan', input);
  }

  planDive(input: PlanInput): Promise<PlanResult> {
    return this.call<PlanResult>('planDive', input);
  }

  savePlan(input: PlanInput): Promise<SavePlanResult> {
    return this.call<SavePlanResult>('savePlan', input);
  }

  gasInfo(input: GasInfoInput): Promise<GasInfo> {
    return this.call<GasInfo>('gasInfo', input);
  }

  plannerOptions(): Promise<PlannerOptions> {
    return this.call<PlannerOptions>('plannerOptions');
  }

  plannerSurface(
    input: { altitudeMm: number } | { surfacePressureMbar: number },
  ): Promise<PlannerSurface> {
    return this.call<PlannerSurface>('plannerSurface', input);
  }

  listDiveSites(): Promise<DiveSite[]> {
    return this.call<DiveSite[]>('listDiveSites');
  }

  upsertDiveSite(site: DiveSiteInput): Promise<{ uuid: number }> {
    return this.call<{ uuid: number }>('upsertDiveSite', site as Record<string, unknown>);
  }

  deleteDiveSite(uuid: number): Promise<{ sites: number }> {
    return this.call<{ sites: number }>('deleteDiveSite', { uuid });
  }

  addDive(input: NewDiveInput): Promise<Dive> {
    return this.call<Dive>('addDive', input);
  }

  previewNewDive(input: NewDiveInput): Promise<Dive> {
    return this.call<Dive>('previewNewDive', input);
  }

  updateDive(id: number, patch: DivePatch): Promise<Dive> {
    return this.call<Dive>('updateDive', { id, patch });
  }

  deleteDive(id: number): Promise<DeleteDiveResult> {
    return this.call<DeleteDiveResult>('deleteDive', { id });
  }

  previewDive(id: number, patch: DivePatch): Promise<Dive> {
    return this.call<Dive>('previewDive', { id, patch });
  }
}
