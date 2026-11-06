// AI-generated (Claude)
// The planner's settings screen; both variants draw PLANNER_SETTING_SECTIONS with this.
import type { PlanDecoMode } from '@/models';
import {
  PLANNER_SETTING_SECTIONS,
  snapToStep,
  type PlannerSetting,
  type PlannerSettingSection,
  type StepperSetting,
} from '@/models/planner-settings';

import { plannerSurface } from '../../../modules/ssrf-core/src';
import { usePlanner } from './use-planner';

function altitudeRange(imperial: boolean) {
  return imperial ? { min: 0, max: 9750, step: 150 } : { min: 0, max: 3000, step: 50 };
}

export function usePlannerSettingsScreen() {
  const { planner, setPlanner, restorePlanner, system, gf } = usePlanner();
  const imperial = system === 'imperial';

  const sections: PlannerSettingSection[] = PLANNER_SETTING_SECTIONS.map((section) => ({
    ...section,
    settings: section.settings.filter((setting) => setting.visible?.(planner) ?? true),
  })).filter((section) => section.settings.length > 0);

  const altRange = altitudeRange(imperial);
  const altitudeMm = plannerSurface({ surfacePressureMbar: planner.surfacePressureMbar }).altitudeMm;
  const altitude = Math.round((imperial ? altitudeMm / 304.8 : altitudeMm / 1000) / altRange.step) * altRange.step;

  return {
    planner,
    sections,
    stepperValue: (setting: StepperSetting) => setting.value(planner, system, gf),
    stepperLabel: (setting: StepperSetting) =>
      `${setting.label}  ${setting.format(setting.value(planner, system, gf), system)}`,
    stepperRange: (setting: StepperSetting) => setting.range(system),
    setStepper: (setting: StepperSetting, value: number) =>
      setPlanner(setting.patch(snapToStep(value, setting.range(system)), system)),
    toggleValue: (setting: Extract<PlannerSetting, { kind: 'toggle' }>) =>
      planner[setting.key] === true,
    setToggle: (setting: Extract<PlannerSetting, { kind: 'toggle' }>, value: boolean) =>
      setPlanner({ [setting.key]: value }),
    setDecoMode: (decoMode: PlanDecoMode) => setPlanner({ decoMode }),
    setSurfacePressure: (surfacePressureMbar: number) => setPlanner({ surfacePressureMbar }),
    altitude,
    altitudeRange: altRange,
    altitudeLabel: `Altitude  ${altitude} ${imperial ? 'ft' : 'm'}`,
    setAltitude: (value: number) =>
      setPlanner({
        surfacePressureMbar: plannerSurface({
          altitudeMm: Math.round(imperial ? value * 304.8 : value * 1000),
        }).surfacePressureMbar,
      }),
    restore: restorePlanner,
    gfFollowsSettings: planner.gfLow === null && planner.gfHigh === null,
  };
}
