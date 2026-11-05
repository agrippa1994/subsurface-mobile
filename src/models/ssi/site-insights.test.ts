// AI-generated (Claude)
// Unit tests for reading SSI's site statistics. The fixture is a real response's
// shape: numbers as strings inside JSON text, and months missing.
import type { SiteDetail } from 'divessi-client';
import { describe, expect, it } from 'vitest';

import {
  formatSsiDepth,
  parseSsiSiteInsights,
  ssiAirTemperatureBars,
  ssiLabels,
  ssiMonthRange,
  ssiMonthlyDiveBars,
  ssiRatingBars,
  ssiShareRows,
  ssiVisibilityBars,
  ssiWaterTemperatureBars,
} from './site-insights';

const gosslerBucht = {
  dive_site_id: 742748,
  bow: 'fresh',
  dives_logged_by_divers: 8,
  total_logged_dives: 15,
  avg_max_depth_logged: 16,
  avg_divetime_logged: 47,
  avg_log_rating: 3.25,
  avg_log_rating_dives: 4,
  avg_log_rating_details: '{"2": "1", "3": "2", "5": "1"}',
  avg_logged_dives_per_month: '{"8":{"dives":"7"},"7":{"dives":"3"}}',
  diveType: '{"xr": "0", "ccr": "2", "frd": "0", "scr": "0", "scuba": "15"}',
  temp_month_avg:
    '{"7": {"dives": "3", "avgVis": "6", "avgAirTemp": "16", "avgWaterTemp": "12"},' +
    ' "8": {"dives": "7", "avgVis": "10", "avgAirTemp": "15", "avgWaterTemp": "13.5"}}',
  environment: [185],
  current: '{"6": "6", "7": "1"}',
  entryTypes: '{"21": "5", "22": "2"}',
  odin_dive_sites_content: '{"bow": ["18"], "level": ["1", "2"]}',
  sightings: '["22", "24"]',
  wildlife_selected: { '22': { month_5: 1, month_6: 1 }, '24': { month_1: 1 } },
} as unknown as SiteDetail;

describe('parseSsiSiteInsights', () => {
  const insights = parseSsiSiteInsights(gosslerBucht);

  it('reads the summary', () => {
    expect(insights).toMatchObject({
      avgDepthM: 16,
      avgMinutes: 47,
      rating: 3.25,
      ratingCount: 4,
      totalDives: 15,
      divers: 8,
      water: 'Fresh water',
      environmentIds: [185],
    });
  });

  it('always gives twelve months, reading numbers out of JSON text', () => {
    expect(insights.months).toHaveLength(12);
    expect(insights.months[7]).toEqual({
      month: 8,
      dives: 7,
      waterC: 13.5,
      airC: 15,
      visibilityM: 10,
    });
    expect(insights.months[0]).toEqual({
      month: 1,
      dives: 0,
      waterC: null,
      airC: null,
      visibilityM: null,
    });
  });

  it('fills in star counts and sorts dive types, dropping unused ones', () => {
    expect(insights.ratingCounts).toEqual([0, 1, 2, 0, 1]);
    expect(insights.diveTypes).toEqual([
      { label: 'Scuba', dives: 15 },
      { label: 'Closed circuit rebreather', dives: 2 },
    ]);
  });

  it('survives a site with nothing logged and malformed fields', () => {
    const empty = parseSsiSiteInsights({
      dive_site_id: 1,
      avg_max_depth_logged: 0,
      temp_month_avg: 'not json',
      avg_log_rating_details: '[1,2]',
      bow: 'lava',
    } as unknown as SiteDetail);
    expect(empty).toMatchObject({ avgDepthM: null, water: null, diveTypes: [], environmentIds: [] });
    expect(ssiWaterTemperatureBars(empty.months, 'metric')).toEqual([]);
    expect(ssiMonthlyDiveBars(empty.months)).toEqual([]);
    expect(ssiRatingBars(empty.ratingCounts)).toEqual([]);
  });
});

describe('monthly bars', () => {
  const { months } = parseSsiSiteInsights(gosslerBucht);

  it('gives twelve bars, with the dive count behind each average', () => {
    const bars = ssiWaterTemperatureBars(months, 'metric');
    expect(bars).toHaveLength(12);
    expect(bars[7]).toMatchObject({
      label: 'A',
      value: 13.5,
      caption: 'August: 13.5 C, from 7 dives',
    });
    expect(bars[0]).toMatchObject({ value: 0, caption: 'January: no data' });
  });

  it('converts to imperial', () => {
    expect(ssiWaterTemperatureBars(months, 'imperial')[6].value).toBe(53.6);
    expect(ssiAirTemperatureBars(months, 'imperial')[6].caption).toContain('60.8 F');
    expect(ssiVisibilityBars(months, 'imperial')[7]).toMatchObject({ value: 33 });
    expect(formatSsiDepth(16, 'imperial')).toBe('52 ft');
    expect(formatSsiDepth(16, 'metric')).toBe('16 m');
  });

  it('keeps a below-freezing month out of the bars but not out of the caption', () => {
    const cold = months.map((month) => (month.month === 1 ? { ...month, airC: -3 } : month));
    expect(ssiAirTemperatureBars(cold, 'metric')[0]).toMatchObject({
      value: 0,
      caption: 'January: -3 C, from 0 dives',
    });
  });

  it('counts dives and ratings', () => {
    expect(ssiMonthlyDiveBars(months)[7].caption).toBe('August: 7 dives');
    expect(ssiRatingBars([0, 1, 2, 0, 1])[1].caption).toBe('2 stars: 1 rating');
  });
});

describe('lookup codes', () => {
  const insights = parseSsiSiteInsights(gosslerBucht);

  it('reads the codes from JSON text', () => {
    expect(insights.current).toEqual([
      { id: 6, count: 6 },
      { id: 7, count: 1 },
    ]);
    expect(insights.entry).toEqual([
      { id: 21, count: 5 },
      { id: 22, count: 2 },
    ]);
    expect(insights.levelIds).toEqual([1, 2]);
    expect(insights.wildlife).toEqual([
      { id: 22, months: [5, 6] },
      { id: 24, months: [1] },
    ]);
  });

  it('falls back to bare wildlife ids when the months are missing', () => {
    const bare = parseSsiSiteInsights({ sightings: '["22", "x", "24"]' } as unknown as SiteDetail);
    expect(bare.wildlife).toEqual([
      { id: 22, months: [] },
      { id: 24, months: [] },
    ]);
  });

  it('labels what it can, dropping repeats and unknown codes', () => {
    const names = new Map([
      [1, 'Lake'],
      [2, 'Lake'],
      [3, 'Wreck'],
    ]);
    expect(ssiLabels([1, 2, 99, 3], names)).toEqual(['Lake', 'Wreck']);
  });

  it('gives shares of all reports, largest first, without inflating them', () => {
    const rows = ssiShareRows(
      [
        { id: 7, count: 1 },
        { id: 6, count: 2 },
        { id: 99, count: 1 },
      ],
      new Map([
        [6, 'None'],
        [7, 'Light'],
      ])
    );
    expect(rows).toEqual([
      { label: 'None', count: 2, percent: 50 },
      { label: 'Light', count: 1, percent: 25 },
    ]);
  });
});

describe('ssiMonthRange', () => {
  it('names the whole year, one month, and a run', () => {
    expect(ssiMonthRange([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe('All year');
    expect(ssiMonthRange([6])).toBe('June');
    expect(ssiMonthRange([5, 6, 7, 8, 9])).toBe('May to September');
  });

  it('follows a run across the new year', () => {
    expect(ssiMonthRange([1, 12])).toBe('December to January');
  });

  it('lists months that are not one run, and accepts none', () => {
    expect(ssiMonthRange([1, 3, 7])).toBe('Jan, Mar, Jul');
    expect(ssiMonthRange([])).toBe('');
  });
});
