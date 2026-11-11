// AI-generated (Claude)
// The conditions SSI's divers logged at a site: the summary, then one chart per
// question, then what was reported and seen there. Anything with nothing behind
// it, or whose lookup table is unavailable, is left out rather than drawn empty.
import type { SiteDetail } from 'divessi-client';
import { Image } from 'expo-image';
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
  ssiLabels,
  ssiLengthUnit,
  ssiMonthRange,
  ssiMonthlyDiveBars,
  ssiRatingBars,
  ssiShareRows,
  ssiTemperatureUnit,
  ssiVisibilityBars,
  ssiWaterTemperatureBars,
} from '@/models/ssi/site-insights';
import { useSsiSiteLookups } from '@/queries/ssi';
import { useUnits } from '@/queries/settings';
import { t } from '@/i18n';


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

function WildlifeRow({
  name,
  latin,
  thumb,
  months,
}: {
  name: string;
  latin: string | null;
  thumb: string | null;
  months: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
      {thumb ? (
        <Image
          source={{ uri: thumb }}
          style={{ width: 44, height: 44, borderRadius: Spacing.two }}
          contentFit="cover"
          accessible={false}
        />
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text }}>{name}</Text>
        {latin ? (
          <Text style={{ color: theme.textSecondary, fontSize: 13, fontStyle: 'italic' }}>
            {latin}
          </Text>
        ) : null}
        {months ? <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{months}</Text> : null}
      </View>
    </View>
  );
}

export function SsiSiteInsights({ detail }: { detail: SiteDetail }) {
  const units = useUnits();
  const { data: lookups } = useSsiSiteLookups();
  const insights = useMemo(() => parseSsiSiteInsights(detail), [detail]);
  const { months } = insights;
  const environment = lookups ? ssiLabels(insights.environmentIds, lookups.environment) : [];
  const levels = lookups ? ssiLabels(insights.levelIds, lookups.level) : [];
  const current = lookups ? ssiShareRows(insights.current, lookups.current) : [];
  const entry = lookups ? ssiShareRows(insights.entry, lookups.entry) : [];
  const wildlife = lookups
    ? insights.wildlife.flatMap(({ id, months }) => {
        const animal = lookups.wildlife.get(id);
        return animal ? [{ id, ...animal, months: ssiMonthRange(months) }] : [];
      })
    : [];

  const facts: [string, string][] = [];
  if (insights.avgDepthM !== null)
    facts.push([t('ssiSite.avgMaxDepth'), formatSsiDepth(insights.avgDepthM, units)]);
  if (insights.avgMinutes !== null) facts.push([t('ssiSite.avgDiveTime'), t('common.minutesShort', { minutes: insights.avgMinutes })]);
  if (insights.water) facts.push([t('ui.water'), insights.water]);
  if (environment.length) facts.push([t('ssiSite.environment'), environment.join(', ')]);
  if (levels.length) facts.push([t('ssiSite.level'), levels.join(', ')]);
  if (insights.rating !== null)
    facts.push([
      t('ssiSite.rating'),
      `${t('ssiSite.ratingValue', { rating: insights.rating.toFixed(1) })}${
        insights.ratingCount ? ` (${insights.ratingCount.toLocaleString()})` : ''
      }`,
    ]);
  if (insights.totalDives !== null)
    facts.push([t('ssiSite.loggedDives'), insights.totalDives.toLocaleString()]);
  if (insights.divers !== null) facts.push([t('ssiSite.divers'), insights.divers.toLocaleString()]);

  const temperatureUnit = ssiTemperatureUnit(units);
  const charts = [
    {
      title: t('stats.variable.waterTemperature'),
      bars: ssiWaterTemperatureBars(months, units),
      axisUnit: temperatureUnit,
      hint: t('ssiSite.monthHint'),
    },
    {
      title: t('stats.variable.airTemperature'),
      bars: ssiAirTemperatureBars(months, units),
      axisUnit: temperatureUnit,
      hint: t('ssiSite.monthHint'),
    },
    {
      title: t('ui.visibility'),
      bars: ssiVisibilityBars(months, units),
      axisUnit: ssiLengthUnit(units),
      hint: t('ssiSite.monthHint'),
    },
    {
      title: t('ssiSite.divesPerMonth'),
      bars: ssiMonthlyDiveBars(months),
      hint: t('ssiSite.monthCountHint'),
      integer: true,
    },
    {
      title: t('ssiSite.ratings'),
      bars: ssiRatingBars(insights.ratingCounts),
      hint: t('charts.tapBarCount'),
      integer: true,
    },
  ].filter((chart) => chart.bars.length > 0);

  return (
    <>
      {facts.length ? (
        <FormSection title={t('ui.atThisSite')}>
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
      {current.length ? (
        <FormSection title={t('ui.current')}>
          {current.map((row) => (
            <Fact key={row.label} label={row.label} value={`${row.percent}%`} />
          ))}
        </FormSection>
      ) : null}
      {entry.length ? (
        <FormSection title={t('ui.entry')}>
          {entry.map((row) => (
            <Fact key={row.label} label={row.label} value={`${row.percent}%`} />
          ))}
        </FormSection>
      ) : null}
      {wildlife.length ? (
        <FormSection title={t('ui.wildlife')}>
          {wildlife.map((animal) => (
            <WildlifeRow
              key={animal.id}
              name={animal.name}
              latin={animal.latin}
              thumb={animal.thumb}
              months={animal.months}
            />
          ))}
        </FormSection>
      ) : null}
      {insights.diveTypes.length ? (
        <FormSection title={t('ui.howItIsDived')}>
          {insights.diveTypes.map((type) => (
            <Fact key={type.label} label={type.label} value={type.dives.toLocaleString()} />
          ))}
        </FormSection>
      ) : null}
    </>
  );
}
