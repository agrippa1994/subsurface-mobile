// AI-generated (Claude)
// The surface GF card on the Android dive list: a tonal Material card as an item
// of the list's LazyColumn, with a Skia sparkline. Same states and texts as the
// iOS card (surface-gf-card.ios.tsx); a tap opens the timeline.
import { Card, Column, Row, RNHostView, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { clickable, fillMaxWidth, padding, semantics, weight } from '@expo/ui/jetpack-compose/modifiers';
import { View } from 'react-native';

import { M3Icon } from '@/components/material/icon';
import { SurfaceGfSparkline } from '@/components/surface-gf-chart';
import { useTheme } from '@/hooks/use-theme';
import type { SurfaceGfCard } from '@/models/surface-gf';
import { t } from '@/i18n';

export function SurfaceGfCardView({ card, onOpen }: { card: SurfaceGfCard; onOpen: () => void }) {
  const palette = useMaterialColors();
  const theme = useTheme();
  const description = `${card.accessibilityLabel} ${t('surfaceGfScreen.opensTimeline')}`;
  const container = [
    padding(16, 12, 16, 4),
    fillMaxWidth(),
    clickable(onOpen),
    semantics({ contentDescription: description }),
  ];

  if (card.phase === 'residual') {
    return (
      <Card colors={{ containerColor: palette.surfaceContainer }} modifiers={container}>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }} modifiers={[padding(16, 12, 16, 12)]}>
          <M3Icon name="trending_down" tint={palette.primary} />
          <Column modifiers={[weight(1)]}>
            <Text style={{ typography: 'titleSmall' }}>{t('surfaceGf.gf', { gf: card.gfText })}</Text>
            <Text color={palette.onSurfaceVariant} style={{ typography: 'bodySmall' }}>
              {card.untilText}
            </Text>
          </Column>
          <M3Icon name="chevron_right" size={20} tint={palette.onSurfaceVariant} />
        </Row>
      </Card>
    );
  }

  return (
    <Card colors={{ containerColor: palette.secondaryContainer }} modifiers={container}>
      <Column modifiers={[padding(16, 12, 16, 12)]}>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }}>
          <Column modifiers={[weight(1)]}>
            <Text color={palette.onSecondaryContainer} style={{ typography: 'labelMedium' }}>
              {t('nav.surfaceGf')}
            </Text>
            <Text
              color={card.aboveGfHigh ? theme.warning : palette.onSecondaryContainer}
              style={{ typography: 'displaySmall' }}>
              {card.gfText}
            </Text>
            <Text color={palette.onSecondaryContainer} style={{ typography: 'bodyMedium' }}>
              {card.untilText}
            </Text>
            <Text color={palette.onSurfaceVariant} style={{ typography: 'bodySmall' }}>
              {card.sinceText}
            </Text>
          </Column>
          <RNHostView matchContents>
            <View>
              <SurfaceGfSparkline points={card.sparkline} nowX={card.nowX} width={112} height={52} />
            </View>
          </RNHostView>
          <M3Icon name="chevron_right" size={20} tint={palette.onSurfaceVariant} />
        </Row>
        {card.planned ? (
          <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }} modifiers={[padding(0, 8, 0, 0)]}>
            <M3Icon name="schedule" size={18} tint={palette.primary} />
            <Text color={palette.onSecondaryContainer} style={{ typography: 'bodyMedium' }}>
              {t('surfaceGfScreen.nextEntry', { entry: `${card.planned.gfText}, ${card.planned.whenText}` })}
            </Text>
          </Row>
        ) : (
          <Text color={palette.onSurfaceVariant} style={{ typography: 'bodySmall' }} modifiers={[padding(0, 8, 0, 0)]}>
            {t('surfaceGfScreen.modelValue')}
          </Text>
        )}
      </Column>
    </Card>
  );
}
