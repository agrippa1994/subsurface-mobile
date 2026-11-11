// AI-generated (Claude)
// The Tools tab, Android variant: a Compose list with one row per tool in
// src/features/tools/tools.ts.
import { useRouter } from 'expo-router';

import { M3ActionRow, M3Screen, M3Section } from '@/components/material/list';
import { TOOLS } from '@/features/tools/tools';
import { toolsDisclaimer } from '@/models/disclaimer';
import { t } from '@/i18n';

export default function ToolsScreen() {
  const router = useRouter();
  return (
    <M3Screen>
      <M3Section title={t('ui.planning')} footer={toolsDisclaimer()}>
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
