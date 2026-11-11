// AI-generated (Claude)
// "Open in Maps": the site in the platform's maps app, for directions to it.

import { useCallback } from 'react';
import { Alert, Linking, Platform } from 'react-native';

import type { DiveSite } from '@/models';
import { mapsLink, type MapsPlatform } from '@/models/maps-link';
import { t } from '@/i18n';

export const MAPS_PLATFORM: MapsPlatform =
  Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

export function useOpenInMaps(): (site: Pick<DiveSite, 'name' | 'hasGps' | 'latUdeg' | 'lonUdeg'>) => void {
  return useCallback((site) => {
    const url = mapsLink(site, MAPS_PLATFORM);
    if (!url) {
      return;
    }
    Linking.openURL(url).catch(() => {
      Alert.alert(t('siteEditor.mapsFailed'), t('siteEditor.mapsFailedMessage'));
    });
  }, []);
}
