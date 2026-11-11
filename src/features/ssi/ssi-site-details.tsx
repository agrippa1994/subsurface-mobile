// AI-generated (Claude)
import { Host, Picker } from '@expo/ui';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { ScrollView, Text, View } from 'react-native';
import { FormSection } from '@/components/form';
import { HeaderAction } from '@/components/header-action';
import { SkeletonGroup, SkeletonText } from '@/components/skeleton';
import { Spacing } from '@/constants/theme';
import { StatusView } from '@/components/status-view';
import { useTheme } from '@/hooks/use-theme';
import { ssiPlainText } from '@/models/ssi/site-browse';
import { describeSsiSite, type SsiSite } from '@/models/ssi/sites';
import { useSsiSiteDetail, useSsiSiteIndex } from '@/queries/ssi';
import { SsiSiteInsights } from './ssi-site-insights';
import { t } from '@/i18n';

/**
 * The route's body in both places details open: the Sites tab and the picker
 * modal. Only the id crosses the route; the site comes from the catalogue.
 */
export function SsiSiteDetailScreen({
  id,
  onSelect,
}: {
  id: number;
  onSelect?: (site: SsiSite) => void;
}) {
  const catalogue = useSsiSiteIndex();
  const site = useMemo(() => catalogue.data?.find((s) => s.id === id), [catalogue.data, id]);
  return (
    <>
      <Stack.Screen options={{ title: site?.name.trim() ?? t('nav.ssiSite'), headerLargeTitle: false }} />
      {site && onSelect ? (
        <HeaderAction label={t('ui.select')} done onPress={() => onSelect(site)} />
      ) : null}
      {site ? (
        <SsiSiteDetails site={site} />
      ) : (
        <StatusView
          kind={catalogue.isPending ? 'loading' : 'empty'}
          title={catalogue.isPending ? t('ssiSite.loading') : t('ssiSite.notFound')}
        />
      )}
    </>
  );
}

/**
 * The location is already known from the catalogue, so it is real from the first
 * frame. Only what the network still owes is a placeholder.
 */
function SsiSiteDetailsSkeleton({ site }: { site: SsiSite }) {
  const theme = useTheme();
  const paragraph = { fontSize: 17, lineHeight: 25 };
  return (
    <ScrollView
      scrollEnabled={false}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: Spacing.three,
        paddingBottom: Spacing.six,
        gap: Spacing.four,
      }}
    >
      <FormSection title={t('ui.location')}>
        <Text selectable style={{ color: theme.text }}>
          {describeSsiSite(site)}
        </Text>
        <Text selectable style={{ color: theme.textSecondary }}>
          {site.lat.toFixed(5)}, {site.lon.toFixed(5)}
        </Text>
      </FormSection>
      <SkeletonGroup label={t('ui.loadingSsiSiteDetails')} style={{ gap: Spacing.four }}>
        <FormSection title={t('ui.aboutThisSite')}>
          <SkeletonText style={paragraph} text="The site sits along a sloping wall that" />
          <SkeletonText style={paragraph} text="drops away from the shore in a series" />
          <SkeletonText style={paragraph} text="of ledges with plenty to look at on" />
          <SkeletonText style={paragraph} text="each of them, and a sandy bottom" />
          <SkeletonText style={paragraph} text="below." />
        </FormSection>
        <View
          style={{
            height: 240,
            borderRadius: Spacing.three,
            backgroundColor: theme.backgroundSelected,
          }}
        />
      </SkeletonGroup>
    </ScrollView>
  );
}

export function SsiSiteDetails({ site }: { site: SsiSite }) {
  const theme = useTheme();
  const query = useSsiSiteDetail(site.id);
  const [language, setLanguage] = useState('eng');
  if (!query.data && query.isError)
    return (
      <StatusView
        kind="error"
        title={t('ui.couldNotLoadSsiSiteDetails')}
        description={query.error.message}
        actionLabel={t('ui.tryAgain')}
        onAction={() => void query.refetch()}
      />
    );
  if (query.data === undefined)
    return query.fetchStatus === 'paused' ? (
      <StatusView kind="empty" title={t('ui.connectToLoadSsiSiteDetails')} />
    ) : (
      <SsiSiteDetailsSkeleton site={site} />
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
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: Spacing.three,
        paddingBottom: Spacing.six,
        gap: Spacing.four,
      }}
    >
      <FormSection title={t('ui.location')}>
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
      {detail ? <SsiSiteInsights detail={detail} /> : null}
      <FormSection title={t('ui.aboutThisSite')}>
        {descriptions.length > 1 ? (
          <Host matchContents>
            <Picker selectedValue={description?.descr_iso3 ?? language} onValueChange={setLanguage}>
              {descriptions
                .filter((d) => d.descr_iso3)
                .map((d) => (
                  <Picker.Item
                    key={d.descr_iso3}
                    label={t('ssiSite.language', { language: d.descr_iso3 })}
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
            {t('ssiSite.noDescription')}
          </Text>
        ) : null}
      </FormSection>
      {images.map((photo, index) => (
        <View key={index} style={{ gap: Spacing.one }}>
          <Image
            source={{ uri: (photo.big ?? photo.thumb)! }}
            style={{ width: '100%', height: 240, borderRadius: Spacing.three }}
            contentFit="contain"
            accessibilityLabel={t('ssiSite.photo', { name: site.name })}
          />
          {photo.copyright ? (
            <Text selectable style={{ color: theme.textSecondary }}>
              {photo.copyright}
            </Text>
          ) : null}
        </View>
      ))}
      <Text style={{ color: theme.textSecondary }}>
        {t('ssiSite.provided')}{' '}
        {detail === null ? t('ssiSite.noDetails') : ''}
      </Text>
    </ScrollView>
  );
}
