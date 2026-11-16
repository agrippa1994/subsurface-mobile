// AI-generated (Claude)
// The diver's SSI certification cards, reduced from the `get_ccards` payload to
// what the Cards tab and an Apple Wallet pass show.
//
// SSI documents almost nothing about this payload: every field is optional, the
// dates have no stated encoding and the images are "references". The parser is
// therefore tolerant - a field it cannot read is dropped rather than failing
// the whole list - and the rules live here, in plain TypeScript, so the Node
// test suite covers them.

import type { Certificate, CertificatesResponse, User } from 'divessi-client';

/** One certification card. Only `id` and `course` are guaranteed. */
export type SsiCertificate = {
  /** Stable per card: SSI's card id, or a value derived from the course. */
  id: string;
  /** The full course name, "Advanced Open Water Diver". */
  course: string;
  /** SSI's short name ("AOWD"), when it gives one. */
  courseShort: string | null;
  /** The category the card belongs to, "Scuba Diving", "Freediving". */
  category: string | null;
  /** The card number printed on the card, if SSI sends one apart from the id. */
  number: string | null;
  /** Calendar date, YYYY-MM-DD. */
  issued: string | null;
  /** Calendar date, YYYY-MM-DD. Most recreational cards never expire. */
  expires: string | null;
  dives: number | null;
  instructor: { name: string | null; number: string | null } | null;
  center: {
    name: string | null;
    number: string | null;
    city: string | null;
    country: string | null;
  } | null;
  /** Absolute URLs of SSI's rendered card, when it has one. */
  images: { front: string | null; back: string | null; thumb: string | null };
};

/** Where SSI serves relative image paths from. */
export const SSI_MEDIA_BASE = 'https://api.divessi.com';

function text(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value !== 'string') {
    return null;
  }
  const cleaned = value
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned === '' || cleaned === '0' || cleaned.toLowerCase() === 'null' ? null : cleaned;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function validDate(year: number, month: number, day: number): string | null {
  if (year < 1950 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * SSI dates arrive as "2023-05-14", "2023-05-14 00:00:00", "14.05.2023", a
 * Unix timestamp in seconds (number or digit string) or "0000-00-00" for none.
 * The card is a calendar fact, so the result is a date without a time zone.
 */
export function parseSsiDate(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const date = new Date(value > 1e11 ? value : value * 1000);
    return validDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  if (typeof value !== 'string') {
    return null;
  }
  const raw = value.trim();
  if (/^\d{9,13}$/.test(raw)) {
    return parseSsiDate(Number(raw));
  }
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw);
  if (iso) {
    return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }
  const european = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(raw);
  if (european) {
    return validDate(Number(european[3]), Number(european[2]), Number(european[1]));
  }
  return null;
}

/** Turns an image reference into a URL an <Image> can load, or null. */
export function ssiImageUrl(value: unknown): string | null {
  const ref = typeof value === 'string' ? value.trim() : '';
  if (ref === '') {
    return null;
  }
  if (/^https?:\/\//i.test(ref)) {
    return ref.replace(/^http:\/\//i, 'https://');
  }
  if (ref.startsWith('//')) {
    return `https:${ref}`;
  }
  if (ref.startsWith('data:image/')) {
    return ref;
  }
  // A bare path ("/img/cards/123.jpg", "img/cards/123.jpg"); anything with
  // spaces or no file extension is not one.
  if (/^\/?[\w.-]+(\/[\w.-]+)*\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(ref)) {
    return `${SSI_MEDIA_BASE}/${ref.replace(/^\//, '')}`;
  }
  return null;
}

function numberOf(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** One record, or null when it names no course at all. */
export function parseSsiCertificate(raw: Certificate): SsiCertificate | null {
  const course = text(raw.ccard_course_name) ?? text(raw.ccard_course_short);
  if (course === null) {
    return null;
  }
  const uid = text(raw.ccard_uid);
  const issued = parseSsiDate(raw.ccard_issue_date);

  const instructorName = text(raw.ccard_instructor_name);
  const instructorNumber = text(raw.ccard_instructor_number);
  const centerName = text(raw.ccard_divecenter_name);
  const centerNumber = text(raw.ccard_divecenter_number);
  const centerCity = text(raw.ccard_divecenter_city);
  const centerCountry = text(raw.ccard_divecenter_country);

  return {
    id: uid ?? `${slug(course)}-${issued ?? 'undated'}`,
    course,
    courseShort: text(raw.ccard_course_short),
    category: text(raw.ccard_cat_title),
    number: uid,
    issued,
    expires: parseSsiDate(raw.ccard_expire_date),
    dives: numberOf(raw.ccard_dives),
    instructor:
      instructorName === null && instructorNumber === null
        ? null
        : { name: instructorName, number: instructorNumber },
    center:
      centerName === null && centerNumber === null && centerCity === null && centerCountry === null
        ? null
        : { name: centerName, number: centerNumber, city: centerCity, country: centerCountry },
    images: {
      front: ssiImageUrl(raw.ccard_image_front),
      back: ssiImageUrl(raw.ccard_image_back),
      thumb: ssiImageUrl(raw.ccard_image_front_thumb),
    },
  };
}

/**
 * Every card, newest first. Cards without a date go last, in SSI's order. The
 * same card listed twice (SSI repeats a card under two categories) is kept once.
 */
export function parseSsiCertificates(response: CertificatesResponse | null | undefined): SsiCertificate[] {
  const list = Array.isArray(response?.ccard_list) ? response.ccard_list : [];
  const seen = new Set<string>();
  const cards: SsiCertificate[] = [];
  for (const raw of list) {
    if (raw === null || typeof raw !== 'object') {
      continue;
    }
    const card = parseSsiCertificate(raw);
    if (card === null || seen.has(card.id)) {
      continue;
    }
    seen.add(card.id);
    cards.push(card);
  }
  return cards
    .map((card, index) => ({ card, index }))
    .sort((a, b) => {
      if (a.card.issued !== b.card.issued) {
        if (a.card.issued === null) return 1;
        if (b.card.issued === null) return -1;
        return a.card.issued < b.card.issued ? 1 : -1;
      }
      return a.index - b.index;
    })
    .map(({ card }) => card);
}

/** The holder's name as it goes on a card, or null when SSI has none. */
export function diverName(user: User | null | undefined): string | null {
  if (!user) {
    return null;
  }
  const parts = [user.user_forename, user.user_middlename, user.user_lastname]
    .map(text)
    .filter((part): part is string => part !== null);
  return parts.length === 0 ? null : parts.join(' ');
}

/** Whether the card has run out on `today` (YYYY-MM-DD). */
export function isExpired(card: SsiCertificate, today: string): boolean {
  return card.expires !== null && card.expires < today;
}

// --- Look ----------------------------------------------------------------

export type CardTier =
  | 'entry'
  | 'advanced'
  | 'rescue'
  | 'professional'
  | 'technical'
  | 'freediving'
  | 'safety'
  | 'specialty';

export type CardLook = {
  tier: CardTier;
  /** Gradient stops, top-left to bottom-right. */
  colors: readonly [string, string, string];
  /** The text colour that reads on the gradient. */
  foreground: string;
  /** The small accent: a rule, the chip. */
  accent: string;
};

const LOOKS: Record<CardTier, Omit<CardLook, 'tier'>> = {
  entry: { colors: ['#0B4F8A', '#1279C9', '#35B4E8'], foreground: '#FFFFFF', accent: '#9FE4FF' },
  advanced: { colors: ['#1B1F6B', '#3A3FB8', '#6C5CE7'], foreground: '#FFFFFF', accent: '#C7C2FF' },
  rescue: { colors: ['#7A0E12', '#C2272D', '#F0643A'], foreground: '#FFFFFF', accent: '#FFD2B8' },
  professional: { colors: ['#0D0D0F', '#24262B', '#3B3E45'], foreground: '#F5F1E6', accent: '#D8B76A' },
  technical: { colors: ['#06363A', '#0B6B63', '#21A68D'], foreground: '#FFFFFF', accent: '#A8F0D8' },
  freediving: { colors: ['#00525E', '#0091A6', '#3FD0D4'], foreground: '#FFFFFF', accent: '#C4FAFA' },
  safety: { colors: ['#8A3B00', '#D9670B', '#F7A21B'], foreground: '#FFFFFF', accent: '#FFE7B0' },
  specialty: { colors: ['#3D1559', '#7B2D8E', '#C04E9B'], foreground: '#FFFFFF', accent: '#F6C6EA' },
};

// Checked in order: "Advanced Adventurer" is advanced, "Rescue Diver" is
// rescue, and anything with "instructor" in it is professional before the
// course words inside it ("Open Water Instructor") are considered.
const TIER_RULES: readonly (readonly [CardTier, RegExp])[] = [
  ['professional', /instructor|divemaster|dive master|dive guide|assistant|trainer|leader|\bpro\b|professional/i],
  ['freediving', /free ?div|apnea|apnoe|mermaid/i],
  ['technical', /nitrox|enriched|extended range|\bxr\b|technical|trimix|decompression|sidemount|gas blend|cave|wreck penetration/i],
  ['rescue', /rescue|stress/i],
  ['safety', /react right|first aid|cpr|oxygen|aed|emergency/i],
  ['advanced', /advanced|master diver|adventurer|deep/i],
  ['entry', /open water|scuba diver|basic|try scuba|referral|junior|scuba skills|snorkel/i],
];

export function cardTier(card: Pick<SsiCertificate, 'course' | 'category'>): CardTier {
  const subject = `${card.course} ${card.category ?? ''}`;
  for (const [tier, rule] of TIER_RULES) {
    if (rule.test(subject)) {
      return tier;
    }
  }
  return 'specialty';
}

export function cardLook(card: Pick<SsiCertificate, 'course' | 'category'>): CardLook {
  const tier = cardTier(card);
  return { tier, ...LOOKS[tier] };
}
