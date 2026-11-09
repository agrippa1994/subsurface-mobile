// AI-generated (Claude)
// What the plan screen shows and does; both variants render this.
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, useWindowDimensions } from 'react-native';

import { operationFailed, operationSucceeded } from '@/lib/haptics';
import { CylinderUse, formatDepth, PlanDiveMode } from '@/models';
import {
  addCylinder,
  addSegment,
  depthFromValue,
  depthRange,
  depthUnit,
  depthValue,
  newCylinderDraft,
  patchSegment,
  planCanBeSaved,
  planGasRows,
  planHeadline,
  planStops,
  tightestGasRow,
  planWarnings,
  removeSegment,
  setDiveMode,
  surfaceIntervalText,
  type PlanCylinderDraft,
  type PlanSegmentDraft,
} from '@/models/planner';
import { buildProfilePlot } from '@/models/profile-plot';
import { useSavePlan } from '@/queries/logbook-mutations';

import { usePlanner } from './use-planner';

export function usePlannerScreen() {
  const planner = usePlanner();
  const { draft, units, outcome, setDraft, input } = planner;
  const router = useRouter();
  const save = useSavePlan();
  const { width, height } = useWindowDimensions();

  const twoPanes = width > height && width >= 700;
  const result = outcome.kind === 'planned' ? outcome.result : null;

  const view = useMemo(() => {
    if (result === null) {
      return null;
    }
    const gasRows = planGasRows(result, units);
    return {
      headline: planHeadline(result),
      stops: planStops(result),
      gasRows,
      tightestGas: tightestGasRow(gasRows),
      warnings: planWarnings(result, units, draft.when, planner.dives),
      plot: result.profile ? buildProfilePlot(result.profile, result.dive?.dcs[0]?.events ?? []) : null,
      interval: surfaceIntervalText(result),
      canSave: planCanBeSaved(result),
    };
  }, [result, units, draft.when, planner.dives]);

  // Asks nothing: the diver has just pressed the button for it, and it undoes.
  const savePlan = () => {
    save.mutate(input, {
      onSuccess: ({ id }) => {
        operationSucceeded();
        router.navigate(`/dives/${id}`);
      },
      onError: (error) => {
        operationFailed();
        Alert.alert('The plan was not saved', error.message);
      },
    });
  };

  return {
    ...planner,
    result,
    view,
    /** Plan on one side, results on the other, as the dive screen does in landscape. */
    twoPanes,
    /**
     * A view hosted in a SwiftUI row takes no width from it, so it has to be told:
     * the pane less the Form's margins (16 each side) and the row's insets (20 each).
     */
    chartWidth: (twoPanes ? width / 2 : width) - 72,
    depthRange: depthRange(units),
    depthUnit: depthUnit(units),
    depthOf: (segment: PlanSegmentDraft) => depthValue(segment.depthMm, units),
    summaryBar: {
      runtime: view?.headline.runtime ?? null,
      depth: result ? formatDepth(result.maxDepthMm, units) : '',
      decoLine: view?.headline.decoLine ?? '',
      gas: view?.tightestGas ?? null,
      warnings: view?.warnings ?? [],
      problem: outcome.kind === 'planned' ? null : outcome.message,
    },
    isDiluent: (cylinder: PlanCylinderDraft | undefined) => cylinder?.use === CylinderUse.Diluent,
    isCcr: draft.diveMode === PlanDiveMode.Ccr,
    isPscr: draft.diveMode === PlanDiveMode.Pscr,
    setDepth: (key: string, value: number) =>
      setDraft((d) => patchSegment(d, key, { depthMm: depthFromValue(value, units) })),
    setMinutes: (key: string, minutes: number) =>
      setDraft((d) => patchSegment(d, key, { minutes })),
    setSegmentGas: (key: string, cylinderKey: string) =>
      setDraft((d) => patchSegment(d, key, { cylinderKey })),
    setSetpoint: (key: string, setpointMbar: number) =>
      setDraft((d) => patchSegment(d, key, { setpointMbar })),
    setOnLoop: (key: string, onLoop: boolean) => setDraft((d) => patchSegment(d, key, { onLoop })),
    addLevel: () => setDraft(addSegment),
    removeLevel: (key: string) => setDraft((d) => removeSegment(d, key)),
    setMode: (mode: PlanDiveMode) => setDraft((d) => setDiveMode(d, mode)),
    openCylinder: (key: string) =>
      router.push({ pathname: '/tools/planner-cylinder', params: { key } }),
    addCylinderAndOpen: () => {
      const cylinder = newCylinderDraft(units);
      setDraft((d) => addCylinder(d, cylinder));
      router.push({ pathname: '/tools/planner-cylinder', params: { key: cylinder.key } });
    },
    openSettings: () => router.push('/tools/planner-settings'),
    openNotes: () => router.push('/tools/planner-notes'),
    savePlan,
    saving: save.isPending,
  };
}
