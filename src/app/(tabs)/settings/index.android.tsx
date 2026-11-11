// AI-generated (Claude)
// Settings, Android variant: Compose list items, laid out as Android's own settings
// are. The sections and what they say match index.ios.tsx; both read
// use-settings-screen.
import { Fragment } from 'react';

import {
  M3ActionRow,
  M3MenuRow,
  M3Screen,
  M3Section,
  M3SegmentedRow,
  M3StepperRow,
  M3SwitchRow,
  M3ValueRow,
} from '@/components/material/list';
import { useSettingsScreen } from '@/features/settings/use-settings-screen';
import { aboutRows, licenseNotice, privacyNotice, sourceNotice } from '@/models/about';
import { diveDataDisclaimer } from '@/models/disclaimer';
import { GF_RANGE, PROFILE_TOGGLES, SETTINGS_FOOTERS } from '@/models/settings';
import type { Units } from '@/models';
import { UNIT_PRESET_OPTIONS, UNIT_ROWS, unitsSummary } from '@/models/units';
import { t } from '@/i18n';


export default function SettingsScreen() {
  const screen = useSettingsScreen();

  return (
    <M3Screen>
      <M3Section
        title={t('ui.units')}
        footer={
          screen.showUnitRows
            ? t('settingsScreen.unitsEach')
            : `${unitsSummary(screen.units)} ${t('settingsScreen.unitsCustom')}`
        }>
        <M3SegmentedRow
          options={UNIT_PRESET_OPTIONS}
          value={screen.unitPreset}
          onChange={screen.setUnitPreset}
        />
        {screen.showUnitRows
          ? UNIT_ROWS.map((row) => (
              <M3SegmentedRow
                key={row.key}
                label={row.label}
                options={row.options}
                value={screen.units[row.key]}
                onChange={(value) => screen.setUnit(row.key, value as Units[typeof row.key])}
              />
            ))
          : null}
      </M3Section>

      <M3Section title={t('ui.decompression')} footer={SETTINGS_FOOTERS.decompression}>
        <M3StepperRow
          label={`${t('plannerSettings.label.gfLow')}  ${screen.gfLow}%`}
          value={screen.gfLow}
          min={GF_RANGE.min}
          max={GF_RANGE.max}
          step={1}
          onChange={screen.setGfLow}
        />
        <M3StepperRow
          label={`${t('plannerSettings.label.gfHigh')}  ${screen.gfHigh}%`}
          value={screen.gfHigh}
          min={GF_RANGE.min}
          max={GF_RANGE.max}
          step={1}
          onChange={screen.setGfHigh}
        />
      </M3Section>

      <M3Section title={t('ui.profile')} footer={SETTINGS_FOOTERS.profile}>
        {PROFILE_TOGGLES.map((toggle) => (
          <M3SwitchRow
            key={toggle.key}
            label={toggle.label}
            value={screen.profile[toggle.key]}
            onChange={(on) => screen.setProfile({ [toggle.key]: on })}
          />
        ))}
      </M3Section>

      <M3Section title={t('ui.newDives')} footer={SETTINGS_FOOTERS.newDives}>
        <M3MenuRow
          label={t('ui.defaultCylinder')}
          value={screen.defaultCylinder.value}
          shown={screen.defaultCylinder.label}
          options={screen.defaultCylinder.options}
          onChange={screen.defaultCylinder.set}
        />
      </M3Section>

      <M3Section title={t('ui.logbook')}>
        <M3ValueRow inline label={t('ui.dives')} value={String(screen.diveCount)} />
        <M3ValueRow inline label={t('ui.diveSites')} value={String(screen.siteCount)} />
        <M3ValueRow inline label={t('ui.trips')} value={String(screen.tripCount)} />
        <M3ActionRow label={t('ui.ungroupAllDives')} icon="trash" destructive onPress={screen.ungroupDives} />
      </M3Section>

      <M3Section
        title={t('ui.transfer')}
        footer={t('ui.importAddsTheDivesInA')}>
        <M3ActionRow label={t('ui.downloadFromDiveComputer')} icon="arrow.down.circle" opens onPress={screen.diveComputers.open} />
        <M3ActionRow
          label={t('ui.importDives')}
          icon="square.and.arrow.down"
          disabled={screen.transfer.busy}
          onPress={screen.transfer.importFile}
        />
        <M3ActionRow
          label={t('ui.exportAndShare')}
          icon="square.and.arrow.up"
          disabled={screen.transfer.busy}
          onPress={screen.transfer.shareLogbook}
        />
        <M3ActionRow
          label={t('ui.openALogbook')}
          icon="folder"
          destructive
          disabled={screen.transfer.busy}
          onPress={screen.transfer.openLogbook}
        />
        <M3ActionRow
          label={t('ui.forgetRememberedDiveComputers')}
          icon="trash"
          destructive
          disabled={screen.diveComputers.remembered === 0}
          onPress={screen.diveComputers.forget}
        />
      </M3Section>

      <M3Section
        title={t('ui.ssi')}
        footer={t('ui.pushADiveToYourSsi')}>
        <M3ValueRow label={t('ui.account')} value={screen.ssi.account ?? t('dive.ssi.notSignedIn')} />
        <M3ValueRow label={t('ui.diveSites')} value={screen.ssi.siteCatalogue} />
        <M3ActionRow label={t('ui.ssiAccount')} icon="person.fill.checkmark" opens onPress={screen.ssi.open} />
      </M3Section>

      <M3Section
        title={t('ui.gitSync')}
        footer={t('ui.keepTheLogbookInAGit')}>
        <M3ValueRow label={t('ui.repository')} value={screen.git.repository} />
        <M3ValueRow label={t('ui.lastSync')} value={screen.git.lastSync} />
        {screen.git.ready ? (
          <M3ActionRow
            label={screen.git.busy ? t('gitScreen.syncing') : t('settingsScreen.syncNow')}
            icon="clock.arrow.circlepath"
            disabled={screen.git.busy}
            onPress={screen.git.sync}
          />
        ) : null}
        <M3ActionRow label={t('ui.gitSyncSettings')} icon="gearshape" opens onPress={screen.git.open} />
      </M3Section>

      <M3Section
        title={t('ui.mcpServer')}
        footer={t('ui.letsAnAiAssistantOnA')}>
        <M3SwitchRow label={t('ui.runMcpServer')} value={screen.mcp.on} onChange={screen.mcp.setOn} />
        <M3ValueRow label={t('ui.status')} value={screen.mcp.status} />
        {screen.mcp.urls.map(({ kind, url }) => (
          <Fragment key={url}>
            <M3ValueRow label={kind} value={url} />
            <M3ActionRow
              label={screen.mcp.copied === url ? t('diveForm.copied') : t('settingsScreen.copyUrl', { kind })}
              icon="doc.on.doc"
              onPress={() => screen.mcp.copyUrl(url)}
            />
          </Fragment>
        ))}
      </M3Section>

      <M3Section title={t('ui.problems')} footer={privacyNotice()}>
        <M3ValueRow label={t('ui.problemLog')} value={screen.diagnostics} />
        <M3ActionRow label={t('ui.shareTheProblemLog')} icon="square.and.arrow.up" onPress={screen.shareDiagnostics} />
        <M3ActionRow label={t('ui.clearIt')} icon="trash" destructive onPress={screen.clearDiagnostics} />
      </M3Section>

      <M3Section title={t('ui.about')} footer={`${diveDataDisclaimer()}\n\n${licenseNotice()} ${sourceNotice()}`}>
        {aboutRows(screen.about).map((row) => (
          <M3ValueRow key={row.label} label={row.label} value={row.value} />
        ))}
        <M3ActionRow label={t('ui.sourceCodeAndLicence')} icon="arrow.up.right.square" onPress={screen.openSource} />
      </M3Section>
    </M3Screen>
  );
}
