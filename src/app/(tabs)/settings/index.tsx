// AI-generated (Claude)
// Settings, portable variant (web). Android has index.android.tsx. iOS renders a native Form
// instead - see index.ios.tsx. The sections, rows and footers mirror that one,
// built from the same grouped cards the editors use (components/form.tsx), with
// the platform's own Switch.
import { Fragment } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { FormButtonRow, FormSection, OptionField } from '@/components/form';
import { Spacing } from '@/constants/theme';
import { useSettingsScreen } from '@/features/settings/use-settings-screen';
import { useTheme } from '@/hooks/use-theme';
import { aboutRows, licenseNotice, privacyNotice, sourceNotice } from '@/models/about';
import { diveDataDisclaimer } from '@/models/disclaimer';
import { GF_RANGE, PROFILE_TOGGLES, SETTINGS_FOOTERS } from '@/models/settings';
import type { Units } from '@/models';
import { UNIT_PRESET_OPTIONS, UNIT_ROWS, unitsSummary } from '@/models/units';
import { t } from '@/i18n';


export default function SettingsScreen() {
  const screen = useSettingsScreen();
  const theme = useTheme();

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <FormSection
        title={t('ui.units')}
        footer={
          screen.showUnitRows
            ? t('settingsScreen.unitsEach')
            : `${unitsSummary(screen.units)} ${t('settingsScreen.unitsCustom')}`
        }>
        <OptionField
          options={UNIT_PRESET_OPTIONS}
          value={screen.unitPreset}
          onChange={screen.setUnitPreset}
        />
        {screen.showUnitRows
          ? UNIT_ROWS.map((row) => (
              <View key={row.key} style={styles.unitRow} accessibilityLabel={row.label}>
                <Text style={{ color: theme.textSecondary }}>{row.label}</Text>
                <OptionField
                  options={row.options}
                  value={screen.units[row.key]}
                  onChange={(value) => screen.setUnit(row.key, value as Units[typeof row.key])}
                />
              </View>
            ))
          : null}
      </FormSection>

      <FormSection title={t('ui.decompression')} footer={SETTINGS_FOOTERS.decompression}>
        <StepperRow label={t('ui.gfLow')} value={screen.gfLow} onChange={screen.setGfLow} />
        <StepperRow label={t('ui.gfHigh')} value={screen.gfHigh} onChange={screen.setGfHigh} />
      </FormSection>

      <FormSection title={t('ui.profile')} footer={SETTINGS_FOOTERS.profile}>
        {PROFILE_TOGGLES.map((toggle) => (
          <SwitchRow
            key={toggle.key}
            label={toggle.label}
            value={screen.profile[toggle.key]}
            onChange={(on) => screen.setProfile({ [toggle.key]: on })}
          />
        ))}
      </FormSection>

      <FormSection title={t('ui.newDives')} footer={SETTINGS_FOOTERS.newDives}>
        <Text style={{ color: theme.textSecondary }}>{t('ui.defaultCylinder')}</Text>
        <OptionField
          options={screen.defaultCylinder.options}
          value={screen.defaultCylinder.value}
          onChange={screen.defaultCylinder.set}
        />
      </FormSection>

      <FormSection title={t('ui.logbook')}>
        <ValueRow label={t('ui.dives')} value={String(screen.diveCount)} />
        <ValueRow label={t('ui.diveSites')} value={String(screen.siteCount)} />
        <ValueRow label={t('ui.trips')} value={String(screen.tripCount)} />
        <FormButtonRow label={t('ui.ungroupAllDives')} destructive onPress={screen.ungroupDives} />
      </FormSection>

      <FormSection
        title={t('ui.transfer')}
        footer={t('ui.importAddsTheDivesInA')}>
        <ActionRow label={t('ui.downloadFromDiveComputer')} onPress={screen.diveComputers.open} />
        <ActionRow label={t('ui.importDives')} onPress={screen.transfer.importFile} />
        <ActionRow label={t('ui.exportAndShare')} onPress={screen.transfer.shareLogbook} />
        <ActionRow label={t('ui.openALogbook')} onPress={screen.transfer.openLogbook} />
        <ActionRow
          label={t('ui.forgetRememberedDiveComputers')}
          onPress={screen.diveComputers.forget}
          disabled={screen.diveComputers.remembered === 0}
        />
      </FormSection>

      <FormSection
        title={t('ui.ssi')}
        footer={t('ui.pushADiveToYourSsi')}>
        <ValueRow label={t('ui.account')} value={screen.ssi.account ?? t('dive.ssi.notSignedIn')} />
        <ValueRow label={t('ui.diveSites')} value={screen.ssi.siteCatalogue} />
        <ActionRow label={t('ui.ssiAccount')} onPress={screen.ssi.open} />
      </FormSection>

      <FormSection
        title={t('ui.gitSync')}
        footer={t('ui.keepTheLogbookInAGit')}>
        <ValueRow label={t('ui.repository')} value={screen.git.repository} />
        <ValueRow label={t('ui.lastSync')} value={screen.git.lastSync} />
        {screen.git.ready ? (
          <ActionRow
            label={screen.git.busy ? t('gitScreen.syncing') : t('settingsScreen.syncNow')}
            disabled={screen.git.busy}
            onPress={screen.git.sync}
          />
        ) : null}
        <ActionRow label={t('ui.gitSyncSettings')} onPress={screen.git.open} />
      </FormSection>

      <FormSection
        title={t('ui.mcpServer')}
        footer={t('ui.letsAnAiAssistantOnA')}>
        <SwitchRow label={t('ui.runMcpServer')} value={screen.mcp.on} onChange={screen.mcp.setOn} />
        <ValueRow label={t('ui.status')} value={screen.mcp.status} />
        {screen.mcp.urls.map(({ kind, url }) => (
          <Fragment key={url}>
            <ValueRow label={kind} value={url} />
            <ActionRow
              label={screen.mcp.copied === url ? t('diveForm.copied') : t('settingsScreen.copyUrl', { kind })}
              onPress={() => screen.mcp.copyUrl(url)}
            />
          </Fragment>
        ))}
      </FormSection>

      <FormSection title={t('ui.problems')} footer={privacyNotice()}>
        <ValueRow label={t('ui.problemLog')} value={screen.diagnostics} />
        <ActionRow label={t('ui.shareTheProblemLog')} onPress={screen.shareDiagnostics} />
        <FormButtonRow label={t('ui.clearIt')} destructive onPress={screen.clearDiagnostics} />
      </FormSection>

      <FormSection title={t('ui.about')} footer={`${diveDataDisclaimer()}\n\n${licenseNotice()} ${sourceNotice()}`}>
        {aboutRows(screen.about).map((row) => (
          <ValueRow key={row.label} label={row.label} value={row.value} />
        ))}
        <ActionRow label={t('ui.sourceCodeAndLicence')} onPress={screen.openSource} />
      </FormSection>
    </ScrollView>
  );
}

/** A label and a read-only value, the counterpart of SwiftUI's LabeledContent. */
function ValueRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.textSecondary }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

/** A button row, in the accent colour. */
function ActionRow({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed || disabled ? { opacity: 0.5 } : null]}>
      <Text style={[styles.rowLabel, { color: theme.accent }]}>{label}</Text>
    </Pressable>
  );
}

function SwitchRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.accent }}
      />
    </View>
  );
}

/** Stands in for the iOS variant's native Stepper: the value, then - and +. */
function StepperRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (percent: number) => void;
}) {
  const theme = useTheme();
  const step = (delta: number, symbol: string, enabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={delta < 0 ? t('charts.decrease', { label }) : t('charts.increase', { label })}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={() => onChange(value + delta)}
      style={({ pressed }) => [
        styles.stepButton,
        { borderColor: theme.separator },
        pressed || !enabled ? { opacity: 0.4 } : null,
      ]}>
      <Text style={[styles.stepSymbol, { color: theme.accent }]}>{symbol}</Text>
    </Pressable>
  );
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.text }]}>{`${label}  ${value}%`}</Text>
      <View style={styles.stepper}>
        {step(-1, '-', value > GF_RANGE.min)}
        {step(1, '+', value < GF_RANGE.max)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  unitRow: {
    gap: Spacing.one,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 32,
  },
  rowLabel: {
    fontSize: 17,
  },
  rowValue: {
    flexShrink: 1,
    fontSize: 15,
    textAlign: 'right',
  },
  stepper: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stepButton: {
    width: 40,
    height: 32,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepSymbol: {
    fontSize: 20,
  },
});
