// AI-generated (Claude)
// Unit tests for the dive-editor model. Pure TypeScript: no native module.
import { describe, expect, it } from 'vitest';

import type { Dive, DiveSummary } from './index';
import { DiveMode } from './index';
import {
  applySuggestion,
  buildDivePatch,
  clampRating,
  diveDraftFrom,
  formatNameList,
  harvestNames,
  harvestTags,
  isEmptyPatch,
  normalizeTags,
  parseNameList,
  parseTagInput,
  suggestNames,
} from './dive-edit';

function summary(overrides: Partial<DiveSummary> = {}): DiveSummary {
  return {
    id: 1,
    number: 1,
    when: 1_700_000_000,
    durationSec: 2400,
    maxDepthMm: 20000,
    meanDepthMm: 12000,
    waterTempMkelvin: 291150,
    rating: 3,
    visibility: 4,
    siteUuid: 10,
    siteName: 'Blue Hole',
    tripLocation: '',
    buddy: '',
    diveguide: '',
    tags: [],
    divemode: DiveMode.OC,
    dcModel: 'Suunto D5',
    invalid: false,
    ...overrides,
  };
}

function dive(overrides: Partial<Dive> = {}): Dive {
  return {
    ...summary(),
    notes: 'Nice reef.',
    suit: '5mm',
    wavesize: 0,
    current: 0,
    surge: 0,
    chill: 0,
    sac: 0,
    otu: 0,
    cns: 0,
    maxcns: 0,
    salinity: 0,
    userSalinity: 0,
    minTempMkelvin: 0,
    maxTempMkelvin: 0,
    airTempMkelvin: 0,
    surfacePressureMbar: 0,
    totalWeightGrams: 0,
    notrip: false,
    cylinders: [],
    weightsystems: [],
    dcs: [],
    ...overrides,
  };
}

describe('name lists', () => {
  it('splits, trims and deduplicates case-insensitively', () => {
    expect(parseNameList('Alice, bob ,ALICE,, Carol')).toEqual(['Alice', 'bob', 'Carol']);
  });

  it('formats back in the core spelling', () => {
    expect(formatNameList(['Alice', 'Bob'])).toBe('Alice, Bob');
    expect(formatNameList([])).toBe('');
  });

  it('harvests every buddy and diveguide in the log, sorted', () => {
    const dives = [
      summary({ id: 1, buddy: 'Bob, alice', diveguide: 'Zoe' }),
      summary({ id: 2, buddy: 'ALICE', diveguide: '' }),
      summary({ id: 3, buddy: '', diveguide: 'Mike' }),
    ];
    expect(harvestNames(dives)).toEqual(['alice', 'Bob', 'Mike', 'Zoe']);
  });

  it('harvests tags', () => {
    const dives = [summary({ tags: ['boat', 'deep'] }), summary({ tags: ['Boat', ' night '] })];
    expect(harvestTags(dives)).toEqual(['boat', 'deep', 'night']);
  });
});

describe('suggestions', () => {
  const corpus = ['Anna Meier', 'Bob', 'Susan', 'Sam'];

  it('suggests nothing until the current token has characters', () => {
    expect(suggestNames('', corpus)).toEqual([]);
    expect(suggestNames('Anna Meier, ', corpus)).toEqual([]);
  });

  it('matches substrings, prefixes first', () => {
    expect(suggestNames('an', corpus)).toEqual(['Anna Meier', 'Susan']);
  });

  it('never repeats a name already in the field', () => {
    expect(suggestNames('Anna Meier, ann', corpus)).toEqual([]);
    expect(suggestNames('Bob, s', corpus)).toEqual(['Sam', 'Susan']);
  });

  it('replaces only the token being typed', () => {
    expect(applySuggestion('Bob, sus', 'Susan')).toBe('Bob, Susan, ');
    expect(applySuggestion('ann', 'Anna Meier')).toBe('Anna Meier, ');
  });
});

describe('patch building', () => {
  it('is empty when nothing changed', () => {
    const d = dive({ buddy: 'Alice, Bob', tags: ['boat'] });
    const patch = buildDivePatch(d, diveDraftFrom(d));
    expect(patch).toEqual({});
    expect(isEmptyPatch(patch)).toBe(true);
  });

  it('ignores re-spacing of a name list', () => {
    const d = dive({ buddy: 'Alice, Bob' });
    expect(buildDivePatch(d, { ...diveDraftFrom(d), buddy: 'Alice,Bob ' })).toEqual({});
  });

  it('carries only the fields that changed', () => {
    const d = dive({ buddy: 'Alice', rating: 3, siteUuid: 10 });
    const patch = buildDivePatch(d, {
      ...diveDraftFrom(d),
      buddy: 'Alice, Bob',
      siteUuid: 11,
    });
    expect(patch).toEqual({ buddy: 'Alice, Bob', siteUuid: 11 });
  });

  it('expresses detaching a dive from its site as siteUuid 0', () => {
    const d = dive({ siteUuid: 10 });
    expect(buildDivePatch(d, { ...diveDraftFrom(d), siteUuid: 0 })).toEqual({ siteUuid: 0 });
  });

  it('sends the whole tag list when one tag changes', () => {
    const d = dive({ tags: ['boat', 'deep'] });
    expect(buildDivePatch(d, { ...diveDraftFrom(d), tags: ['boat', 'deep', 'night'] })).toEqual({
      tags: ['boat', 'deep', 'night'],
    });
  });

  it('clamps rating and visibility to the core range', () => {
    const d = dive({ rating: 3 });
    expect(buildDivePatch(d, { ...diveDraftFrom(d), rating: 9 })).toEqual({ rating: 5 });
    expect(clampRating(-2)).toBe(0);
  });
});

describe('tags', () => {
  it('normalizes and deduplicates', () => {
    expect(normalizeTags([' boat ', 'Boat', '', 'deep'])).toEqual(['boat', 'deep']);
  });

  it('parses the comma-separated input field', () => {
    expect(parseTagInput('boat, deep,,night ')).toEqual(['boat', 'deep', 'night']);
  });
});
