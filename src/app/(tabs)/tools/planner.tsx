// AI-generated (Claude)
// The dive planner, portable fallback (web). Android has planner.android.tsx. iOS renders a native Form
// instead, see planner.ios.tsx; both take everything from use-planner-screen.
import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { FormButtonRow, FormSection, OptionField } from '@/components/form';
import { HeaderActions } from '@/components/header-action';
import { PlanSummaryBar } from '@/components/plan-summary-bar';
import { ProfileChart } from '@/components/profile-chart';
import { StepperRow } from '@/components/stepper-row';
import { Spacing } from '@/constants/theme';
import { usePlannerScreen } from '@/features/tools/use-planner-screen';
import { useTheme } from '@/hooks/use-theme';
import { PlanDecoMode } from '@/models';
import {
  cylinderSummary,
  DIVE_MODE_OPTIONS,
  formatMinutes,
  formatWhen,
  gasName,
  PLAN_DISCLAIMER,
  SETPOINT_RANGE,
  TIME_RANGE,
  WATER_OPTIONS,
} from '@/models/planner';
import { DECO_MODE_OPTIONS } from '@/models/planner-settings';
import { formatDepth } from '@/models/units';

export default function PlannerScreen() {
  const screen = usePlannerScreen();
  const theme = useTheme();
  const { draft, units, outcome, view, result, planner } = screen;
  const levelColor = (level: 'ok' | 'caution' | 'danger') =>
    level === 'danger' ? theme.danger : level === 'caution' ? theme.warning : theme.accent;

  const warningSection = (
    <>
      {outcome.kind !== 'planned' ? (
        <FormSection title="No plan">
          <Text accessibilityRole="alert" selectable style={{ color: theme.danger }}>
            {outcome.message}
          </Text>
        </FormSection>
      ) : null}
      {view && view.warnings.length > 0 ? (
        <FormSection title={view.warnings.length === 1 ? 'Warning' : 'Warnings'}>
          {view.warnings.map((warning) => (
            <Text
              key={warning.text}
              selectable
              style={{ color: warning.level === 'danger' ? theme.danger : theme.warning }}
            >
              {warning.text}
            </Text>
          ))}
        </FormSection>
      ) : null}
    </>
  );

  const inputs = (
    <>
      {draft.segments.map((segment, index) => {
        const cylinder = draft.cylinders.find((c) => c.key === segment.cylinderKey);
        return (
          <FormSection
            key={segment.key}
            title={draft.segments.length > 1 ? `Level ${index + 1}` : 'Level'}
            footer={
              index > 0
                ? 'The time includes the travel from the level before.'
                : planner.dropStone
                  ? 'The time includes the descent.'
                  : 'The level takes its whole time to reach its depth.'
            }
          >
            <StepperRow
              label={`Depth  ${screen.depthOf(segment)} ${screen.depthUnit}`}
              value={screen.depthOf(segment)}
              {...screen.depthRange}
              onChange={(value) => screen.setDepth(segment.key, value)}
            />
            <StepperRow
              label={`Time  ${segment.minutes} min`}
              value={segment.minutes}
              {...TIME_RANGE}
              onChange={(value) => screen.setMinutes(segment.key, value)}
            />
            {draft.cylinders.length > 1 ? (
              <OptionField
                options={draft.cylinders.map((option) => ({
                  value: option.key,
                  label: gasName(option.o2Percent, option.hePercent),
                }))}
                value={segment.cylinderKey}
                onChange={(value) => screen.setSegmentGas(segment.key, value)}
              />
            ) : null}
            {screen.isCcr && screen.isDiluent(cylinder) ? (
              <StepperRow
                label={`Setpoint  ${((segment.setpointMbar || planner.defaultSetpointMbar) / 1000).toFixed(2)} bar`}
                value={segment.setpointMbar || planner.defaultSetpointMbar}
                {...SETPOINT_RANGE}
                onChange={(value) => screen.setSetpoint(segment.key, value)}
              />
            ) : null}
            {screen.isPscr ? (
              <View style={styles.row}>
                <Text style={{ color: theme.text }}>On the loop</Text>
                <Switch
                  value={segment.onLoop}
                  onValueChange={(value) => screen.setOnLoop(segment.key, value)}
                />
              </View>
            ) : null}
            {draft.segments.length > 1 ? (
              <FormButtonRow
                label="Remove level"
                destructive
                onPress={() => screen.removeLevel(segment.key)}
              />
            ) : null}
          </FormSection>
        );
      })}
      <FormSection>
        <FormButtonRow label="Add level" onPress={screen.addLevel} />
      </FormSection>

      <FormSection title="Cylinders">
        {draft.cylinders.map((cylinder) => (
          <FormButtonRow
            key={cylinder.key}
            label={gasName(cylinder.o2Percent, cylinder.hePercent)}
            value={cylinderSummary(cylinder, units)}
            onPress={() => screen.openCylinder(cylinder.key)}
          />
        ))}
        <FormButtonRow label="Add cylinder" onPress={screen.addCylinderAndOpen} />
      </FormSection>

      <FormSection title="Dive">
        <StepperRow
          label={`Day  ${formatWhen(draft.when)}`}
          value={draft.when}
          min={0}
          max={Number.MAX_SAFE_INTEGER}
          step={86400}
          onChange={(when) => screen.setDraft((d) => ({ ...d, when }))}
        />
        <StepperRow
          label="Time, by 15 min"
          value={draft.when}
          min={0}
          max={Number.MAX_SAFE_INTEGER}
          step={900}
          onChange={(when) => screen.setDraft((d) => ({ ...d, when }))}
        />
        <OptionField
          options={DECO_MODE_OPTIONS}
          value={planner.decoMode}
          onChange={(decoMode) => screen.setPlanner({ decoMode })}
        />
        <OptionField options={DIVE_MODE_OPTIONS} value={draft.diveMode} onChange={screen.setMode} />
        {(screen.isCcr || screen.isPscr) && planner.decoMode !== PlanDecoMode.Recreational ? (
          <View style={styles.row}>
            <Text style={{ color: theme.text }}>Deco on open circuit bailout</Text>
            <Switch
              value={planner.doBailout}
              onValueChange={(doBailout) => screen.setPlanner({ doBailout })}
            />
          </View>
        ) : null}
        <OptionField
          options={WATER_OPTIONS}
          value={draft.water}
          onChange={(water) => screen.setDraft((d) => ({ ...d, water }))}
        />
      </FormSection>

    </>
  );

  const detail =
    view && result ? (
      <>
        {view.stops.length > 0 ? (
          <FormSection title="Stops">
            {view.stops.map((stop) => (
              <View
                key={`${stop.depthMm}-${stop.endSec}`}
                style={styles.row}
                accessible
                accessibilityLabel={`${formatDepth(stop.depthMm, units)} on ${stop.gas}, ${formatMinutes(stop.durationSec)}`}
              >
                <Text style={{ color: theme.text }}>
                  {`${formatDepth(stop.depthMm, units)} on ${stop.gas}`}
                </Text>
                <Text style={[styles.tabular, { color: theme.textSecondary }]}>
                  {formatMinutes(stop.durationSec)}
                </Text>
              </View>
            ))}
          </FormSection>
        ) : null}
        <FormSection
          title="Gas"
          footer={screen.isCcr ? 'Closed loop legs are not counted against the cylinders.' : undefined}
        >
          {view.gasRows.map((row) => (
            <View key={row.key} accessible>
              <View style={styles.row}>
                <Text style={{ color: theme.text }}>
                  {row.description ? `${row.name}, ${row.description}` : row.name}
                </Text>
                <Text style={[styles.tabular, { color: theme.textSecondary }]}>{row.usedText}</Text>
              </View>
              {row.usedFraction !== null ? (
                <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
                  <View
                    style={[
                      styles.fill,
                      {
                        width: `${Math.min(100, row.usedFraction * 100)}%`,
                        backgroundColor: levelColor(row.level),
                      },
                    ]}
                  />
                </View>
              ) : null}
              {[row.endText, row.decoText, row.minimumText, row.switchText]
                .filter((line): line is string => line !== null)
                .map((line) => (
                  <Text key={line} style={[styles.small, { color: theme.textSecondary }]}>
                    {line}
                  </Text>
                ))}
            </View>
          ))}
          <View style={styles.row}>
            <Text style={{ color: theme.text }}>CNS</Text>
            <Text style={[styles.tabular, { color: theme.textSecondary }]}>{`${result.cns}%`}</Text>
          </View>
          <View style={styles.row}>
            <Text style={{ color: theme.text }}>OTU</Text>
            <Text style={[styles.tabular, { color: theme.textSecondary }]}>{result.otu}</Text>
          </View>
        </FormSection>
        {view.plot && result.profile ? (
          <FormSection title="Profile" footer={view.interval ?? undefined}>
            <ProfileChart key={result.runtimeSec} plot={view.plot} pi={result.profile} units={units} height={200} />
          </FormSection>
        ) : null}
        <FormSection>
          <FormButtonRow label="Full plan notes" onPress={screen.openNotes} />
        </FormSection>
      </>
    ) : null;

  const ending = (
    <FormSection footer={PLAN_DISCLAIMER}>
      <FormButtonRow label="Planner settings" onPress={screen.openSettings} />
      <FormButtonRow label="Start over" destructive onPress={screen.resetDraft} />
    </FormSection>
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
        <View style={[styles.panes, { backgroundColor: theme.background }]}>
          <ScrollView style={styles.pane} contentContainerStyle={styles.content}>
            {inputs}
          </ScrollView>
          <View style={styles.pane}>
            <PlanSummaryBar {...screen.summaryBar} />
            <ScrollView contentContainerStyle={styles.content}>
              {warningSection}
              {detail}
              {ending}
            </ScrollView>
          </View>
        </View>
      ) : (
        <View style={[styles.pane, { backgroundColor: theme.background }]}>
          <PlanSummaryBar {...screen.summaryBar} />
          <ScrollView contentContainerStyle={styles.content}>
            {inputs}
            {warningSection}
            {detail}
            {ending}
          </ScrollView>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  panes: { flex: 1, flexDirection: 'row' },
  pane: { flex: 1 },
  content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.four },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  tabular: { fontVariant: ['tabular-nums'] },
  small: { fontSize: 13 },
  track: { height: 6, borderRadius: 3, marginTop: Spacing.one, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
