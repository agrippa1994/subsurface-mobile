// AI-generated (Claude)
// One cylinder of the plan, in a sheet, iOS variant. The tanks are the core's table.
import { Button, Form, Host, Picker, Section, Stepper, Text } from '@expo/ui/swift-ui';
import { foregroundStyle, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';

import { StatusView } from '@/components/status-view';
import { USE_OPTIONS, usePlannerCylinderScreen } from '@/features/tools/use-planner-cylinder-screen';
import type { CylinderUse } from '@/models';
import { gasName } from '@/models/planner';

export default function PlannerCylinderScreen() {
  const screen = usePlannerCylinderScreen();
  const { cylinder } = screen;
  if (!cylinder) {
    return <StatusView kind="empty" title="This cylinder is no longer in the plan" />;
  }
  const name = gasName(cylinder.o2Percent, cylinder.hePercent);

  return (
    <Host style={{ flex: 1 }} useViewportSizeMeasurement>
      <Stack.Screen options={{ title: name }} />
      <Form>
        <Section title="Cylinder">
          <Picker
            label="Type"
            selection={cylinder.tank}
            onSelectionChange={(value: string) => screen.setTank(value)}
            modifiers={[pickerStyle('menu')]}
          >
            {screen.tanks.map((tank) => (
              <Text key={tank.name} modifiers={[tag(tank.name)]}>
                {tank.name}
              </Text>
            ))}
          </Picker>
          <Stepper
            label={`Filled to  ${screen.fill} ${screen.fillUnit}`}
            value={screen.fill}
            min={screen.fillRange.min}
            max={screen.fillRange.max}
            step={screen.fillRange.step}
            onValueChange={screen.setFill}
          />
          {screen.showUse ? (
            <Picker
              label="Use"
              selection={cylinder.use}
              onSelectionChange={(value: number) => screen.setUse(value as CylinderUse)}
              modifiers={[pickerStyle('segmented')]}
            >
              {USE_OPTIONS.map((option) => (
                <Text key={option.value} modifiers={[tag(option.value)]}>
                  {option.label}
                </Text>
              ))}
            </Picker>
          ) : null}
        </Section>

        <Section title="Gas">
          <Picker
            label="Mix"
            selection={screen.presets.some((preset) => preset.label === name) ? name : 'Custom'}
            onSelectionChange={(value: string) => screen.setPreset(value)}
            modifiers={[pickerStyle('menu')]}
          >
            {[
              ...(screen.presets.some((preset) => preset.label === name)
                ? []
                : [<Text key="Custom" modifiers={[tag('Custom')]}>{name}</Text>]),
              ...screen.presets.map((preset) => (
                <Text key={preset.label} modifiers={[tag(preset.label)]}>
                  {preset.label}
                </Text>
              )),
            ]}
          </Picker>
          <Stepper
            label={`Oxygen  ${cylinder.o2Percent}%`}
            value={cylinder.o2Percent}
            min={5}
            max={100}
            step={1}
            onValueChange={screen.setO2}
          />
          <Stepper
            label={`Helium  ${cylinder.hePercent}%`}
            value={cylinder.hePercent}
            min={0}
            max={95}
            step={1}
            onValueChange={screen.setHe}
          />
          {screen.bestLabel ? <Button label={screen.bestLabel} onPress={screen.applyBest} /> : null}
        </Section>

        <Section>
          {screen.canRemove ? (
            <Button label="Remove cylinder" role="destructive" onPress={screen.remove} />
          ) : (
            <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              {screen.inUse
                ? 'A level breathes from this cylinder, so it cannot be removed.'
                : 'A plan needs at least one cylinder.'}
            </Text>
          )}
        </Section>
      </Form>
    </Host>
  );
}
