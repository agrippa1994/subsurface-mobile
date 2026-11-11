// AI-generated (Claude)
// The sheet that edits one cylinder of the plan; both variants render this.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';

import { CylinderUse, formatDepth, PlanDiveMode, type PlanTank } from '@/models';
import {
  cylinderInUse,
  fillFromValue,
  fillRange,
  fillValue,
  GAS_PRESETS,
  gasName,
  patchCylinder,
  plannedMaxDepthMm,
  removeCylinder,
  tankPatch,
} from '@/models/planner';

import { gasInfo, plannerOptions } from '../../../modules/ssrf-core/src';
import { usePlanner } from './use-planner';
import { labelled, t } from '@/i18n';

/** The core's table does not change while the app runs. */
let tanks: PlanTank[] | null = null;
function coreTanks(): PlanTank[] {
  if (tanks === null) {
    tanks = plannerOptions().tanks;
  }
  return tanks;
}

export const USE_OPTIONS: readonly { value: CylinderUse; readonly label: string }[] = [
  labelled({ value: CylinderUse.OcGas }, () => t('diveForm.use.ocGas')),
  labelled({ value: CylinderUse.Diluent }, () => t('diveForm.use.diluent')),
];

export function usePlannerCylinderScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const router = useRouter();
  const { draft, setDraft, units, planner } = usePlanner();
  const cylinder = draft.cylinders.find((candidate) => candidate.key === key) ?? null;

  const maxDepthMm = plannedMaxDepthMm(draft);
  const best = useMemo(() => {
    try {
      return (
        gasInfo({
          o2Permille: 210,
          o2Narcotic: planner.o2Narcotic,
          surfacePressureMbar: planner.surfacePressureMbar,
          bestMix: {
            depthMm: maxDepthMm,
            bottomPo2Mbar: planner.bottomPo2Mbar,
            bestMixEndMm: planner.bestMixEndMm,
          },
        }).best ?? null
      );
    } catch {
      return null;
    }
  }, [maxDepthMm, planner]);

  const tankList = useMemo(() => {
    const list = coreTanks();
    return list.some((tank) => tank.name === cylinder?.tank)
      ? list
      : [{ name: cylinder?.tank ?? '', sizeMl: 0, workingPressureMbar: 0 }, ...list];
  }, [cylinder?.tank]);

  const patch = (changes: Parameters<typeof patchCylinder>[2]) =>
    setDraft((d) => patchCylinder(d, key, changes));

  return {
    cylinder,
    units,
    tanks: tankList,
    presets: GAS_PRESETS,
    fillRange: fillRange(units),
    fill: cylinder ? fillValue(cylinder.fillMbar, units) : 0,
    fillUnit: units.pressure === 'psi' ? 'psi' : 'bar',
    showUse: draft.diveMode === PlanDiveMode.Ccr,
    canRemove: draft.cylinders.length > 1 && !cylinderInUse(draft, key),
    inUse: cylinderInUse(draft, key),
    bestLabel: best
      ? t('plannerScreen.bestMix', {
          depth: formatDepth(maxDepthMm, units),
          gas: gasName(Math.round(best.o2Permille / 10), Math.round(best.hePermille / 10)),
        })
      : null,
    applyBest: () => {
      if (best) {
        patch({
          o2Percent: Math.round(best.o2Permille / 10),
          hePercent: Math.round(best.hePermille / 10),
        });
      }
    },
    setTank: (name: string) => {
      const tank = coreTanks().find((candidate) => candidate.name === name);
      if (tank) {
        patch(tankPatch(tank));
      }
    },
    setPreset: (label: string) => {
      const preset = GAS_PRESETS.find((candidate) => candidate.label === label);
      if (preset) {
        patch({ o2Percent: preset.o2, hePercent: preset.he });
      }
    },
    setO2: (o2Percent: number) => patch({ o2Percent }),
    setHe: (hePercent: number) => patch({ hePercent }),
    setFill: (value: number) => patch({ fillMbar: fillFromValue(value, units) }),
    setUse: (use: CylinderUse) => patch({ use }),
    remove: () => {
      setDraft((d) => removeCylinder(d, key));
      router.back();
    },
  };
}
