// AI-generated (Claude)
// The dive planner, Android variant, in Compose. The result is pinned above the list,
// so a change to the plan shows what it did without scrolling. The figures are the
// core's, see src/models/planner.ts and cpp/bindings/planner.cpp. In landscape the plan
// and the result sit side by side.
import { Host } from '@/components/material/host';
import {
  Column,
  LazyColumn,
  LinearProgressIndicator,
  Row,
  RNHostView,
  Text,
  useMaterialColors,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding, weight } from '@expo/ui/jetpack-compose/modifiers';
import { Stack } from 'expo-router';
import { View } from 'react-native';

import { HeaderActions } from '@/components/header-action';
import { M3Icon } from '@/components/material/icon';
import {
  M3ActionRow,
  M3MenuRow,
  M3Section,
  M3SegmentedRow,
  M3StepperRow,
  M3SwitchRow,
  M3ValueRow,
} from '@/components/material/list';
import { M3WhenRows } from '@/components/material/when-rows';
import { PlanSummaryBar } from '@/components/plan-summary-bar';
import { ProfileChart } from '@/components/profile-chart';
import { usePlannerScreen } from '@/features/tools/use-planner-screen';
import { useTheme } from '@/hooks/use-theme';
import { PlanDecoMode } from '@/models';
import {
  cylinderSummary,
  DIVE_MODE_OPTIONS,
  formatMinutes,
  gasName,
  planDisclaimer,
  SETPOINT_RANGE,
  TIME_RANGE,
  WATER_OPTIONS,
} from '@/models/planner';
import { DECO_MODE_OPTIONS } from '@/models/planner-settings';
import { formatDepth } from '@/models/units';
import { useProfileSeries } from '@/queries/settings';
import { t } from '@/i18n';

function WarningRow({ text, color }: { text: string; color: string }) {
  return (
    <Row horizontalArrangement={{ spacedBy: 8 }} modifiers={[padding(16, 8, 16, 8)]}>
      <M3Icon symbol="exclamationmark.triangle" size={20} tint={color} />
      <Text color={color} style={{ typography: 'bodyMedium' }} modifiers={[weight(1)]}>
        {text}
      </Text>
    </Row>
  );
}

export default function PlannerScreen() {
  const screen = usePlannerScreen();
  // The plan's profile draws what every dive profile does (Settings, Profile).
  const profileSeries = useProfileSeries();
  const theme = useTheme();
  const palette = useMaterialColors();
  const { draft, units, outcome, view, result, planner } = screen;

  const warningSection = (
    <>
      {outcome.kind !== 'planned' ? (
        <M3Section title={t('ui.noPlan')}>
          <WarningRow text={outcome.message} color={palette.error} />
        </M3Section>
      ) : null}
      {view && view.warnings.length > 0 ? (
        <M3Section title={t('toolsScreen.warnings', { count: view.warnings.length })}>
          {view.warnings.map((warning) => (
            <WarningRow
              key={warning.text}
              text={warning.text}
              color={warning.level === 'danger' ? palette.error : theme.warning}
            />
          ))}
        </M3Section>
      ) : null}
    </>
  );

  const inputs = (
    <>
      {draft.segments.map((segment, index) => {
        const cylinder = draft.cylinders.find((c) => c.key === segment.cylinderKey);
        return (
          <M3Section
            key={segment.key}
            title={draft.segments.length > 1 ? t('toolsScreen.levelNumber', { number: index + 1 }) : t('toolsScreen.level')}
            footer={
              index === 0
                ? planner.dropStone
                  ? t('toolsScreen.includesDescent')
                  : t('toolsScreen.wholeTime')
                : t('toolsScreen.includesTravel')
            }>
            <M3StepperRow
              label={`${t('units.quantity.depth')}  ${screen.depthOf(segment)} ${screen.depthUnit}`}
              value={screen.depthOf(segment)}
              min={screen.depthRange.min}
              max={screen.depthRange.max}
              step={screen.depthRange.step}
              onChange={(value) => screen.setDepth(segment.key, value)}
            />
            <M3StepperRow
              label={`${t('toolsScreen.time')}  ${segment.minutes} min`}
              value={segment.minutes}
              min={TIME_RANGE.min}
              max={TIME_RANGE.max}
              step={TIME_RANGE.step}
              onChange={(value) => screen.setMinutes(segment.key, value)}
            />
            {draft.cylinders.length > 1 ? (
              <M3MenuRow
                label={t('ui.gas')}
                value={segment.cylinderKey}
                options={draft.cylinders.map((option) => ({
                  value: option.key,
                  label: gasName(option.o2Percent, option.hePercent),
                }))}
                onChange={(value) => screen.setSegmentGas(segment.key, value)}
              />
            ) : null}
            {screen.isCcr && screen.isDiluent(cylinder) ? (
              <M3StepperRow
                label={`${t('toolsScreen.setpoint')}  ${((segment.setpointMbar || planner.defaultSetpointMbar) / 1000).toFixed(2)} bar`}
                value={segment.setpointMbar || planner.defaultSetpointMbar}
                min={SETPOINT_RANGE.min}
                max={SETPOINT_RANGE.max}
                step={SETPOINT_RANGE.step}
                onChange={(value) => screen.setSetpoint(segment.key, value)}
              />
            ) : null}
            {screen.isPscr ? (
              <M3SwitchRow
                label={t('ui.onTheLoop')}
                value={segment.onLoop}
                onChange={(value) => screen.setOnLoop(segment.key, value)}
              />
            ) : null}
            {draft.segments.length > 1 ? (
              <M3ActionRow
                label={t('ui.removeLevel')}
                destructive
                onPress={() => screen.removeLevel(segment.key)}
              />
            ) : null}
          </M3Section>
        );
      })}

      <M3Section>
        <M3ActionRow label={t('ui.addLevel')} icon="plus" onPress={screen.addLevel} />
      </M3Section>

      <M3Section title={t('ui.cylinders')}>
        {draft.cylinders.map((cylinder) => (
          <M3ActionRow
            key={cylinder.key}
            label={gasName(cylinder.o2Percent, cylinder.hePercent)}
            detail={cylinderSummary(cylinder, units)}
            opens
            onPress={() => screen.openCylinder(cylinder.key)}
          />
        ))}
        <M3ActionRow label={t('ui.addCylinder')} icon="plus" onPress={screen.addCylinderAndOpen} />
      </M3Section>

      <M3Section title={t('ui.dive')}>
        <M3WhenRows
          dateLabel={t('toolsScreen.startDate')}
          timeLabel={t('toolsScreen.startTime')}
          value={draft.when}
          onChange={(when) => screen.setDraft((d) => ({ ...d, when }))}
        />
        <M3MenuRow
          label={t('ui.decoModel')}
          value={planner.decoMode}
          options={DECO_MODE_OPTIONS}
          onChange={(decoMode) => screen.setPlanner({ decoMode })}
        />
        <M3MenuRow
          label={t('ui.diveMode')}
          value={draft.diveMode}
          options={DIVE_MODE_OPTIONS}
          onChange={screen.setMode}
        />
        {(screen.isCcr || screen.isPscr) && planner.decoMode !== PlanDecoMode.Recreational ? (
          <M3SwitchRow
            label={t('ui.decoOnOpenCircuitBailout')}
            value={planner.doBailout}
            onChange={(doBailout) => screen.setPlanner({ doBailout })}
          />
        ) : null}
        <M3SegmentedRow
          label={t('ui.water')}
          options={WATER_OPTIONS}
          value={draft.water}
          onChange={(water) => screen.setDraft((d) => ({ ...d, water }))}
        />
      </M3Section>
    </>
  );

  const detail =
    view && result ? (
      <>
        {view.stops.length > 0 ? (
          <M3Section title={t('ui.stops')}>
            {view.stops.map((stop) => (
              <M3ValueRow
                key={`${stop.depthMm}-${stop.endSec}`}
                inline
                label={t('toolsScreen.stopOn', { depth: formatDepth(stop.depthMm, units), gas: stop.gas })}
                value={formatMinutes(stop.durationSec)}
              />
            ))}
          </M3Section>
        ) : null}

        <M3Section
          title={t('ui.gas')}
          footer={screen.isCcr ? t('toolsScreen.closedLoop') : undefined}>
          {view.gasRows.map((row) => (
            <Column
              key={row.key}
              verticalArrangement={{ spacedBy: 4 }}
              modifiers={[fillMaxWidth(), padding(16, 8, 16, 8)]}>
              <Row modifiers={[fillMaxWidth()]}>
                <Text style={{ typography: 'bodyLarge' }} modifiers={[weight(1)]}>
                  {row.description ? `${row.name}, ${row.description}` : row.name}
                </Text>
                <Text color={palette.onSurfaceVariant} style={{ typography: 'bodyMedium' }}>
                  {row.usedText}
                </Text>
              </Row>
              {row.usedFraction !== null ? (
                <LinearProgressIndicator
                  progress={Math.min(1, row.usedFraction)}
                  color={
                    row.level === 'danger'
                      ? palette.error
                      : row.level === 'caution'
                        ? theme.warning
                        : palette.primary
                  }
                  modifiers={[fillMaxWidth()]}
                />
              ) : null}
              {[row.endText, row.decoText, row.minimumText, row.switchText]
                .filter((line): line is string => line !== null)
                .map((line) => (
                  <Text key={line} color={palette.onSurfaceVariant} style={{ typography: 'bodySmall' }}>
                    {line}
                  </Text>
                ))}
            </Column>
          ))}
          <M3ValueRow inline label={t('ui.cns')} value={`${result.cns}%`} />
          <M3ValueRow inline label={t('ui.otu')} value={String(result.otu)} />
        </M3Section>

        {view.plot && result.profile ? (
          <M3Section title={t('ui.profile')} footer={view.interval ?? undefined}>
            <Column modifiers={[padding(16, 0, 16, 0)]}>
              <RNHostView matchContents>
                <View
                  style={{ width: screen.chartWidth }}
                  accessibilityLabel={t('toolsScreen.planProfile', { runtime: view.headline.runtime, depth: formatDepth(result.maxDepthMm, units) })}>
                  {/* Keyed: its zoom is held in state, and must not outlive the time axis of an older plan. */}
                  <ProfileChart
                    key={result.runtimeSec}
                    plot={view.plot}
                    pi={result.profile}
                    units={units}
                    series={profileSeries}
                    height={200}
                  />
                </View>
              </RNHostView>
            </Column>
          </M3Section>
        ) : null}

        <M3Section>
          <M3ActionRow label={t('ui.fullPlanNotes')} icon="doc.text" opens onPress={screen.openNotes} />
        </M3Section>
      </>
    ) : null;

  const ending = (
    <M3Section footer={planDisclaimer()}>
      <M3ActionRow label={t('ui.plannerSettings')} icon="gearshape" opens onPress={screen.openSettings} />
      <M3ActionRow label={t('ui.startOver')} destructive onPress={screen.resetDraft} />
    </M3Section>
  );

  const background = { flex: 1, backgroundColor: palette.surface };

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
          <Host style={background}>
            <LazyColumn contentPadding={{ bottom: 24 }}>{inputs}</LazyColumn>
          </Host>
          <View style={{ flex: 1 }}>
            <PlanSummaryBar {...screen.summaryBar} />
            <Host style={background}>
              <LazyColumn contentPadding={{ bottom: 24 }}>
                {warningSection}
                {detail}
                {ending}
              </LazyColumn>
            </Host>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <PlanSummaryBar {...screen.summaryBar} />
          <Host style={background}>
            <LazyColumn contentPadding={{ bottom: 24 }}>
              {inputs}
              {warningSection}
              {detail}
              {ending}
            </LazyColumn>
          </Host>
        </View>
      )}
    </>
  );
}
