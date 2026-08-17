// AI-generated (Claude)
// Presentation model of the weights editor.
//
// The counterpart of ./cylinder-edit for `weightsystem_t` (core/equipment.h):
// pure functions, no React and no native module. The core stores a weight in
// grams; what the diver types is kilograms or pounds, so the conversion happens
// here, exactly once, and the editor binds to plain strings.
//
// Fields are text rather than numbers for the same reason as in the cylinder
// editor: a numeric draft cannot represent "the digits have been deleted and
// new ones are about to be typed".

import { parseNumberInput } from './cylinder-edit';
import type { Dive, WeightSystem, WeightSystemPatch } from './index';
import { gramsToKg, gramsToLbs, kgToGrams, lbsToGrams, type UnitSystem } from './units';

/**
 * One row of the weights editor.
 *
 * `sourceIndex` is the weightsystem's position in the dive's current list, or
 * null for one the user has just added - which is what lets the bindings
 * (api.cpp, `apply_weightsystems`) read a row missing from the list as
 * "delete this weight".
 */
export type WeightDraft = {
  /** Stable across edits, so React rows do not lose focus. Not sent. */
  key: string;
  sourceIndex: number | null;
  /** Free text: "integrated", "belt", "ankle". */
  description: string;
  /** Kilograms or pounds, per the unit system the draft was built with. */
  weightText: string;
};

let nextKey = 0;

function makeKey(): string {
  nextKey += 1;
  return `weight-${nextKey}`;
}

// --- Draft <-> core units --------------------------------------------------

/**
 * What a weight field is seeded with, so editing round-trips. One decimal: a
 * dive weight is never known finer, and the same rounding `formatWeight` uses
 * for display keeps the editor and the detail screen agreeing.
 */
export function formatWeightInput(grams: number, system: UnitSystem): string {
  if (grams === 0) {
    return '';
  }
  const value = system === 'imperial' ? gramsToLbs(grams) : gramsToKg(grams);
  return String(Number(value.toFixed(1)));
}

/** Grams for a weight field. `undefined` for empty, null for unreadable. */
export function parseWeightInput(text: string, system: UnitSystem): number | null | undefined {
  const value = parseNumberInput(text);
  if (value === null || value === undefined) {
    return value;
  }
  return system === 'imperial' ? lbsToGrams(value) : kgToGrams(value);
}

export function weightDraftFrom(
  weight: WeightSystem,
  sourceIndex: number,
  system: UnitSystem
): WeightDraft {
  return {
    key: makeKey(),
    sourceIndex,
    description: weight.description,
    weightText: formatWeightInput(weight.weightGrams, system),
  };
}

export function weightDraftsFrom(dive: Dive, system: UnitSystem): WeightDraft[] {
  return dive.weightsystems.map((weight, index) => weightDraftFrom(weight, index, system));
}

/** A new, blank weight row. */
export function newWeightDraft(): WeightDraft {
  return {
    key: makeKey(),
    sourceIndex: null,
    description: '',
    weightText: '',
  };
}

/**
 * The total the editor shows while typing. Plain arithmetic rather than a
 * `previewDive` round trip, because `dive::total_weight()` is exactly this sum -
 * unlike the SAC rate, there is no core physics to disagree with.
 */
export function totalWeightGrams(drafts: readonly WeightDraft[], system: UnitSystem): number {
  let total = 0;
  for (const draft of drafts) {
    total += parseWeightInput(draft.weightText, system) ?? 0;
  }
  return total;
}

// --- Validation ------------------------------------------------------------

/** Per-row messages, keyed by the draft's `key`. Empty when everything parses. */
export type WeightErrors = Record<string, string>;

/**
 * What the editor refuses to save. Only a weight that is not a number: a blank
 * weight and a blank description are both legitimate - plenty of dives are
 * logged with "6 kg" and no idea what kind of belt it was, or the other way
 * around.
 */
export function validateWeightDrafts(
  drafts: readonly WeightDraft[],
  system: UnitSystem
): WeightErrors {
  const errors: WeightErrors = {};
  for (const draft of drafts) {
    if (parseWeightInput(draft.weightText, system) === null) {
      errors[draft.key] = 'Weight is not a number.';
    }
  }
  return errors;
}

// --- Patch building --------------------------------------------------------

/**
 * The `weightsystems` key of a dive patch, or null when the drafts describe
 * exactly the weights the dive already has - in which case the key is left out
 * and the module skips the weight path entirely.
 *
 * The array is always the *complete* resulting list, because that is what the
 * bindings expect: a weightsystem missing from it is one the user deleted.
 * Inside an entry only the fields the user actually touched are named, so an
 * untouched weight crosses as `{ sourceIndex: n }` and keeps its `auto_filled`
 * flag.
 *
 * "Touched" is decided on the *text*, not on the parsed number, for the reason
 * spelled out at `buildCylinderPatches`: a draft field is a rendering, and
 * 5987 g shows as "6" kg. Re-parsing that would hand back 6000 g and quietly
 * rewrite a weight on a save the user thought only changed the notes.
 */
export function buildWeightPatches(
  dive: Dive,
  drafts: readonly WeightDraft[],
  system: UnitSystem
): WeightSystemPatch[] | null {
  const entries: WeightSystemPatch[] = [];
  let changed = drafts.length !== dive.weightsystems.length;

  for (const draft of drafts) {
    const entry: WeightSystemPatch = {};
    const original =
      draft.sourceIndex === null ? undefined : dive.weightsystems[draft.sourceIndex];
    // What the editor put in the fields when it opened this weight.
    const seed =
      original === undefined
        ? undefined
        : weightDraftFrom(original, draft.sourceIndex as number, system);

    if (draft.sourceIndex !== null) {
      entry.sourceIndex = draft.sourceIndex;
    }
    if (!seed || seed.description.trim() !== draft.description.trim()) {
      entry.description = draft.description.trim();
    }
    if (!seed || seed.weightText !== draft.weightText) {
      entry.weightGrams = parseWeightInput(draft.weightText, system) ?? 0;
    }

    // `sourceIndex` alone is "keep this one as it is".
    if (Object.keys(entry).length > (entry.sourceIndex === undefined ? 0 : 1)) {
      changed = true;
    }
    // A weight that moved up because an earlier one was deleted is unchanged in
    // itself, but its position is not - the bindings need every entry.
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
    throw new Error('Weights may not be reordered.');
  }

  return changed ? entries : null;
}
