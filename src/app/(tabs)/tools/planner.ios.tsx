// AI-generated (Claude)
// The dive planner, iOS variant: a native Form that leads with the result, so a
// change to the plan shows what it did without scrolling. The figures are the core's,
// see src/models/planner.ts and cpp/bindings/planner.cpp. In landscape the plan and
// the detail of the result sit side by side.
import {
  Button,
  DatePicker,
  Form,
  Gauge,
  HStack,
  Host,
  Image,
  LabeledContent,
  Picker,
  RNHostView,
  Section,
  Spacer,
  Stepper,
  Text,
  Toggle,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityElement,
  accessibilityLabel,
  font,
  foregroundStyle,
  gaugeStyle,
  monospacedDigit,
  pickerStyle,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { View } from 'react-native';

import { HeaderActions } from '@/components/header-action';
import { ProfileChart } from '@/components/profile-chart';
import { usePlannerScreen } from '@/features/tools/use-planner-screen';
import { useTheme } from '@/hooks/use-theme';
import { PlanDecoMode, type PlanDiveMode } from '@/models';
import {
  cylinderSummary,
  DIVE_MODE_OPTIONS,
  formatMinutes,
  gasName,
  PLAN_DISCLAIMER,
  SETPOINT_RANGE,
  TIME_RANGE,
  WATER_OPTIONS,
  whenFromDate,
  whenToDate,
  type Water,
} from '@/models/planner';
import { DECO_MODE_OPTIONS } from '@/models/planner-settings';
import { formatDepth } from '@/models/units';

const SECONDARY = { type: 'hierarchical', style: 'secondary' } as const;

export default function PlannerScreen() {
  const screen = usePlannerScreen();
  const theme = useTheme();
  const { draft, system, outcome, view, result, planner } = screen;

  const summary = (
    <>
      {outcome.kind !== 'planned' ? (
        <Section title="No plan">
          <HStack spacing={8} alignment="top">
            <Image systemName="exclamationmark.triangle.fill" size={18} color={theme.danger} />
            <Text modifiers={[foregroundStyle(theme.danger)]}>{outcome.message}</Text>
          </HStack>
        </Section>
      ) : null}

      {view && view.warnings.length > 0 ? (
        <Section title={view.warnings.length === 1 ? 'Warning' : 'Warnings'}>
          {view.warnings.map((warning) => (
            <HStack key={warning.text} spacing={8} alignment="top">
              <Image
                systemName="exclamationmark.triangle.fill"
                size={18}
                color={warning.level === 'danger' ? theme.danger : theme.warning}
              />
              <Text
                modifiers={[
                  foregroundStyle(warning.level === 'danger' ? theme.danger : theme.warning),
                ]}
              >
                {warning.text}
              </Text>
            </HStack>
          ))}
        </Section>
      ) : null}

      {view && result ? (
        <Section footer={<Text>{PLAN_DISCLAIMER}</Text>}>
          <VStack
            alignment="leading"
            spacing={4}
            modifiers={[
              accessibilityElement('combine'),
              accessibilityLabel(
                `Runtime ${view.headline.runtime}. ${view.headline.decoLine}. Maximum depth ${formatDepth(result.maxDepthMm, system)}.`,
              ),
            ]}
          >
            <HStack>
              <Text modifiers={[font({ textStyle: 'largeTitle', weight: 'bold' }), monospacedDigit()]}>
                {view.headline.runtime}
              </Text>
              <Spacer />
              <Text modifiers={[font({ textStyle: 'title3' }), monospacedDigit(), foregroundStyle(SECONDARY)]}>
                {formatDepth(result.maxDepthMm, system)}
              </Text>
            </HStack>
            <Text modifiers={[foregroundStyle(SECONDARY)]}>{view.headline.decoLine}</Text>
          </VStack>
          {view.gasRows.map((row) => (
            <VStack key={row.key} alignment="leading" spacing={4}>
              <HStack>
                <Text>{row.name}</Text>
                <Spacer />
                <Text modifiers={[monospacedDigit(), foregroundStyle(SECONDARY)]}>{row.usedText}</Text>
              </HStack>
              {row.usedFraction !== null ? (
                <Gauge
                  value={Math.min(1, row.usedFraction)}
                  modifiers={[
                    gaugeStyle('linearCapacity'),
                    tint(
                      row.level === 'danger'
                        ? theme.danger
                        : row.level === 'caution'
                          ? theme.warning
                          : theme.accent,
                    ),
                    accessibilityLabel(`${row.name}: ${row.usedText}`),
                  ]}
                />
              ) : null}
            </VStack>
          ))}
        </Section>
      ) : null}
    </>
  );

  const inputs = (
    <>
      <Section title="Dive">
        <DatePicker
          title="Start"
          selection={whenToDate(draft.when)}
          displayedComponents={['date', 'hourAndMinute']}
          onDateChange={(date) => screen.setDraft((d) => ({ ...d, when: whenFromDate(date) }))}
        />
        <Picker
          label="Deco model"
          selection={planner.decoMode}
          onSelectionChange={(value: number) => screen.setPlanner({ decoMode: value as PlanDecoMode })}
          modifiers={[pickerStyle('menu')]}
        >
          {DECO_MODE_OPTIONS.map((option) => (
            <Text key={option.value} modifiers={[tag(option.value)]}>
              {option.label}
            </Text>
          ))}
        </Picker>
        <Picker
          label="Dive mode"
          selection={draft.diveMode}
          onSelectionChange={(value: number) => screen.setMode(value as PlanDiveMode)}
          modifiers={[pickerStyle('menu')]}
        >
          {DIVE_MODE_OPTIONS.map((option) => (
            <Text key={option.value} modifiers={[tag(option.value)]}>
              {option.label}
            </Text>
          ))}
        </Picker>
        {screen.isCcr || screen.isPscr ? (
          planner.decoMode !== PlanDecoMode.Recreational ? (
            <Toggle
              label="Deco on open circuit bailout"
              isOn={planner.doBailout}
              onIsOnChange={(doBailout) => screen.setPlanner({ doBailout })}
            />
          ) : null
        ) : null}
        <Picker
          label="Water"
          selection={draft.water}
          onSelectionChange={(value: string) =>
            screen.setDraft((d) => ({ ...d, water: value as Water }))
          }
          modifiers={[pickerStyle('segmented')]}
        >
          {WATER_OPTIONS.map((option) => (
            <Text key={option.value} modifiers={[tag(option.value)]}>
              {option.label}
            </Text>
          ))}
        </Picker>
      </Section>

      {draft.segments.map((segment, index) => {
        const cylinder = draft.cylinders.find((c) => c.key === segment.cylinderKey);
        return (
          <Section
            key={segment.key}
            title={draft.segments.length > 1 ? `Level ${index + 1}` : 'Level'}
            footer={
              index === 0 ? (
                <Text>
                  {planner.dropStone
                    ? 'The time includes the descent.'
                    : 'The level takes its whole time to reach its depth.'}
                </Text>
              ) : (
                <Text>The time includes the travel from the level before.</Text>
              )
            }
          >
            <Stepper
              label={`Depth  ${screen.depthOf(segment)} ${screen.depthUnit}`}
              value={screen.depthOf(segment)}
              min={screen.depthRange.min}
              max={screen.depthRange.max}
              step={screen.depthRange.step}
              onValueChange={(value) => screen.setDepth(segment.key, value)}
            />
            <Stepper
              label={`Time  ${segment.minutes} min`}
              value={segment.minutes}
              min={TIME_RANGE.min}
              max={TIME_RANGE.max}
              step={TIME_RANGE.step}
              onValueChange={(value) => screen.setMinutes(segment.key, value)}
            />
            {draft.cylinders.length > 1 ? (
              <Picker
                label="Gas"
                selection={segment.cylinderKey}
                onSelectionChange={(value: string) => screen.setSegmentGas(segment.key, value)}
                modifiers={[pickerStyle('menu')]}
              >
                {draft.cylinders.map((option) => (
                  <Text key={option.key} modifiers={[tag(option.key)]}>
                    {gasName(option.o2Percent, option.hePercent)}
                  </Text>
                ))}
              </Picker>
            ) : null}
            {screen.isCcr && screen.isDiluent(cylinder) ? (
              <Stepper
                label={`Setpoint  ${((segment.setpointMbar || planner.defaultSetpointMbar) / 1000).toFixed(2)} bar`}
                value={segment.setpointMbar || planner.defaultSetpointMbar}
                min={SETPOINT_RANGE.min}
                max={SETPOINT_RANGE.max}
                step={SETPOINT_RANGE.step}
                onValueChange={(value) => screen.setSetpoint(segment.key, value)}
              />
            ) : null}
            {screen.isPscr ? (
              <Toggle
                label="On the loop"
                isOn={segment.onLoop}
                onIsOnChange={(value) => screen.setOnLoop(segment.key, value)}
              />
            ) : null}
            {draft.segments.length > 1 ? (
              <Button
                label="Remove level"
                role="destructive"
                onPress={() => screen.removeLevel(segment.key)}
              />
            ) : null}
          </Section>
        );
      })}

      <Section>
        <Button label="Add level" systemImage="plus" onPress={screen.addLevel} />
      </Section>

      <Section title="Cylinders">
        {draft.cylinders.map((cylinder) => (
          <Button key={cylinder.key} onPress={() => screen.openCylinder(cylinder.key)}>
            <HStack>
              <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>
                {cylinderSummary(cylinder, system)}
              </Text>
              <Spacer />
              <Image systemName="chevron.right" size={12} color={theme.textSecondary} />
            </HStack>
          </Button>
        ))}
        <Button label="Add cylinder" systemImage="plus" onPress={screen.addCylinderAndOpen} />
      </Section>

      <Section>
        <Button label="Start over" role="destructive" onPress={screen.resetDraft} />
      </Section>
    </>
  );

  const detail =
    view && result ? (
      <>
        {view.stops.length > 0 ? (
          <Section title="Stops">
            {view.stops.map((stop) => (
              <LabeledContent
                key={`${stop.depthMm}-${stop.endSec}`}
                label={`${formatDepth(stop.depthMm, system)} on ${stop.gas}`}
              >
                <Text modifiers={[monospacedDigit()]}>{formatMinutes(stop.durationSec)}</Text>
              </LabeledContent>
            ))}
          </Section>
        ) : null}

        <Section
          title="Gas"
          footer={screen.isCcr ? <Text>Closed loop legs are not counted against the cylinders.</Text> : undefined}
        >
          {view.gasRows.map((row) => (
            <VStack key={row.key} alignment="leading" spacing={2}>
              <Text>{row.description ? `${row.name}, ${row.description}` : row.name}</Text>
              {[row.endText, row.decoText, row.minimumText, row.switchText]
                .filter((line): line is string => line !== null)
                .map((line) => (
                  <Text key={line} modifiers={[font({ textStyle: 'footnote' }), foregroundStyle(SECONDARY)]}>
                    {line}
                  </Text>
                ))}
            </VStack>
          ))}
          <LabeledContent label="CNS">
            <Text modifiers={[monospacedDigit()]}>{`${result.cns}%`}</Text>
          </LabeledContent>
          <LabeledContent label="OTU">
            <Text modifiers={[monospacedDigit()]}>{String(result.otu)}</Text>
          </LabeledContent>
        </Section>

        {view.plot && result.profile ? (
          <Section title="Profile" footer={view.interval ? <Text>{view.interval}</Text> : undefined}>
            <RNHostView matchContents>
              <View style={{ width: '100%', minWidth: 280 }} accessibilityLabel={`Profile of the plan: ${view.headline.runtime}, ${formatDepth(result.maxDepthMm, system)}`}>
                <ProfileChart plot={view.plot} pi={result.profile} unitSystem={system} height={200} />
              </View>
            </RNHostView>
          </Section>
        ) : null}

        <Section>
          <Button label="Full plan notes" systemImage="doc.text" onPress={screen.openNotes} />
          <Button label="Planner settings" systemImage="gearshape" onPress={screen.openSettings} />
        </Section>
      </>
    ) : (
      <Section>
        <Button label="Planner settings" systemImage="gearshape" onPress={screen.openSettings} />
      </Section>
    );

  return (
    <>
      <Stack.Screen options={{ title: 'Dive planner' }} />
      <HeaderActions
        actions={[
          {
            label: 'Add to the logbook',
            icon: 'square.and.arrow.down',
            disabled: !view?.canSave || screen.saving,
            onPress: screen.savePlan,
          },
          { label: 'Planner settings', icon: 'gearshape', onPress: screen.openSettings },
        ]}
      />
      {screen.twoPanes ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <Host style={{ flex: 1 }} useViewportSizeMeasurement>
            <Form>
              {summary}
              {inputs}
            </Form>
          </Host>
          <Host style={{ flex: 1 }} useViewportSizeMeasurement>
            <Form>{detail}</Form>
          </Host>
        </View>
      ) : (
        <Host style={{ flex: 1 }} useViewportSizeMeasurement>
          <Form>
            {summary}
            {inputs}
            {detail}
          </Form>
        </Host>
      )}
    </>
  );
}
