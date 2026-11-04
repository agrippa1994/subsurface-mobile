// AI-generated (Claude)
import { Host, Picker } from '@expo/ui';
import { useState } from 'react';
import { Image } from 'expo-image';
import { ScrollView, Text, View } from 'react-native';
import { FormSection } from '@/components/form';
import { Spacing } from '@/constants/theme';
import { StatusView } from '@/components/status-view';
import { useTheme } from '@/hooks/use-theme';
import { ssiPlainText } from '@/models/ssi/site-browse';
import { describeSsiSite, type SsiSite } from '@/models/ssi/sites';
import { useSsiSiteDetail } from '@/queries/ssi';

export function SsiSiteDetails({ site }: { site: SsiSite }) {
  const theme = useTheme();
  const query = useSsiSiteDetail(site.id);
  const [language, setLanguage] = useState('eng');
  if (!query.data && query.isError)
    return (
      <StatusView
        kind="error"
        title="Could not load SSI site details"
        description={query.error.message}
        actionLabel="Try again"
        onAction={() => void query.refetch()}
      />
    );
  if (query.data === undefined)
    return (
      <StatusView
        kind="loading"
        title={
          query.fetchStatus === 'paused'
            ? 'Connect to load SSI site details'
            : 'Loading SSI site details'
        }
      />
    );
  const detail = query.data;
  const descriptions = Array.isArray(detail?.descr) ? detail.descr : [];
  const description = descriptions.find((d) => d.descr_iso3 === language) ?? descriptions[0];
  const paragraphs = description
    ? [description.descr_1, description.descr_2, description.descr_3]
        .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
        .map(ssiPlainText)
    : [];
  const images = (Array.isArray(detail?.images) ? detail.images : []).filter(
    (i) => typeof (i.big ?? i.thumb) === 'string' && /^https?:\/\//.test((i.big ?? i.thumb)!),
  );
  const facts = [
    ['Logged dives', detail?.total_logged_dives],
    ['Divers', detail?.dives_logged_by_divers],
    ['SSI rating', detail?.avg_log_rating],
  ] as const;
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: Spacing.three,
        paddingBottom: Spacing.six,
        gap: Spacing.four,
      }}
    >
      <FormSection title="Location">
        <Text selectable style={{ color: theme.text }}>
          {describeSsiSite(site)}
        </Text>
        <Text selectable style={{ color: theme.textSecondary }}>
          {site.lat.toFixed(5)}, {site.lon.toFixed(5)}
        </Text>
        {detail?.breadcrump_string ? (
          <Text selectable style={{ color: theme.textSecondary }}>
            {ssiPlainText(detail.breadcrump_string)}
          </Text>
        ) : null}
      </FormSection>
      <FormSection title="About this site">
        {descriptions.length > 1 ? (
          <Host matchContents>
            <Picker selectedValue={description?.descr_iso3 ?? language} onValueChange={setLanguage}>
              {descriptions
                .filter((d) => d.descr_iso3)
                .map((d) => (
                  <Picker.Item
                    key={d.descr_iso3}
                    label={`Description language: ${d.descr_iso3}`}
                    value={d.descr_iso3!}
                  />
                ))}
            </Picker>
          </Host>
        ) : null}
        {paragraphs.map((text, index) => (
          <Text key={index} selectable style={{ color: theme.text, fontSize: 17, lineHeight: 25 }}>
            {text}
          </Text>
        ))}
        {description?.descr_who ? (
          <Text selectable style={{ color: theme.textSecondary }}>
            {description.descr_who}
            {description.descr_added_date ? ` · ${description.descr_added_date}` : ''}
          </Text>
        ) : null}
        {!paragraphs.length ? (
          <Text style={{ color: theme.textSecondary }}>
            SSI has not provided a description for this site.
          </Text>
        ) : null}
      </FormSection>
      {images.map((photo, index) => (
        <View key={index} style={{ gap: Spacing.one }}>
          <Image
            source={{ uri: (photo.big ?? photo.thumb)! }}
            style={{ width: '100%', height: 240, borderRadius: Spacing.three }}
            contentFit="contain"
            accessibilityLabel={`SSI photo of ${site.name}`}
          />
          {photo.copyright ? (
            <Text selectable style={{ color: theme.textSecondary }}>
              {photo.copyright}
            </Text>
          ) : null}
        </View>
      ))}
      {facts.some(([, value]) => typeof value === 'number' && Number.isFinite(value)) ? (
        <FormSection title="SSI statistics">
          {facts.map(([label, value]) =>
            typeof value === 'number' && Number.isFinite(value) ? (
              <View
                key={label}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: Spacing.three,
                }}
              >
                <Text style={{ color: theme.text }}>{label}</Text>
                <Text selectable style={{ color: theme.text }}>
                  {value.toLocaleString()}
                </Text>
              </View>
            ) : null,
          )}
        </FormSection>
      ) : null}
      <Text style={{ color: theme.textSecondary }}>
        Site information provided by SSI.{' '}
        {detail === null ? 'No additional details are available.' : ''}
      </Text>
    </ScrollView>
  );
}
