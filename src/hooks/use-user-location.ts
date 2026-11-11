// AI-generated (Claude)
// The user's position for finding nearby dive sites. Only an explicit locate()
// prompts for permission; opening a screen reuses an already granted one.
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import type { SitePosition } from '@/models/ssi/site-browse';
import { t } from '@/i18n';

export function useUserLocation(initialPosition: SitePosition | null = null) {
  const [position, setPosition] = useState(initialPosition);
  const [locating, setLocating] = useState(false);
  const inFlight = useRef(false);
  // Read on mount and again after locate() asks, so a map can draw the user's
  // position as soon as it may.
  const [permission, , refreshPermission] = Location.useForegroundPermissions();

  const locate = async (): Promise<SitePosition | null> => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setLocating(true);
    try {
      const requested = await Location.requestForegroundPermissionsAsync();
      void refreshPermission();
      if (!requested.granted) {
        Alert.alert(
          t('location.offTitle'),
          t('location.offMessage'),
          [
            { text: t('location.notNow'), style: 'cancel' },
            { text: t('location.openSettings'), onPress: () => void Linking.openSettings() },
          ],
        );
        return null;
      }
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const next = { lat: current.coords.latitude, lon: current.coords.longitude };
      setPosition(next);
      return next;
    } catch {
      Alert.alert(t('location.failedTitle'), t('location.failedMessage'));
      return null;
    } finally {
      inFlight.current = false;
      setLocating(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (!initialPosition)
      void Location.getForegroundPermissionsAsync()
        .then(async (permission) => {
          if (!permission.granted) return;
          const last = await Location.getLastKnownPositionAsync();
          if (active && last)
            setPosition({ lat: last.coords.latitude, lon: last.coords.longitude });
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [initialPosition]);

  return { position, locating, locate, locationGranted: permission?.granted === true };
}
