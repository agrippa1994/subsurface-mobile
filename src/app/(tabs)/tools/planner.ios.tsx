// AI-generated (Claude)
// The dive planner, iOS variant. The result is pinned above a native Form, so a change
// to the plan shows what it did without scrolling, and the controls never move. The
// figures are the core's, see src/models/planner.ts and cpp/bindings/planner.cpp. In
// landscape the plan and the result sit side by side.
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
import { PlanSummaryBar } from '@/components/plan-summary-bar';
import { ProfileChart } from '@/components/profile-chart';
import { usePlannerScreen } from '@/features/tools/use-planner-screen';
import { useTheme } from '@/hooks/use-theme';
import { PlanDecoMode, type PlanDiveMode } from '@/models';
import {
  cylinderSummary,
  DIVE_MODE_OPTIONS,
  formatMinutes,
  gasName,
  planDisclaimer,
  SETPOINT_RANGE,
  TIME_RANGE,
  WATER_OPTIONS,
  whenFromDate,
  whenToDate,
  type Water,
} from '@/models/planner';
import { DECO_MODE_OPTIONS } from '@/models/planner-settings';
import { formatDepth } from '@/models/units';
import { useProfileSeries } from '@/queries/settings';
import { t } from '@/i18n';

const SECONDARY = { type: 'hierarchical', style: 'secondary' } as const;

export default function PlannerScreen() {
  const screen = usePlannerScreen();
  // The plan's profile draws what every dive profile does (Settings, Profile).
  const profileSeries = useProfileSeries();
  const theme = useTheme();
  const { draft, units, outcome, view, result, planner } = screen;

  const warningSection = (
    <>
      {outcome.kind !== 'planned' ? (
        <Section title={t('ui.noPlan')}>
          <HStack spacing={8} alignment="top">
            <Image systemName="exclamationmark.triangle.fill" size={18} color={theme.danger} />
            <Text modifiers={[foregroundStyle(theme.danger)]}>{outcome.message}</Text>
          </HStack>
        </Section>
      ) : null}

      {view && view.warnings.length > 0 ? (
        <Section title={t('toolsScreen.warnings', { count: view.warnings.length })}>
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
    </>
  );

  const inputs = (
    <>
      {draft.segments.map((segment, index) => {
        const cylinder = draft.cylinders.find((c) => c.key === segment.cylinderKey);
        return (
          <Section
            key={segment.key}
            title={draft.segments.length > 1 ? t('toolsScreen.levelNumber', { number: index + 1 }) : t('toolsScreen.level')}
            footer={
              index === 0 ? (
                <Text>
                  {planner.dropStone
                    ? t('toolsScreen.includesDescent')
                    : t('toolsScreen.wholeTime')}
                </Text>
              ) : (
                <Text>{t('toolsScreen.includesTravel')}</Text>
              )
            }
          >
            <Stepper
              label={`${t('units.quantity.depth')}  ${screen.depthOf(segment)} ${screen.depthUnit}`}
              value={screen.depthOf(segment)}
              min={screen.depthRange.min}
              max={screen.depthRange.max}
              step={screen.depthRange.step}
              onValueChange={(value) => screen.setDepth(segment.key, value)}
            />
            <Stepper
              label={`${t('toolsScreen.time')}  ${segment.minutes} min`}
              value={segment.minutes}
              min={TIME_RANGE.min}
              max={TIME_RANGE.max}
              step={TIME_RANGE.step}
              onValueChange={(value) => screen.setMinutes(segment.key, value)}
            />
            {draft.cylinders.length > 1 ? (
              <Picker
                label={t('ui.gas')}
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
                label={`${t('toolsScreen.setpoint')}  ${((segment.setpointMbar || planner.defaultSetpointMbar) / 1000).toFixed(2)} bar`}
                value={segment.setpointMbar || planner.defaultSetpointMbar}
                min={SETPOINT_RANGE.min}
                max={SETPOINT_RANGE.max}
                step={SETPOINT_RANGE.step}
                onValueChange={(value) => screen.setSetpoint(segment.key, value)}
              />
            ) : null}
            {screen.isPscr ? (
              <Toggle
                label={t('ui.onTheLoop')}
                isOn={segment.onLoop}
                onIsOnChange={(value) => screen.setOnLoop(segment.key, value)}
              />
            ) : null}
            {draft.segments.length > 1 ? (
              <Button
                label={t('ui.removeLevel')}
                role="destructive"
                onPress={() => screen.removeLevel(segment.key)}
              />
            ) : null}
          </Section>
        );
      })}

      <Section>
        <Button label={t('ui.addLevel')} systemImage="plus" onPress={screen.addLevel} />
      </Section>

      <Section title={t('ui.cylinders')}>
        {draft.cylinders.map((cylinder) => (
          <Button key={cylinder.key} onPress={() => screen.openCylinder(cylinder.key)}>
            <HStack>
              <VStack alignment="leading" spacing={2}>
                <Text modifiers={[foregroundStyle(theme.text)]}>
                  {gasName(cylinder.o2Percent, cylinder.hePercent)}
                </Text>
                <Text modifiers={[font({ textStyle: 'footnote' }), foregroundStyle(theme.textSecondary)]}>
                  {cylinderSummary(cylinder, units)}
                </Text>
              </VStack>
              <Spacer />
              <Image systemName="chevron.right" size={12} color={theme.textSecondary} />
            </HStack>
          </Button>
        ))}
        <Button label={t('ui.addCylinder')} systemImage="plus" onPress={screen.addCylinderAndOpen} />
      </Section>

      <Section title={t('ui.dive')}>
        <DatePicker
          title={t('ui.start')}
          selection={whenToDate(draft.when)}
          displayedComponents={['date', 'hourAndMinute']}
          onDateChange={(date) => screen.setDraft((d) => ({ ...d, when: whenFromDate(date) }))}
        />
        <Picker
          label={t('ui.decoModel')}
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
          label={t('ui.diveMode')}
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
              label={t('ui.decoOnOpenCircuitBailout')}
              isOn={planner.doBailout}
              onIsOnChange={(doBailout) => screen.setPlanner({ doBailout })}
            />
          ) : null
        ) : null}
        <Picker
          label={t('ui.water')}
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

    </>
  );

  const detail =
    view && result ? (
      <>
        {view.stops.length > 0 ? (
          <Section title={t('ui.stops')}>
            {view.stops.map((stop) => (
              <LabeledContent
                key={`${stop.depthMm}-${stop.endSec}`}
                label={t('toolsScreen.stopOn', { depth: formatDepth(stop.depthMm, units), gas: stop.gas })}
              >
                <Text modifiers={[monospacedDigit()]}>{formatMinutes(stop.durationSec)}</Text>
              </LabeledContent>
            ))}
          </Section>
        ) : null}

        <Section
          title={t('ui.gas')}
          footer={screen.isCcr ? <Text>{t('toolsScreen.closedLoop')}</Text> : undefined}
        >
          {view.gasRows.map((row) => (
            <VStack key={row.key} alignment="leading" spacing={4}>
              <HStack>
                <Text>{row.description ? `${row.name}, ${row.description}` : row.name}</Text>
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
              {[row.endText, row.decoText, row.minimumText, row.switchText]
                .filter((line): line is string => line !== null)
                .map((line) => (
                  <Text key={line} modifiers={[font({ textStyle: 'footnote' }), foregroundStyle(SECONDARY)]}>
                    {line}
                  </Text>
                ))}
            </VStack>
          ))}
          <LabeledContent label={t('ui.cns')}>
            <Text modifiers={[monospacedDigit()]}>{`${result.cns}%`}</Text>
          </LabeledContent>
          <LabeledContent label={t('ui.otu')}>
            <Text modifiers={[monospacedDigit()]}>{String(result.otu)}</Text>
          </LabeledContent>
        </Section>

        {view.plot && result.profile ? (
          <Section title={t('ui.profile')} footer={view.interval ? <Text>{view.interval}</Text> : undefined}>
            <RNHostView matchContents>
              <View style={{ width: screen.chartWidth }} accessibilityLabel={t('toolsScreen.planProfile', { runtime: view.headline.runtime, depth: formatDepth(result.maxDepthMm, units) })}>
                {/* Keyed: its zoom is held in state, and must not outlive the time axis of an older plan. */}
                <ProfileChart key={result.runtimeSec} plot={view.plot} pi={result.profile} units={units} series={profileSeries} height={200} />
              </View>
            </RNHostView>
          </Section>
        ) : null}

        <Section>
          <Button label={t('ui.fullPlanNotes')} systemImage="doc.text" onPress={screen.openNotes} />
        </Section>
      </>
    ) : null;

  const ending = (
    <Section footer={<Text>{planDisclaimer()}</Text>}>
      <Button label={t('ui.plannerSettings')} systemImage="gearshape" onPress={screen.openSettings} />
      <Button label={t('ui.startOver')} role="destructive" onPress={screen.resetDraft} />
    </Section>
  );

  return (
    <>
      <Stack.Screen options={{ title: t('nav.divePlanner') }} />
      <HeaderActions
        actions={[
          {
            label: t('toolsScreen.addToLogbook'),
            icon: 'square.and.arrow.down',
            disabled: !view?.canSave || screen.saving,
            onPress: screen.savePlan,
          },
          { label: t('ui.plannerSettings'), icon: 'gearshape', onPress: screen.openSettings },
        ]}
      />
      {screen.twoPanes ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <Host style={{ flex: 1 }} useViewportSizeMeasurement>
            <Form>{inputs}</Form>
          </Host>
          <View style={{ flex: 1 }}>
            <PlanSummaryBar {...screen.summaryBar} />
            <Host style={{ flex: 1 }} useViewportSizeMeasurement>
              <Form>
                {warningSection}
                {detail}
                {ending}
              </Form>
            </Host>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <PlanSummaryBar {...screen.summaryBar} />
          <Host style={{ flex: 1 }} useViewportSizeMeasurement>
            <Form>
              {inputs}
              {warningSection}
              {detail}
              {ending}
            </Form>
          </Host>
        </View>
      )}
    </>
  );
}
