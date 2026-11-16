// AI-generated (Claude)
// The pass.json of an Apple Wallet pass for one certification card.
//
// A "generic" pass: Wallet draws it as a card with a header, one large primary
// field and rows under it, which is the shape of a certification card. The
// labels are localised when the pass is made - a pass is a static file, and
// Wallet does not translate keys it was not given .lproj bundles for.
//
// Pure: signing and zipping are src/lib/wallet/pkpass.ts.

import { t } from '@/i18n';
import { cardLook, type SsiCertificate } from '@/models/ssi/certificates';

export type PassSigner = {
  /** The Pass Type ID from the signing certificate, "pass.com.example.cards". */
  passTypeIdentifier: string;
  /** The Apple Developer team the certificate belongs to. */
  teamIdentifier: string;
};

type PassField = {
  key: string;
  label?: string;
  value: string;
  dateStyle?: 'PKDateStyleShort' | 'PKDateStyleMedium' | 'PKDateStyleLong';
  ignoresTimeZone?: boolean;
  textAlignment?: 'PKTextAlignmentLeft' | 'PKTextAlignmentRight' | 'PKTextAlignmentNatural';
};

export type PassJson = {
  formatVersion: 1;
  passTypeIdentifier: string;
  teamIdentifier: string;
  serialNumber: string;
  organizationName: string;
  description: string;
  logoText: string;
  backgroundColor: string;
  foregroundColor: string;
  labelColor: string;
  sharingProhibited: boolean;
  expirationDate?: string;
  generic: {
    headerFields: PassField[];
    primaryFields: PassField[];
    secondaryFields: PassField[];
    auxiliaryFields: PassField[];
    backFields: PassField[];
  };
};

/** "#0B4F8A" to "rgb(11, 79, 138)", the only colour syntax pass.json accepts. */
export function passColor(hex: string): string {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!match) {
    throw new Error(`Not a colour: ${hex}`);
  }
  const [r, g, b] = match.slice(1).map((part) => parseInt(part, 16));
  return `rgb(${r}, ${g}, ${b})`;
}

/** A calendar date as the W3C date-time Wallet wants for a date field. */
function passDate(date: string): string {
  return `${date}T00:00:00Z`;
}

/**
 * Serial numbers identify the pass within its type: adding the same card again
 * replaces the pass rather than adding a second one. Wallet allows any string;
 * this keeps it to characters that survive every tool that handles a pass.
 */
export function passSerial(card: SsiCertificate): string {
  return `ssi-${card.id}`.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 64);
}

function place(card: SsiCertificate): string | null {
  const center = card.center;
  if (!center) {
    return null;
  }
  const where = [center.city, center.country].filter(Boolean).join(', ');
  return [center.name, where].filter(Boolean).join(' - ') || null;
}

export function buildPassJson(
  card: SsiCertificate,
  signer: PassSigner,
  holder: string | null,
): PassJson {
  // The pass uses the middle stop: Wallet draws one flat colour.
  const look = cardLook(card);

  const secondary: PassField[] = [];
  if (holder) {
    secondary.push({ key: 'holder', label: t('certificates.pass.diver'), value: holder });
  }
  if (card.issued) {
    secondary.push({
      key: 'issued',
      label: t('certificates.pass.issued'),
      value: passDate(card.issued),
      dateStyle: 'PKDateStyleMedium',
      ignoresTimeZone: true,
      textAlignment: 'PKTextAlignmentRight',
    });
  }

  const auxiliary: PassField[] = [];
  if (card.number) {
    auxiliary.push({ key: 'number', label: t('certificates.pass.number'), value: card.number });
  }
  if (card.expires) {
    auxiliary.push({
      key: 'expires',
      label: t('certificates.pass.expires'),
      value: passDate(card.expires),
      dateStyle: 'PKDateStyleMedium',
      ignoresTimeZone: true,
      textAlignment: 'PKTextAlignmentRight',
    });
  } else if (card.dives !== null) {
    auxiliary.push({
      key: 'dives',
      label: t('certificates.pass.dives'),
      value: String(card.dives),
      textAlignment: 'PKTextAlignmentRight',
    });
  }

  const back: PassField[] = [];
  if (card.category) {
    back.push({ key: 'category', label: t('certificates.pass.category'), value: card.category });
  }
  if (card.instructor?.name || card.instructor?.number) {
    back.push({
      key: 'instructor',
      label: t('certificates.pass.instructor'),
      value: [card.instructor.name, card.instructor.number && `#${card.instructor.number}`]
        .filter(Boolean)
        .join(' '),
    });
  }
  const where = place(card);
  if (where) {
    back.push({ key: 'center', label: t('certificates.pass.center'), value: where });
  }
  if (card.center?.number) {
    back.push({ key: 'centerNumber', label: t('certificates.pass.centerNumber'), value: card.center.number });
  }
  back.push({ key: 'source', label: t('certificates.pass.sourceLabel'), value: t('certificates.pass.source') });

  return {
    formatVersion: 1,
    passTypeIdentifier: signer.passTypeIdentifier,
    teamIdentifier: signer.teamIdentifier,
    serialNumber: passSerial(card),
    organizationName: 'SSI',
    description: t('certificates.pass.description', { course: card.course }),
    logoText: t('certificates.pass.logoText'),
    backgroundColor: passColor(look.colors[1]),
    foregroundColor: passColor(look.foreground),
    labelColor: passColor(look.accent),
    sharingProhibited: false,
    ...(card.expires ? { expirationDate: passDate(card.expires) } : {}),
    generic: {
      headerFields: card.courseShort && card.courseShort !== card.course
        ? [{ key: 'short', label: t('certificates.pass.level'), value: card.courseShort }]
        : [],
      primaryFields: [{ key: 'course', value: card.course }],
      secondaryFields: secondary,
      auxiliaryFields: auxiliary,
      backFields: back,
    },
  };
}
