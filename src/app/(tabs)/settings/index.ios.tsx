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
import { disabled, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';

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

        <Section title="Logbook" footer={<Text>{screen.logbookPath ?? 'not loaded'}</Text>}>
          <LabeledContent label="Dives">
            <Text>{String(screen.diveCount)}</Text>
          </LabeledContent>
          <LabeledContent label="Dive sites">
            <Text>{String(screen.siteCount)}</Text>
          </LabeledContent>
          <LabeledContent label="Trips">
            <Text>{String(screen.tripCount)}</Text>
          </LabeledContent>
          <Button label="Reload from disk" onPress={screen.reload} />
          <Button label="Restore the sample logbook" onPress={screen.restoreSample} />
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

        {__DEV__ ? (
          <Section
            title="Developer"
            footer={
              <Text>Loads throwaway files to exercise the list&apos;s empty and error states.</Text>
            }>
            <Button label="Import the Suunto sample" onPress={screen.importSuuntoSample} />
            <Button label="Import the Suunto XML sample" onPress={screen.importSuuntoXmlSample} />
            <Button label="Load an empty logbook" onPress={screen.loadEmptyLogbook} />
            <Button
              label="Load a malformed logbook"
              role="destructive"
              onPress={screen.loadMalformedLogbook}
            />
          </Section>
        ) : null}
      </Form>
    </Host>
  );
}
