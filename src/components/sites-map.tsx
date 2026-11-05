// AI-generated (Claude)
// The overview map of the Sites tab: every site with a position as a pin.
//
// Read-only on purpose - the pins cannot be dragged or moved here. Tapping one
// opens that site; its position is changed in the site editor. Apple Maps only
// (expo-maps): rendered only where MAPS_AVAILABLE (components/site-map.tsx).

import { AppleMaps } from 'expo-maps';
import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';

import { udegToDegrees, type DiveSite } from '@/models';
import type { MapViewport } from '@/models/map-viewport';
import { fitSitesCamera, mapCameraFromMove, mappableSites } from '@/models/site-edit';

export function SitesMap({
  sites,
  onSelectSite,
  viewport,
}: {
  sites: readonly DiveSite[];
  onSelectSite: (uuid: number) => void;
  /** Kept by the owner so it outlives this map. */
  viewport: MapViewport;
}) {
  const markers = useMemo(
    () =>
      mappableSites(sites).map((site) => ({
        id: String(site.uuid),
        coordinates: {
          latitude: udegToDegrees(site.latUdeg),
          longitude: udegToDegrees(site.lonUdeg),
        },
        title: site.name.trim() === '' ? 'Unnamed site' : site.name,
        systemImage: 'mappin',
      })),
    [sites],
  );
  // Only the opening position: recomputing it after an edit elsewhere would
  // throw away wherever the user has panned to.
  const [opening] = useState(() => viewport.camera() ?? fitSitesCamera(sites));

  return (
    <AppleMaps.View
      ref={(map) => viewport.attach(map)}
      style={styles.map}
      cameraPosition={{
        coordinates: { latitude: opening.latitude, longitude: opening.longitude },
        zoom: opening.zoom,
      }}
      markers={markers}
      properties={{ isMyLocationEnabled: true }}
      uiSettings={{ myLocationButtonEnabled: false }}
      onCameraMove={(move) => viewport.remember(mapCameraFromMove(move))}
      onMarkerClick={(marker) => {
        const uuid = Number(marker.id);
        if (Number.isFinite(uuid)) {
          onSelectSite(uuid);
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
