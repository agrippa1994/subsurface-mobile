// AI-generated (Claude)
// The chart builder, iOS variant: a native form in a sheet, with the chart live behind
// it. Short lists are menu pickers. The variables are too many for one, so they are a
// menu with sections; a Picker's menu takes no sections from here.
import {
  Button,
  Form,
  Host,
  HStack,
  Image,
  Menu,
  Picker,
  Section,
  Spacer,
  Text,
  Toggle,
} from '@expo/ui/swift-ui';
import { foregroundStyle, font, lineLimit, tag } from '@expo/ui/swift-ui/modifiers';

import { useRouter } from 'expo-router';

import { HeaderAction } from '@/components/header-action';
import {
  useBuilder,
  type BuilderField,
  type VariableField,
} from '@/features/statistics/use-builder';
import { useTheme } from '@/hooks/use-theme';

function VariableRow({ field }: { field: VariableField }) {
  const theme = useTheme();
  return (
    <HStack>
      <Text>{field.label}</Text>
      <Spacer />
      <Menu
        label={
          <HStack spacing={4}>
            <Text modifiers={[lineLimit(1), foregroundStyle(theme.accent)]}>{field.selected}</Text>
            <Image
              systemName="chevron.up.chevron.down"
              modifiers={[font({ size: 13 }), foregroundStyle(theme.accent)]}
            />
          </HStack>
        }
      >
        {field.noneLabel ? (
          <Button
            label={field.noneLabel}
            systemImage={field.selected === field.noneLabel ? 'checkmark' : undefined}
            onPress={() => field.onChoose(null)}
          />
        ) : null}
        {field.groups.map((group) => (
          <Section key={group.title} title={group.title}>
            {group.variables.map((variable) => (
              <Button
                key={variable.name}
                label={variable.name}
                systemImage={field.selected === variable.name ? 'checkmark' : undefined}
                onPress={() => field.onChoose(variable.name)}
              />
            ))}
          </Section>
        ))}
      </Menu>
    </HStack>
  );
}

function ChoiceRow({ field }: { field: BuilderField }) {
  return (
    <Picker label={field.label} selection={field.selected} onSelectionChange={field.onChoose}>
      {field.choices.map((choice) => (
        <Text key={choice.key} modifiers={[tag(choice.key)]}>
          {choice.label}
        </Text>
      ))}
    </Picker>
  );
}

export default function BuilderScreen() {
  const builder = useBuilder();
  const router = useRouter();
  return (
    <>
      <HeaderAction label="Done" done onPress={() => router.back()} />
      <Host style={{ flex: 1 }} useViewportSizeMeasurement>
        <Form>
          <Section title="What to show" footer={<Text>{builder.description}</Text>}>
            {builder.first ? <VariableRow field={builder.first} /> : null}
            {builder.fields.map((field) => (
              <ChoiceRow key={field.key} field={field} />
            ))}
            {builder.second ? <VariableRow field={builder.second} /> : null}
            {builder.measures.map((field) => (
              <ChoiceRow key={field.key} field={field} />
            ))}
          </Section>
          <Section
            title="How to show it"
            footer={<Text>The chart counts the dives the filter on the chart screen selects.</Text>}
          >
            {builder.display.map((field) => (
              <ChoiceRow key={field.key} field={field} />
            ))}
            {builder.features.map((feature) => (
              <Toggle
                key={feature.key}
                label={feature.label}
                isOn={feature.on}
                onIsOnChange={(on) => builder.setFeature(feature.key, on)}
              />
            ))}
          </Section>
        </Form>
      </Host>
    </>
  );
}
