// AI-generated (Claude)
// The conditions SSI's divers logged at a site: the summary, then one chart per
// question. A chart with nothing behind it is left out rather than drawn empty.
import type { SiteDetail } from 'divessi-client';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { FormSection } from '@/components/form';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  formatSsiDepth,
  parseSsiSiteInsights,
  ssiAirTemperatureBars,
  ssiEnvironmentLabels,
  ssiLengthUnit,
  ssiMonthlyDiveBars,
  ssiRatingBars,
  ssiTemperatureUnit,
  ssiVisibilityBars,
  ssiWaterTemperatureBars,
} from '@/models/ssi/site-insights';
import { useSsiEnvironmentNames } from '@/queries/ssi';
import { useUnitSystem } from '@/queries/settings';

const MONTH_HINT = 'Tap a month for its average';

function Fact({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three }}>
      <Text style={{ color: theme.text }}>{label}</Text>
      <Text selectable style={{ color: theme.textSecondary, flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

export function SsiSiteInsights({ detail }: { detail: SiteDetail }) {
  const system = useUnitSystem();
  const environmentNames = useSsiEnvironmentNames();
  const insights = useMemo(() => parseSsiSiteInsights(detail), [detail]);
  const { months } = insights;
  const environment = environmentNames.data
    ? ssiEnvironmentLabels(insights.environmentIds, environmentNames.data)
    : [];

  const facts: [string, string][] = [];
  if (insights.avgDepthM !== null)
    facts.push(['Average maximum depth', formatSsiDepth(insights.avgDepthM, system)]);
  if (insights.avgMinutes !== null) facts.push(['Average dive time', `${insights.avgMinutes} min`]);
  if (insights.water) facts.push(['Water', insights.water]);
  if (environment.length) facts.push(['Environment', environment.join(', ')]);
  if (insights.rating !== null)
    facts.push([
      'SSI rating',
      `${insights.rating.toFixed(1)} of 5${
        insights.ratingCount ? ` (${insights.ratingCount.toLocaleString()})` : ''
      }`,
    ]);
  if (insights.totalDives !== null)
    facts.push(['Logged dives', insights.totalDives.toLocaleString()]);
  if (insights.divers !== null) facts.push(['Divers', insights.divers.toLocaleString()]);

  const temperatureUnit = ssiTemperatureUnit(system);
  const charts = [
    {
      title: 'Water temperature',
      bars: ssiWaterTemperatureBars(months, system),
      axisUnit: temperatureUnit,
      hint: MONTH_HINT,
    },
    {
      title: 'Air temperature',
      bars: ssiAirTemperatureBars(months, system),
      axisUnit: temperatureUnit,
      hint: MONTH_HINT,
    },
    {
      title: 'Visibility',
      bars: ssiVisibilityBars(months, system),
      axisUnit: ssiLengthUnit(system),
      hint: MONTH_HINT,
    },
    {
      title: 'Dives per month',
      bars: ssiMonthlyDiveBars(months),
      hint: 'Tap a month for its count',
      integer: true,
    },
    {
      title: 'Ratings',
      bars: ssiRatingBars(insights.ratingCounts),
      hint: 'Tap a bar for its count',
      integer: true,
    },
  ].filter((chart) => chart.bars.length > 0);

  return (
    <>
      {facts.length ? (
        <FormSection title="At this site">
          {facts.map(([label, value]) => (
            <Fact key={label} label={label} value={value} />
          ))}
        </FormSection>
      ) : null}
      {charts.map((chart) => (
        <BarChart
          key={chart.title}
          title={chart.title}
          bars={chart.bars}
          axisUnit={chart.axisUnit}
          hint={chart.hint}
          integer={chart.integer ?? false}
        />
      ))}
      {insights.diveTypes.length ? (
        <FormSection title="How it is dived">
          {insights.diveTypes.map((type) => (
            <Fact key={type.label} label={type.label} value={type.dives.toLocaleString()} />
          ))}
        </FormSection>
      ) : null}
    </>
  );
}
