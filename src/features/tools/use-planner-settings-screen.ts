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

function altitudeRange(feet: boolean) {
  return feet ? { min: 0, max: 9750, step: 150 } : { min: 0, max: 3000, step: 50 };
}

export function usePlannerSettingsScreen() {
  const { planner, setPlanner, restorePlanner, units, gf } = usePlanner();
  const feet = units.depth === 'ft';

  const sections: (Omit<PlannerSettingSection, 'footer'> & { footer?: string })[] = PLANNER_SETTING_SECTIONS.map((section) => ({
    ...section,
    footer: typeof section.footer === 'function' ? section.footer(planner) : section.footer,
    settings: section.settings.filter((setting) => setting.visible?.(planner) ?? true),
  })).filter((section) => section.settings.length > 0);

  const altRange = altitudeRange(feet);
  const altitudeMm = plannerSurface({ surfacePressureMbar: planner.surfacePressureMbar }).altitudeMm;
  const altitude = Math.round((feet ? altitudeMm / 304.8 : altitudeMm / 1000) / altRange.step) * altRange.step;

  return {
    planner,
    sections,
    stepperValue: (setting: StepperSetting) => setting.value(planner, units, gf),
    stepperLabel: (setting: StepperSetting) =>
      `${setting.label}  ${setting.format(setting.value(planner, units, gf), units)}`,
    stepperRange: (setting: StepperSetting) => setting.range(units),
    setStepper: (setting: StepperSetting, value: number) =>
      setPlanner(setting.patch(snapToStep(value, setting.range(units)), units)),
    toggleValue: (setting: Extract<PlannerSetting, { kind: 'toggle' }>) =>
      planner[setting.key] === true,
    setToggle: (setting: Extract<PlannerSetting, { kind: 'toggle' }>, value: boolean) =>
      setPlanner({ [setting.key]: value }),
    setDecoMode: (decoMode: PlanDecoMode) => setPlanner({ decoMode }),
    setSurfacePressure: (surfacePressureMbar: number) => setPlanner({ surfacePressureMbar }),
    altitude,
    altitudeRange: altRange,
    altitudeLabel: `Altitude  ${altitude} ${feet ? 'ft' : 'm'}`,
    setAltitude: (value: number) =>
      setPlanner({
        surfacePressureMbar: plannerSurface({
          altitudeMm: Math.round(feet ? value * 304.8 : value * 1000),
        }).surfacePressureMbar,
      }),
    restore: restorePlanner,
    gfFollowsSettings: planner.gfLow === null && planner.gfHigh === null,
  };
}
