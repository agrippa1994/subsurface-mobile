// AI-generated (Claude)
// The dive-site map: shows a site's position and, when editable, picks one.
//
// iOS gets Apple Maps through expo-maps; Android needs a Google Maps API key
// and arrives with task 13, so there it degrades to the coordinate readout
// rather than an empty grey box. Coordinates cross the module boundary as
// microdegrees and are converted here (see models/site-edit.ts).

import { AppleMaps } from 'expo-maps';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { degreesToUdeg, udegToDegrees } from '@/models';
import { formatCoordinates } from '@/models/site-edit';

export type SiteMapProps = {
  latUdeg: number | null;
  lonUdeg: number | null;
  /** Tapping the map moves the marker. */
  editable?: boolean;
  onPick?: (latUdeg: number, lonUdeg: number) => void;
  height?: number;
  title?: string;
};

/** Zoom level of a fresh pick: close enough to see the reef, wide enough to pan. */
const SITE_ZOOM = 13;
/** What the map shows before the site has a position: the whole world. */
const WORLD_ZOOM = 1;

export function SiteMap({
  latUdeg,
  lonUdeg,
  editable = false,
  onPick,
  height = 220,
  title,
}: SiteMapProps) {
  const theme = useTheme();
  const hasPosition = latUdeg !== null && lonUdeg !== null;
  const coordinates = hasPosition
    ? { latitude: udegToDegrees(latUdeg), longitude: udegToDegrees(lonUdeg) }
    : { latitude: 0, longitude: 0 };

  if (Platform.OS !== 'ios') {
    return (
      <View
        style={[
          styles.fallback,
          { height, backgroundColor: theme.backgroundElement, borderColor: theme.separator },
        ]}>
        <Text style={{ color: theme.textSecondary }}>
          {hasPosition ? formatCoordinates(latUdeg, lonUdeg) : 'No position'}
        </Text>
        <Text style={[styles.fallbackHint, { color: theme.textSecondary }]}>
          The map is iOS-only for now.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.mapFrame, { height, borderColor: theme.separator }]}>
      <AppleMaps.View
        style={StyleSheet.absoluteFill}
        // The camera is only the *initial* position, so it must not be rebuilt
        // on every marker move - otherwise the map jumps back while panning.
        cameraPosition={{ coordinates, zoom: hasPosition ? SITE_ZOOM : WORLD_ZOOM }}
        markers={
          hasPosition ? [{ coordinates, title: title ?? 'Dive site', systemImage: 'mappin' }] : []
        }
        uiSettings={{ myLocationButtonEnabled: false }}
        onMapClick={
          editable && onPick
            ? (event) => {
                const { latitude, longitude } = event.coordinates ?? {};
                if (latitude === undefined || longitude === undefined) {
                  return;
                }
                onPick(degreesToUdeg(latitude), degreesToUdeg(longitude));
              }
            : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mapFrame: {
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fallbackHint: {
    fontSize: 13,
  },
});
