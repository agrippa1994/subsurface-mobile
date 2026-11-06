// AI-generated (Claude)
// The plan being edited. Lives outside React because three screens work on it (the
// plan, the cylinder sheet, the notes), and it should still be there when the diver
// comes back to the tab. It is deliberately not persisted: a plan left over from
// last week is not what opening the planner should show.
import { useSyncExternalStore } from 'react';

import type { DiveSummary, UnitSystem } from '@/models';
import { defaultPlanDraft, defaultPlanWhen, type PlanDraft } from '@/models/planner';

let draft: PlanDraft | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function freshDraft(system: UnitSystem, dives: readonly DiveSummary[]): PlanDraft {
  const now = Date.now();
  return defaultPlanDraft(system, defaultPlanWhen(now, new Date(now).getTimezoneOffset(), dives));
}

/** Made the first time a screen asks: the default depends on the units and the log. */
function currentDraft(system: UnitSystem, dives: readonly DiveSummary[]): PlanDraft {
  draft ??= freshDraft(system, dives);
  return draft;
}

export function usePlanDraft(system: UnitSystem, dives: readonly DiveSummary[]): PlanDraft {
  return useSyncExternalStore(subscribe, () => currentDraft(system, dives));
}

export function updatePlanDraft(change: (current: PlanDraft) => PlanDraft): void {
  if (draft === null) {
    return;
  }
  draft = change(draft);
  listeners.forEach((listener) => listener());
}

export function resetPlanDraft(system: UnitSystem, dives: readonly DiveSummary[]): void {
  draft = freshDraft(system, dives);
  listeners.forEach((listener) => listener());
}
