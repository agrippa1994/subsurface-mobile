// AI-generated (Claude)
// Handing a dive site to the platform's maps app, for directions to it.
//
// Each platform has its own way in: Apple Maps answers a maps.apple.com link on
// iOS (and opens the app rather than the web), and Android resolves a `geo:` URI
// to whichever maps app the diver uses. Both put a pin with the site's name at
// the coordinates, which is what "directions to here" starts from.

import type { DiveSite } from './index';
import { udegToDegrees } from './units';

export type MapsPlatform = 'ios' | 'android' | 'web';

/** The coordinate as both apps read it: plain decimal degrees, six places. */
function degrees(udeg: number): string {
  return udegToDegrees(udeg).toFixed(6);
}

/** The link that opens `site` in the maps app, or null for a site with no position. */
export function mapsLink(
  site: Pick<DiveSite, 'name' | 'hasGps' | 'latUdeg' | 'lonUdeg'>,
  platform: MapsPlatform,
): string | null {
  if (!site.hasGps) {
    return null;
  }
  const lat = degrees(site.latUdeg);
  const lon = degrees(site.lonUdeg);
  const name = site.name.trim() || 'Dive site';
  if (platform === 'android') {
    // geo:0,0?q=lat,lon(label) is the form that drops a labelled pin; the
    // leading coordinate is where the map opens.
    return `geo:${lat},${lon}?q=${lat},${lon}(${encodeURIComponent(name)})`;
  }
  // ll places the pin, q names it.
  return `https://maps.apple.com/?ll=${lat},${lon}&q=${encodeURIComponent(name)}`;
}

/** What the row says: the app it opens. */
export function mapsAppName(platform: MapsPlatform): string {
  return platform === 'ios' ? 'Apple Maps' : 'Maps';
}
