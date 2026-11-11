// AI-generated (Claude)
// The planner's settings: what the legacy app's setup page has
// (qml/DivePlannerSetup.qml), persisted in settings.json.
//
// Kept in the core's own units, so a unit switch loses nothing. The screens are
// drawn from PLANNER_SETTING_SECTIONS below, one table for the SwiftUI form and the
// portable one, so a setting is added in one place.

import type { PlanSettingsInput } from './index';
import { PlanDecoMode } from './index';
import { feetToMm, mlToCuft, mmToFeet, cuftToMl, mbarToPsi, psiToMbar, coreUnits, type Units } from './units';
import { t } from '@/i18n';
import type en from '@/i18n/locales/en';

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
  units: Units,
  gf: { gfLow: number; gfHigh: number },
): PlanSettingsInput {
  const { gfLow, gfHigh, surfacePressureMbar: _pressure, ...rest } = settings;
  const low = gfLow ?? gf.gfLow;
  return {
    ...rest,
    units: coreUnits(units),
    gfLow: low,
    // A low above a high means nothing to the model; the bindings refuse it.
    gfHigh: Math.max(low, gfHigh ?? gf.gfHigh),
  };
}

// --- Rates -------------------------------------------------------------------

/** unit_factor() in the Qt model: mm/s per m/min or ft/min. */
function rateFactor(units: Units): number {
  return units.depth === 'ft' ? 304.8 / 60 : 1000 / 60;
}

export function rateValue(mmPerSec: number, units: Units): number {
  return Math.round(mmPerSec / rateFactor(units));
}

export function rateFromValue(value: number, units: Units): number {
  return Math.round(value * rateFactor(units));
}

// --- The table the screens draw --------------------------------------------

export type StepperSetting = {
  kind: 'stepper';
  key: string;
  readonly label: string;
  /** The value in the unit shown, which is what the stepper moves. */
  value: (settings: PlannerSettings, units: Units, gf: { gfLow: number; gfHigh: number }) => number;
  format: (value: number, units: Units) => string;
  range: (units: Units) => { min: number; max: number; step: number };
  patch: (value: number, units: Units) => Partial<PlannerSettings>;
  visible?: (settings: PlannerSettings) => boolean;
};

export type ToggleSetting = {
  kind: 'toggle';
  key: keyof PlannerSettings;
  readonly label: string;
  visible?: (settings: PlannerSettings) => boolean;
};

export type PlannerSetting = StepperSetting | ToggleSetting;

export type PlannerSettingSection = {
  readonly title: string;
  readonly footer?: string | ((settings: PlannerSettings) => string | undefined);
  settings: PlannerSetting[];
};

type NumericKey = {
  [K in keyof PlannerSettings]: PlannerSettings[K] extends number ? K : never;
}[keyof PlannerSettings] &
  SettingLabelKey;

function rate(key: NumericKey, visible?: StepperSetting['visible']): StepperSetting {
  return {
    kind: 'stepper',
    key,
    get label() {
      return settingLabel(key);
    },
    visible,
    value: (s, units) => rateValue(s[key] as number, units),
    format: (value, units) => `${value} ${units.depth === 'ft' ? 'ft/min' : 'm/min'}`,
    range: (units) => (units.depth === 'ft' ? { min: 1, max: 99, step: 5 } : { min: 1, max: 99, step: 1 }),
    patch: (value, units) => ({ [key]: rateFromValue(value, units) }),
  };
}

function plain(
  key: NumericKey,
  range: { min: number; max: number; step: number },
  format: (value: number) => string,
  visible?: StepperSetting['visible'],
  scale = 1,
): StepperSetting {
  return {
    kind: 'stepper',
    key,
    get label() {
      return settingLabel(key);
    },
    visible,
    value: (s) => (s[key] as number) / scale,
    format,
    range: () => range,
    patch: (value) => ({ [key]: Math.round(value * scale) }),
  };
}

function sac(key: NumericKey): StepperSetting {
  return {
    kind: 'stepper',
    key,
    get label() {
      return settingLabel(key);
    },
    value: (s, units) =>
      units.volume === 'cuft'
        ? Math.round(mlToCuft(s[key] as number) * 20) / 20
        : Math.round((s[key] as number) / 1000),
    format: (value, units) =>
      units.volume === 'cuft' ? `${value.toFixed(2)} cuft/min` : `${value} l/min`,
    range: (units) =>
      units.volume === 'cuft' ? { min: 0.1, max: 3, step: 0.05 } : { min: 1, max: 85, step: 1 },
    patch: (value, units) => ({
      [key]: units.volume === 'cuft' ? cuftToMl(value) : Math.round(value * 1000),
    }),
  };
}

function toggle(key: keyof PlannerSettings & SettingLabelKey, visible?: ToggleSetting['visible']): ToggleSetting {
  return {
    kind: 'toggle',
    key,
    get label() {
      return settingLabel(key);
    },
    visible,
  };
}

function po2(key: NumericKey, range: { min: number; max: number; step: number }) {
  return plain(key, range, (value) => `${value.toFixed(2)} bar`, undefined, 1000);
}

const isBuehlmann = (s: PlannerSettings) => s.decoMode === PlanDecoMode.Buehlmann;
const isVpmb = (s: PlannerSettings) => s.decoMode === PlanDecoMode.VpmB;
const isRecreational = (s: PlannerSettings) => s.decoMode === PlanDecoMode.Recreational;
const isDeco = (s: PlannerSettings) => s.decoMode !== PlanDecoMode.Recreational;

/** A setting's row label, by its key. */
function settingLabel(key: SettingLabelKey): string {
  return t(`plannerSettings.label.${key}`);
}

type SettingLabelKey = keyof typeof en.plannerSettings.label;

export const DECO_MODE_OPTIONS: readonly { value: PlanDecoMode; readonly label: string }[] = [
  { value: PlanDecoMode.Buehlmann, label: 'Bühlmann' },
  { value: PlanDecoMode.VpmB, label: 'VPM-B' },
  {
    value: PlanDecoMode.Recreational,
    get label() {
      return t('plannerSettings.recreational');
    },
  },
];

/** Everything DivePlannerSetup.qml offers, in the order a diver thinks of it. */
export const PLANNER_SETTING_SECTIONS: readonly PlannerSettingSection[] = [
  {
    get title() {
      return t('plannerSettings.section.decompression');
    },
    footer: (s) => (isRecreational(s) ? t('plannerSettings.footer.recreational') : undefined),
    settings: [
      {
        kind: 'stepper',
        key: 'gfLow',
        get label() {
          return settingLabel('gfLow');
        },
        visible: isBuehlmann,
        value: (s, _system, gf) => s.gfLow ?? gf.gfLow,
        format: (value) => `${value}%`,
        range: () => ({ min: 1, max: 150, step: 1 }),
        patch: (value) => ({ gfLow: value }),
      },
      {
        kind: 'stepper',
        key: 'gfHigh',
        get label() {
          return settingLabel('gfHigh');
        },
        visible: isBuehlmann,
        value: (s, _system, gf) => s.gfHigh ?? gf.gfHigh,
        format: (value) => `${value}%`,
        range: () => ({ min: 1, max: 150, step: 1 }),
        patch: (value) => ({ gfHigh: value }),
      },
      plain(
        'vpmbConservatism',
        { min: 0, max: 4, step: 1 },
        (value) => (value === 0 ? t('plannerSettings.nominal') : `+${value}`),
        isVpmb,
      ),
      {
        kind: 'stepper',
        key: 'reserveGasMbar',
        get label() {
          return settingLabel('reserveGasMbar');
        },
        visible: isRecreational,
        value: (s, units) =>
          units.pressure === 'psi'
            ? Math.round(mbarToPsi(s.reserveGasMbar) / 50) * 50
            : Math.round(s.reserveGasMbar / 1000),
        format: (value, units) => `${value} ${units.pressure === 'psi' ? 'psi' : 'bar'}`,
        range: (units) =>
          units.pressure === 'psi' ? { min: 50, max: 1500, step: 50 } : { min: 1, max: 99, step: 1 },
        patch: (value, units) => ({
          reserveGasMbar: units.pressure === 'psi' ? psiToMbar(value) : value * 1000,
        }),
      },
      toggle('safetyStop', isRecreational),
    ],
  },
  {
    get title() {
      return t('plannerSettings.section.ascent');
    },
    get footer() {
      return t('plannerSettings.footer.ascent');
    },
    settings: [
      rate('ascrate75'),
      rate('ascrate50'),
      rate('ascratestops'),
      rate('ascratelast6m'),
    ],
  },
  {
    get title() {
      return t('plannerSettings.section.descent');
    },
    get footer() {
      return t('plannerSettings.footer.descent');
    },
    settings: [
      toggle('dropStone'),
      rate('descrate', (s) => s.dropStone),
    ],
  },
  {
    get title() {
      return t('plannerSettings.section.stops');
    },
    settings: [
      toggle('lastStop6m', isDeco),
      toggle('o2Breaks', isDeco),
      toggle('switchAtRequiredStop', isDeco),
      plain(
        'minSwitchSec',
        { min: 0, max: 4, step: 1 },
        (value) => `${value} min`,
        isDeco,
        60,
      ),
      plain('surfaceSegmentSec', { min: 0, max: 60, step: 1 }, (value) => `${value} min`, undefined, 60),
    ],
  },
  {
    get title() {
      return t('plannerSettings.section.gas');
    },
    get footer() {
      return t('plannerSettings.footer.gas');
    },
    settings: [
      sac('bottomSacMl'),
      sac('decoSacMl'),
      plain('sacFactor', { min: 1, max: 9.9, step: 0.1 }, (value) => value.toFixed(1), undefined, 100),
      plain('problemSolvingMin', { min: 1, max: 9, step: 1 }, (value) => `${value} min`),
      po2('bottomPo2Mbar', { min: 1, max: 2, step: 0.05 }),
      po2('decoPo2Mbar', { min: 1, max: 2, step: 0.05 }),
      po2('defaultSetpointMbar', { min: 0.2, max: 2, step: 0.05 }),
      {
        kind: 'stepper',
        key: 'bestMixEndMm',
        get label() {
          return settingLabel('bestMixEndMm');
        },
        value: (s, units) =>
          units.depth === 'ft' ? Math.round(mmToFeet(s.bestMixEndMm) / 5) * 5 : Math.round(s.bestMixEndMm / 1000),
        format: (value, units) => `${value} ${units.depth === 'ft' ? 'ft' : 'm'}`,
        range: (units) =>
          units.depth === 'ft' ? { min: 10, max: 300, step: 5 } : { min: 3, max: 99, step: 1 },
        patch: (value, units) => ({
          bestMixEndMm: units.depth === 'ft' ? feetToMm(value) : value * 1000,
        }),
      },
      toggle('o2Narcotic'),
    ],
  },
  {
    get title() {
      return t('plannerSettings.section.notes');
    },
    settings: [
      toggle('displayRuntime'),
      toggle('displayDuration'),
      toggle('displayTransitions'),
      toggle('verbatim'),
      toggle('displayVariations', isDeco),
      toggle('showIcd'),
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
