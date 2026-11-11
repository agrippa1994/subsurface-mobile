// AI-generated (Claude)
// The five sections of the app, as a native tab bar. On iOS 26 this is the
// system liquid-glass tab bar, on Android the Material bottom navigation bar;
// nothing here draws it by hand. `sf` names the iOS icon, `md` the Material
// Symbol Android draws.
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTabBarStyle } from '@/hooks/use-navigation-theme';
import { t } from '@/i18n';

export default function TabsLayout() {
  const tabBarStyle = useTabBarStyle();
  return (
    <NativeTabs {...tabBarStyle}>
      <NativeTabs.Trigger name="dives">
        <NativeTabs.Trigger.Label>{t('nav.dives')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet" md="format_list_bulleted" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="sites">
        <NativeTabs.Trigger.Label>{t('nav.sites')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="mappin.and.ellipse" md="location_on" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="statistics">
        <NativeTabs.Trigger.Label>{t('nav.statistics')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar" md="bar_chart" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="tools">
        <NativeTabs.Trigger.Label>{t('nav.tools')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="wrench.and.screwdriver" md="build" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>{t('nav.settings')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
