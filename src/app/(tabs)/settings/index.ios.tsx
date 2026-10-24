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
import { aboutRows, LICENSE_NOTICE, PRIVACY_NOTICE, SOURCE_NOTICE } from '@/models/about';
import { GF_RANGE } from '@/models/settings';
import type { UnitSystem } from '@/models';

export default function SettingsScreen() {
  const screen = useSettingsScreen();

  return (
    <Host style={{ flex: 1 }} useViewportSizeMeasurement>
      <Form>
        <Section title="Units">
          <Picker
            label="Measurements"
            selection={screen.unitSystem}
            onSelectionChange={(value: string) => screen.setUnitSystem(value as UnitSystem)}
            modifiers={[pickerStyle('segmented')]}>
            <Text modifiers={[tag('metric')]}>Metric</Text>
            <Text modifiers={[tag('imperial')]}>Imperial</Text>
          </Picker>
        </Section>

        <Section
          title="Decompression"
          footer={
            <Text>
              Buehlmann gradient factors, in percent. They decide the deco ceiling drawn on the dive
              profile - lower is more conservative. Subsurface&apos;s defaults are 30 and 75. The two
              curves show tissue loading against the limit: GF at depth for the moment itself,
              surface GF for what the diver would carry on surfacing right then.
            </Text>
          }>
          <Stepper
            label={`GF low  ${screen.gfLow}%`}
            value={screen.gfLow}
            min={GF_RANGE.min}
            max={GF_RANGE.max}
            step={1}
            onValueChange={screen.setGfLow}
          />
          <Stepper
            label={`GF high  ${screen.gfHigh}%`}
            value={screen.gfHigh}
            min={GF_RANGE.min}
            max={GF_RANGE.max}
            step={1}
            onValueChange={screen.setGfHigh}
          />
          <Toggle
            label="Show GF at depth"
            isOn={screen.showGfNow}
            onIsOnChange={screen.setShowGfNow}
          />
          <Toggle
            label="Show surface GF"
            isOn={screen.showGfSurface}
            onIsOnChange={screen.setShowGfSurface}
          />
        </Section>

        <Section title="Logbook">
          <LabeledContent label="Dives">
            <Text>{String(screen.diveCount)}</Text>
          </LabeledContent>
          <LabeledContent label="Dive sites">
            <Text>{String(screen.siteCount)}</Text>
          </LabeledContent>
          <LabeledContent label="Trips">
            <Text>{String(screen.tripCount)}</Text>
          </LabeledContent>
          <Button label="Ungroup all dives" role="destructive" onPress={screen.ungroupDives} />
        </Section>

        <Section
          title="Transfer"
          footer={
            <Text>
              Import merges dives into this logbook - Suunto exports (XML, JSON, SDE) and Subsurface
              files alike. Open replaces it.
            </Text>
          }>
          <Button
            label="Import dives"
            modifiers={[disabled(screen.transfer.busy)]}
            onPress={screen.transfer.importFile}
          />
          <Button
            label="Export and share"
            modifiers={[disabled(screen.transfer.busy)]}
            onPress={screen.transfer.shareLogbook}
          />
          <Button
            label="Open a logbook"
            role="destructive"
            modifiers={[disabled(screen.transfer.busy)]}
            onPress={screen.transfer.openLogbook}
          />
        </Section>

        <Section
          title="SSI"
          footer={
            <Text>
              Push a dive to your SSI logbook from the dive itself. Your SSI email and password are
              kept in this device&apos;s keychain, never in the logbook file. Not affiliated with
              SSI.
            </Text>
          }>
          <LabeledContent label="Account">
            <Text>{screen.ssi.account ?? 'Not signed in'}</Text>
          </LabeledContent>
          <LabeledContent label="Dive sites">
            <Text>{screen.ssi.siteCatalogue}</Text>
          </LabeledContent>
          <Button label="SSI account" onPress={screen.ssi.open} />
        </Section>

        <Section
          title="Git sync"
          footer={
            <Text>
              Keep the logbook in a git repository over SSH, to back it up and share it between
              devices.
            </Text>
          }>
          <LabeledContent label="Repository">
            <Text>{screen.git.repository}</Text>
          </LabeledContent>
          <LabeledContent label="Last sync">
            <Text>{screen.git.lastSync}</Text>
          </LabeledContent>
          {screen.git.ready ? (
            <Button
              label={screen.git.busy ? 'Syncing...' : 'Sync now'}
              modifiers={[disabled(screen.git.busy)]}
              onPress={screen.git.sync}
            />
          ) : null}
          <Button label="Git sync settings" onPress={screen.git.open} />
        </Section>

        <Section
          title="MCP server"
          footer={
            <Text>
              Lets an AI assistant on a computer in the same network, or on your VPN, read this
              logbook - dives, statistics, notes, cylinders, weights and the computed profile as
              CSV. Read-only, and without a password: anyone who can reach one of these addresses
              can connect while it runs. It answers only while the app is open, and is off again
              on the next launch.
            </Text>
          }>
          <Toggle label="Run MCP server" isOn={screen.mcp.on} onIsOnChange={screen.mcp.setOn} />
          <LabeledContent label="Status">
            <Text>{screen.mcp.status}</Text>
          </LabeledContent>
          {screen.mcp.urls.map(({ kind, url }) => (
            <Fragment key={url}>
              <LabeledContent label={kind}>
                <Text modifiers={[textSelection(true)]}>{url}</Text>
              </LabeledContent>
              <Button
                label={screen.mcp.copied === url ? 'Copied' : `Copy ${kind} URL`}
                onPress={() => screen.mcp.copyUrl(url)}
              />
            </Fragment>
          ))}
        </Section>

        <Section title="Problems" footer={<Text>{PRIVACY_NOTICE}</Text>}>
          <LabeledContent label="Problem log">
            <Text>{screen.diagnostics}</Text>
          </LabeledContent>
          <Button label="Share the problem log" onPress={screen.shareDiagnostics} />
          <Button label="Clear it" role="destructive" onPress={screen.clearDiagnostics} />
        </Section>

        <Section title="About" footer={<Text>{`${LICENSE_NOTICE} ${SOURCE_NOTICE}`}</Text>}>
          {aboutRows(screen.about).map((row) => (
            <LabeledContent key={row.label} label={row.label}>
              <Text>{row.value}</Text>
            </LabeledContent>
          ))}
          <Button label="Source code and licence" onPress={screen.openSource} />
        </Section>

      </Form>
    </Host>
  );
}
