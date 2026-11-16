// AI-generated (Claude)
// A certification card as SSI renders it: the card image SSI serves for it, so
// the card on screen matches the real brevet. The card drawn by
// certificate-card.tsx stands in only when SSI has no image for a side, or the
// image does not load.

import { Image } from 'expo-image';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { t } from '@/i18n';
import type { SsiCertificate } from '@/models/ssi/certificates';

import { CARD_ASPECT, CertificateCard, CertificateCardBack, formatCardDate } from './certificate-card';

type Props = {
  card: SsiCertificate;
  holder: string | null;
  width: number;
  expired?: boolean;
  side?: 'front' | 'back';
  /** For the drawn stand-in: put the course name where a stacked card shows it. */
  titleAtBottom?: boolean;
};

export function CardFace({ card, holder, width, expired = false, side = 'front', titleAtBottom = false }: Props) {
  const [failed, setFailed] = useState<string | null>(null);
  const uri = side === 'front' ? (card.images.front ?? card.images.thumb) : card.images.back;
  const unit = width / 340;

  if (uri === null || failed === uri) {
    return side === 'front' ? (
      <CertificateCard card={card} holder={holder} width={width} expired={expired} titleAtBottom={titleAtBottom} />
    ) : (
      <CertificateCardBack card={card} width={width} />
    );
  }

  const label = [
    card.course,
    side === 'back' ? t('certificates.back') : null,
    holder,
    card.issued && formatCardDate(card.issued),
    expired ? t('certificates.expired') : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={{
        width,
        height: width / CARD_ASPECT,
        borderRadius: 16 * unit,
        boxShadow: `0px ${6 * unit}px ${18 * unit}px rgba(0, 0, 0, 0.28)`,
      }}>
      <Image
        source={{ uri }}
        // The small rendering shows while the full one loads.
        placeholder={side === 'front' && card.images.thumb !== uri ? { uri: card.images.thumb ?? undefined } : undefined}
        contentFit="cover"
        transition={150}
        cachePolicy="disk"
        recyclingKey={`${card.id}-${side}`}
        onError={() => setFailed(uri)}
        style={{ width: '100%', height: '100%', borderRadius: 16 * unit, overflow: 'hidden' }}
      />
      {expired ? <ExpiredBadge unit={unit} /> : null}
    </View>
  );
}

function ExpiredBadge({ unit }: { unit: number }) {
  return (
    <View
      style={{
        position: 'absolute',
        right: 12 * unit,
        bottom: 12 * unit,
        borderRadius: 6 * unit,
        paddingHorizontal: 6 * unit,
        paddingVertical: 2 * unit,
        backgroundColor: 'rgba(215, 0, 21, 0.9)',
      }}>
      <Text style={{ color: '#FFFFFF', fontSize: 10 * unit, fontWeight: '700' }}>
        {t('certificates.expired').toLocaleUpperCase()}
      </Text>
    </View>
  );
}
