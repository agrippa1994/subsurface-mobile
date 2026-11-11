// AI-generated (Claude)
// Unit conversion and formatting.
//
// The native module never converts or formats: it hands over the core's raw
// integer units and every rendering decision is made here, so the same numbers
// can be shown in whatever units the diver picked. The conversion factors are
// the ones in subsurface/core/units.h - deliberately the same constants, so a
// depth shown in feet matches the desktop app to the digit.
//
// Units are chosen one quantity at a time, as on desktop and in the legacy
// mobile app (`struct units` in core/units.h): metric and imperial are presets
// of the five, not a mode. Every formatter and parser therefore takes a whole
// `Units`, never a unit system - a unit system alone cannot say whether a diver
// who logs feet also wants bar.

import { t } from '@/i18n';

/** Millikelvin of 0 C. `ZERO_C_IN_MKELVIN` in core/units.h. */
export const ZERO_C_IN_MKELVIN = 273150;

/** The two presets. "Personalized" is any other combination of `Units`. */
export type UnitSystem = 'metric' | 'imperial';

export type DepthUnit = 'm' | 'ft';
export type PressureUnit = 'bar' | 'psi';
export type VolumeUnit = 'l' | 'cuft';
export type TemperatureUnit = 'C' | 'F';
export type WeightUnit = 'kg' | 'lbs';

/** One unit per quantity, `struct units` in core/units.h minus what the app never shows. */
export type Units = Readonly<{
  depth: DepthUnit;
  pressure: PressureUnit;
  volume: VolumeUnit;
  temperature: TemperatureUnit;
  weight: WeightUnit;
}>;

/** `SI_units` in core/units.cpp, as far as `Units` reaches. */
export const METRIC_UNITS: Units = Object.freeze({
  depth: 'm',
  pressure: 'bar',
  volume: 'l',
  temperature: 'C',
  weight: 'kg',
});

/** `IMPERIAL_units` in core/units.cpp. */
export const IMPERIAL_UNITS: Units = Object.freeze({
  depth: 'ft',
  pressure: 'psi',
  volume: 'cuft',
  temperature: 'F',
  weight: 'lbs',
});

export const UNIT_CHOICES = {
  depth: ['m', 'ft'],
  pressure: ['bar', 'psi'],
  volume: ['l', 'cuft'],
  temperature: ['C', 'F'],
  weight: ['kg', 'lbs'],
} as const satisfies { [K in keyof Units]: readonly Units[K][] };

export function unitsForSystem(system: UnitSystem): Units {
  return system === 'imperial' ? IMPERIAL_UNITS : METRIC_UNITS;
}

/** Which preset a set of units is, or 'personalized' when it is neither. */
export function unitPreset(units: Units): UnitSystem | 'personalized' {
  const keys = Object.keys(UNIT_CHOICES) as (keyof Units)[];
  if (keys.every((key) => units[key] === METRIC_UNITS[key])) {
    return 'metric';
  }
  if (keys.every((key) => units[key] === IMPERIAL_UNITS[key])) {
    return 'imperial';
  }
  return 'personalized';
}

/**
 * Units out of anything - a parsed settings file, say. A quantity that is
 * missing or unknown takes `fallback`'s unit, so one bad key never resets the
 * other four.
 */
export function parseUnits(value: unknown, fallback: Units = METRIC_UNITS): Units {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const pick = <K extends keyof Units>(key: K): Units[K] => {
    const choices = UNIT_CHOICES[key] as readonly string[];
    const candidate = raw[key];
    return (typeof candidate === 'string' && choices.includes(candidate) ? candidate : fallback[key]) as Units[K];
  };
  return {
    depth: pick('depth'),
    pressure: pick('pressure'),
    volume: pick('volume'),
    temperature: pick('temperature'),
    weight: pick('weight'),
  };
}

/**
 * Guards the formatters against the old call shape. A unit system string
 * would otherwise fall through every `units.depth === 'ft'` test and render
 * metric without a word.
 */
export function assertUnits(units: unknown): asserts units is Units {
  if (typeof units !== 'object' || units === null || !('depth' in units)) {
    throw new TypeError(
      `expected Units (one unit per quantity), got ${JSON.stringify(units)}; a unit system alone is not enough`
    );
  }
}

// --- Depth -----------------------------------------------------------------

export function mmToMeters(mm: number): number {
  return mm / 1000;
}

/** `mm_to_feet` in core/units.h. */
export function mmToFeet(mm: number): number {
  return mm * 0.00328084;
}

export function metersToMm(m: number): number {
  return Math.round(m * 1000);
}

/** `feet_to_mm` in core/units.h. */
export function feetToMm(ft: number): number {
  return Math.round(ft * 304.8);
}

// --- Pressure --------------------------------------------------------------

export function mbarToBar(mbar: number): number {
  return mbar / 1000;
}

export function barToMbar(bar: number): number {
  return Math.round(bar * 1000);
}

/** `to_PSI` in core/units.h. */
export function mbarToPsi(mbar: number): number {
  return mbar * 0.0145037738;
}

/** `psi_to_mbar` in core/units.h. */
export function psiToMbar(psi: number): number {
  return Math.round((psi / 14.5037738) * 1000);
}

// --- Temperature -----------------------------------------------------------

/** `mkelvin_to_C` in core/units.h. */
export function mkelvinToCelsius(mkelvin: number): number {
  return (mkelvin - ZERO_C_IN_MKELVIN) / 1000;
}

/** `mkelvin_to_F` in core/units.h. */
export function mkelvinToFahrenheit(mkelvin: number): number {
  return (mkelvin * 9) / 5000 - 459.67;
}

/** `C_to_mkelvin` in core/units.h. */
export function celsiusToMkelvin(c: number): number {
  return Math.round(c * 1000 + ZERO_C_IN_MKELVIN);
}

// --- Volume and weight -----------------------------------------------------

export function mlToLiters(ml: number): number {
  return ml / 1000;
}

/** `ml_to_cuft` in core/units.h. */
export function mlToCuft(ml: number): number {
  return ml / 28316.8466;
}

export function litersToMl(liters: number): number {
  return Math.round(liters * 1000);
}

/** The inverse of `mlToCuft`, for what an imperial volume field accepts back. */
export function cuftToMl(cuft: number): number {
  return Math.round(cuft * 28316.8466);
}

export function gramsToKg(grams: number): number {
  return grams / 1000;
}

/** `grams_to_lbs` in core/units.h. */
export function gramsToLbs(grams: number): number {
  return grams / 453.6;
}

export function kgToGrams(kg: number): number {
  return Math.round(kg * 1000);
}

/** The inverse of `gramsToLbs`, for what an imperial weight field accepts back. */
export function lbsToGrams(lbs: number): number {
  return Math.round(lbs * 453.6);
}

// --- Coordinates -----------------------------------------------------------

export function udegToDegrees(udeg: number): number {
  return udeg / 1000000;
}

export function degreesToUdeg(deg: number): number {
  return Math.trunc(deg * 1000000);
}

// --- Formatting ------------------------------------------------------------

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function formatDepth(mm: number, units: Units): string {
  assertUnits(units);
  return units.depth === 'ft' ? `${Math.round(mmToFeet(mm))} ft` : `${round(mmToMeters(mm), 1)} m`;
}

export function formatPressure(mbar: number, units: Units): string {
  assertUnits(units);
  return units.pressure === 'psi'
    ? `${Math.round(mbarToPsi(mbar))} psi`
    : `${Math.round(mbarToBar(mbar))} bar`;
}

export function formatTemperature(mkelvin: number, units: Units): string {
  assertUnits(units);
  return units.temperature === 'F'
    ? `${round(mkelvinToFahrenheit(mkelvin), 1)} F`
    : `${round(mkelvinToCelsius(mkelvin), 1)} C`;
}

export function formatVolume(ml: number, units: Units): string {
  assertUnits(units);
  return units.volume === 'cuft' ? `${round(mlToCuft(ml), 1)} cuft` : `${round(mlToLiters(ml), 1)} l`;
}

export function formatWeight(grams: number, units: Units): string {
  assertUnits(units);
  return units.weight === 'lbs' ? `${round(gramsToLbs(grams), 1)} lbs` : `${round(gramsToKg(grams), 1)} kg`;
}

/**
 * Surface air consumption, which the core stores as millilitres per minute
 * (`dive::sac`, computed by `calculate_sac` in core/divelist.cpp). Shown to one
 * decimal in litres, two in cubic feet - a SAC is never known finer than that.
 * It is a volume, so it follows the volume unit.
 */
export function formatSac(mlPerMin: number, units: Units): string {
  assertUnits(units);
  return units.volume === 'cuft'
    ? `${round(mlToCuft(mlPerMin), 2)} cuft/min`
    : `${round(mlToLiters(mlPerMin), 1)} l/min`;
}

// --- Unit-only helpers -----------------------------------------------------

/** Depth in the depth unit, unrounded. */
export function depthInUnit(mm: number, units: Units): number {
  assertUnits(units);
  return units.depth === 'ft' ? mmToFeet(mm) : mmToMeters(mm);
}

/** The inverse of `depthInUnit`. */
export function depthFromUnit(value: number, units: Units): number {
  assertUnits(units);
  return units.depth === 'ft' ? feetToMm(value) : metersToMm(value);
}

export function pressureInUnit(mbar: number, units: Units): number {
  assertUnits(units);
  return units.pressure === 'psi' ? mbarToPsi(mbar) : mbarToBar(mbar);
}

export function pressureFromUnit(value: number, units: Units): number {
  assertUnits(units);
  return units.pressure === 'psi' ? psiToMbar(value) : barToMbar(value);
}

export function temperatureInUnit(mkelvin: number, units: Units): number {
  assertUnits(units);
  return units.temperature === 'F' ? mkelvinToFahrenheit(mkelvin) : mkelvinToCelsius(mkelvin);
}

export function volumeInUnit(ml: number, units: Units): number {
  assertUnits(units);
  return units.volume === 'cuft' ? mlToCuft(ml) : mlToLiters(ml);
}

export function volumeFromUnit(value: number, units: Units): number {
  assertUnits(units);
  return units.volume === 'cuft' ? cuftToMl(value) : litersToMl(value);
}

/** Short labels: "ft", "psi", "cuft", "F", "lbs". */
export function depthLabel(units: Units): string {
  assertUnits(units);
  return units.depth;
}

export function pressureLabel(units: Units): string {
  assertUnits(units);
  return units.pressure;
}

export function volumeLabel(units: Units): string {
  assertUnits(units);
  return units.volume;
}

export function temperatureLabel(units: Units): string {
  assertUnits(units);
  return units.temperature;
}

export function weightLabel(units: Units): string {
  assertUnits(units);
  return units.weight;
}

/** The SAC axis and field unit, "l/min" or "cuft/min". */
export function sacLabel(units: Units): string {
  assertUnits(units);
  return `${units.volume}/min`;
}

/** Spoken names, for accessibility labels: "feet", "degrees Celsius". */
export function depthUnitName(units: Units): string {
  assertUnits(units);
  return units.depth === 'ft' ? t('units.spoken.feet') : t('units.spoken.meters');
}

export function temperatureUnitName(units: Units): string {
  assertUnits(units);
  return units.temperature === 'F' ? t('units.spoken.fahrenheit') : t('units.spoken.celsius');
}

export function pressureUnitName(units: Units): string {
  assertUnits(units);
  return units.pressure === 'psi' ? t('units.spoken.psi') : t('units.spoken.bar');
}

export function volumeUnitName(units: Units): string {
  assertUnits(units);
  return units.volume === 'cuft' ? t('units.spoken.cubicFeet') : t('units.spoken.liters');
}

export function weightUnitName(units: Units): string {
  assertUnits(units);
  return units.weight === 'lbs' ? t('units.spoken.pounds') : t('units.spoken.kilograms');
}

/**
 * The shape the bindings take for the core's `prefs.units` (cpp/API.md): the
 * core formats some text itself - planner notes, statistics binners, CSV -
 * and must use the same units the screens do.
 */
export type CoreUnits = Units;

export function coreUnits(units: Units): CoreUnits {
  assertUnits(units);
  return {
    depth: units.depth,
    pressure: units.pressure,
    volume: units.volume,
    temperature: units.temperature,
    weight: units.weight,
  };
}

/** Dive durations are shown as `h:mm:ss` or `m:ss`, like the desktop app. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Name of a gas mix, following the core's convention: an o2 fraction of 0 means
 * air, helium makes it trimix, anything else is nitrox.
 */
export function formatGasMix(o2Permille: number, hePermille: number): string {
  if (hePermille > 0) {
    return t('units.gas.trimix', { o2: Math.round(o2Permille / 10), he: Math.round(hePermille / 10) });
  }
  if (o2Permille === 0 || o2Permille === 209) {
    return t('units.gas.air');
  }
  if (o2Permille === 1000) {
    return t('units.gas.oxygen');
  }
  return `EAN${Math.round(o2Permille / 10)}`;
}

/** Formats a dive timestamp (Unix seconds, UTC) as an ISO-8601 UTC string. */
export function formatWhenIso(when: number): string {
  return new Date(when * 1000).toISOString().replace('.000Z', 'Z');
}

// --- Settings rows -----------------------------------------------------------

export type UnitPresetChoice = UnitSystem | 'personalized';

// The labels are getters so they are looked up in the language in force each
// time a row is drawn, not once when this module loads.

/** The three choices of the legacy app's unit setting (qml/Settings.qml). */
export const UNIT_PRESET_OPTIONS: readonly { value: UnitPresetChoice; readonly label: string }[] = [
  {
    value: 'metric',
    get label() {
      return t('units.preset.metric');
    },
  },
  {
    value: 'imperial',
    get label() {
      return t('units.preset.imperial');
    },
  },
  {
    value: 'personalized',
    get label() {
      return t('units.preset.custom');
    },
  },
];

type UnitRow = {
  key: keyof Units;
  readonly label: string;
  options: readonly { value: string; readonly label: string }[];
};

/** A row whose labels are looked up when read. */
function unitRow(key: keyof Units, options: readonly (readonly [string, () => string])[]): UnitRow {
  return {
    key,
    get label() {
      return t(`units.quantity.${key}`);
    },
    options: options.map(([value, label]) => ({
      value,
      get label() {
        return label();
      },
    })),
  };
}

/** One row per quantity, in the order desktop's preferences list them. */
export const UNIT_ROWS: readonly UnitRow[] = [
  unitRow('depth', [
    ['m', () => t('units.name.meters')],
    ['ft', () => t('units.name.feet')],
  ]),
  unitRow('pressure', [
    ['bar', () => t('units.name.bar')],
    ['psi', () => t('units.name.psi')],
  ]),
  unitRow('volume', [
    ['l', () => t('units.name.liters')],
    ['cuft', () => t('units.name.cubicFeet')],
  ]),
  unitRow('temperature', [
    ['C', () => t('units.name.celsius')],
    ['F', () => t('units.name.fahrenheit')],
  ]),
  unitRow('weight', [
    ['kg', () => t('units.name.kilograms')],
    ['lbs', () => t('units.name.pounds')],
  ]),
];

/** A footer line naming the units in force, e.g. "Meters, bar, liters, Celsius, kilograms." */
export function unitsSummary(units: Units): string {
  assertUnits(units);
  const names = UNIT_ROWS.map((row) => {
    const option = row.options.find((candidate) => candidate.value === units[row.key]);
    return option ? t(`units.inline.${option.value as InlineUnit}`) : '';
  });
  return t('units.summary', { list: names.join(', ') });
}

type InlineUnit = 'm' | 'ft' | 'bar' | 'psi' | 'l' | 'cuft' | 'C' | 'F' | 'kg' | 'lbs';
