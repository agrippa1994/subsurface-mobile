// AI-generated (Claude)
// Unit tests for reading SSI's site statistics. The fixture is a real response's
// shape: numbers as strings inside JSON text, and months missing.
import type { SiteDetail } from 'divessi-client';
import { describe, expect, it } from 'vitest';

import {
  formatSsiDepth,
  parseSsiEnvironmentNames,
  parseSsiSiteInsights,
  ssiAirTemperatureBars,
  ssiEnvironmentLabels,
  ssiMonthlyDiveBars,
  ssiRatingBars,
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

describe('environment names', () => {
  const names = parseSsiEnvironmentNames({
    bow_env: {
      fresh: [
        { odin_dive_sites_vars_id: '185', odin_dive_sites_vars_option: 'lake' },
        { odin_dive_sites_vars_id: '174', odin_dive_sites_vars_option: 'wall_drop_off' },
      ],
      salt: [{ odin_dive_sites_vars_id: '164', odin_dive_sites_vars_option: 'wall_drop_off' }],
    },
  });

  it('reads the table and writes the names out', () => {
    expect(names.get(185)).toBe('Lake');
    expect(names.get(174)).toBe('Wall or drop-off');
  });

  it('drops unknown ids and repeats of a name', () => {
    expect(ssiEnvironmentLabels([174, 164, 999, 185], names)).toEqual(['Wall or drop-off', 'Lake']);
  });

  it('accepts a response with no table', () => {
    expect(parseSsiEnvironmentNames(null).size).toBe(0);
  });
});
