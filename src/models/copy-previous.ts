// AI-generated (Claude)
// "Same as last time": carrying the gear and the people of the previous dive
// over into the one being edited.
//
// A diver on a trip dives two or three times a day with the same tank, the same
// lead and the same buddy, and typing all of it again for every dive is the
// tedious part of logging. These functions take the editor's current drafts and
// the previous dive, and return new drafts - nothing is written until the
// editor saves, so the diver sees (and can correct) the result first.
//
// Pure functions only - no React, no native module. The drafts they return go
// through the same `buildCylinderPatches` / `buildWeightPatches` as hand-made
// edits, so the patch rules (sourceIndex, no reordering) hold by construction.

import { cylinderDraftFrom, newCylinderDraft, type CylinderDraft } from './cylinder-edit';
import { formatNameList, parseNameList } from './dive-edit';
import type { Cylinder, DiveSummary, WeightSystem } from './index';
import type { UnitSystem } from './units';
import { newWeightDraft, weightDraftFrom, type WeightDraft } from './weight-edit';

/**
 * The dive logged immediately before `dive`, by start time. Undefined for the
 * first dive in the log.
 */
export function findPreviousDive(
  dives: readonly DiveSummary[],
  dive: Pick<DiveSummary, 'id' | 'when'>
): DiveSummary | undefined {
  let previous: DiveSummary | undefined;
  for (const other of dives) {
    if (other.id === dive.id || other.when >= dive.when) {
      continue;
    }
    if (previous === undefined || other.when > previous.when) {
      previous = other;
    }
  }
  return previous;
}

/**
 * The cylinder rows after taking over the previous dive's cylinder setup:
 * description, size, working pressure, gas mix and use.
 *
 * Start and end pressures are *not* copied - they are what this dive's SAC is
 * computed from, and last dive's 50 bar is not this dive's. Whatever this dive
 * already has for them (typed, or from the computer's samples) is kept.
 *
 * Rows are matched by position, so an existing cylinder is updated in place
 * rather than deleted and re-added. Surplus rows of this dive are dropped,
 * except the ones the dive computer recorded: those cannot be removed (see
 * `CylinderDraft.used`) and are left as they are.
 */
export function copyCylinderSetup(
  current: readonly CylinderDraft[],
  previous: readonly Cylinder[],
  system: UnitSystem
): CylinderDraft[] {
  const rows: CylinderDraft[] = [];
  previous.forEach((cylinder, index) => {
    const source = cylinderDraftFrom(cylinder, index, system);
    const setup = {
      description: source.description,
      sizeText: source.sizeText,
      workingPressureText: source.workingPressureText,
      o2Text: source.o2Text,
      heText: source.heText,
      use: source.use,
    };
    const existing = current[index];
    rows.push(existing ? { ...existing, ...setup } : { ...newCylinderDraft(), ...setup });
  });
  for (const extra of current.slice(previous.length)) {
    if (extra.used) {
      rows.push(extra);
    }
  }
  return rows;
}

/**
 * The weight rows after taking over the previous dive's weights. Unlike
 * cylinders there is nothing dive-specific about a weight, so the previous list
 * replaces this one outright; existing rows are reused by position so the patch
 * edits them rather than deleting and re-adding.
 */
export function copyWeights(
  current: readonly WeightDraft[],
  previous: readonly WeightSystem[],
  system: UnitSystem
): WeightDraft[] {
  return previous.map((weight, index) => {
    const source = weightDraftFrom(weight, index, system);
    const values = { description: source.description, weightText: source.weightText };
    const existing = current[index];
    return existing ? { ...existing, ...values } : { ...newWeightDraft(), ...values };
  });
}

/**
 * A comma-separated name field with the previous dive's names added. A union
 * rather than a replacement: a buddy already entered for this dive (or synced
 * in from elsewhere) is never lost, and copying twice changes nothing.
 */
export function mergeNames(current: string, previous: string): string {
  return formatNameList([...parseNameList(current), ...parseNameList(previous)]);
}
