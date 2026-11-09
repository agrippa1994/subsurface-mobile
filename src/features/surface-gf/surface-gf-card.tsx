// AI-generated (Claude)
// The surface GF card above the dive list, React Native variant (the web; iOS
// and Android have native ones). Same states and texts as those.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SurfaceGfSparkline } from '@/components/surface-gf-chart';
import { useTheme } from '@/hooks/use-theme';
import type { SurfaceGfCard } from '@/models/surface-gf';

export function SurfaceGfCardView({ card, onOpen }: { card: SurfaceGfCard; onOpen: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={card.accessibilityLabel}
      accessibilityHint="Opens the surface GF timeline"
      style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.row}>
        <View style={styles.texts}>
          <Text style={[styles.caption, { color: theme.textSecondary }]}>SURFACE GF</Text>
          <Text style={[styles.big, { color: card.aboveGfHigh ? theme.warning : theme.text }]}>{card.gfText}</Text>
          <Text style={{ color: theme.text }}>{card.untilText}</Text>
          <Text style={[styles.small, { color: theme.textSecondary }]}>{card.sinceText}</Text>
        </View>
        {card.phase === 'supersaturated' ? <SurfaceGfSparkline points={card.sparkline} nowX={card.nowX} /> : null}
      </View>
      {card.planned ? (
        <Text style={[styles.small, { color: theme.text }]}>
          {`Next entry: ${card.planned.gfText}, ${card.planned.whenText}`}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { margin: 16, marginBottom: 4, padding: 16, borderRadius: 16, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  texts: { flex: 1, gap: 2 },
  caption: { fontSize: 12, fontWeight: '600' },
  big: { fontSize: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
  small: { fontSize: 13, fontVariant: ['tabular-nums'] },
});
