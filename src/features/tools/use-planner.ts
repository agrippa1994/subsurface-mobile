// AI-generated (Claude)
// The planner's state and its result, shared by every planner screen.
//
// The plan is worked out synchronously during render, from the draft, the settings
// and the logbook (whose dives are part of the calculation). So the result on screen
// is always of the inputs on screen: there is no moment for a stale one to be shown,
// which is why this is not debounced. A plan takes milliseconds at the depths and
// times the screen allows (docs/tasks/15-dive-planner.md has the measurements).
import { useCallback, useMemo } from 'react';

import type { DiveSummary, PlanInput, PlanResult, Units } from '@/models';
import { describeError } from '@/models/errors';
import {
  draftProblem,
  planFailure,
  planHasResult,
  planInput,
  type PlanDraft,
} from '@/models/planner';
import { DEFAULT_PLANNER_SETTINGS, type PlannerSettings } from '@/models/planner-settings';
import { useDives } from '@/queries/logbook';
import { useGradientFactors, useSettings, useUpdateSettings } from '@/queries/settings';

import { planDive } from '../../../modules/ssrf-core/src';
import { resetPlanDraft, updatePlanDraft, usePlanDraft } from './planner-store';

export type PlanOutcome =
  /** The draft cannot be asked for yet, and this says why in the diver's terms. */
  | { kind: 'problem'; message: string }
  /** Asked for, and the core has an answer that is only an explanation. */
  | { kind: 'failed'; message: string; result: PlanResult }
  /** Something went wrong below the planner, which is a bug to report. */
  | { kind: 'error'; message: string }
  | { kind: 'planned'; result: PlanResult };

const NO_DIVES: readonly DiveSummary[] = [];

export function usePlanner() {
  const settings = useSettings();
  const units: Units = settings.units;
  const planner: PlannerSettings = settings.planner;
  const gf = useGradientFactors();
  const dives = useDives().data ?? NO_DIVES;
  const draft = usePlanDraft(units, dives);

  const input: PlanInput = useMemo(
    () => planInput(draft, planner, units, gf),
    [draft, planner, units, gf],
  );

  const outcome: PlanOutcome = useMemo(() => {
    const problem = draftProblem(draft, planner, units);
    if (problem !== null) {
      return { kind: 'problem', message: problem };
    }
    try {
      const result = planDive(input);
      return planHasResult(result)
        ? { kind: 'planned', result }
        : { kind: 'failed', message: planFailure(result), result };
    } catch (error) {
      return { kind: 'error', message: describeError(error).message };
    }
    // The dives are not read here, but the core reads them: a dive added or removed
    // in the logbook changes the tissues this plan starts from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, planner, units, input, dives]);

  const update = useUpdateSettings();
  const setPlanner = useCallback(
    (patch: Partial<PlannerSettings>) =>
      update.mutate({ planner: { ...planner, ...patch } }),
    [update, planner],
  );
  const restorePlanner = useCallback(
    () => update.mutate({ planner: DEFAULT_PLANNER_SETTINGS }),
    [update],
  );

  return {
    draft,
    units,
    planner,
    gf,
    input,
    outcome,
    dives,
    setDraft: updatePlanDraft as (change: (current: PlanDraft) => PlanDraft) => void,
    resetDraft: () => resetPlanDraft(units, dives),
    setPlanner,
    restorePlanner,
  };
}
