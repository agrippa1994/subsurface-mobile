// AI-generated (Claude)
// The Cards tab: every SSI certification card, stacked the way Wallet stacks
// passes, as SSI's own card images (card-face.tsx). The newest is on top,
// whole; each card under it shows its bottom strip, which is where SSI prints
// the course name; tapping one opens it on its own screen to show around.

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { StatusView } from '@/components/status-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { selectionChanged } from '@/lib/haptics';
import { describeError, formatErrorLine } from '@/models/errors';
import { isExpired } from '@/models/ssi/certificates';
import { useSsiCards } from '@/queries/certificates';

import { CardFace } from './card-face';
import { CARD_ASPECT } from './certificate-card';

/** How much of each card below the first one shows: its bottom strip. */
const STRIP = 0.5;

export function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function CardsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const cards = useSsiCards();
  const { width: windowWidth } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);

  const width = Math.min(windowWidth - Spacing.three * 2, MaxContentWidth / 1.6);
  const height = width / CARD_ASPECT;

  if (cards.isPending) {
    return <StatusView kind="loading" title={t('certificates.loading')} />;
  }
  if (cards.isError) {
    return (
      <StatusView
        kind="error"
        title={t('certificates.errorTitle')}
        description={formatErrorLine(describeError(cards.error))}
        systemImage="exclamationmark.triangle"
        actionLabel={t('ui.tryAgain')}
        onAction={() => void cards.refetch()}
      />
    );
  }

  const { cards: list, holder } = cards.data;
  if (list.length === 0) {
    return (
      <StatusView
        kind="empty"
        title={t('certificates.emptyTitle')}
        description={t('certificates.emptyMessage')}
        systemImage="person.text.rectangle"
        actionLabel={t('ui.tryAgain')}
        onAction={() => void cards.refetch()}
      />
    );
  }

  const today = todayIso();
  const refresh = () => {
    setRefreshing(true);
    void cards.refetch().finally(() => setRefreshing(false));
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <Text style={[styles.count, { color: theme.textSecondary }]}>
        {t('certificates.count', { count: list.length })}
      </Text>
      <View style={{ width }}>
        {list.map((card, index) => (
          <Pressable
            key={card.id}
            accessibilityRole="button"
            onPress={() => {
              selectionChanged();
              router.push(`/cards/${encodeURIComponent(card.id)}`);
            }}
            style={({ pressed }) => ({
              // Each card slides under the one above it, leaving its bottom showing.
              marginTop: index === 0 ? 0 : -height * (1 - STRIP),
              zIndex: list.length - index,
              opacity: pressed ? 0.85 : 1,
            })}>
            <CardFace
              card={card}
              holder={holder}
              width={width}
              expired={isExpired(card, today)}
              titleAtBottom={index > 0}
            />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
  },
  count: {
    alignSelf: 'stretch',
    fontSize: 13,
    marginBottom: Spacing.three,
    textAlign: 'center',
  },
});
