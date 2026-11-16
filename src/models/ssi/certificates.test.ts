// AI-generated (Claude)
// Unit tests for the certification-card model and the Wallet pass built from it.
import { describe, expect, it } from 'vitest';

import { buildPassJson, passColor, passSerial } from '@/models/wallet/pass';

import {
  cardTier,
  diverName,
  isExpired,
  parseSsiCertificates,
  parseSsiDate,
  ssiImageUrl,
} from './certificates';

describe('parseSsiDate', () => {
  it.each([
    ['2023-05-14', '2023-05-14'],
    ['2023-05-14 10:22:00', '2023-05-14'],
    ['14.05.2023', '2023-05-14'],
    ['4/5/2023', '2023-05-04'],
    [1684022400, '2023-05-14'],
    ['1684022400', '2023-05-14'],
  ])('reads %s', (raw, expected) => {
    expect(parseSsiDate(raw)).toBe(expected);
  });

  it.each(['0000-00-00', '', null, 0, '2023-02-30', 'soon', {}])('has no date for %s', (raw) => {
    expect(parseSsiDate(raw)).toBeNull();
  });
});

describe('ssiImageUrl', () => {
  it('keeps absolute URLs, upgraded to https', () => {
    expect(ssiImageUrl('http://x.divessi.com/a.jpg')).toBe('https://x.divessi.com/a.jpg');
    expect(ssiImageUrl('//cdn.example/a.png')).toBe('https://cdn.example/a.png');
  });

  it('resolves a bare image path against SSI', () => {
    expect(ssiImageUrl('/cards/1/front.jpg')).toBe('https://api.divessi.com/cards/1/front.jpg');
  });

  it('drops what is not an image reference', () => {
    expect(ssiImageUrl('')).toBeNull();
    expect(ssiImageUrl('no image')).toBeNull();
    expect(ssiImageUrl(null)).toBeNull();
  });
});

describe('parseSsiCertificates', () => {
  const response = {
    ccard_list: [
      {
        ccard_uid: '1001',
        ccard_course_name: 'Open Water Diver',
        ccard_course_short: 'OWD',
        ccard_cat_title: 'Scuba Diving',
        ccard_issue_date: '2019-07-02',
        ccard_instructor_name: 'Ann  Smith',
        ccard_instructor_number: '55',
        ccard_divecenter_name: 'Blue &amp; Deep',
        ccard_divecenter_city: 'Dahab',
        ccard_divecenter_country: 'EG',
        ccard_image_front: 'https://img.example/front.jpg',
      },
      {
        ccard_uid: '1002',
        ccard_course_name: 'Advanced Adventurer',
        ccard_issue_date: '2021-03-10',
        ccard_dives: '24',
      },
      // Listed twice under two categories.
      { ccard_uid: '1002', ccard_course_name: 'Advanced Adventurer', ccard_issue_date: '2021-03-10' },
      { ccard_uid: '1003', ccard_course_name: '', ccard_course_short: '' },
      { ccard_course_name: 'Science of Diving' },
    ],
  };

  it('keeps one entry per card, newest first, undated last', () => {
    const cards = parseSsiCertificates(response);
    expect(cards.map((card) => card.course)).toEqual([
      'Advanced Adventurer',
      'Open Water Diver',
      'Science of Diving',
    ]);
  });

  it('reads the fields a card shows', () => {
    const owd = parseSsiCertificates(response).find((card) => card.id === '1001');
    expect(owd).toMatchObject({
      courseShort: 'OWD',
      category: 'Scuba Diving',
      number: '1001',
      issued: '2019-07-02',
      instructor: { name: 'Ann Smith', number: '55' },
      center: { name: 'Blue & Deep', city: 'Dahab', country: 'EG', number: null },
      images: { front: 'https://img.example/front.jpg', back: null, thumb: null },
    });
  });

  it('gives a card without an SSI id a stable one', () => {
    const cards = parseSsiCertificates(response);
    expect(cards[2]).toMatchObject({ id: 'science-of-diving-undated', number: null });
    expect(parseSsiCertificates(response)[2].id).toBe(cards[2].id);
  });

  it('survives an empty or malformed response', () => {
    expect(parseSsiCertificates(null)).toEqual([]);
    expect(parseSsiCertificates({ ccard_list: null })).toEqual([]);
  });
});

describe('cardTier', () => {
  it.each([
    ['Open Water Diver', 'entry'],
    ['Advanced Adventurer', 'advanced'],
    ['Stress & Rescue', 'rescue'],
    ['Open Water Instructor', 'professional'],
    ['Enriched Air Nitrox', 'technical'],
    ['Freediver Level 1', 'freediving'],
    ['React Right', 'safety'],
    ['Underwater Photography', 'specialty'],
  ])('%s is %s', (course, tier) => {
    expect(cardTier({ course, category: null })).toBe(tier);
  });
});

describe('diverName and isExpired', () => {
  it('joins the parts SSI has', () => {
    expect(diverName({ user_forename: 'Jane', user_middlename: '', user_lastname: 'Doe' })).toBe('Jane Doe');
    expect(diverName({})).toBeNull();
  });

  it('expires the day after the expiry date', () => {
    const card = parseSsiCertificates({
      ccard_list: [{ ccard_course_name: 'React Right', ccard_expire_date: '2024-06-01' }],
    })[0];
    expect(isExpired(card, '2024-06-01')).toBe(false);
    expect(isExpired(card, '2024-06-02')).toBe(true);
  });
});

describe('buildPassJson', () => {
  const [card] = parseSsiCertificates({
    ccard_list: [
      {
        ccard_uid: 'AB 12/3',
        ccard_course_name: 'Open Water Diver',
        ccard_course_short: 'OWD',
        ccard_issue_date: '2019-07-02',
        ccard_instructor_name: 'Ann Smith',
        ccard_divecenter_name: 'Blue',
        ccard_divecenter_city: 'Dahab',
      },
    ],
  });
  const signer = { passTypeIdentifier: 'pass.com.example.cards', teamIdentifier: 'TEAM123456' };

  it('fills a generic pass from the card', () => {
    const pass = buildPassJson(card, signer, 'Jane Doe');
    expect(pass).toMatchObject({
      formatVersion: 1,
      passTypeIdentifier: 'pass.com.example.cards',
      teamIdentifier: 'TEAM123456',
      serialNumber: 'ssi-AB-12-3',
      backgroundColor: passColor('#1279C9'),
    });
    expect(pass.generic.primaryFields).toEqual([{ key: 'course', value: 'Open Water Diver' }]);
    expect(pass.generic.secondaryFields.map((field) => field.value)).toEqual([
      'Jane Doe',
      '2019-07-02T00:00:00Z',
    ]);
    expect(pass.generic.backFields.find((field) => field.key === 'center')?.value).toBe('Blue - Dahab');
    expect(pass.expirationDate).toBeUndefined();
  });

  it('leaves the holder out when SSI has no name', () => {
    const pass = buildPassJson(card, signer, null);
    expect(pass.generic.secondaryFields.map((field) => field.key)).toEqual(['issued']);
  });

  it('keeps serial numbers to safe characters', () => {
    expect(passSerial(card)).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it('converts colours to the rgb() pass.json expects', () => {
    expect(passColor('#0B4F8A')).toBe('rgb(11, 79, 138)');
    expect(() => passColor('blue')).toThrow();
  });
});
