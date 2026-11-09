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
import { aboutRows, LICENSE_NOTICE, PRIVACY_NOTICE, SOURCE_NOTICE } from '@/models/about';
import { GF_RANGE, SETTINGS_FOOTERS } from '@/models/settings';
import type { Units } from '@/models';
import { UNIT_PRESET_OPTIONS, UNIT_ROWS, unitsSummary } from '@/models/units';


export default function SettingsScreen() {
  const screen = useSettingsScreen();

  return (
    <M3Screen>
      <M3Section
        title="Units"
        footer={
          screen.showUnitRows
            ? 'Each quantity in its own unit, everywhere in the app: lists, profiles, statistics, the planner, editors and CSV export.'
            : `${unitsSummary(screen.units)} Choose Custom to pick each unit on its own.`
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

      <M3Section
        title="Decompression"
        footer="Buehlmann gradient factors, in percent. They decide the deco ceiling drawn on the dive profile - lower is more conservative. Subsurface's defaults are 30 and 75. The two curves show tissue loading against the limit: GF at depth for the moment itself, surface GF for what the diver would carry on surfacing right then.">
        <M3StepperRow
          label={`GF low  ${screen.gfLow}%`}
          value={screen.gfLow}
          min={GF_RANGE.min}
          max={GF_RANGE.max}
          step={1}
          onChange={screen.setGfLow}
        />
        <M3StepperRow
          label={`GF high  ${screen.gfHigh}%`}
          value={screen.gfHigh}
          min={GF_RANGE.min}
          max={GF_RANGE.max}
          step={1}
          onChange={screen.setGfHigh}
        />
        <M3SwitchRow label="Show GF at depth" value={screen.showGfNow} onChange={screen.setShowGfNow} />
        <M3SwitchRow
          label="Show surface GF"
          value={screen.showGfSurface}
          onChange={screen.setShowGfSurface}
        />
      </M3Section>

      <M3Section title="New dives" footer={SETTINGS_FOOTERS.newDives}>
        <M3MenuRow
          label="Default cylinder"
          value={screen.defaultCylinder.value}
          shown={screen.defaultCylinder.label}
          options={screen.defaultCylinder.options}
          onChange={screen.defaultCylinder.set}
        />
      </M3Section>

      <M3Section title="Logbook">
        <M3ValueRow inline label="Dives" value={String(screen.diveCount)} />
        <M3ValueRow inline label="Dive sites" value={String(screen.siteCount)} />
        <M3ValueRow inline label="Trips" value={String(screen.tripCount)} />
        <M3ActionRow label="Ungroup all dives" icon="trash" destructive onPress={screen.ungroupDives} />
      </M3Section>

      <M3Section
        title="Transfer"
        footer="Import adds the dives in a Subsurface logbook or a Suunto export to this one. Open replaces it.">
        <M3ActionRow label="Download from dive computer" icon="arrow.down.circle" opens onPress={screen.diveComputers.open} />
        <M3ActionRow
          label="Import dives"
          icon="square.and.arrow.down"
          disabled={screen.transfer.busy}
          onPress={screen.transfer.importFile}
        />
        <M3ActionRow
          label="Export and share"
          icon="square.and.arrow.up"
          disabled={screen.transfer.busy}
          onPress={screen.transfer.shareLogbook}
        />
        <M3ActionRow
          label="Open a logbook"
          icon="folder"
          destructive
          disabled={screen.transfer.busy}
          onPress={screen.transfer.openLogbook}
        />
        <M3ActionRow
          label="Forget remembered dive computers"
          icon="trash"
          destructive
          disabled={screen.diveComputers.remembered === 0}
          onPress={screen.diveComputers.forget}
        />
      </M3Section>

      <M3Section
        title="SSI"
        footer="Push a dive to your SSI logbook from the dive itself. Your SSI email and password are kept in this device's encrypted storage, never in the logbook file. Not affiliated with SSI.">
        <M3ValueRow label="Account" value={screen.ssi.account ?? 'Not signed in'} />
        <M3ValueRow label="Dive sites" value={screen.ssi.siteCatalogue} />
        <M3ActionRow label="SSI account" icon="person.fill.checkmark" opens onPress={screen.ssi.open} />
      </M3Section>

      <M3Section
        title="Git sync"
        footer="Keep the logbook in a git repository over SSH, to back it up and share it between devices.">
        <M3ValueRow label="Repository" value={screen.git.repository} />
        <M3ValueRow label="Last sync" value={screen.git.lastSync} />
        {screen.git.ready ? (
          <M3ActionRow
            label={screen.git.busy ? 'Syncing...' : 'Sync now'}
            icon="clock.arrow.circlepath"
            disabled={screen.git.busy}
            onPress={screen.git.sync}
          />
        ) : null}
        <M3ActionRow label="Git sync settings" icon="gearshape" opens onPress={screen.git.open} />
      </M3Section>

      <M3Section
        title="MCP server"
        footer="Lets an AI assistant on a computer in the same network, or on your VPN, read this logbook - dives, statistics, notes, cylinders, weights and the computed profile as CSV. Read-only, and without a password: anyone who can reach one of these addresses can connect while it runs. It answers only while the app is open, and is off again on the next launch.">
        <M3SwitchRow label="Run MCP server" value={screen.mcp.on} onChange={screen.mcp.setOn} />
        <M3ValueRow label="Status" value={screen.mcp.status} />
        {screen.mcp.urls.map(({ kind, url }) => (
          <Fragment key={url}>
            <M3ValueRow label={kind} value={url} />
            <M3ActionRow
              label={screen.mcp.copied === url ? 'Copied' : `Copy ${kind} URL`}
              icon="doc.on.doc"
              onPress={() => screen.mcp.copyUrl(url)}
            />
          </Fragment>
        ))}
      </M3Section>

      <M3Section title="Problems" footer={PRIVACY_NOTICE}>
        <M3ValueRow label="Problem log" value={screen.diagnostics} />
        <M3ActionRow label="Share the problem log" icon="square.and.arrow.up" onPress={screen.shareDiagnostics} />
        <M3ActionRow label="Clear it" icon="trash" destructive onPress={screen.clearDiagnostics} />
      </M3Section>

      <M3Section title="About" footer={`${LICENSE_NOTICE} ${SOURCE_NOTICE}`}>
        {aboutRows(screen.about).map((row) => (
          <M3ValueRow key={row.label} label={row.label} value={row.value} />
        ))}
        <M3ActionRow label="Source code and licence" icon="arrow.up.right.square" onPress={screen.openSource} />
      </M3Section>
    </M3Screen>
  );
}
