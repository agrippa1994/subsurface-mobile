// AI-generated (Claude)
// Unit conversion and formatting.
//
// The native module never converts or formats: it hands over the core's raw
// integer units and every rendering decision is made here, so the same numbers
// can be shown metric or imperial. The conversion factors are the ones in
// subsurface/core/units.h - deliberately the same constants, so a depth shown
// in feet matches the desktop app to the digit.

/** Millikelvin of 0 C. `ZERO_C_IN_MKELVIN` in core/units.h. */
export const ZERO_C_IN_MKELVIN = 273150;

export type UnitSystem = 'metric' | 'imperial';

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

export function gramsToKg(grams: number): number {
  return grams / 1000;
}

/** `grams_to_lbs` in core/units.h. */
export function gramsToLbs(grams: number): number {
  return grams / 453.6;
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

export function formatDepth(mm: number, system: UnitSystem = 'metric'): string {
  return system === 'imperial'
    ? `${Math.round(mmToFeet(mm))} ft`
    : `${round(mmToMeters(mm), 1)} m`;
}

export function formatPressure(mbar: number, system: UnitSystem = 'metric'): string {
  return system === 'imperial'
    ? `${Math.round(mbarToPsi(mbar))} psi`
    : `${Math.round(mbarToBar(mbar))} bar`;
}

export function formatTemperature(mkelvin: number, system: UnitSystem = 'metric'): string {
  return system === 'imperial'
    ? `${round(mkelvinToFahrenheit(mkelvin), 1)} F`
    : `${round(mkelvinToCelsius(mkelvin), 1)} C`;
}

export function formatVolume(ml: number, system: UnitSystem = 'metric'): string {
  return system === 'imperial'
    ? `${round(mlToCuft(ml), 1)} cuft`
    : `${round(mlToLiters(ml), 1)} l`;
}

export function formatWeight(grams: number, system: UnitSystem = 'metric'): string {
  return system === 'imperial'
    ? `${round(gramsToLbs(grams), 1)} lbs`
    : `${round(gramsToKg(grams), 1)} kg`;
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
    return `Trimix ${Math.round(o2Permille / 10)}/${Math.round(hePermille / 10)}`;
  }
  if (o2Permille === 0 || o2Permille === 209) {
    return 'Air';
  }
  if (o2Permille === 1000) {
    return 'Oxygen';
  }
  return `EAN${Math.round(o2Permille / 10)}`;
}

/** Formats a dive timestamp (Unix seconds, UTC) as an ISO-8601 UTC string. */
export function formatWhenIso(when: number): string {
  return new Date(when * 1000).toISOString().replace('.000Z', 'Z');
}
