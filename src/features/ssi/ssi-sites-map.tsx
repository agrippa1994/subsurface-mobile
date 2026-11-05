// AI-generated (Claude)
import { AppleMaps } from 'expo-maps';
import { useMemo, useState } from 'react';
import { useTheme } from '@/hooks/use-theme';
import type { MapViewport } from '@/models/map-viewport';
import { mapCameraFromMove, NEARBY_ZOOM, WORLD_ZOOM } from '@/models/site-edit';
import { groupSsiSites, type SitePosition } from '@/models/ssi/site-browse';
import type { SsiSite } from '@/models/ssi/sites';

export function SsiSitesMap({
  sites,
  position,
  viewport,
  onSelect,
  onCluster,
}: {
  sites: readonly SsiSite[];
  position: SitePosition | null;
  /** Kept by the owner so it outlives this map. */
  viewport: MapViewport;
  onSelect: (site: SsiSite) => void;
  onCluster: (sites: SsiSite[]) => void;
}) {
  const theme = useTheme();
  const [initial] = useState(() => {
    const opening = viewport.camera() ?? {
      latitude: position?.lat ?? 20,
      longitude: position?.lon ?? 0,
      zoom: position ? NEARBY_ZOOM : WORLD_ZOOM + 1,
    };
    return {
      coordinates: { latitude: opening.latitude, longitude: opening.longitude },
      zoom: opening.zoom,
    };
  });
  const [region, setRegion] = useState({
    lat: initial.coordinates.latitude,
    lon: initial.coordinates.longitude,
    latitudeDelta: 360 / 2 ** initial.zoom,
    longitudeDelta: 360 / 2 ** initial.zoom,
  });
  const groups = useMemo(() => groupSsiSites(sites, region), [sites, region]);
  return (
    <AppleMaps.View
      ref={(map) => viewport.attach(map)}
      style={{ flex: 1 }}
      cameraPosition={initial}
      properties={{ mapType: AppleMaps.MapType.STANDARD, isMyLocationEnabled: true }}
      uiSettings={{ myLocationButtonEnabled: false }}
      markers={groups.map((group) => ({
        id: group.id,
        coordinates: { latitude: group.lat, longitude: group.lon },
        title:
          group.sites.length === 1
            ? group.sites[0].name
            : `${group.sites.length} SSI sites — tap to zoom`,
        monogram: group.sites.length > 1 ? String(group.sites.length) : undefined,
        systemImage: group.sites.length === 1 ? 'mappin' : undefined,
        tintColor: theme.accent,
      }))}
      onCameraMove={(event) => {
        if (
          event.coordinates.latitude === undefined ||
          event.coordinates.longitude === undefined ||
          event.latitudeDelta <= 0 ||
          event.longitudeDelta <= 0
        )
          return;
        viewport.remember(mapCameraFromMove(event));
        setRegion({
          lat: event.coordinates.latitude,
          lon: event.coordinates.longitude,
          latitudeDelta: event.latitudeDelta,
          longitudeDelta: event.longitudeDelta,
        });
      }}
      onMarkerClick={(marker) => {
        const group = groups.find((g) => g.id === marker.id);
        if (!group) return;
        if (group.sites.length === 1) {
          onSelect(group.sites[0]);
          return;
        }
        // Co-located sites cannot be separated by zooming; offer every name.
        if (
          region.longitudeDelta < 0.0001 ||
          group.sites.every(
            (s) => Math.abs(s.lat - group.lat) < 0.00001 && Math.abs(s.lon - group.lon) < 0.00001,
          )
        ) {
          onCluster(group.sites);
        } else
          viewport.move({
            latitude: group.lat,
            longitude: group.lon,
            zoom: Math.min(21, Math.log2(360 / Math.max(region.longitudeDelta, 0.00001)) + 3),
          });
      }}
    />
  );
}
