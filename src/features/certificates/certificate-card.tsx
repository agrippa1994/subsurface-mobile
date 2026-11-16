// AI-generated (Claude)
// A certification card drawn the size and shape of a real one (ISO/IEC 7810
// ID-1, 85.6 x 54 mm), in the colours of its level - see `cardLook`.
//
// The course name sits at the top; in the Cards tab, where only a card's bottom
// strip shows, `titleAtBottom` moves it there.
// Everything is laid out in units of the card's width, so the same component
// draws a stacked card, the card on its own screen and the full-screen one.

import { StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { t } from '@/i18n';
import { formatDiveDate } from '@/models/date-format';
import { cardLook, type SsiCertificate } from '@/models/ssi/certificates';

export const CARD_ASPECT = 85.6 / 54;

export function formatCardDate(date: string): string {
  return formatDiveDate(Date.parse(`${date}T00:00:00Z`) / 1000);
}

type Props = {
  card: SsiCertificate;
  holder: string | null;
  width: number;
  expired?: boolean;
  /**
   * Swap the title and the holder rows. SSI's card images carry their name at
   * the bottom, so the stack shows bottom strips; a drawn card in that stack
   * puts its name there too.
   */
  titleAtBottom?: boolean;
};

function useCardStyle(card: SsiCertificate, width: number) {
  const look = cardLook(card);
  const unit = width / 340;
  const [c0, c1, c2] = look.colors;
  return {
    look,
    unit,
    surface: {
      width,
      height: width / CARD_ASPECT,
      borderRadius: 16 * unit,
      padding: 18 * unit,
      experimental_backgroundImage: `linear-gradient(135deg, ${c0} 0%, ${c1} 55%, ${c2} 100%)`,
      boxShadow: `0px ${6 * unit}px ${18 * unit}px rgba(0, 0, 0, 0.28)`,
    },
  };
}

/** Light catching the card, and the rings of a ripple: decoration only. */
function Decoration({ unit, color }: { unit: number; color: string }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 16 * unit, overflow: 'hidden' }]}>
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            experimental_backgroundImage:
              'radial-gradient(circle at 15% 0%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 55%)',
          },
        ]}
      />
      {[150, 220, 290].map((size, index) => (
        <View
          key={size}
          style={{
            position: 'absolute',
            right: -size * unit * 0.42,
            bottom: -size * unit * 0.48,
            width: size * unit,
            height: size * unit,
            borderRadius: size * unit,
            borderWidth: 1.5 * unit,
            borderColor: color,
            opacity: 0.22 - index * 0.05,
          }}
        />
      ))}
    </View>
  );
}

export function CertificateCard({ card, holder, width, expired = false, titleAtBottom = false }: Props) {
  const { look, unit, surface } = useCardStyle(card, width);
  const label = { color: look.accent, fontSize: 9 * unit, letterSpacing: 1.2 * unit };
  const value = { color: look.foreground, fontSize: 13 * unit };

  return (
    <View
      style={[surface, titleAtBottom ? { flexDirection: 'column-reverse' } : null]}
      accessible
      accessibilityLabel={[card.course, holder, card.issued && formatCardDate(card.issued)]
        .filter(Boolean)
        .join(', ')}>
      <Decoration unit={unit} color={look.foreground} />

      <View style={styles.top}>
        <View style={styles.titleBlock}>
          <Text
            style={[styles.course, { color: look.foreground, fontSize: 20 * unit, lineHeight: 24 * unit }]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.7}>
            {card.course}
          </Text>
          {card.category ? (
            <Text style={[styles.label, label, { marginTop: 3 * unit }]} numberOfLines={1}>
              {card.category.toLocaleUpperCase()}
            </Text>
          ) : null}
        </View>
        {card.courseShort && card.courseShort !== card.course ? (
          <View
            style={[
              styles.chip,
              {
                borderColor: look.accent,
                borderRadius: 8 * unit,
                paddingHorizontal: 7 * unit,
                paddingVertical: 3 * unit,
              },
            ]}>
            <Text style={{ color: look.foreground, fontSize: 11 * unit, fontWeight: '700' }}>
              {card.courseShort}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.spacer} />

      {expired ? (
        <View style={[styles.expired, { borderRadius: 6 * unit, paddingHorizontal: 6 * unit, marginBottom: 6 * unit }]}>
          <Text style={{ color: '#FFFFFF', fontSize: 10 * unit, fontWeight: '700' }}>
            {t('certificates.expired').toLocaleUpperCase()}
          </Text>
        </View>
      ) : null}

      <View style={styles.bottom}>
        <View style={styles.flex}>
          {holder ? (
            <>
              <Text style={[styles.label, label]}>{t('certificates.pass.diver')}</Text>
              <Text style={[styles.value, value]} numberOfLines={1}>
                {holder}
              </Text>
            </>
          ) : null}
          {card.number ? (
            <Text
              style={[styles.number, { color: look.foreground, fontSize: 11 * unit, marginTop: 4 * unit }]}
              numberOfLines={1}>
              {card.number}
            </Text>
          ) : null}
        </View>
        <View style={styles.right}>
          {card.issued ? (
            <>
              <Text style={[styles.label, label, styles.alignRight]}>{t('certificates.pass.issued')}</Text>
              <Text style={[styles.value, value, styles.alignRight]}>{formatCardDate(card.issued)}</Text>
            </>
          ) : null}
          <Text style={[styles.brand, { color: look.foreground, fontSize: 18 * unit, marginTop: 2 * unit }]}>
            SSI
          </Text>
        </View>
      </View>
    </View>
  );
}

/** The reverse: what a real card prints on its back. */
export function CertificateCardBack({ card, width }: { card: SsiCertificate; width: number }) {
  const { look, unit, surface } = useCardStyle(card, width);
  const rows = [
    [t('certificates.number'), card.number],
    [t('certificates.instructor'), [card.instructor?.name, card.instructor?.number && `#${card.instructor.number}`].filter(Boolean).join(' ') || null],
    [t('certificates.center'), [card.center?.name, card.center?.city, card.center?.country].filter(Boolean).join(', ') || null],
    [t('certificates.dives'), card.dives === null ? null : String(card.dives)],
    [t('certificates.expires'), card.expires && formatCardDate(card.expires)],
  ].filter((row): row is [string, string] => typeof row[1] === 'string' && row[1] !== '');

  return (
    <View style={[surface, { paddingHorizontal: 0 }]}>
      <Decoration unit={unit} color={look.foreground} />
      <View style={{ height: 34 * unit, backgroundColor: 'rgba(0,0,0,0.55)', marginTop: 4 * unit }} />
      <View style={{ paddingHorizontal: 18 * unit, paddingTop: 12 * unit, gap: 5 * unit }}>
        {rows.slice(0, 4).map(([name, text]) => (
          <View key={name} style={styles.backRow}>
            <Text style={[styles.label, { color: look.accent, fontSize: 9 * unit, letterSpacing: 0.8 * unit, width: 118 * unit }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}>
              {name.toLocaleUpperCase()}
            </Text>
            <Text style={[styles.flex, { color: look.foreground, fontSize: 12 * unit }]} numberOfLines={1}>
              {text}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  titleBlock: {
    flex: 1,
  },
  course: {
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  label: {
    fontWeight: '700',
  },
  chip: {
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  spacer: {
    flex: 1,
  },
  expired: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(215, 0, 21, 0.9)',
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  value: {
    fontWeight: '600',
  },
  number: {
    fontFamily: Fonts?.mono,
    opacity: 0.85,
    letterSpacing: 1,
  },
  right: {
    alignItems: 'flex-end',
  },
  alignRight: {
    textAlign: 'right',
  },
  brand: {
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 1,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
