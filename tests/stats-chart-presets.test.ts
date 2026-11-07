// AI-generated (Claude)
// The presets and the builder's wording against what the bindings really offer:
// a preset is a configuration, and StatsState would quietly correct a wrong one.

import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { StatsChartConfig } from '../src/models';
import {
  chartOptionLabel,
  chartRows,
  chartSummary,
  foldSeries,
  groupVariables,
  phoneFriendlyChart,
  selectionReadout,
  STATS_PRESETS,
} from '../src/models/stats-chart';
import { buildScene, hitTest } from '../src/models/stats-chart-layout';
import { fixture } from './harness/fixtures';
import { SsrfHost } from './harness/ssrf-host';

let host: SsrfHost;

beforeAll(async () => {
  host = new SsrfHost();
  await host.loadFromXML(join(fixture('abitofeverything.ssrf'), '../../../subsurface.xml'));
});

afterAll(async () => {
  await host.close();
});

describe('every preset', () => {
  for (const preset of STATS_PRESETS) {
    it(`"${preset.title}" stays what it says, and has something to show`, async () => {
      const result = await host.statsChart({ config: preset.config });
      for (const key of ['var1', 'var2', 'operation', 'sort', 'chart'] as const) {
        if (preset.config[key] !== undefined) {
          expect(result.config[key]).toEqual(preset.config[key]);
        }
      }
      expect(result.chart?.family).not.toBe('empty');
      expect(result.config).toEqual((await host.statsChart({ config: result.config })).config);
    });
  }

  it('picks the binners its detail names, in either unit', async () => {
    for (const imperial of [false, true]) {
      const byKey = async (key: string) => {
        const preset = STATS_PRESETS.find((p) => p.key === key)!;
        const { options, config } = await host.statsChart({ config: preset.config, imperial });
        return options.binners1[config.binner1];
      };
      expect(await byKey('sac-depth')).toBe('none');
      expect(await byKey('year-mode')).toBe('Yearly');
      expect(await byKey('depth-histogram')).toBe(imperial ? 'in 15 ft steps' : 'in 5 m steps');
    }
  });
});

describe('the builder', () => {
  it('has a group for every variable of the desktop', async () => {
    const { options } = await host.statsChart();
    const groups = groupVariables(options.var1);
    expect(groups.map((g) => g.title)).not.toContain('Other');
    expect(groups.flatMap((g) => g.variables)).toHaveLength(options.var1.length);
  });

  it('turns a list of sites into rows on choosing it, and keeps them when read back', async () => {
    const first = await host.statsChart({ config: { var1: 'Date' } });
    const change = { kind: 'var1', value: 'Dive site' } as const;
    const changed = await host.statsChart({ config: first.config, change });
    const friendly = phoneFriendlyChart(change, changed.config, changed.options);
    expect(friendly).toEqual({ type: changed.config.chart.type, subtype: 'Horizontal' });
    const settled = await host.statsChart({
      config: changed.config,
      change: { kind: 'chart', value: friendly! },
    });
    expect(settled.chart?.horizontal).toBe(true);
    expect(settled.config.chart.subtype).toBe('Horizontal');
  });

  it('never offers two charts under one name', async () => {
    const { options } = await host.statsChart();
    for (const var1 of options.var1.map((v) => v.name)) {
      for (const var2 of [null, 'SAC', 'Dive mode', 'Date']) {
        const result = await host.statsChart({ config: { var1, var2 } });
        const labels = result.options.charts.map(chartOptionLabel);
        expect(new Set(labels).size).toBe(labels.length);
      }
    }
  });
});

describe('every kind of chart, end to end on the large log', () => {
  const configs = async (): Promise<StatsChartConfig[]> => {
    const out: StatsChartConfig[] = [];
    for (const preset of STATS_PRESETS) {
      out.push((await host.statsChart({ config: preset.config })).config);
    }
    return out;
  };

  it('draws, hit-tests, reads and summarises', async () => {
    for (const config of await configs()) {
      const result = await host.statsChart({ config });
      const chart = foldSeries(result.chart!);
      const summary = chartSummary(result.config, chart, result.dives);
      expect(summary.length).toBeGreaterThan(10);
      expect(summary).not.toMatch(/NaN|undefined|null/);
      const rows = chartRows(chart);
      for (const row of rows) {
        expect(row.accessibilityLabel).not.toMatch(/NaN|undefined/);
        expect(row.label).not.toBe('');
      }
      const scene = buildScene(chart, 390, 300);
      for (const x of [scene.plot.left + 5, 195, scene.plot.left + scene.plot.width - 5]) {
        const hit = hitTest(scene, x, scene.plot.top + scene.plot.height - 2);
        if (hit) {
          const readout = selectionReadout(chart, hit);
          expect(readout).not.toBeNull();
          expect(JSON.stringify(readout)).not.toMatch(/NaN|undefined/);
        }
      }
    }
  });

  it('builds a chart of any bin count well within a frame', () => {
    const items = Array.from({ length: 600 }, (_, index) => ({
      from: index - 0.5,
      to: index + 0.5,
      label: String(index),
      full: String(index),
      count: index % 7,
      value: index % 7,
      dives: [],
    }));
    const started = performance.now();
    buildScene(
      {
        family: 'bar',
        title: '',
        horizontal: false,
        stacked: false,
        histogram: false,
        catAxis: { kind: 'category', title: '' },
        valAxis: { kind: 'count', title: '', min: 0, max: 6, decimals: 0, unit: '' },
        items,
      },
      390,
      300,
    );
    expect(performance.now() - started).toBeLessThan(16);
  });

  it('the largest chart of the real log stays cheap to carry', async () => {
    const result = await host.statsChart({ config: { var1: 'Dive #', binner1: 0, var2: 'Max. Depth' } });
    expect(JSON.stringify(result).length).toBeLessThan(200_000);
  });
});
