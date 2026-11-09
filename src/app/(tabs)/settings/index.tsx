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
import { aboutRows, LICENSE_NOTICE, PRIVACY_NOTICE, SOURCE_NOTICE } from '@/models/about';
import { GF_RANGE, PROFILE_TOGGLES, SETTINGS_FOOTERS } from '@/models/settings';
import type { Units } from '@/models';
import { UNIT_PRESET_OPTIONS, UNIT_ROWS, unitsSummary } from '@/models/units';


export default function SettingsScreen() {
  const screen = useSettingsScreen();
  const theme = useTheme();

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <FormSection
        title="Units"
        footer={
          screen.showUnitRows
            ? 'Each quantity in its own unit, everywhere in the app: lists, profiles, statistics, the planner, editors and CSV export.'
            : `${unitsSummary(screen.units)} Choose Custom to pick each unit on its own.`
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

      <FormSection title="Decompression" footer={SETTINGS_FOOTERS.decompression}>
        <StepperRow label="GF low" value={screen.gfLow} onChange={screen.setGfLow} />
        <StepperRow label="GF high" value={screen.gfHigh} onChange={screen.setGfHigh} />
      </FormSection>

      <FormSection title="Profile" footer={SETTINGS_FOOTERS.profile}>
        {PROFILE_TOGGLES.map((toggle) => (
          <SwitchRow
            key={toggle.key}
            label={toggle.label}
            value={screen.profile[toggle.key]}
            onChange={(on) => screen.setProfile({ [toggle.key]: on })}
          />
        ))}
      </FormSection>

      <FormSection title="New dives" footer={SETTINGS_FOOTERS.newDives}>
        <Text style={{ color: theme.textSecondary }}>Default cylinder</Text>
        <OptionField
          options={screen.defaultCylinder.options}
          value={screen.defaultCylinder.value}
          onChange={screen.defaultCylinder.set}
        />
      </FormSection>

      <FormSection title="Logbook">
        <ValueRow label="Dives" value={String(screen.diveCount)} />
        <ValueRow label="Dive sites" value={String(screen.siteCount)} />
        <ValueRow label="Trips" value={String(screen.tripCount)} />
        <FormButtonRow label="Ungroup all dives" destructive onPress={screen.ungroupDives} />
      </FormSection>

      <FormSection
        title="Transfer"
        footer="Import adds the dives in a Subsurface logbook or a Suunto export to this one. Open replaces it.">
        <ActionRow label="Download from dive computer" onPress={screen.diveComputers.open} />
        <ActionRow label="Import dives" onPress={screen.transfer.importFile} />
        <ActionRow label="Export and share" onPress={screen.transfer.shareLogbook} />
        <ActionRow label="Open a logbook" onPress={screen.transfer.openLogbook} />
        <ActionRow
          label="Forget remembered dive computers"
          onPress={screen.diveComputers.forget}
          disabled={screen.diveComputers.remembered === 0}
        />
      </FormSection>

      <FormSection
        title="SSI"
        footer="Push a dive to your SSI logbook from the dive itself. Your SSI email and password are kept in this device's encrypted storage, never in the logbook file. Not affiliated with SSI.">
        <ValueRow label="Account" value={screen.ssi.account ?? 'Not signed in'} />
        <ValueRow label="Dive sites" value={screen.ssi.siteCatalogue} />
        <ActionRow label="SSI account" onPress={screen.ssi.open} />
      </FormSection>

      <FormSection
        title="Git sync"
        footer="Keep the logbook in a git repository over SSH, to back it up and share it between devices.">
        <ValueRow label="Repository" value={screen.git.repository} />
        <ValueRow label="Last sync" value={screen.git.lastSync} />
        {screen.git.ready ? (
          <ActionRow
            label={screen.git.busy ? 'Syncing...' : 'Sync now'}
            disabled={screen.git.busy}
            onPress={screen.git.sync}
          />
        ) : null}
        <ActionRow label="Git sync settings" onPress={screen.git.open} />
      </FormSection>

      <FormSection
        title="MCP server"
        footer="Lets an AI assistant on a computer in the same network, or on your VPN, read this logbook - dives, statistics, notes, cylinders, weights and the computed profile as CSV. Read-only, and without a password: anyone who can reach one of these addresses can connect while it runs. It answers only while the app is open, and is off again on the next launch.">
        <SwitchRow label="Run MCP server" value={screen.mcp.on} onChange={screen.mcp.setOn} />
        <ValueRow label="Status" value={screen.mcp.status} />
        {screen.mcp.urls.map(({ kind, url }) => (
          <Fragment key={url}>
            <ValueRow label={kind} value={url} />
            <ActionRow
              label={screen.mcp.copied === url ? 'Copied' : `Copy ${kind} URL`}
              onPress={() => screen.mcp.copyUrl(url)}
            />
          </Fragment>
        ))}
      </FormSection>

      <FormSection title="Problems" footer={PRIVACY_NOTICE}>
        <ValueRow label="Problem log" value={screen.diagnostics} />
        <ActionRow label="Share the problem log" onPress={screen.shareDiagnostics} />
        <FormButtonRow label="Clear it" destructive onPress={screen.clearDiagnostics} />
      </FormSection>

      <FormSection title="About" footer={`${LICENSE_NOTICE} ${SOURCE_NOTICE}`}>
        {aboutRows(screen.about).map((row) => (
          <ValueRow key={row.label} label={row.label} value={row.value} />
        ))}
        <ActionRow label="Source code and licence" onPress={screen.openSource} />
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
      accessibilityLabel={`${delta < 0 ? 'Decrease' : 'Increase'} ${label}`}
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
