// AI-generated (Claude)
// The iOS map: Apple Maps through expo-maps. The Android side is platform-map.tsx,
// which also declares the props both share.

import { AppleMaps } from 'expo-maps';
import type { Ref } from 'react';

import type { PlatformMapProps } from './platform-map';

export const MAPS_AVAILABLE = true;

export function PlatformMap({
  ref,
  style,
  cameraPosition,
  markers,
  showsUserLocation = false,
  onMapClick,
  onCameraMove,
  onMarkerClick,
}: PlatformMapProps) {
  return (
    <AppleMaps.View
      ref={ref as Ref<AppleMaps.MapView>}
      style={style}
      cameraPosition={cameraPosition}
      markers={markers}
      properties={{ mapType: AppleMaps.MapType.STANDARD, isMyLocationEnabled: showsUserLocation }}
      uiSettings={{ myLocationButtonEnabled: false }}
      onMapClick={onMapClick}
      onCameraMove={onCameraMove}
      onMarkerClick={onMarkerClick}
    />
  );
}
