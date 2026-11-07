// AI-generated (Claude)
// Loading / empty / error placeholder on Android, in Compose: the icon, the text and a
// filled button for the way forward. The portable variant is status-view.tsx.
import { Host } from '@/components/material/host';
import {
  Box,
  Button,
  Column,
  LoadingIndicator,
  Text,
  TextButton,
  useMaterialColors,
} from '@expo/ui/jetpack-compose';
import { fillMaxSize, paddingAll } from '@expo/ui/jetpack-compose/modifiers';

import { M3Icon } from '@/components/material/icon';

import type { StatusViewProps } from './status-view';

export type { StatusViewProps };

export function StatusView({
  kind,
  title,
  description,
  systemImage,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: StatusViewProps) {
  const palette = useMaterialColors();
  return (
    <Host style={{ flex: 1, backgroundColor: palette.surface }}>
      <Box contentAlignment="center" modifiers={[fillMaxSize(), paddingAll(24)]}>
      <Column verticalArrangement={{ spacedBy: 16 }} horizontalAlignment="center">
        {kind === 'loading' ? <LoadingIndicator /> : null}
        {kind !== 'loading' && systemImage ? (
          <M3Icon symbol={systemImage} size={48} tint={palette.onSurfaceVariant} />
        ) : null}
        <Text style={{ typography: 'titleLarge', textAlign: 'center' }}>{title}</Text>
        {description ? (
          <Text color={palette.onSurfaceVariant} style={{ typography: 'bodyMedium', textAlign: 'center' }}>
            {description}
          </Text>
        ) : null}
        {actionLabel && onAction ? (
          <Button onClick={onAction}>
            <Text>{actionLabel}</Text>
          </Button>
        ) : null}
        {secondaryActionLabel && onSecondaryAction ? (
          <TextButton onClick={onSecondaryAction}>
            <Text>{secondaryActionLabel}</Text>
          </TextButton>
        ) : null}
      </Column>
      </Box>
    </Host>
  );
}
