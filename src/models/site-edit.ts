// AI-generated (Claude)
// Presentation model of the dive-site editor.
//
// Pure functions only - no React, no native module. Coordinates cross the
// boundary as microdegrees (`degrees_t::udeg` in core/units.h), so everything
// the user types or reads is converted here and nowhere else.

import type { DiveSite, DiveSiteInput } from './index';
import { degreesToUdeg, udegToDegrees } from './units';

export type SiteDraft = {
  /** 0 for a site that does not exist yet. */
  uuid: number;
  name: string;
  description: string;
  notes: string;
  /** Null when the site has no position. */
  latUdeg: number | null;
  lonUdeg: number | null;
};

export const EMPTY_SITE_DRAFT: SiteDraft = {
  uuid: 0,
  name: '',
  description: '',
  notes: '',
  latUdeg: null,
  lonUdeg: null,
};

export function siteDraftFrom(site: DiveSite): SiteDraft {
  return {
    uuid: site.uuid,
    name: site.name,
    description: site.description,
    notes: site.notes,
    latUdeg: site.hasGps ? site.latUdeg : null,
    lonUdeg: site.hasGps ? site.lonUdeg : null,
  };
}

// --- Coordinates -----------------------------------------------------------

/**
 * Formats one coordinate the way the dive-site list shows it: four decimals
 * (about 11 m, finer than a dive site is ever known) plus a hemisphere letter,
 * so no minus sign has to be read.
 */
export function formatLatitude(latUdeg: number): string {
  const lat = udegToDegrees(latUdeg);
  return `${Math.abs(lat).toFixed(4)}${lat >= 0 ? 'N' : 'S'}`;
}

export function formatLongitude(lonUdeg: number): string {
  const lon = udegToDegrees(lonUdeg);
  return `${Math.abs(lon).toFixed(4)}${lon >= 0 ? 'E' : 'W'}`;
}

export function formatCoordinates(latUdeg: number, lonUdeg: number): string {
  return `${formatLatitude(latUdeg)} ${formatLongitude(lonUdeg)}`;
}

/** What the coordinate text field is seeded with, so editing round-trips. */
export function formatCoordinateInput(latUdeg: number | null, lonUdeg: number | null): string {
  if (latUdeg === null || lonUdeg === null) {
    return '';
  }
  return `${udegToDegrees(latUdeg).toFixed(6)}, ${udegToDegrees(lonUdeg).toFixed(6)}`;
}

export type ParsedCoordinates = { latUdeg: number; lonUdeg: number };

const NUMBER = String.raw`[-+]?\d+(?:[.,]\d+)?`;

/**
 * One coordinate, as decimal degrees, degrees and decimal minutes, or degrees,
 * minutes and seconds - with the hemisphere letter on either side. Covers what
 * a diver is likely to paste out of a map app or another logbook:
 *
 *   47.3769      N47.3769      47.3769 N
 *   N 47 22.614  47 22.614 N   47deg 22.614'
 *   N 47 22 36.8
 */
function parseComponent(text: string, positive: string, negative: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') {
    return null;
  }

  const letter = new RegExp(`[${positive}${negative}]`, 'i');
  const found = trimmed.match(letter);
  const hemisphere = found ? found[0].toUpperCase() : '';
  if (!found && /[a-z]/i.test(trimmed.replace(/deg|[nsew'"°′″]/gi, ''))) {
    return null;
  }
  const body = trimmed.replace(letter, ' ');

  const numbers = body.match(new RegExp(NUMBER, 'g'));
  if (!numbers || numbers.length === 0 || numbers.length > 3) {
    return null;
  }
  const [degrees, minutes = 0, seconds = 0] = numbers.map((n) => Number(n.replace(',', '.')));
  if (!Number.isFinite(degrees) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }
  // Minutes and seconds carry no sign of their own; the degrees do.
  if (minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) {
    return null;
  }

  const magnitude = Math.abs(degrees) + minutes / 60 + seconds / 3600;
  const negativeSign = degrees < 0 || hemisphere === negative.toUpperCase();
  return negativeSign ? -magnitude : magnitude;
}

/**
 * Parses a "latitude, longitude" pair. Returns null on anything it cannot read
 * or that is off the globe, so the editor can refuse to save rather than store
 * a silently wrong position.
 */
export function parseCoordinates(value: string): ParsedCoordinates | null {
  const text = value.trim();
  if (text === '') {
    return null;
  }

  // A comma separates the two coordinates, unless it is being used as a decimal
  // separator - in which case there is exactly one and digits on both sides.
  const parts = text.includes(',')
    ? splitOnCoordinateComma(text)
    : splitOnHemisphereOrSpace(text);
  if (!parts) {
    return null;
  }

  const lat = parseComponent(parts[0], 'N', 'S');
  const lon = parseComponent(parts[1], 'E', 'W');
  if (lat === null || lon === null) {
    return null;
  }
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return null;
  }

  return { latUdeg: degreesToUdeg(lat), lonUdeg: degreesToUdeg(lon) };
}

function splitOnCoordinateComma(text: string): [string, string] | null {
  const candidates: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== ',') {
      continue;
    }
    const decimal = /\d/.test(text[i - 1] ?? '') && /\d/.test(text[i + 1] ?? '');
    if (!decimal) {
      candidates.push(i);
    }
  }
  if (candidates.length === 0) {
    // Every comma is a decimal separator ("47,3769 8,5417"): fall back to the
    // whitespace split, which handles the German spelling of both numbers.
    return splitOnHemisphereOrSpace(text);
  }
  if (candidates.length > 1) {
    return null;
  }
  const at = candidates[0];
  return [text.slice(0, at), text.slice(at + 1)];
}

function splitOnHemisphereOrSpace(text: string): [string, string] | null {
  // "N 47 22.614 E 8 32.502": the longitude starts at its hemisphere letter.
  const east = text.slice(1).search(/[EW]/i);
  if (east >= 0 && /[NS]/i.test(text)) {
    const at = east + 1;
    return [text.slice(0, at), text.slice(at)];
  }
  const fields = text.split(/\s+/).filter((f) => f !== '');
  if (fields.length % 2 !== 0) {
    return null;
  }
  const half = fields.length / 2;
  return [fields.slice(0, half).join(' '), fields.slice(half).join(' ')];
}

// --- Validation and patch building -----------------------------------------

export type SiteValidation = { ok: true } | { ok: false; message: string };

/**
 * A site must have a name: `divelog.sites.create()` accepts an empty one, but
 * the dive list and the site picker have nothing to show for it, and desktop
 * Subsurface treats an unnamed site as a site to be merged away.
 */
export function validateSiteDraft(draft: SiteDraft): SiteValidation {
  if (draft.name.trim() === '') {
    return { ok: false, message: 'A dive site needs a name.' };
  }
  if ((draft.latUdeg === null) !== (draft.lonUdeg === null)) {
    return { ok: false, message: 'A position needs both a latitude and a longitude.' };
  }
  return { ok: true };
}

/**
 * The `upsertDiveSite` argument for `draft`. Only the fields that differ from
 * `original` are sent, because the binding overwrites exactly what the argument
 * mentions (api.cpp `upsert_dive_site`). A new site sends everything it has.
 */
export function buildSiteInput(draft: SiteDraft, original?: DiveSite): DiveSiteInput {
  const input: DiveSiteInput = {};
  if (draft.uuid !== 0) {
    input.uuid = draft.uuid;
  }

  const name = draft.name.trim();
  if (!original || name !== original.name) {
    input.name = name;
  }
  const description = draft.description.trim();
  if (!original || description !== original.description) {
    input.description = description;
  }
  const notes = draft.notes.trim();
  if (!original || notes !== original.notes) {
    input.notes = notes;
  }

  // Clearing a position is expressed as 0/0, which is what the core means by
  // "no location" (`location_t::is_zero`).
  const latUdeg = draft.latUdeg ?? 0;
  const lonUdeg = draft.lonUdeg ?? 0;
  const hadGps = original ? original.hasGps : false;
  const originalLat = hadGps ? (original as DiveSite).latUdeg : 0;
  const originalLon = hadGps ? (original as DiveSite).lonUdeg : 0;
  if (!original || latUdeg !== originalLat || lonUdeg !== originalLon) {
    input.latUdeg = latUdeg;
    input.lonUdeg = lonUdeg;
  }

  return input;
}

/** True when the upsert would change nothing, so the write can be skipped. */
export function isEmptySiteInput(input: DiveSiteInput): boolean {
  return Object.keys(input).filter((key) => key !== 'uuid').length === 0;
}

// --- Duplicates ------------------------------------------------------------

/** Sites sharing a name with `draft`, excluding the site being edited. */
export function findDuplicateSites(
  draft: SiteDraft,
  sites: readonly DiveSite[]
): DiveSite[] {
  const name = draft.name.trim().toLocaleLowerCase();
  if (name === '') {
    return [];
  }
  return sites.filter(
    (site) => site.uuid !== draft.uuid && site.name.trim().toLocaleLowerCase() === name
  );
}

/**
 * Sites within `radiusMeters` of the draft's position, nearest first. Used to
 * warn before creating a second site on top of an existing one - the same
 * problem `dive_site::merge` exists to clean up after.
 */
export function findNearbySites(
  draft: SiteDraft,
  sites: readonly DiveSite[],
  radiusMeters = 100
): DiveSite[] {
  if (draft.latUdeg === null || draft.lonUdeg === null) {
    return [];
  }
  const lat = udegToDegrees(draft.latUdeg);
  const lon = udegToDegrees(draft.lonUdeg);

  return sites
    .filter((site) => site.uuid !== draft.uuid && site.hasGps)
    .map((site) => ({
      site,
      distance: distanceMeters(lat, lon, udegToDegrees(site.latUdeg), udegToDegrees(site.lonUdeg)),
    }))
    .filter((entry) => entry.distance <= radiusMeters)
    .sort((a, b) => a.distance - b.distance)
    .map((entry) => entry.site);
}

const EARTH_RADIUS_M = 6371000;

/** Great-circle distance, haversine. Accurate enough at dive-site scale. */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

// --- List rendering --------------------------------------------------------

export type SiteRow = {
  uuid: number;
  title: string;
  subtitle: string;
  countText: string;
  hasGps: boolean;
};

export function toSiteRow(site: DiveSite): SiteRow {
  return {
    uuid: site.uuid,
    title: site.name.trim() === '' ? 'Unnamed site' : site.name,
    subtitle: site.hasGps ? formatCoordinates(site.latUdeg, site.lonUdeg) : 'No position',
    countText: `${site.diveCount} ${site.diveCount === 1 ? 'dive' : 'dives'}`,
    hasGps: site.hasGps,
  };
}

export function sortSitesByName(sites: readonly DiveSite[]): DiveSite[] {
  return [...sites].sort((a, b) => a.name.localeCompare(b.name) || a.uuid - b.uuid);
}
