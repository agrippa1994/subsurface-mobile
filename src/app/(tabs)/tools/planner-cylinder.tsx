// AI-generated (Claude)
// One cylinder of the plan, in a sheet, portable fallback. See planner-cylinder.ios.tsx.
import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { FormButtonRow, FormSection, OptionField } from '@/components/form';
import { StatusView } from '@/components/status-view';
import { StepperRow } from '@/components/stepper-row';
import { Spacing } from '@/constants/theme';
import { USE_OPTIONS, usePlannerCylinderScreen } from '@/features/tools/use-planner-cylinder-screen';
import { useTheme } from '@/hooks/use-theme';
import { gasName } from '@/models/planner';
import { t } from '@/i18n';

export default function PlannerCylinderScreen() {
  const screen = usePlannerCylinderScreen();
  const theme = useTheme();
  const { cylinder } = screen;
  if (!cylinder) {
    return <StatusView kind="empty" title={t('ui.thisCylinderIsNoLongerIn')} />;
  }
  const name = gasName(cylinder.o2Percent, cylinder.hePercent);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Stack.Screen options={{ title: name }} />
      <FormSection title={t('ui.cylinderType')}>
        <OptionField
          options={screen.tanks.map((tank) => ({ value: tank.name, label: tank.name }))}
          value={cylinder.tank}
          onChange={screen.setTank}
        />
      </FormSection>
      <FormSection>
        <StepperRow
          label={`${t('toolsScreen.filledTo')}  ${screen.fill} ${screen.fillUnit}`}
          value={screen.fill}
          {...screen.fillRange}
          onChange={screen.setFill}
        />
        {screen.showUse ? (
          <OptionField options={USE_OPTIONS} value={cylinder.use} onChange={screen.setUse} />
        ) : null}
      </FormSection>
      <FormSection title={t('ui.gas')}>
        <OptionField
          options={screen.presets.map((preset) => ({ value: preset.label, label: preset.label }))}
          value={name}
          onChange={screen.setPreset}
        />
        <StepperRow
          label={`${t('toolsScreen.oxygen')}  ${cylinder.o2Percent}%`}
          value={cylinder.o2Percent}
          min={5}
          max={100}
          step={1}
          onChange={screen.setO2}
        />
        <StepperRow
          label={`${t('toolsScreen.helium')}  ${cylinder.hePercent}%`}
          value={cylinder.hePercent}
          min={0}
          max={95}
          step={1}
          onChange={screen.setHe}
        />
        {screen.bestLabel ? <FormButtonRow label={screen.bestLabel} onPress={screen.applyBest} /> : null}
      </FormSection>
      <FormSection>
        {screen.canRemove ? (
          <FormButtonRow label={t('ui.removeCylinder')} destructive onPress={screen.remove} />
        ) : (
          <Text style={{ color: theme.textSecondary }}>
            {screen.inUse
              ? 'A level breathes from this cylinder, so it cannot be removed.'
              : 'A plan needs at least one cylinder.'}
          </Text>
        )}
      </FormSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.four },
});
