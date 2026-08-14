// AI-generated (Claude)
// Loading / empty / error placeholder, iOS variant.
//
// Uses the system ContentUnavailableView so an empty logbook looks the way an
// empty list looks everywhere else on the platform, including its typography
// and its behaviour under Dynamic Type.
import { Button, ContentUnavailableView, Host, ProgressView, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, padding } from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { StatusViewProps } from './status-view';

export type { StatusViewProps };

export function StatusView({
  kind,
  title,
  description,
  systemImage,
  actionLabel,
  onAction,
}: StatusViewProps) {
  const fallbackSymbol: SFSymbol = kind === 'error' ? 'exclamationmark.triangle' : 'water.waves';

  return (
    <Host style={{ flex: 1 }}>
      <VStack spacing={16}>
        {kind === 'loading' ? (
          <ProgressView />
        ) : (
          <ContentUnavailableView
            title={title}
            description={description}
            systemImage={(systemImage as SFSymbol) ?? fallbackSymbol}
          />
        )}
        {actionLabel && onAction ? (
          <Button
            label={actionLabel}
            onPress={onAction}
            modifiers={[buttonStyle('glassProminent'), padding({ bottom: 24 })]}
          />
        ) : null}
      </VStack>
    </Host>
  );
}
