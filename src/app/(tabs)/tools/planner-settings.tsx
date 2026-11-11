// AI-generated (Claude)
// The planner's settings, portable fallback: PLANNER_SETTING_SECTIONS in plain React
// Native. iOS renders a native Form instead, see planner-settings.ios.tsx.
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { FormButtonRow, FormSection, OptionField } from '@/components/form';
import { StepperRow } from '@/components/stepper-row';
import { Spacing } from '@/constants/theme';
import { usePlannerSettingsScreen } from '@/features/tools/use-planner-settings-screen';
import { useTheme } from '@/hooks/use-theme';
import { DECO_MODE_OPTIONS } from '@/models/planner-settings';
import { t } from '@/i18n';

export default function PlannerSettingsScreen() {
  const screen = usePlannerSettingsScreen();
  const theme = useTheme();

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <FormSection title={t('ui.decoModel')}>
        <OptionField
          options={DECO_MODE_OPTIONS}
          value={screen.planner.decoMode}
          onChange={screen.setDecoMode}
        />
      </FormSection>

      {screen.sections.map((section) => (
        <FormSection key={section.title} title={section.title} footer={section.footer}>
          {section.settings.map((setting) =>
            setting.kind === 'toggle' ? (
              <View key={setting.key} style={styles.row}>
                <Text style={[styles.label, { color: theme.text }]}>{setting.label}</Text>
                <Switch
                  accessibilityLabel={setting.label}
                  value={screen.toggleValue(setting)}
                  onValueChange={(value) => screen.setToggle(setting, value)}
                />
              </View>
            ) : (
              <StepperRow
                key={setting.key}
                label={screen.stepperLabel(setting)}
                value={screen.stepperValue(setting)}
                {...screen.stepperRange(setting)}
                onChange={(value) => screen.setStepper(setting, value)}
              />
            ),
          )}
        </FormSection>
      ))}

      <FormSection title={t('ui.altitude')}>
        <StepperRow
          label={screen.altitudeLabel}
          value={screen.altitude}
          {...screen.altitudeRange}
          onChange={screen.setAltitude}
        />
        <StepperRow
          label={`${t('toolsScreen.surfacePressure')}  ${screen.planner.surfacePressureMbar} mbar`}
          value={screen.planner.surfacePressureMbar}
          min={689}
          max={1100}
          step={1}
          onChange={screen.setSurfacePressure}
        />
      </FormSection>

      <FormSection>
        <FormButtonRow label={t('ui.restoreDefaults')} destructive onPress={screen.restore} />
      </FormSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.four },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  label: { flexShrink: 1, fontSize: 17 },
});
