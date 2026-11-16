// AI-generated (Claude)
// One certification card, to show someone: SSI's card image large (tap to turn
// it over to the back image), a full-screen mode that turns it sideways to fill
// the phone, the details, and Add to Apple Wallet.

import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { FormButtonRow, FormSection } from '@/components/form';
import { StatusView } from '@/components/status-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { operationFailed, operationSucceeded, selectionChanged } from '@/lib/haptics';
import { NoPassIdentityError } from '@/lib/wallet/add-to-wallet';
import { describeError, formatErrorLine } from '@/models/errors';
import { isExpired, type SsiCertificate } from '@/models/ssi/certificates';
import { useAddCardToWallet, useSsiCard } from '@/queries/certificates';

import { AddPassButton, canAddPasses } from '../../../modules/wallet-pass/src';
import { CardFace } from './card-face';
import { CARD_ASPECT, formatCardDate } from './certificate-card';
import { todayIso } from './cards-screen';
import { useWalletSetup } from './use-wallet-setup';

/** The card, turning over when tapped. */
function FlipCard({ card, holder, width, expired }: { card: SsiCertificate; holder: string | null; width: number; expired: boolean }) {
  const turn = useSharedValue(0);
  const front = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${turn.value}deg` }],
  }));
  const back = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${turn.value + 180}deg` }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={t('certificates.tapToFlip')}
      onPress={() => {
        selectionChanged();
        turn.value = withTiming(turn.value === 0 ? 180 : 0, { duration: 450 });
      }}
      style={{ width, height: width / CARD_ASPECT }}>
      <Animated.View style={[styles.face, front]}>
        <CardFace card={card} holder={holder} width={width} expired={expired} />
      </Animated.View>
      <Animated.View style={[styles.face, back]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <CardFace card={card} holder={holder} width={width} side="back" />
      </Animated.View>
    </Pressable>
  );
}

/** The card sideways across the whole screen, for holding up to someone. */
function FullScreenCard({
  card,
  holder,
  expired,
  onClose,
}: {
  card: SsiCertificate;
  holder: string | null;
  expired: boolean;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  // Turned a quarter: the card's long side runs along the phone's.
  const cardWidth = Math.min(height - Spacing.six * 2, (width - Spacing.five) * CARD_ASPECT);
  return (
    <Modal visible animationType="fade" supportedOrientations={['portrait']} onRequestClose={onClose}>
      <Pressable
        style={styles.fullScreen}
        accessibilityRole="button"
        accessibilityLabel={t('certificates.close')}
        onPress={onClose}>
        <View style={{ transform: [{ rotate: '90deg' }] }}>
          <CardFace card={card} holder={holder} width={cardWidth} expired={expired} />
        </View>
      </Pressable>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  const theme = useTheme();
  if (!value) {
    return null;
  }
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.text }]} selectable>
        {value}
      </Text>
    </View>
  );
}

export function CardDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { card, holder, query } = useSsiCard(decodeURIComponent(id ?? ''));
  const { width: windowWidth } = useWindowDimensions();
  const wallet = useWalletSetup();
  const addToWallet = useAddCardToWallet();
  const [fullScreen, setFullScreen] = useState(false);

  if (query.isPending) {
    return <StatusView kind="loading" title={t('certificates.loading')} />;
  }
  if (!card) {
    return (
      <StatusView
        kind="error"
        title={t('certificates.errorTitle')}
        description={query.error ? formatErrorLine(describeError(query.error)) : undefined}
        systemImage="exclamationmark.triangle"
      />
    );
  }

  const width = Math.min(windowWidth - Spacing.three * 2, MaxContentWidth / 1.6);
  const expired = isExpired(card, todayIso());
  const walletAvailable = canAddPasses();

  const add = async () => {
    if (wallet.identity === null && !(await wallet.setUp())) {
      return;
    }
    addToWallet.mutate(
      { card, holder },
      {
        onSuccess: (added) => {
          if (added) {
            operationSucceeded();
          }
        },
        onError: (error) => {
          if (error instanceof NoPassIdentityError) {
            void wallet.setUp();
            return;
          }
          operationFailed();
          Alert.alert(t('certificates.wallet.failed'), formatErrorLine(describeError(error)));
        },
      },
    );
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: card.courseShort ?? card.course }} />

      <View style={styles.hero}>
        <FlipCard card={card} holder={holder} width={width} expired={expired} />
        <Text style={[styles.hint, { color: theme.textSecondary }]}>{t('certificates.tapToFlip')}</Text>
      </View>

      <FormSection>
        <FormButtonRow label={t('certificates.showFullScreen')} onPress={() => setFullScreen(true)} />
      </FormSection>

      {walletAvailable ? (
        <FormSection
          title={t('certificates.wallet.section')}
          footer={wallet.identity ? t('certificates.wallet.footer') : t('certificates.wallet.setUpMessage')}>
          {wallet.identity ? (
            <View style={styles.walletRow}>
              {addToWallet.isPending ? (
                <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>
                  {t('certificates.wallet.adding')}
                </Text>
              ) : (
                <AddPassButton onPress={() => void add()} dark={theme.background === '#000000'} />
              )}
            </View>
          ) : (
            <FormButtonRow
              label={wallet.importing ? t('certificates.wallet.adding') : t('certificates.wallet.setUpTitle')}
              onPress={() => void add()}
            />
          )}
        </FormSection>
      ) : null}

      <FormSection title={t('certificates.details')}>
        <Row label={t('certificates.diver')} value={holder} />
        <Row label={t('certificates.category')} value={card.category} />
        <Row label={t('certificates.number')} value={card.number} />
        <Row label={t('certificates.issued')} value={card.issued && formatCardDate(card.issued)} />
        <Row
          label={expired ? t('certificates.expired') : t('certificates.expires')}
          value={card.expires && formatCardDate(card.expires)}
        />
        <Row label={t('certificates.dives')} value={card.dives === null ? null : String(card.dives)} />
        <Row
          label={t('certificates.instructor')}
          value={[card.instructor?.name, card.instructor?.number && `#${card.instructor.number}`].filter(Boolean).join(' ')}
        />
        <Row
          label={t('certificates.center')}
          value={[card.center?.name, [card.center?.city, card.center?.country].filter(Boolean).join(', ')]
            .filter(Boolean)
            .join('\n')}
        />
      </FormSection>

      {fullScreen ? (
        <FullScreenCard card={card} holder={holder} expired={expired} onClose={() => setFullScreen(false)} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  face: {
    ...StyleSheet.absoluteFill,
    backfaceVisibility: 'hidden',
  },
  hint: {
    fontSize: 12,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletRow: {
    alignItems: 'stretch',
    paddingVertical: Spacing.one,
  },
  row: {
    gap: Spacing.half,
  },
  rowLabel: {
    fontSize: 13,
  },
  rowValue: {
    fontSize: 17,
  },
});
