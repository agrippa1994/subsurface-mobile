// AI-generated (Claude)
// The planner's settings: what the legacy app's setup page has
// (qml/DivePlannerSetup.qml), persisted in settings.json.
//
// Kept in the core's own units, so a unit switch loses nothing. The screens are
// drawn from PLANNER_SETTING_SECTIONS below, one table for the SwiftUI form and the
// portable one, so a setting is added in one place.

import type { PlanSettingsInput } from './index';
import { PlanDecoMode } from './index';
import { feetToMm, mlToCuft, mmToFeet, cuftToMl, mbarToPsi, psiToMbar, type UnitSystem } from './units';

export type PlannerSettings = {
  decoMode: PlanDecoMode;
  /** Null: follow the gradient factors of Settings, as the legacy planner does on opening. */
  gfLow: number | null;
  gfHigh: number | null;
  vpmbConservatism: number;
  /** All rates in mm/s. */
  ascrate75: number;
  ascrate50: number;
  ascratestops: number;
  ascratelast6m: number;
  descrate: number;
  dropStone: boolean;
  lastStop6m: boolean;
  o2Breaks: boolean;
  switchAtRequiredStop: boolean;
  minSwitchSec: number;
  surfaceSegmentSec: number;
  surfacePressureMbar: number;
  reserveGasMbar: number;
  safetyStop: boolean;
  bottomSacMl: number;
  decoSacMl: number;
  /** In percent: 400 is a factor of 4.0. */
  sacFactor: number;
  problemSolvingMin: number;
  bottomPo2Mbar: number;
  decoPo2Mbar: number;
  defaultSetpointMbar: number;
  bestMixEndMm: number;
  o2Narcotic: boolean;
  doBailout: boolean;
  displayRuntime: boolean;
  displayDuration: boolean;
  displayTransitions: boolean;
  verbatim: boolean;
  displayVariations: boolean;
  showIcd: boolean;
};

/** default_prefs in core/pref.cpp, except what the comments say. */
export const DEFAULT_PLANNER_SETTINGS: PlannerSettings = {
  decoMode: PlanDecoMode.Buehlmann,
  gfLow: null,
  gfHigh: null,
  // Upstream's default is +3 for a logged dive's display; its planner tests use 0.
  vpmbConservatism: 3,
  ascrate75: 150,
  ascrate50: 150,
  ascratestops: 150,
  ascratelast6m: 150,
  descrate: 300,
  // On, unlike the core. Off, a one-level plan descends for the whole of its time,
  // which no diver asks for: the desktop's default plan works around it with a first point.
  dropStone: true,
  lastStop6m: false,
  o2Breaks: false,
  switchAtRequiredStop: false,
  minSwitchSec: 60,
  surfaceSegmentSec: 0,
  surfacePressureMbar: 1013,
  reserveGasMbar: 40000,
  safetyStop: true,
  bottomSacMl: 20000,
  decoSacMl: 17000,
  sacFactor: 400,
  problemSolvingMin: 4,
  bottomPo2Mbar: 1400,
  decoPo2Mbar: 1600,
  defaultSetpointMbar: 1100,
  bestMixEndMm: 30000,
  o2Narcotic: true,
  doBailout: false,
  displayRuntime: true,
  displayDuration: true,
  displayTransitions: true,
  verbatim: false,
  displayVariations: false,
  // On, unlike the core: the isobaric counterdiffusion warning depends on it.
  showIcd: true,
};

/** The planner's arguments the settings hold. Gradient factors resolved by the caller. */
export function plannerSettingsInput(
  settings: PlannerSettings,
  system: UnitSystem,
  gf: { gfLow: number; gfHigh: number },
): PlanSettingsInput {
  const { gfLow, gfHigh, surfacePressureMbar: _pressure, ...rest } = settings;
  const low = gfLow ?? gf.gfLow;
  return {
    ...rest,
    imperial: system === 'imperial',
    gfLow: low,
    // A low above a high means nothing to the model; the bindings refuse it.
    gfHigh: Math.max(low, gfHigh ?? gf.gfHigh),
  };
}

// --- Rates -------------------------------------------------------------------

/** unit_factor() in the Qt model: mm/s per m/min or ft/min. */
function rateFactor(system: UnitSystem): number {
  return system === 'imperial' ? 304.8 / 60 : 1000 / 60;
}

export function rateValue(mmPerSec: number, system: UnitSystem): number {
  return Math.round(mmPerSec / rateFactor(system));
}

export function rateFromValue(value: number, system: UnitSystem): number {
  return Math.round(value * rateFactor(system));
}

// --- The table the screens draw --------------------------------------------

export type StepperSetting = {
  kind: 'stepper';
  key: string;
  label: string;
  /** The value in the unit shown, which is what the stepper moves. */
  value: (settings: PlannerSettings, system: UnitSystem, gf: { gfLow: number; gfHigh: number }) => number;
  format: (value: number, system: UnitSystem) => string;
  range: (system: UnitSystem) => { min: number; max: number; step: number };
  patch: (value: number, system: UnitSystem) => Partial<PlannerSettings>;
  visible?: (settings: PlannerSettings) => boolean;
};

export type ToggleSetting = {
  kind: 'toggle';
  key: keyof PlannerSettings;
  label: string;
  visible?: (settings: PlannerSettings) => boolean;
};

export type PlannerSetting = StepperSetting | ToggleSetting;

export type PlannerSettingSection = {
  title: string;
  footer?: string;
  settings: PlannerSetting[];
};

type NumericKey = {
  [K in keyof PlannerSettings]: PlannerSettings[K] extends number ? K : never;
}[keyof PlannerSettings];

function rate(key: NumericKey, label: string, visible?: StepperSetting['visible']): StepperSetting {
  return {
    kind: 'stepper',
    key,
    label,
    visible,
    value: (s, system) => rateValue(s[key] as number, system),
    format: (value, system) => `${value} ${system === 'imperial' ? 'ft/min' : 'm/min'}`,
    range: (system) => (system === 'imperial' ? { min: 1, max: 99, step: 5 } : { min: 1, max: 99, step: 1 }),
    patch: (value, system) => ({ [key]: rateFromValue(value, system) }),
  };
}

function plain(
  key: NumericKey,
  label: string,
  range: { min: number; max: number; step: number },
  format: (value: number) => string,
  visible?: StepperSetting['visible'],
  scale = 1,
): StepperSetting {
  return {
    kind: 'stepper',
    key,
    label,
    visible,
    value: (s) => (s[key] as number) / scale,
    format,
    range: () => range,
    patch: (value) => ({ [key]: Math.round(value * scale) }),
  };
}

function sac(key: NumericKey, label: string): StepperSetting {
  return {
    kind: 'stepper',
    key,
    label,
    value: (s, system) =>
      system === 'imperial'
        ? Math.round(mlToCuft(s[key] as number) * 20) / 20
        : Math.round((s[key] as number) / 1000),
    format: (value, system) =>
      system === 'imperial' ? `${value.toFixed(2)} cuft/min` : `${value} l/min`,
    range: (system) =>
      system === 'imperial' ? { min: 0.1, max: 3, step: 0.05 } : { min: 1, max: 85, step: 1 },
    patch: (value, system) => ({
      [key]: system === 'imperial' ? cuftToMl(value) : Math.round(value * 1000),
    }),
  };
}

function po2(key: NumericKey, label: string, range: { min: number; max: number; step: number }) {
  return plain(key, label, range, (value) => `${value.toFixed(2)} bar`, undefined, 1000);
}

const isBuehlmann = (s: PlannerSettings) => s.decoMode === PlanDecoMode.Buehlmann;
const isVpmb = (s: PlannerSettings) => s.decoMode === PlanDecoMode.VpmB;
const isRecreational = (s: PlannerSettings) => s.decoMode === PlanDecoMode.Recreational;
const isDeco = (s: PlannerSettings) => s.decoMode !== PlanDecoMode.Recreational;

export const DECO_MODE_OPTIONS: readonly { value: PlanDecoMode; label: string }[] = [
  { value: PlanDecoMode.Buehlmann, label: 'Bühlmann' },
  { value: PlanDecoMode.VpmB, label: 'VPM-B' },
  { value: PlanDecoMode.Recreational, label: 'Recreational' },
];

/** Everything DivePlannerSetup.qml offers, in the order a diver thinks of it. */
export const PLANNER_SETTING_SECTIONS: readonly PlannerSettingSection[] = [
  {
    title: 'Decompression',
    footer:
      'Recreational mode plans no stops: it stays down until the no-deco limit or the reserve, whichever comes first.',
    settings: [
      {
        kind: 'stepper',
        key: 'gfLow',
        label: 'GF low',
        visible: isBuehlmann,
        value: (s, _system, gf) => s.gfLow ?? gf.gfLow,
        format: (value) => `${value}%`,
        range: () => ({ min: 1, max: 150, step: 1 }),
        patch: (value) => ({ gfLow: value }),
      },
      {
        kind: 'stepper',
        key: 'gfHigh',
        label: 'GF high',
        visible: isBuehlmann,
        value: (s, _system, gf) => s.gfHigh ?? gf.gfHigh,
        format: (value) => `${value}%`,
        range: () => ({ min: 1, max: 150, step: 1 }),
        patch: (value) => ({ gfHigh: value }),
      },
      plain(
        'vpmbConservatism',
        'Conservatism',
        { min: 0, max: 4, step: 1 },
        (value) => (value === 0 ? 'Nominal' : `+${value}`),
        isVpmb,
      ),
      {
        kind: 'stepper',
        key: 'reserveGasMbar',
        label: 'Reserve gas',
        visible: isRecreational,
        value: (s, system) =>
          system === 'imperial'
            ? Math.round(mbarToPsi(s.reserveGasMbar) / 50) * 50
            : Math.round(s.reserveGasMbar / 1000),
        format: (value, system) => `${value} ${system === 'imperial' ? 'psi' : 'bar'}`,
        range: (system) =>
          system === 'imperial' ? { min: 50, max: 1500, step: 50 } : { min: 1, max: 99, step: 1 },
        patch: (value, system) => ({
          reserveGasMbar: system === 'imperial' ? psiToMbar(value) : value * 1000,
        }),
      },
      { kind: 'toggle', key: 'safetyStop', label: 'Safety stop', visible: isRecreational },
    ],
  },
  {
    title: 'Ascent',
    footer: 'As in the desktop app, the rates change with depth against the average depth of the dive.',
    settings: [
      rate('ascrate75', 'Below 75% of average depth'),
      rate('ascrate50', '75% to 50% of average depth'),
      rate('ascratestops', '50% of average depth to 6 m'),
      rate('ascratelast6m', 'Last 6 m to the surface'),
    ],
  },
  {
    title: 'Descent',
    footer: 'Off, the first level takes its whole time to reach its depth.',
    settings: [
      { kind: 'toggle', key: 'dropStone', label: 'Descend at the rate below' },
      rate('descrate', 'Descent rate', (s) => s.dropStone),
    ],
  },
  {
    title: 'Stops',
    settings: [
      { kind: 'toggle', key: 'lastStop6m', label: 'Last stop at 6 m', visible: isDeco },
      { kind: 'toggle', key: 'o2Breaks', label: 'Back gas breaks', visible: isDeco },
      { kind: 'toggle', key: 'switchAtRequiredStop', label: 'Switch gas only at required stops', visible: isDeco },
      plain(
        'minSwitchSec',
        'Minimum switch time',
        { min: 0, max: 4, step: 1 },
        (value) => `${value} min`,
        isDeco,
        60,
      ),
      plain('surfaceSegmentSec', 'Surface segment', { min: 0, max: 60, step: 1 }, (value) => `${value} min`, undefined, 60),
    ],
  },
  {
    title: 'Gas',
    footer: 'Minimum gas is the SAC factor times the bottom SAC for the problem solving time, plus the ascent at that factor.',
    settings: [
      sac('bottomSacMl', 'Bottom SAC'),
      sac('decoSacMl', 'Deco SAC'),
      plain('sacFactor', 'SAC factor', { min: 1, max: 9.9, step: 0.1 }, (value) => value.toFixed(1), undefined, 100),
      plain('problemSolvingMin', 'Problem solving time', { min: 1, max: 9, step: 1 }, (value) => `${value} min`),
      po2('bottomPo2Mbar', 'Bottom pO₂', { min: 1, max: 2, step: 0.05 }),
      po2('decoPo2Mbar', 'Deco pO₂', { min: 1, max: 2, step: 0.05 }),
      po2('defaultSetpointMbar', 'Default CCR setpoint', { min: 0.2, max: 2, step: 0.05 }),
      {
        kind: 'stepper',
        key: 'bestMixEndMm',
        label: 'Best mix END',
        value: (s, system) =>
          system === 'imperial' ? Math.round(mmToFeet(s.bestMixEndMm) / 5) * 5 : Math.round(s.bestMixEndMm / 1000),
        format: (value, system) => `${value} ${system === 'imperial' ? 'ft' : 'm'}`,
        range: (system) =>
          system === 'imperial' ? { min: 10, max: 300, step: 5 } : { min: 3, max: 99, step: 1 },
        patch: (value, system) => ({
          bestMixEndMm: system === 'imperial' ? feetToMm(value) : value * 1000,
        }),
      },
      { kind: 'toggle', key: 'o2Narcotic', label: 'Oxygen is narcotic' },
    ],
  },
  {
    title: 'Plan notes',
    settings: [
      { kind: 'toggle', key: 'displayRuntime', label: 'Show runtime' },
      { kind: 'toggle', key: 'displayDuration', label: 'Show segment duration' },
      { kind: 'toggle', key: 'displayTransitions', label: 'Show transitions in deco' },
      { kind: 'toggle', key: 'verbatim', label: 'Verbatim plan' },
      { kind: 'toggle', key: 'displayVariations', label: 'Show plan variations', visible: isDeco },
      { kind: 'toggle', key: 'showIcd', label: 'Isobaric counterdiffusion check' },
    ],
  },
];

/** Moves a stepper's value by hand-picked floating steps without collecting float dust. */
export function snapToStep(value: number, range: { min: number; max: number; step: number }): number {
  const snapped = Math.round(value / range.step) * range.step;
  const clamped = Math.min(range.max, Math.max(range.min, snapped));
  return Number(clamped.toFixed(2));
}

// --- Reading the file --------------------------------------------------------

/**
 * Out of a parsed settings file. Anything missing, of the wrong type or out of the
 * range the bindings accept is the default: a hand-edited file must not leave a plan
 * that the bindings refuse with no way to fix it from the screen.
 */
export function parsePlannerSettings(raw: unknown): PlannerSettings {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_PLANNER_SETTINGS } as Record<string, unknown>;
  const within = (key: string, min: number, max: number) => {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max) {
      out[key] = Math.round(value);
    }
  };
  const flag = (key: string) => {
    if (typeof source[key] === 'boolean') {
      out[key] = source[key];
    }
  };
  const nullable = (key: string, min: number, max: number) => {
    within(key, min, max);
    if (typeof source[key] !== 'number') {
      out[key] = null;
    }
  };

  within('decoMode', PlanDecoMode.Buehlmann, PlanDecoMode.VpmB);
  nullable('gfLow', 1, 150);
  nullable('gfHigh', 1, 150);
  within('vpmbConservatism', 0, 4);
  for (const key of ['ascrate75', 'ascrate50', 'ascratestops', 'ascratelast6m', 'descrate']) {
    within(key, 1, 2000);
  }
  within('minSwitchSec', 0, 600);
  within('surfaceSegmentSec', 0, 3600);
  within('surfacePressureMbar', 689, 1100);
  within('reserveGasMbar', 0, 300000);
  within('bottomSacMl', 100, 100000);
  within('decoSacMl', 100, 100000);
  within('sacFactor', 100, 990);
  within('problemSolvingMin', 0, 30);
  within('bottomPo2Mbar', 100, 2500);
  within('decoPo2Mbar', 100, 2500);
  within('defaultSetpointMbar', 160, 2000);
  within('bestMixEndMm', 1000, 100000);
  for (const key of [
    'dropStone',
    'lastStop6m',
    'o2Breaks',
    'switchAtRequiredStop',
    'safetyStop',
    'o2Narcotic',
    'doBailout',
    'displayRuntime',
    'displayDuration',
    'displayTransitions',
    'verbatim',
    'displayVariations',
    'showIcd',
  ]) {
    flag(key);
  }
  return out as PlannerSettings;
}
