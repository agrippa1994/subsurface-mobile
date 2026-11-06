// AI-generated (Claude)
// The planner's settings, iOS variant: PLANNER_SETTING_SECTIONS as a native Form.
import { Button, Form, Host, Picker, Section, Stepper, Text, Toggle } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';

import { usePlannerSettingsScreen } from '@/features/tools/use-planner-settings-screen';
import type { PlanDecoMode } from '@/models';
import { DECO_MODE_OPTIONS } from '@/models/planner-settings';

export default function PlannerSettingsScreen() {
  const screen = usePlannerSettingsScreen();

  return (
    <Host style={{ flex: 1 }} useViewportSizeMeasurement>
      <Form>
        <Section title="Deco model">
          <Picker
            label="Model"
            selection={screen.planner.decoMode}
            onSelectionChange={(value: number) => screen.setDecoMode(value as PlanDecoMode)}
            modifiers={[pickerStyle('segmented')]}
          >
            {DECO_MODE_OPTIONS.map((option) => (
              <Text key={option.value} modifiers={[tag(option.value)]}>
                {option.label}
              </Text>
            ))}
          </Picker>
        </Section>

        {screen.sections.map((section) => (
          <Section
            key={section.title}
            title={section.title}
            footer={section.footer ? <Text>{section.footer}</Text> : undefined}
          >
            {section.settings.map((setting) =>
              setting.kind === 'toggle' ? (
                <Toggle
                  key={setting.key}
                  label={setting.label}
                  isOn={screen.toggleValue(setting)}
                  onIsOnChange={(value) => screen.setToggle(setting, value)}
                />
              ) : (
                <Stepper
                  key={setting.key}
                  label={screen.stepperLabel(setting)}
                  value={screen.stepperValue(setting)}
                  {...screen.stepperRange(setting)}
                  onValueChange={(value) => screen.setStepper(setting, value)}
                />
              ),
            )}
          </Section>
        ))}

        <Section title="Altitude">
          <Stepper
            label={screen.altitudeLabel}
            value={screen.altitude}
            {...screen.altitudeRange}
            onValueChange={screen.setAltitude}
          />
          <Stepper
            label={`Surface pressure  ${screen.planner.surfacePressureMbar} mbar`}
            value={screen.planner.surfacePressureMbar}
            min={689}
            max={1100}
            step={1}
            onValueChange={screen.setSurfacePressure}
          />
        </Section>

        <Section>
          <Button label="Restore defaults" role="destructive" onPress={screen.restore} />
        </Section>
      </Form>
    </Host>
  );
}
