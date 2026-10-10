// AI-generated (Claude)
// The Tools tab, iOS variant: a native Form with one row per tool in
// src/features/tools/tools.ts.
import { Button, Form, Host, Label, Section, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';

import { TOOLS } from '@/features/tools/tools';

export default function ToolsScreen() {
  const router = useRouter();

  return (
    <Host style={{ flex: 1 }} useViewportSizeMeasurement>
      <Form>
        <Section title="Planning">
          {TOOLS.map((tool) => (
            <Button key={tool.key} onPress={() => router.push(tool.href)}>
              <VStack alignment="leading" spacing={2}>
                <Label
                  title={tool.title}
                  systemImage={tool.systemImage}
                  modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}
                />
                <Text
                  modifiers={[
                    font({ textStyle: 'footnote' }),
                    foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                  ]}
                >
                  {tool.summary}
                </Text>
              </VStack>
            </Button>
          ))}
        </Section>
      </Form>
    </Host>
  );
}
