// AI-generated (Claude)
// The user's position for finding nearby dive sites. Only an explicit locate()
// prompts for permission; opening a screen reuses an already granted one.
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import type { SitePosition } from '@/models/ssi/site-browse';

export function useUserLocation(initialPosition: SitePosition | null = null) {
  const [position, setPosition] = useState(initialPosition);
  const [locating, setLocating] = useState(false);
  const inFlight = useRef(false);

  const locate = async (): Promise<SitePosition | null> => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Location access is off',
          'Allow location access in Settings to find dive sites near you.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => void Linking.openSettings() },
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
      Alert.alert('Could not find your location', 'Try again, search by name, or explore the map.');
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

  return { position, locating, locate };
}
