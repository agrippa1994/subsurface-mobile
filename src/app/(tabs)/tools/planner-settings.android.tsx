// AI-generated (Claude)
// The planner's settings, Android variant: PLANNER_SETTING_SECTIONS in Compose.
import {
  M3ActionRow,
  M3Screen,
  M3Section,
  M3SegmentedRow,
  M3StepperRow,
  M3SwitchRow,
} from '@/components/material/list';
import { usePlannerSettingsScreen } from '@/features/tools/use-planner-settings-screen';
import { DECO_MODE_OPTIONS } from '@/models/planner-settings';

export default function PlannerSettingsScreen() {
  const screen = usePlannerSettingsScreen();

  return (
    <M3Screen>
      <M3Section title="Deco model">
        <M3SegmentedRow
          options={DECO_MODE_OPTIONS}
          value={screen.planner.decoMode}
          onChange={screen.setDecoMode}
        />
      </M3Section>

      {screen.sections.map((section) => (
        <M3Section key={section.title} title={section.title} footer={section.footer}>
          {section.settings.map((setting) =>
            setting.kind === 'toggle' ? (
              <M3SwitchRow
                key={setting.key}
                label={setting.label}
                value={screen.toggleValue(setting)}
                onChange={(value) => screen.setToggle(setting, value)}
              />
            ) : (
              <M3StepperRow
                key={setting.key}
                label={screen.stepperLabel(setting)}
                value={screen.stepperValue(setting)}
                {...screen.stepperRange(setting)}
                onChange={(value) => screen.setStepper(setting, value)}
              />
            ),
          )}
        </M3Section>
      ))}

      <M3Section title="Altitude">
        <M3StepperRow
          label={screen.altitudeLabel}
          value={screen.altitude}
          {...screen.altitudeRange}
          onChange={screen.setAltitude}
        />
        <M3StepperRow
          label={`Surface pressure  ${screen.planner.surfacePressureMbar} mbar`}
          value={screen.planner.surfacePressureMbar}
          min={689}
          max={1100}
          step={1}
          onChange={screen.setSurfacePressure}
        />
      </M3Section>

      <M3Section>
        <M3ActionRow label="Restore defaults" destructive onPress={screen.restore} />
      </M3Section>
    </M3Screen>
  );
}
