// AI-generated (Claude)
// The dive planner, minus the rendering.
//
// Holds the plan the diver is editing and turns it into the arguments of
// `planDive`, then turns the reply into what a screen leads with. No decompression
// or gas physics here: every figure comes from the core's plan() through
// cpp/bindings/planner.cpp. Stops are read off the waypoints plan() added, and
// warnings out of the notes it wrote.

import type {
  DiveSummary,
  PlanInput,
  PlannedCylinder,
  PlanResult,
  PlanTank,
  PlanWaypoint,
} from './index';
import { CylinderUse, PlanDiveMode } from './index';
import { planNoteWarnings } from './plan-notes';
import { plannerSettingsInput, type PlannerSettings } from './planner-settings';
import {
  feetToMm,
  formatDepth,
  formatPressure,
  formatVolume,
  mbarToPsi,
  mmToFeet,
  psiToMbar,
  type UnitSystem,
} from './units';

// --- The draft ---------------------------------------------------------------

export type Water = 'salt' | 'en13319' | 'fresh';

/** Salinity in g/10l, the three options the legacy planner has. */
export const WATER_SALINITY: Record<Water, number> = { salt: 10300, en13319: 10200, fresh: 10000 };

export const WATER_OPTIONS: readonly { value: Water; label: string }[] = [
  { value: 'salt', label: 'Salt' },
  { value: 'fresh', label: 'Fresh' },
  { value: 'en13319', label: 'EN13319' },
];

export const DIVE_MODE_OPTIONS: readonly { value: PlanDiveMode; label: string }[] = [
  { value: PlanDiveMode.OpenCircuit, label: 'Open circuit' },
  { value: PlanDiveMode.Ccr, label: 'CCR' },
  { value: PlanDiveMode.Pscr, label: 'pSCR' },
];

export type PlanCylinderDraft = {
  key: string;
  /** The name in the core's table; also what the dive records if the plan is saved. */
  tank: string;
  sizeMl: number;
  fillMbar: number;
  o2Percent: number;
  hePercent: number;
  use: CylinderUse;
};

export type PlanSegmentDraft = {
  key: string;
  depthMm: number;
  minutes: number;
  /** A cylinder's key, so removing another cylinder does not move this one's gas. */
  cylinderKey: string;
  setpointMbar: number;
  /** On a pSCR dive, whether this segment is on the loop or open circuit. */
  onLoop: boolean;
};

export type PlanDraft = {
  /** Seconds, local wall clock as if UTC, like every `when` in the core. */
  when: number;
  diveMode: PlanDiveMode;
  water: Water;
  cylinders: PlanCylinderDraft[];
  segments: PlanSegmentDraft[];
};

let nextKey = 0;

function makeKey(prefix: string): string {
  nextKey += 1;
  return `${prefix}-${nextKey}`;
}

/** The working pressure a cylinder is filled to in the plan until the diver says otherwise. */
const DEFAULT_TANK: Record<UnitSystem, { name: string; sizeMl: number; fillMbar: number }> = {
  metric: { name: '12L 200 bar', sizeMl: 12000, fillMbar: 200000 },
  imperial: { name: 'AL80', sizeMl: 11094, fillMbar: psiToMbar(3000) },
};

export function newCylinderDraft(system: UnitSystem): PlanCylinderDraft {
  const tank = DEFAULT_TANK[system];
  return {
    key: makeKey('cyl'),
    tank: tank.name,
    sizeMl: tank.sizeMl,
    fillMbar: tank.fillMbar,
    o2Percent: 21,
    hePercent: 0,
    use: CylinderUse.OcGas,
  };
}

/**
 * setupStartTime() in the Qt model: an hour from now, or an hour after a dive that
 * ends later than that. `tzOffsetMin` is Date's own: minutes behind UTC.
 */
export function defaultPlanWhen(
  nowMs: number,
  tzOffsetMin: number,
  dives: readonly Pick<DiveSummary, 'when' | 'durationSec'>[] = [],
): number {
  const hourFromNow = Math.floor(nowMs / 1000) - tzOffsetMin * 60 + 3600;
  const lastEnd = dives.reduce((latest, dive) => Math.max(latest, dive.when + dive.durationSec), 0);
  const start = lastEnd + 3600 > hourFromNow ? lastEnd + 3600 : hourFromNow;
  // To the next five minutes: nobody plans a dive for 14:37.
  return Math.ceil(start / 300) * 300;
}

/**
 * A nothing-special dive that comes out clean under the core's defaults, which are
 * strict about minimum gas: a warning on the first screen would teach the wrong thing.
 */
export function defaultPlanDraft(system: UnitSystem, when: number): PlanDraft {
  const cylinder = newCylinderDraft(system);
  return {
    when,
    diveMode: PlanDiveMode.OpenCircuit,
    water: 'salt',
    cylinders: [cylinder],
    segments: [
      {
        key: makeKey('seg'),
        depthMm: system === 'imperial' ? feetToMm(50) : 15000,
        minutes: 20,
        cylinderKey: cylinder.key,
        setpointMbar: 0,
        onLoop: true,
      },
    ],
  };
}

// --- Editing -----------------------------------------------------------------

export const TIME_RANGE = { min: 1, max: 240, step: 1 } as const;

/** Well inside what the bindings accept: past this, plans run for days. */
export function depthRange(system: UnitSystem): { min: number; max: number; step: number } {
  return system === 'imperial' ? { min: 10, max: 500, step: 5 } : { min: 3, max: 150, step: 1 };
}

export function depthUnit(system: UnitSystem): string {
  return system === 'imperial' ? 'ft' : 'm';
}

/** The depth in the unit the stepper moves, snapped to its step. */
export function depthValue(depthMm: number, system: UnitSystem): number {
  const { step } = depthRange(system);
  return Math.round((system === 'imperial' ? mmToFeet(depthMm) : depthMm / 1000) / step) * step;
}

export function depthFromValue(value: number, system: UnitSystem): number {
  return system === 'imperial' ? feetToMm(value) : value * 1000;
}

export function fillRange(system: UnitSystem): { min: number; max: number; step: number } {
  return system === 'imperial' ? { min: 500, max: 4500, step: 100 } : { min: 50, max: 300, step: 10 };
}

export function fillValue(fillMbar: number, system: UnitSystem): number {
  const { step } = fillRange(system);
  return Math.round((system === 'imperial' ? mbarToPsi(fillMbar) : fillMbar / 1000) / step) * step;
}

export function fillFromValue(value: number, system: UnitSystem): number {
  return system === 'imperial' ? psiToMbar(value) : value * 1000;
}

/** A new level starts where the last one ended, like the plus button of the legacy table. */
export function addSegment(draft: PlanDraft): PlanDraft {
  const last = draft.segments[draft.segments.length - 1];
  return {
    ...draft,
    segments: [...draft.segments, { ...last, key: makeKey('seg'), minutes: 10 }],
  };
}

export function removeSegment(draft: PlanDraft, key: string): PlanDraft {
  if (draft.segments.length <= 1) {
    return draft;
  }
  return { ...draft, segments: draft.segments.filter((segment) => segment.key !== key) };
}

export function patchSegment(
  draft: PlanDraft,
  key: string,
  patch: Partial<PlanSegmentDraft>,
): PlanDraft {
  return {
    ...draft,
    segments: draft.segments.map((segment) =>
      segment.key === key ? { ...segment, ...patch } : segment,
    ),
  };
}

export function addCylinder(draft: PlanDraft, cylinder: PlanCylinderDraft): PlanDraft {
  return { ...draft, cylinders: [...draft.cylinders, cylinder] };
}

export function patchCylinder(
  draft: PlanDraft,
  key: string,
  patch: Partial<PlanCylinderDraft>,
): PlanDraft {
  return {
    ...draft,
    cylinders: draft.cylinders.map((cylinder) => {
      if (cylinder.key !== key) {
        return cylinder;
      }
      const next = { ...cylinder, ...patch };
      // Whichever was just changed stays what was asked for; the other gives way.
      if (next.o2Percent + next.hePercent > 100) {
        if (patch.hePercent !== undefined) {
          next.o2Percent = 100 - next.hePercent;
        } else {
          next.hePercent = 100 - next.o2Percent;
        }
      }
      return next;
    }),
  };
}

/** A cylinder a level breathes from stays, so a plan never points at nothing. */
export function cylinderInUse(draft: PlanDraft, key: string): boolean {
  return draft.segments.some((segment) => segment.cylinderKey === key);
}

export function removeCylinder(draft: PlanDraft, key: string): PlanDraft {
  if (draft.cylinders.length <= 1 || cylinderInUse(draft, key)) {
    return draft;
  }
  return { ...draft, cylinders: draft.cylinders.filter((cylinder) => cylinder.key !== key) };
}

/**
 * Choosing a tank takes its size, and its working pressure as the fill: the core's
 * table has no pressure for its bare-size entries ("10.0L"), which keep the fill.
 */
export function tankPatch(tank: PlanTank): Partial<PlanCylinderDraft> {
  return {
    tank: tank.name,
    sizeMl: tank.sizeMl,
    ...(tank.workingPressureMbar > 0 ? { fillMbar: tank.workingPressureMbar } : {}),
  };
}

/** What changing the dive's mode does: a closed loop has to have a diluent, and vice versa. */
export function setDiveMode(draft: PlanDraft, diveMode: PlanDiveMode): PlanDraft {
  const needsDiluent = diveMode === PlanDiveMode.Ccr;
  const hasDiluent = draft.cylinders.some((cylinder) => cylinder.use === CylinderUse.Diluent);
  const firstKey = draft.segments[0].cylinderKey;
  return {
    ...draft,
    diveMode,
    cylinders: draft.cylinders.map((cylinder) => {
      if (needsDiluent && !hasDiluent && cylinder.key === firstKey) {
        return { ...cylinder, use: CylinderUse.Diluent };
      }
      if (!needsDiluent && cylinder.use === CylinderUse.Diluent) {
        return { ...cylinder, use: CylinderUse.OcGas };
      }
      return cylinder;
    }),
  };
}

export const GAS_PRESETS: readonly { label: string; o2: number; he: number }[] = [
  { label: 'Air', o2: 21, he: 0 },
  { label: 'EAN32', o2: 32, he: 0 },
  { label: 'EAN36', o2: 36, he: 0 },
  { label: 'EAN50', o2: 50, he: 0 },
  { label: 'Oxygen', o2: 100, he: 0 },
  { label: 'Trimix 21/35', o2: 21, he: 35 },
  { label: 'Trimix 18/45', o2: 18, he: 45 },
];

export function gasName(o2Percent: number, hePercent: number): string {
  if (hePercent > 0) {
    return `Trimix ${o2Percent}/${hePercent}`;
  }
  if (o2Percent === 21) {
    return 'Air';
  }
  return o2Percent === 100 ? 'Oxygen' : `EAN${o2Percent}`;
}

export function cylinderSummary(cylinder: PlanCylinderDraft, system: UnitSystem): string {
  return `${gasName(cylinder.o2Percent, cylinder.hePercent)} · ${cylinder.tank} · ${formatPressure(cylinder.fillMbar, system)}`;
}

// --- Draft to arguments --------------------------------------------------------

/** Whole percents, so this is the desktop's sanitize_gasmix(): 21% with no helium is air. */
function o2Permille(cylinder: PlanCylinderDraft): number {
  return cylinder.o2Percent === 21 && cylinder.hePercent === 0 ? 0 : cylinder.o2Percent * 10;
}

export function planInput(
  draft: PlanDraft,
  settings: PlannerSettings,
  system: UnitSystem,
  gf: { gfLow: number; gfHigh: number },
): PlanInput {
  const index = new Map(draft.cylinders.map((cylinder, i) => [cylinder.key, i]));
  const defaultSetpoint = settings.defaultSetpointMbar;
  return {
    ...plannerSettingsInput(settings, system, gf),
    when: draft.when,
    diveMode: draft.diveMode,
    salinity: WATER_SALINITY[draft.water],
    surfacePressureMbar: settings.surfacePressureMbar,
    cylinders: draft.cylinders.map((cylinder) => ({
      description: cylinder.tank,
      sizeMl: cylinder.sizeMl,
      pressureMbar: cylinder.fillMbar,
      o2Permille: o2Permille(cylinder),
      hePermille: cylinder.hePercent * 10,
      use: cylinder.use,
    })),
    segments: draft.segments.map((segment) => ({
      depthMm: segment.depthMm,
      durationSec: segment.minutes * 60,
      cylinder: index.get(segment.cylinderKey) ?? 0,
      setpointMbar: segment.setpointMbar || defaultSetpoint,
      diveMode: draft.diveMode === PlanDiveMode.Pscr && !segment.onLoop ? PlanDiveMode.OpenCircuit : draft.diveMode,
    })),
  };
}

/** What the bindings would refuse, said in the diver's terms before asking. */
export function draftProblem(
  draft: PlanDraft,
  settings: PlannerSettings,
  system: UnitSystem,
): string | null {
  const first = draft.segments[0];
  if (settings.dropStone && settings.descrate > 0) {
    const descentSec = first.depthMm / settings.descrate;
    if (first.minutes * 60 < Math.floor(descentSec)) {
      return `The first level is shorter than the ${Math.ceil(descentSec / 60)} min descent to ${formatDepth(first.depthMm, system)}. Give it more time, or a shallower depth.`;
    }
  }
  return null;
}

// --- The reply -----------------------------------------------------------------

/** Whether plan() got as far as an ascent, so that there is something to show. */
export function planHasResult(result: PlanResult): boolean {
  return result.error === 'ok' || result.error === 'recreationalExceedsNdl';
}

/** The bindings refuse to save anything else. */
export function planCanBeSaved(result: PlanResult): boolean {
  return result.error === 'ok';
}

export type PlanStop = {
  depthMm: number;
  durationSec: number;
  /** When the stop ends, on the dive's clock. */
  endSec: number;
  gas: string;
};

function gasOf(result: PlanResult, waypoint: PlanWaypoint): string {
  return result.cylinders[waypoint.cylinder]?.name ?? 'Air';
}

/**
 * The stops, read off plan()'s waypoints: a point the core added, at the depth of
 * the point before it, with time between them. The surface segment is not a stop.
 */
export function planStops(result: PlanResult): PlanStop[] {
  const stops: PlanStop[] = [];
  let previous: PlanWaypoint | null = null;
  for (const waypoint of result.waypoints) {
    if (
      previous !== null &&
      !waypoint.entered &&
      waypoint.depthMm > 0 &&
      waypoint.depthMm === previous.depthMm &&
      waypoint.timeSec > previous.timeSec
    ) {
      const durationSec = waypoint.timeSec - previous.timeSec;
      const gas = gasOf(result, waypoint);
      const last = stops[stops.length - 1];
      if (last && last.depthMm === waypoint.depthMm && last.gas === gas) {
        last.durationSec += durationSec;
        last.endSec = waypoint.timeSec;
      } else {
        stops.push({ depthMm: waypoint.depthMm, durationSec, endSec: waypoint.timeSec, gas });
      }
    }
    previous = waypoint;
  }
  return stops;
}

export function formatMinutes(seconds: number): string {
  return `${Math.round(seconds / 60)} min`;
}

export type PlanGasRow = {
  key: number;
  name: string;
  description: string;
  /** "1,840 l of 2,290 l", or just the volume when the plan has no cylinder size. */
  usedText: string;
  /** 0 to 1 and beyond: more than 1 is more gas than the cylinder holds. */
  usedFraction: number | null;
  endText: string | null;
  /** The core's minimum gas figure, for the last bottom gas of an open circuit plan. */
  minimumText: string | null;
  decoText: string | null;
  switchText: string | null;
  level: 'ok' | 'caution' | 'danger';
};

/** The notes draw this in red, but with no "Warning:" for planNoteWarnings to find. */
function belowMinimumGas(cylinder: PlannedCylinder): boolean {
  return cylinder.minimumGasMbar > 0 && cylinder.ascentStartMbar < cylinder.minimumGasMbar;
}

function gasRow(
  cylinder: PlannedCylinder,
  index: number,
  firstGasIndex: number,
  system: UnitSystem,
): PlanGasRow {
  const carried = cylinder.gasCarriedMl;
  const used = cylinder.gasUsedMl;
  const fraction = carried > 0 ? used / carried : null;
  let level: PlanGasRow['level'] = 'ok';
  if (carried > 0 && cylinder.endMbar <= 10000 && used > 0) {
    level = 'danger'; // The same 10 bar line the core's own warning draws.
  } else if (belowMinimumGas(cylinder)) {
    level = 'caution';
  }
  return {
    key: index,
    name: cylinder.name,
    description: cylinder.description,
    usedText:
      carried > 0
        ? `${formatVolume(used, system)} of ${formatVolume(carried, system)}`
        : formatVolume(used, system),
    usedFraction: fraction,
    endText:
      carried > 0
        ? `Ends at ${formatPressure(Math.max(0, cylinder.endMbar), system)} of ${formatPressure(cylinder.startMbar, system)}`
        : null,
    minimumText:
      cylinder.minimumGasMbar > 0
        ? `Minimum gas ${formatPressure(cylinder.minimumGasMbar, system)}`
        : null,
    decoText:
      cylinder.decoGasUsedMl > 0 ? `${formatVolume(cylinder.decoGasUsedMl, system)} in the ascent` : null,
    switchText:
      index !== firstGasIndex && cylinder.switchDepthMm > 0
        ? `Switch at ${formatDepth(cylinder.switchDepthMm, system)}`
        : null,
    level,
  };
}

/** One row per cylinder that takes part: a closed loop's unused oxygen says nothing. */
export function planGasRows(result: PlanResult, system: UnitSystem): PlanGasRow[] {
  return result.cylinders
    .map((cylinder, index) => ({ cylinder, index }))
    .filter(({ cylinder }) => cylinder.use !== CylinderUse.NotUsed)
    .map(({ cylinder, index }) => gasRow(cylinder, index, 0, system));
}

export type PlanWarning = { level: 'danger' | 'caution'; text: string };

/**
 * What must not be missed, worst first. Nearly all of it is the core's own wording
 * out of the notes. The others are facts the core reports another way: a waypoint
 * above the ceiling (a label on the desktop profile), a cylinder below minimum gas
 * (a red line with no "Warning:") and an overlap (a phrase in the notes' title).
 */
export function planWarnings(result: PlanResult, system: UnitSystem): PlanWarning[] {
  const out: PlanWarning[] = [];
  // On a recreational plan over the limit, the core's own warning already says this.
  if (result.waypointAboveCeiling && result.error === 'ok') {
    out.push({
      level: 'danger',
      text: 'A planned level is shallower than the deco ceiling at that point. Plan a deeper level or a shorter dive before it.',
    });
  }
  for (const text of planNoteWarnings(result.notes)) {
    out.push({ level: 'danger', text });
  }
  for (const cylinder of result.cylinders) {
    if (belowMinimumGas(cylinder)) {
      out.push({
        level: 'caution',
        text: `Below minimum gas: ${cylinder.name} is at ${formatPressure(cylinder.ascentStartMbar, system)} when the ascent starts, and the minimum is ${formatPressure(cylinder.minimumGasMbar, system)}.`,
      });
    }
  }
  if (result.surfaceIntervalSec < 0) {
    out.push({
      level: 'caution',
      text: 'This plan overlaps a dive in the logbook. Check the start time.',
    });
  }
  return out;
}

/** The word on a failed plan's message when the notes have none, which they should. */
export function planFailure(result: PlanResult): string {
  const [warning] = planNoteWarnings(result.notes);
  return warning ?? 'The planner could not work out this plan.';
}

/** Runtime as a diver reads it, and what is not the bottom time. */
export function planHeadline(result: PlanResult): {
  runtime: string;
  decoLine: string;
  depth: number;
} {
  const stops = planStops(result);
  const ascentSec = result.runtimeSec - result.bottomTimeSec;
  const stopSec = stops.reduce((sum, stop) => sum + stop.durationSec, 0);
  return {
    runtime: formatMinutes(result.runtimeSec),
    decoLine:
      stops.length === 0
        ? `No stops · ${formatMinutes(ascentSec)} ascent`
        : `${stops.length} ${stops.length === 1 ? 'stop' : 'stops'}, ${formatMinutes(stopSec)} · ${formatMinutes(ascentSec)} ascent`,
    depth: result.maxDepthMm,
  };
}

/** The dive before this one, if the core counted one. Its 48 hours is the "no previous dive". */
export function surfaceIntervalText(result: PlanResult): string | null {
  const seconds = result.surfaceIntervalSec;
  if (seconds <= 0 || seconds >= 48 * 3600) {
    return null;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `Repetitive dive: ${hours}:${String(minutes).padStart(2, '0')} h after the previous dive in the logbook, whose tissue loading is included.`;
}

export const PLAN_DISCLAIMER =
  'A plan is not a substitute for training or a dive computer. This calculation has had limited testing. Check it against another source, and dive within your training.';
