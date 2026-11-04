// AI-generated (Claude)
import { AppleMaps } from 'expo-maps';
import { useMemo, useRef, useState } from 'react';
import { useTheme } from '@/hooks/use-theme';
import { groupSsiSites, hasSsiPosition, type SitePosition } from '@/models/ssi/site-browse';
import type { SsiSite } from '@/models/ssi/sites';

export function SsiSitesMap({
  sites,
  position,
  onSelect,
  onCluster,
  fitToSites = false,
}: {
  sites: readonly SsiSite[];
  position: SitePosition | null;
  fitToSites?: boolean;
  onSelect: (site: SsiSite) => void;
  onCluster: (sites: SsiSite[]) => void;
}) {
  const theme = useTheme();
  const map = useRef<AppleMaps.MapView>(null);
  const [initial] = useState(() => {
    const located = fitToSites ? sites.filter(hasSsiPosition) : [];
    if (located.length) {
      const latitudes = located.map((s) => s.lat);
      const longitudes = located.map((s) => s.lon);
      const minLat = Math.min(...latitudes),
        maxLat = Math.max(...latitudes);
      const minLon = Math.min(...longitudes),
        maxLon = Math.max(...longitudes);
      const span = Math.max(maxLat - minLat, maxLon - minLon, 0.02);
      return {
        coordinates: { latitude: (minLat + maxLat) / 2, longitude: (minLon + maxLon) / 2 },
        zoom: Math.max(2, Math.min(14, Math.log2(360 / span) - 1)),
      };
    }
    return {
      coordinates: { latitude: position?.lat ?? 20, longitude: position?.lon ?? 0 },
      zoom: position ? 9 : 2,
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
      ref={map}
      style={{ flex: 1 }}
      cameraPosition={initial}
      properties={{ mapType: AppleMaps.MapType.STANDARD }}
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
          void map.current?.setCameraPosition({
            coordinates: { latitude: group.lat, longitude: group.lon },
            zoom: Math.min(21, Math.log2(360 / Math.max(region.longitudeDelta, 0.00001)) + 3),
          });
      }}
    />
  );
}
