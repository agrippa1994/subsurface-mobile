// AI-generated (Claude)
// Settings, iOS variant: a native Form, so the rows, grouping and controls are
// the system's own.
import { Button, Form, Host, LabeledContent, Picker, Section, Text } from '@expo/ui/swift-ui';
import { disabled, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';

import { useSettingsScreen } from '@/features/settings/use-settings-screen';
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

        <Section title="Logbook" footer={<Text>{screen.logbookPath ?? 'not loaded'}</Text>}>
          <LabeledContent label="Dives">
            <Text>{String(screen.diveCount)}</Text>
          </LabeledContent>
          <LabeledContent label="Dive sites">
            <Text>{String(screen.siteCount)}</Text>
          </LabeledContent>
          <Button label="Reload from disk" onPress={screen.reload} />
          <Button label="Restore the sample logbook" onPress={screen.restoreSample} />
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

        {__DEV__ ? (
          <Section
            title="Developer"
            footer={<Text>Loads throwaway files to exercise the list&apos;s empty and error states.</Text>}>
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
