// AI-generated (Claude)
// Presentation model of the cylinder editor.
//
// Pure functions only - no React, no native module. Cylinder sizes and
// pressures cross the boundary in the core's integer units (millilitres,
// millibar) and a permille gas mix, while what the diver types is litres or
// cubic feet, bar or psi, and whole percents. All of that conversion happens
// here, exactly once, so the editor binds to plain strings.
//
// Fields are kept as text rather than numbers on purpose: a numeric draft
// cannot represent "the user has deleted the digits and is about to type new
// ones", and re-formatting a half-typed number under the cursor is the classic
// way to make a form unusable.
//
// The SAC rate is deliberately *not* computed here. It follows from cylinder
// size, start/end pressure and gas compressibility (`cylinder_t::gas_volume`,
// `calculate_sac` in core/divelist.cpp); reimplementing that in TypeScript
// would be a second version of core physics that could disagree with the file.
// The editor asks the module instead, through `previewDive`.

import type { Cylinder, CylinderPatch, Dive } from './index';
import { CylinderUse } from './index';
import {
  barToMbar,
  cuftToMl,
  litersToMl,
  mbarToBar,
  mbarToPsi,
  mlToCuft,
  mlToLiters,
  psiToMbar,
  type UnitSystem,
} from './units';

/**
 * One row of the cylinder editor.
 *
 * `sourceIndex` is the cylinder's position in the dive's current list, or null
 * for a cylinder the user has just added. The bindings use it to tell a kept
 * cylinder from a new one (api.cpp, `apply_cylinders`), which is what makes a
 * row simply removed from the list mean "delete this cylinder".
 */
export type CylinderDraft = {
  /** Stable across edits, so React rows do not lose focus. Not sent. */
  key: string;
  sourceIndex: number | null;
  description: string;
  /** Litres or cubic feet, per the unit system the draft was built with. */
  sizeText: string;
  /** Bar or psi. */
  workingPressureText: string;
  /** Whole percent. Empty means air, which is the core's 0 sentinel. */
  o2Text: string;
  heText: string;
  startText: string;
  endText: string;
  use: CylinderUse;
  /**
   * The samples or gas-switch events refer to this cylinder, so it cannot be
   * removed. Carried from `Cylinder.used`; a new row is never used.
   */
  used: boolean;
};

let nextKey = 0;

function makeKey(): string {
  nextKey += 1;
  return `cyl-${nextKey}`;
}

// --- Number text -----------------------------------------------------------

/**
 * A number as typed, accepting the comma decimal separator a German or French
 * keyboard produces. Returns null for anything that is not a number, and
 * `undefined` for an empty field - which is a different thing: "not set" is a
 * legitimate value for a pressure the diver never wrote down, whereas "12,5,3"
 * is a mistake the editor must refuse to save.
 */
export function parseNumberInput(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') {
    return undefined;
  }
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function formatNumber(value: number, digits: number): string {
  if (value === 0) {
    return '';
  }
  // Trailing zeros are noise in a field the user is about to edit.
  return String(Number(value.toFixed(digits)));
}

// --- Draft <-> core units --------------------------------------------------

export function cylinderDraftFrom(
  cylinder: Cylinder,
  sourceIndex: number,
  system: UnitSystem
): CylinderDraft {
  const imperial = system === 'imperial';
  return {
    key: makeKey(),
    sourceIndex,
    description: cylinder.description,
    sizeText: imperial
      ? formatNumber(mlToCuft(cylinder.sizeMl), 1)
      : formatNumber(mlToLiters(cylinder.sizeMl), 1),
    workingPressureText: formatPressureInput(cylinder.workingPressureMbar, system),
    // The raw permille is shown, sentinel and all: a cylinder the file spells
    // as air must stay air, not become a literal 20.9% nitrox on the next save.
    o2Text: formatNumber(cylinder.gasmix.o2Permille / 10, 1),
    heText: formatNumber(cylinder.gasmix.hePermille / 10, 1),
    startText: formatPressureInput(cylinder.startMbar || cylinder.sampleStartMbar, system),
    endText: formatPressureInput(cylinder.endMbar || cylinder.sampleEndMbar, system),
    use: cylinder.use,
    used: cylinder.used,
  };
}

export function cylinderDraftsFrom(dive: Dive, system: UnitSystem): CylinderDraft[] {
  return dive.cylinders.map((cylinder, index) => cylinderDraftFrom(cylinder, index, system));
}

/**
 * A new cylinder row. Left blank rather than pre-filled with an AL80: the core's
 * `add_default_cylinder` fills from a preference this app has no UI for, and a
 * guessed size would silently change the SAC the diver is looking at.
 */
export function newCylinderDraft(): CylinderDraft {
  return {
    key: makeKey(),
    sourceIndex: null,
    description: '',
    sizeText: '',
    workingPressureText: '',
    o2Text: '',
    heText: '',
    startText: '',
    endText: '',
    use: CylinderUse.OcGas,
    used: false,
  };
}

/** What a pressure field is seeded with, so editing round-trips. */
export function formatPressureInput(mbar: number, system: UnitSystem): string {
  if (mbar === 0) {
    return '';
  }
  return system === 'imperial'
    ? String(Math.round(mbarToPsi(mbar)))
    : String(Math.round(mbarToBar(mbar)));
}

/** Millibar for a pressure field. `undefined` for empty, null for unreadable. */
export function parsePressureInput(
  text: string,
  system: UnitSystem
): number | null | undefined {
  const value = parseNumberInput(text);
  if (value === null || value === undefined) {
    return value;
  }
  return system === 'imperial' ? psiToMbar(value) : barToMbar(value);
}

/** Millilitres for a size field. */
export function parseSizeInput(text: string, system: UnitSystem): number | null | undefined {
  const value = parseNumberInput(text);
  if (value === null || value === undefined) {
    return value;
  }
  return system === 'imperial' ? cuftToMl(value) : litersToMl(value);
}

/** Permille for a gas-fraction field, which is entered in whole percent. */
export function parseFractionInput(text: string): number | null | undefined {
  const value = parseNumberInput(text);
  if (value === null || value === undefined) {
    return value;
  }
  return value > 100 ? null : Math.round(value * 10);
}

// --- Validation ------------------------------------------------------------

/** Per-row messages, keyed by the draft's `key`. Empty when everything parses. */
export type CylinderErrors = Record<string, string>;

/**
 * What the editor refuses to save. Only the mistakes that would put a wrong
 * number in the logbook: a pressure that is not a number, a mix over 100%, an
 * end pressure above the start. A missing size or pressure is not an error -
 * plenty of dives are logged without one.
 */
export function validateCylinderDrafts(
  drafts: readonly CylinderDraft[],
  system: UnitSystem
): CylinderErrors {
  const errors: CylinderErrors = {};
  for (const draft of drafts) {
    const message = validateCylinderDraft(draft, system);
    if (message !== null) {
      errors[draft.key] = message;
    }
  }
  return errors;
}

function validateCylinderDraft(draft: CylinderDraft, system: UnitSystem): string | null {
  const size = parseSizeInput(draft.sizeText, system);
  if (size === null) {
    return 'Size is not a number.';
  }
  const working = parsePressureInput(draft.workingPressureText, system);
  if (working === null) {
    return 'Working pressure is not a number.';
  }
  const start = parsePressureInput(draft.startText, system);
  if (start === null) {
    return 'Start pressure is not a number.';
  }
  const end = parsePressureInput(draft.endText, system);
  if (end === null) {
    return 'End pressure is not a number.';
  }
  const o2 = parseFractionInput(draft.o2Text);
  if (o2 === null) {
    return 'Oxygen must be a percentage between 0 and 100.';
  }
  const he = parseFractionInput(draft.heText);
  if (he === null) {
    return 'Helium must be a percentage between 0 and 100.';
  }
  if ((o2 ?? 0) + (he ?? 0) > 1000) {
    return 'Oxygen and helium together cannot exceed 100%.';
  }
  if (start !== undefined && end !== undefined && end > start) {
    return 'The end pressure cannot be above the start pressure.';
  }
  return null;
}

// --- Patch building --------------------------------------------------------

/**
 * The `cylinders` key of a dive patch, or null when the drafts describe exactly
 * the cylinders the dive already has - in which case the key is left out and
 * the module skips the whole cylinder path, SAC recomputation included.
 *
 * The array is always the *complete* resulting list, because that is what the
 * bindings expect: a cylinder missing from it is one the user deleted. Inside
 * an entry, only the fields the user actually touched are named, so an
 * untouched cylinder crosses as `{ sourceIndex: n }`.
 *
 * "Touched" is decided on the *text*, not on the parsed number, and that
 * distinction is the whole reason this function is not a plain value
 * comparison. A draft field is a rendering: 9987 ml shows as "10" litres and
 * 196140 mbar as "196" bar. Re-parsing those would hand back 10000 and 196000
 * and quietly rewrite two cylinders on a save the user thought only changed the
 * notes. Comparing against the text the same cylinder would seed makes an
 * untouched field untouched by construction.
 */
export function buildCylinderPatches(
  dive: Dive,
  drafts: readonly CylinderDraft[],
  system: UnitSystem
): CylinderPatch[] | null {
  const entries: CylinderPatch[] = [];
  let changed = drafts.length !== dive.cylinders.length;

  for (const draft of drafts) {
    const entry: CylinderPatch = {};
    const original =
      draft.sourceIndex === null ? undefined : dive.cylinders[draft.sourceIndex];
    // What the editor put in the fields when it opened this cylinder.
    const seed =
      original === undefined
        ? undefined
        : cylinderDraftFrom(original, draft.sourceIndex as number, system);

    if (draft.sourceIndex !== null) {
      entry.sourceIndex = draft.sourceIndex;
    }
    if (!seed || seed.description.trim() !== draft.description.trim()) {
      entry.description = draft.description.trim();
    }
    if (!seed || seed.sizeText !== draft.sizeText) {
      entry.sizeMl = parseSizeInput(draft.sizeText, system) ?? 0;
    }
    if (!seed || seed.workingPressureText !== draft.workingPressureText) {
      entry.workingPressureMbar = parsePressureInput(draft.workingPressureText, system) ?? 0;
    }
    if (!seed || seed.o2Text !== draft.o2Text) {
      entry.o2Permille = parseFractionInput(draft.o2Text) ?? 0;
    }
    if (!seed || seed.heText !== draft.heText) {
      entry.hePermille = parseFractionInput(draft.heText) ?? 0;
    }
    if (!seed || seed.startText !== draft.startText) {
      entry.startMbar = parsePressureInput(draft.startText, system) ?? 0;
    }
    if (!seed || seed.endText !== draft.endText) {
      entry.endMbar = parsePressureInput(draft.endText, system) ?? 0;
    }
    if (!seed || seed.use !== draft.use) {
      entry.use = draft.use;
    }

    // `sourceIndex` alone is "keep this one as it is".
    if (Object.keys(entry).length > (entry.sourceIndex === undefined ? 0 : 1)) {
      changed = true;
    }
    // A cylinder that moved up because an earlier one was deleted is unchanged
    // in itself, but its position is not - the bindings need every entry.
    entries.push(entry);
  }

  // Ordering the bindings enforce, checked here so the editor can report it
  // rather than the module rejecting the save.
  const sourceIndices = entries
    .map((entry) => entry.sourceIndex)
    .filter((index): index is number => index !== undefined);
  const strictlyIncreasing = sourceIndices.every(
    (index, at) => at === 0 || index > sourceIndices[at - 1]
  );
  if (!strictlyIncreasing) {
    throw new Error('Cylinders may not be reordered.');
  }

  return changed ? entries : null;
}

