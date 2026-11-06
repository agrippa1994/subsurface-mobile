// AI-generated (Claude)
// What the plan screen shows and does; both variants render this.
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, useWindowDimensions } from 'react-native';

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
  const { draft, system, outcome, setDraft, input } = planner;
  const router = useRouter();
  const save = useSavePlan();
  const { width, height } = useWindowDimensions();

  const result = outcome.kind === 'planned' ? outcome.result : null;

  const view = useMemo(() => {
    if (result === null) {
      return null;
    }
    return {
      headline: planHeadline(result),
      stops: planStops(result),
      gasRows: planGasRows(result, system),
      warnings: planWarnings(result, system),
      plot: result.profile ? buildProfilePlot(result.profile, result.dive?.dcs[0]?.events ?? []) : null,
      interval: surfaceIntervalText(result),
      canSave: planCanBeSaved(result),
    };
  }, [result, system]);

  const savePlan = () => {
    Alert.alert(
      'Add to the logbook?',
      'It is added as a planned dive, marked as such, with the plan in its notes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: () =>
            save.mutate(input, {
              onSuccess: ({ id }) => router.navigate(`/dives/${id}`),
              onError: (error) => Alert.alert('The plan was not saved', error.message),
            }),
        },
      ],
    );
  };

  return {
    ...planner,
    result,
    view,
    /** Plan on one side, results on the other, as the dive screen does in landscape. */
    twoPanes: width > height && width >= 700,
    depthRange: depthRange(system),
    depthUnit: depthUnit(system),
    depthOf: (segment: PlanSegmentDraft) => depthValue(segment.depthMm, system),
    maxDepthText: result ? formatDepth(result.maxDepthMm, system) : '',
    isDiluent: (cylinder: PlanCylinderDraft | undefined) => cylinder?.use === CylinderUse.Diluent,
    isCcr: draft.diveMode === PlanDiveMode.Ccr,
    isPscr: draft.diveMode === PlanDiveMode.Pscr,
    setDepth: (key: string, value: number) =>
      setDraft((d) => patchSegment(d, key, { depthMm: depthFromValue(value, system) })),
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
      const cylinder = newCylinderDraft(system);
      setDraft((d) => addCylinder(d, cylinder));
      router.push({ pathname: '/tools/planner-cylinder', params: { key: cylinder.key } });
    },
    openSettings: () => router.push('/tools/planner-settings'),
    openNotes: () => router.push('/tools/planner-notes'),
    savePlan,
    saving: save.isPending,
  };
}
