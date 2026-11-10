// AI-generated (Claude)
// The Tools tab, Android variant: a Compose list with one row per tool in
// src/features/tools/tools.ts.
import { useRouter } from 'expo-router';

import { M3ActionRow, M3Screen, M3Section } from '@/components/material/list';
import { TOOLS } from '@/features/tools/tools';
import { TOOLS_DISCLAIMER } from '@/models/disclaimer';

export default function ToolsScreen() {
  const router = useRouter();
  return (
    <M3Screen>
      <M3Section title="Planning" footer={TOOLS_DISCLAIMER}>
        {TOOLS.map((tool) => (
          <M3ActionRow
            key={tool.key}
            label={tool.title}
            detail={tool.summary}
            icon={tool.systemImage}
            opens
            onPress={() => router.push(tool.href)}
          />
        ))}
      </M3Section>
    </M3Screen>
  );
}
