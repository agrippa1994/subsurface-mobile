// AI-generated (Claude)
// Settings, iOS variant: a native Form, so the rows, grouping and controls are
// the system's own.
import {
  Button,
  Form,
  Host,
  LabeledContent,
  Picker,
  Section,
  Stepper,
  Text,
  Toggle,
} from '@expo/ui/swift-ui';
import { disabled, pickerStyle, tag, textSelection } from '@expo/ui/swift-ui/modifiers';
import { Fragment } from 'react';

import { useSettingsScreen } from '@/features/settings/use-settings-screen';
import { aboutRows, licenseNotice, privacyNotice, sourceNotice } from '@/models/about';
import { diveDataDisclaimer } from '@/models/disclaimer';
import { GF_RANGE, PROFILE_TOGGLES, SETTINGS_FOOTERS } from '@/models/settings';
import type { Units } from '@/models';
import {
  UNIT_PRESET_OPTIONS,
  UNIT_ROWS,
  unitsSummary,
  type UnitPresetChoice,
} from '@/models/units';
import { t } from '@/i18n';

export default function SettingsScreen() {
  const screen = useSettingsScreen();

  return (
    <Host style={{ flex: 1 }} useViewportSizeMeasurement>
      <Form>
        <Section
          title={t('ui.units')}
          footer={
            <Text>
              {screen.showUnitRows
                ? t('settingsScreen.unitsEach')
                : `${unitsSummary(screen.units)} ${t('settingsScreen.unitsCustom')}`}
            </Text>
          }>
          <Picker
            label={t('ui.measurements')}
            selection={screen.unitPreset}
            onSelectionChange={(value: string) => screen.setUnitPreset(value as UnitPresetChoice)}
            modifiers={[pickerStyle('segmented')]}>
            {UNIT_PRESET_OPTIONS.map((option) => (
              <Text key={option.value} modifiers={[tag(option.value)]}>
                {option.label}
              </Text>
            ))}
          </Picker>
          {screen.showUnitRows
            ? UNIT_ROWS.map((row) => (
                <Picker
                  key={row.key}
                  label={row.label}
                  selection={screen.units[row.key]}
                  onSelectionChange={(value: string) =>
                    screen.setUnit(row.key, value as Units[typeof row.key])
                  }
                  modifiers={[pickerStyle('menu')]}>
                  {row.options.map((option) => (
                    <Text key={option.value} modifiers={[tag(option.value)]}>
                      {option.label}
                    </Text>
                  ))}
                </Picker>
              ))
            : null}
        </Section>

        <Section title={t('ui.decompression')} footer={<Text>{SETTINGS_FOOTERS.decompression}</Text>}>
          <Stepper
            label={`${t('plannerSettings.label.gfLow')}  ${screen.gfLow}%`}
            value={screen.gfLow}
            min={GF_RANGE.min}
            max={GF_RANGE.max}
            step={1}
            onValueChange={screen.setGfLow}
          />
          <Stepper
            label={`${t('plannerSettings.label.gfHigh')}  ${screen.gfHigh}%`}
            value={screen.gfHigh}
            min={GF_RANGE.min}
            max={GF_RANGE.max}
            step={1}
            onValueChange={screen.setGfHigh}
          />
        </Section>

        <Section title={t('ui.profile')} footer={<Text>{SETTINGS_FOOTERS.profile}</Text>}>
          {PROFILE_TOGGLES.map((toggle) => (
            <Toggle
              key={toggle.key}
              label={toggle.label}
              isOn={screen.profile[toggle.key]}
              onIsOnChange={(on: boolean) => screen.setProfile({ [toggle.key]: on })}
            />
          ))}
        </Section>

        <Section title={t('ui.newDives')} footer={<Text>{SETTINGS_FOOTERS.newDives}</Text>}>
          <Picker
            label={t('ui.defaultCylinder')}
            selection={screen.defaultCylinder.value}
            onSelectionChange={(value: string) => screen.defaultCylinder.set(value)}
            modifiers={[pickerStyle('menu')]}>
            {screen.defaultCylinder.options.map((option) => (
              <Text key={option.value || 'none'} modifiers={[tag(option.value)]}>
                {option.label}
              </Text>
            ))}
          </Picker>
        </Section>

        <Section title={t('ui.logbook')}>
          <LabeledContent label={t('ui.dives')}>
            <Text>{String(screen.diveCount)}</Text>
          </LabeledContent>
          <LabeledContent label={t('ui.diveSites')}>
            <Text>{String(screen.siteCount)}</Text>
          </LabeledContent>
          <LabeledContent label={t('ui.trips')}>
            <Text>{String(screen.tripCount)}</Text>
          </LabeledContent>
          <Button label={t('ui.ungroupAllDives')} role="destructive" onPress={screen.ungroupDives} />
        </Section>

        <Section
          title={t('ui.transfer')}
          footer={
            <Text>
              {t('settingsScreen.transferIos')}
            </Text>
          }>
          <Button label={t('ui.downloadFromDiveComputer')} onPress={screen.diveComputers.open} />
          <Button
            label={t('ui.importDives')}
            modifiers={[disabled(screen.transfer.busy)]}
            onPress={screen.transfer.importFile}
          />
          <Button
            label={t('ui.exportAndShare')}
            modifiers={[disabled(screen.transfer.busy)]}
            onPress={screen.transfer.shareLogbook}
          />
          <Button
            label={t('ui.openALogbook')}
            role="destructive"
            modifiers={[disabled(screen.transfer.busy)]}
            onPress={screen.transfer.openLogbook}
          />
          <Button
            label={t('ui.forgetRememberedDiveComputers')}
            role="destructive"
            modifiers={[disabled(screen.diveComputers.remembered === 0)]}
            onPress={screen.diveComputers.forget}
          />
        </Section>

        <Section
          title={t('ui.ssi')}
          footer={
            <Text>
              {t('settingsScreen.ssiIos')}
            </Text>
          }>
          <LabeledContent label={t('ui.account')}>
            <Text>{screen.ssi.account ?? t('dive.ssi.notSignedIn')}</Text>
          </LabeledContent>
          <LabeledContent label={t('ui.diveSites')}>
            <Text>{screen.ssi.siteCatalogue}</Text>
          </LabeledContent>
          <Button label={t('ui.ssiAccount')} onPress={screen.ssi.open} />
        </Section>

        <Section
          title={t('ui.gitSync')}
          footer={
            <Text>
              {t('ui.keepTheLogbookInAGit')}
            </Text>
          }>
          <LabeledContent label={t('ui.repository')}>
            <Text>{screen.git.repository}</Text>
          </LabeledContent>
          <LabeledContent label={t('ui.lastSync')}>
            <Text>{screen.git.lastSync}</Text>
          </LabeledContent>
          {screen.git.ready ? (
            <Button
              label={screen.git.busy ? t('gitScreen.syncing') : t('settingsScreen.syncNow')}
              modifiers={[disabled(screen.git.busy)]}
              onPress={screen.git.sync}
            />
          ) : null}
          <Button label={t('ui.gitSyncSettings')} onPress={screen.git.open} />
        </Section>

        <Section
          title={t('ui.mcpServer')}
          footer={
            <Text>
              {t('ui.letsAnAiAssistantOnA')}
            </Text>
          }>
          <Toggle label={t('ui.runMcpServer')} isOn={screen.mcp.on} onIsOnChange={screen.mcp.setOn} />
          <LabeledContent label={t('ui.status')}>
            <Text>{screen.mcp.status}</Text>
          </LabeledContent>
          {screen.mcp.urls.map(({ kind, url }) => (
            <Fragment key={url}>
              <LabeledContent label={kind}>
                <Text modifiers={[textSelection(true)]}>{url}</Text>
              </LabeledContent>
              <Button
                label={screen.mcp.copied === url ? t('diveForm.copied') : t('settingsScreen.copyUrl', { kind })}
                onPress={() => screen.mcp.copyUrl(url)}
              />
            </Fragment>
          ))}
        </Section>

        <Section title={t('ui.problems')} footer={<Text>{privacyNotice()}</Text>}>
          <LabeledContent label={t('ui.problemLog')}>
            <Text>{screen.diagnostics}</Text>
          </LabeledContent>
          <Button label={t('ui.shareTheProblemLog')} onPress={screen.shareDiagnostics} />
          <Button label={t('ui.clearIt')} role="destructive" onPress={screen.clearDiagnostics} />
        </Section>

        <Section title={t('ui.about')} footer={<Text>{`${diveDataDisclaimer()}\n\n${licenseNotice()} ${sourceNotice()}`}</Text>}>
          {aboutRows(screen.about).map((row) => (
            <LabeledContent key={row.label} label={row.label}>
              <Text>{row.value}</Text>
            </LabeledContent>
          ))}
          <Button label={t('ui.sourceCodeAndLicence')} onPress={screen.openSource} />
        </Section>

      </Form>
    </Host>
  );
}
