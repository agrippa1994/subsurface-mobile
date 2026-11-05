// AI-generated (Claude)
// The app's one map view. This file is Android: MapLibre drawing OpenFreeMap's
// vector tiles, which need no API key or account. iOS keeps Apple Maps in
// platform-map.ios.tsx. The screens describe the map once, against these props.
//
// OpenFreeMap requires attribution; MapLibre draws it from the style's sources,
// so `attribution` must stay on.

import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  UserLocation,
} from '@maplibre/maplibre-react-native';
import type { CameraMoveEvent, CameraPosition } from 'expo-maps';
import { type Ref, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';

import type { SFSymbol } from '@/components/symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Whether this platform has a map at all. The one place that decides it: every
 * screen that would show a map asks this rather than checking the platform.
 */
export const MAPS_AVAILABLE = Platform.OS === 'android';

const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/liberty';
const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';
// The one font both styles' glyph server is sure to have.
const FONT = ['Noto Sans Regular'];

// The app's zoom levels are the 256 px world of Apple's and Google's maps;
// MapLibre's world is 512 px, so the same view is one level lower.
const toMapLibreZoom = (zoom: number) => Math.max(0, zoom - 1);
const fromMapLibreZoom = (zoom: number) => zoom + 1;

const MOVE_MS = 500;
const MARKER_HITBOX = { top: 16, right: 16, bottom: 16, left: 16 };

export type PlatformMapHandle = {
  setCameraPosition: (position: {
    coordinates: { latitude: number; longitude: number };
    zoom: number;
  }) => Promise<void> | void;
};

export type PlatformMapMarker = {
  id: string;
  coordinates: { latitude: number; longitude: number };
  title: string;
  /** Apple Maps only: MapLibre draws a dot. */
  systemImage?: SFSymbol;
  /** Short text drawn on the marker, such as a cluster's count. */
  monogram?: string;
  tintColor?: string;
};

export type PlatformMapProps = {
  ref?: Ref<PlatformMapHandle>;
  style?: StyleProp<ViewStyle>;
  /** Changing it moves the map; panning does not change it. */
  cameraPosition: CameraPosition;
  markers: PlatformMapMarker[];
  /** Draw the user's position. MapLibre needs location permission to do so. */
  showsUserLocation?: boolean;
  onMapClick?: (event: { coordinates: { latitude?: number; longitude?: number } }) => void;
  onCameraMove?: (event: CameraMoveEvent) => void;
  onMarkerClick?: (marker: { id?: string }) => void;
};

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
  const theme = useTheme();
  const scheme = useColorScheme();
  const camera = useRef<CameraRef>(null);

  const latitude = cameraPosition.coordinates?.latitude ?? 0;
  const longitude = cameraPosition.coordinates?.longitude ?? 0;
  const zoom = toMapLibreZoom(cameraPosition.zoom ?? 1);

  // initialViewState covers the first position; this follows later changes.
  const opened = useRef(false);
  useEffect(() => {
    if (!opened.current) {
      opened.current = true;
      return;
    }
    camera.current?.easeTo({ center: [longitude, latitude], zoom, duration: MOVE_MS });
  }, [latitude, longitude, zoom]);

  useImperativeHandle(
    ref,
    () => ({
      setCameraPosition: (position) =>
        camera.current?.easeTo({
          center: [position.coordinates.longitude, position.coordinates.latitude],
          zoom: toMapLibreZoom(position.zoom),
          duration: MOVE_MS,
        }),
    }),
    [],
  );

  const features = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: markers.map((marker) => ({
        type: 'Feature',
        id: marker.id,
        geometry: {
          type: 'Point',
          coordinates: [marker.coordinates.longitude, marker.coordinates.latitude],
        },
        properties: {
          id: marker.id,
          title: marker.title,
          monogram: marker.monogram ?? '',
          color: marker.tintColor ?? theme.accent,
        },
      })),
    }),
    [markers, theme.accent],
  );

  return (
    <MapLibreMap
      style={style}
      mapStyle={scheme === 'dark' ? STYLE_DARK : STYLE_LIGHT}
      // A texture, not a surface: these maps sit in rounded frames and scroll
      // views, and a SurfaceView is drawn outside both.
      androidView="texture"
      attribution
      logo={false}
      touchPitch={false}
      onPress={
        onMapClick
          ? (event) => {
              const [lng, lat] = event.nativeEvent.lngLat;
              onMapClick({ coordinates: { latitude: lat, longitude: lng } });
            }
          : undefined
      }
      onRegionDidChange={
        onCameraMove
          ? (event) => {
              const { center, zoom: mapZoom, bearing, pitch, bounds } = event.nativeEvent;
              const [west, south, east, north] = bounds;
              onCameraMove({
                coordinates: { latitude: center[1], longitude: center[0] },
                zoom: fromMapLibreZoom(mapZoom),
                tilt: pitch,
                bearing,
                latitudeDelta: north - south,
                // Negative when the view crosses the antimeridian.
                longitudeDelta: east >= west ? east - west : east - west + 360,
              });
            }
          : undefined
      }>
      <Camera
        ref={camera}
        initialViewState={{ center: [longitude, latitude], zoom }}
      />
      <GeoJSONSource
        id="markers"
        data={features}
        hitbox={MARKER_HITBOX}
        onPress={
          onMarkerClick
            ? (event) => {
                const id = event.nativeEvent.features[0]?.properties?.id;
                if (typeof id === 'string') onMarkerClick({ id });
              }
            : undefined
        }>
        <Layer
          id="marker-dots"
          type="circle"
          paint={{
            'circle-color': ['get', 'color'],
            'circle-radius': ['case', ['==', ['get', 'monogram'], ''], 8, 15],
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-width': 2,
          }}
        />
        <Layer
          id="marker-monograms"
          type="symbol"
          filter={['!=', ['get', 'monogram'], '']}
          layout={{
            'text-field': ['get', 'monogram'],
            'text-font': FONT,
            'text-size': 12,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          }}
          paint={{ 'text-color': '#FFFFFF' }}
        />
        <Layer
          id="marker-titles"
          type="symbol"
          filter={['==', ['get', 'monogram'], '']}
          layout={{
            'text-field': ['get', 'title'],
            'text-font': FONT,
            'text-size': 12,
            'text-anchor': 'top',
            'text-offset': [0, 0.9],
            'text-optional': true,
          }}
          paint={{
            'text-color': theme.text,
            'text-halo-color': theme.background,
            'text-halo-width': 1.5,
          }}
        />
      </GeoJSONSource>
      {showsUserLocation ? <UserLocation /> : null}
    </MapLibreMap>
  );
}
