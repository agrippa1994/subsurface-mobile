// AI-generated (Claude)
// The builder's fields, shared by the SwiftUI form and the portable one.
//
// Every option offered here comes out of StatsState::getUIState(), through `options`,
// so a combination the desktop would refuse cannot be asked for: there is no error for
// a form to show. A choice that takes others with it (an operation ending a binning)
// is decided there too.

import type { StatsChartOptions, StatsFeature } from '@/models';
import {
  binnerLabel,
  chartDescription,
  chartOptionKey,
  chartOptionLabel,
  featureLabel,
  groupVariables,
  operationLabel,
  secondBinnerLabel,
  sortLabel,
  variableLabel,
  type VariableGroup,
} from '@/models/stats-chart';

import { useChartScreen, type ChartScreen } from './use-chart-screen';
import { t } from '@/i18n';

export type BuilderChoice = { key: string; label: string };

export type BuilderField = {
  key: string;
  label: string;
  selected: string;
  choices: BuilderChoice[];
  onChoose: (key: string) => void;
};

export type VariableField = {
  key: 'var1' | 'var2';
  label: string;
  selected: string;
  /** What leaving the second variable empty means. */
  noneLabel: string | null;
  groups: VariableGroup[];
  onChoose: (name: string | null) => void;
};

/** The second variable's "none": the chart counts dives. */
export function numberOfDives(): string {
  return t('builder.numberOfDives');
}

export function useBuilder() {
  const screen = useChartScreen();
  return { ...builderFields(screen), description: chartDescription(screen.config, screen.chart ?? undefined, screen.options), error: screen.error };
}

function builderFields(screen: ChartScreen) {
  const { options, config, change } = screen;
  if (!options) {
    return { first: null, second: null, fields: [], measures: [], display: [], features: [], setFeature: () => {} };
  }

  const first: VariableField = {
    key: 'var1',
    // Unbinned, nothing is grouped: each dive sits somewhere along this variable.
    label: options.binners1[config.binner1] === 'none' ? t('builder.across') : t('builder.groupBy'),
    selected: config.var1,
    noneLabel: null,
    groups: groupVariables(options.var1),
    onChoose: (name) => {
      if (name) {
        change({ kind: 'var1', value: name });
      }
    },
  };
  const second: VariableField = {
    key: 'var2',
    label: t('builder.measure'),
    selected: config.var2 ?? numberOfDives(),
    noneLabel: numberOfDives(),
    groups: groupVariables(options.var2),
    onChoose: (name) => change({ kind: 'var2', value: name }),
  };

  const fields: BuilderField[] = [];
  if (options.binners1.length > 0) {
    fields.push({
      key: 'binner1',
      label: t('builder.steps'),
      selected: String(config.binner1),
      choices: options.binners1.map((name, index) => ({ key: String(index), label: binnerLabel(name) })),
      onChoose: (key) => change({ kind: 'binner1', value: Number(key) }),
    });
  }

  const measures: BuilderField[] = [];
  if (options.binners2.length > 0) {
    measures.push({
      key: 'binner2',
      label: t('builder.varSteps', { variable: variableLabel(config.var2 ?? '') }),
      selected: String(config.binner2),
      choices: options.binners2.map((name, index) => ({ key: String(index), label: secondBinnerLabel(name) })),
      onChoose: (key) => change({ kind: 'binner2', value: Number(key) }),
    });
  }
  if (options.operations.length > 0) {
    measures.push({
      key: 'operation',
      label: t('builder.calculate'),
      selected: config.operation,
      choices: options.operations.map((operation) => ({ key: operation.key, label: operationLabel(operation.key) })),
      onChoose: (key) => change({ kind: 'operation', value: key as never }),
    });
  }

  const display: BuilderField[] = [];
  display.push(chartField(options, config.chart, change));
  if (options.sorts.length > 0) {
    display.push({
      key: 'sort',
      label: t('builder.order'),
      selected: config.sort,
      choices: options.sorts.map((sort) => ({ key: sort.key, label: sortLabel(sort.key) })),
      onChoose: (key) => change({ kind: 'sort', value: key as never }),
    });
  }

  return {
    first,
    second,
    fields,
    measures,
    display,
    // Rows always say their value, so there is nothing for that switch to do.
    features: options.features
      .filter((feature) => !(feature.key === 'labels' && screen.chart?.horizontal))
      .map((feature) => ({
        key: feature.key,
        label: featureLabel(feature.key),
        on: feature.on,
      })),
    setFeature: (key: StatsFeature, on: boolean) => change({ kind: 'feature', value: { key, on } }),
  };
}

function chartField(
  options: StatsChartOptions,
  chart: { type: string; subtype: string },
  change: ChartScreen['change'],
): BuilderField {
  const recommended = options.charts.filter((c) => !c.warning);
  const others = options.charts.filter((c) => c.warning);
  return {
    key: 'chart',
    label: t('builder.chart'),
    selected: `${chart.type}/${chart.subtype}`,
    choices: [...recommended, ...others].map((c) => ({ key: chartOptionKey(c), label: chartOptionLabel(c) })),
    onChoose: (key) => {
      const [type, subtype] = key.split('/');
      change({ kind: 'chart', value: { type: type as never, subtype: subtype as never } });
    },
  };
}
