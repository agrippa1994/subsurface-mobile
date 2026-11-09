// AI-generated (Claude)
// The plan being edited. Lives outside React because three screens work on it (the
// plan, the cylinder sheet, the notes), and it should still be there when the diver
// comes back to the tab. It is deliberately not persisted: a plan left over from
// last week is not what opening the planner should show.
import { useSyncExternalStore } from 'react';

import type { DiveSummary, Units } from '@/models';
import { defaultPlanDraft, defaultPlanWhen, type PlanDraft } from '@/models/planner';

let draft: PlanDraft | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function freshDraft(units: Units, dives: readonly DiveSummary[]): PlanDraft {
  const now = Date.now();
  return defaultPlanDraft(units, defaultPlanWhen(now, new Date(now).getTimezoneOffset(), dives));
}

/** Made the first time a screen asks: the default depends on the units and the log. */
function currentDraft(units: Units, dives: readonly DiveSummary[]): PlanDraft {
  draft ??= freshDraft(units, dives);
  return draft;
}

export function usePlanDraft(units: Units, dives: readonly DiveSummary[]): PlanDraft {
  return useSyncExternalStore(subscribe, () => currentDraft(units, dives));
}

export function updatePlanDraft(change: (current: PlanDraft) => PlanDraft): void {
  if (draft === null) {
    return;
  }
  draft = change(draft);
  listeners.forEach((listener) => listener());
}

export function resetPlanDraft(units: Units, dives: readonly DiveSummary[]): void {
  draft = freshDraft(units, dives);
  listeners.forEach((listener) => listener());
}
