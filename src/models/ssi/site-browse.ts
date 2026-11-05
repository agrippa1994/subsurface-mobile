// AI-generated (Claude)
import type { DiveLog, SiteDetail } from 'divessi-client';
import { distanceMeters, type MapCamera } from '../site-edit';
import type { SsiSite } from './sites';

export type SitePosition = { lat: number; lon: number };
export function hasSsiPosition(site: SitePosition): boolean {
  return (
    Number.isFinite(site.lat) &&
    Number.isFinite(site.lon) &&
    Math.abs(site.lat) <= 90 &&
    Math.abs(site.lon) <= 180 &&
    (site.lat !== 0 || site.lon !== 0)
  );
}

export function recentSsiSiteIds(dives: readonly DiveLog[]): number[] {
  const sorted = [...dives]
    .filter((d) => !d.odin_user_log_deleted)
    .sort(
      (a, b) =>
        (b.odin_user_log_date ?? '').localeCompare(a.odin_user_log_date ?? '') ||
        (b.odin_user_log_nr ?? 0) - (a.odin_user_log_nr ?? 0),
    );
  return [
    ...new Set(
      sorted
        .map((d) => d.odin_user_log_dive_sites_id)
        .filter((id): id is number => typeof id === 'number' && Number.isFinite(id)),
    ),
  ];
}

export function browseSsiSites(
  sites: readonly SsiSite[],
  query: string,
  position: SitePosition | null,
  recentIds?: readonly number[],
): SsiSite[] {
  const needle = query.trim().toLocaleLowerCase();
  const matches = sites.filter(
    (s) => !needle || `${s.name} ${s.country}`.toLocaleLowerCase().includes(needle),
  );
  if (recentIds) {
    const byId = new Map(matches.map((s) => [s.id, s]));
    return recentIds.flatMap((id) => {
      const site = byId.get(id);
      return site ? [site] : [];
    });
  }
  if (!position) return matches.sort((a, b) => a.name.trim().localeCompare(b.name.trim()));
  return matches
    .map((site) => ({
      site,
      distance: hasSsiPosition(site)
        ? distanceMeters(position.lat, position.lon, site.lat, site.lon)
        : Infinity,
    }))
    .sort((a, b) => a.distance - b.distance)
    .map((s) => s.site);
}

// The camera showing every located site, or null when none has a position.
export function fitSsiSitesCamera(sites: readonly SsiSite[]): MapCamera | null {
  const located = sites.filter(hasSsiPosition);
  if (located.length === 0) return null;
  const latitudes = located.map((s) => s.lat);
  const longitudes = located.map((s) => s.lon);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const span = Math.max(maxLat - minLat, maxLon - minLon, 0.02);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    zoom: Math.max(2, Math.min(14, Math.log2(360 / span) - 1)),
  };
}

// SSI returns a one-element array, or an empty array for an unknown site.
export function parseSsiSiteDetail(value: unknown, id: number): SiteDetail | null {
  const entry = Array.isArray(value)
    ? value.find((v) => v && typeof v === 'object' && Number(v.dive_site_id) === id)
    : value;
  if (!entry || typeof entry !== 'object' || Number((entry as SiteDetail).dive_site_id) !== id)
    return null;
  return entry as SiteDetail;
}

export function ssiPlainText(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .trim();
}

export type SsiMapGroup = { id: string; lat: number; lon: number; sites: SsiSite[] };
// Grid clustering keeps every catalogue site reachable without creating tens of
// thousands of native markers. Panning and zooming rebuild the visible groups.
export function groupSsiSites(
  sites: readonly SsiSite[],
  region: { lat: number; lon: number; latitudeDelta: number; longitudeDelta: number },
): SsiMapGroup[] {
  const groups = new Map<string, SsiMapGroup>();
  const cellLat = Math.max(region.latitudeDelta / 12, 0.00001);
  const cellLon = Math.max(region.longitudeDelta / 10, 0.00001);
  for (const site of sites) {
    const lonDistance = Math.abs(((site.lon - region.lon + 540) % 360) - 180);
    if (
      !hasSsiPosition(site) ||
      Math.abs(site.lat - region.lat) > region.latitudeDelta * 0.7 ||
      lonDistance > region.longitudeDelta * 0.7
    )
      continue;
    const key = `${Math.floor(site.lat / cellLat)}:${Math.floor(site.lon / cellLon)}`;
    const group = groups.get(key);
    if (group) {
      const count = group.sites.length;
      group.lat = (group.lat * count + site.lat) / (count + 1);
      group.lon = (group.lon * count + site.lon) / (count + 1);
      group.sites.push(site);
    } else groups.set(key, { id: key, lat: site.lat, lon: site.lon, sites: [site] });
  }
  return [...groups.values()];
}
