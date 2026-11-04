// AI-generated (Claude)
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import type { SitePosition } from '@/models/ssi/site-browse';

export function useSsiSiteLocation(initialPosition: SitePosition | null) {
  const [position, setPosition] = useState(initialPosition);
  const [locationError, setLocationError] = useState('');
  const [locating, setLocating] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const locate = async () => {
    if (locating) return;
    setLocating(true);
    setLocationError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationError('Location access is off. Search by name or explore the map.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setPosition({ lat: current.coords.latitude, lon: current.coords.longitude });
      setMapKey((key) => key + 1);
    } catch {
      setLocationError(
        'Could not find your location. Try again, search by name, or explore the map.',
      );
    } finally {
      setLocating(false);
    }
  };
  // Use an already granted permission without prompting on opening a screen.
  useEffect(() => {
    let active = true;
    if (!initialPosition)
      void Location.getForegroundPermissionsAsync()
        .then(async (permission) => {
          if (!permission.granted) return;
          const last = await Location.getLastKnownPositionAsync();
          if (active && last) {
            setPosition({ lat: last.coords.latitude, lon: last.coords.longitude });
            setMapKey((key) => key + 1);
          }
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [initialPosition]);

  return { position, locationError, locating, locate, mapKey };
}
