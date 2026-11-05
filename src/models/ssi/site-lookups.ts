// AI-generated (Claude)
// SSI's lookup tables: what the numeric codes in a site's details stand for.
//
// Three read-only endpoints that divessi-client does not wrap, shapes as measured
// in November 2026. `get_divelog_vars` turns a code into a key (6 is no_current),
// `get_wildlife_vars` does the same for animals, and `get_translations` turns any
// key into display text. Together they are about 580 KB, reduced here to the few
// labels the site screen uses.
//
// A key SSI has no text for is written out from the key itself, so one missing
// translation costs some polish and not the row.
//
// This file stays free of the network so vitest can cover the parsing directly.

export type SsiWildlifeInfo = { name: string; latin: string | null; thumb: string | null };

export type SsiSiteLookups = {
  current: ReadonlyMap<number, string>;
  entry: ReadonlyMap<number, string>;
  level: ReadonlyMap<number, string>;
  environment: ReadonlyMap<number, string>;
  wildlife: ReadonlyMap<number, SsiWildlifeInfo>;
};

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function fromKey(key: string): string {
  const words = key.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A `{ "6": "no_current" }` table with each key turned into display text. */
function labelTable(
  table: unknown,
  text: JsonObject,
  prefix: string = ''
): Map<number, string> {
  const labels = new Map<number, string>();
  for (const [id, key] of Object.entries(asObject(table))) {
    if (typeof key !== 'string' || !Number.isFinite(Number(id))) {
      continue;
    }
    const translated = text[`${prefix}${key}`] ?? text[key];
    labels.set(Number(id), typeof translated === 'string' ? translated : fromKey(key));
  }
  return labels;
}

function httpUrl(value: unknown): string | null {
  return typeof value === 'string' && /^https?:\/\//.test(value) ? value : null;
}

/** Any argument may be null: that endpoint failed, and its labels are left out. */
export function parseSsiSiteLookups(
  divelogVars: unknown,
  wildlifeVars: unknown,
  translations: unknown
): SsiSiteLookups {
  const text = asObject(asObject(translations).eng);
  const vars = asObject(divelogVars);
  const logbook = asObject(vars.logbook_vars);

  const environment = new Map<number, string>();
  for (const table of Object.values(asObject(vars.divesite_extended_vars))) {
    for (const [id, label] of labelTable(table, text)) {
      environment.set(id, label);
    }
  }

  const wildlife = new Map<number, SsiWildlifeInfo>();
  const animals = asObject(asObject(wildlifeVars).wildlife).animal;
  for (const raw of Array.isArray(animals) ? animals : []) {
    const animal = asObject(raw);
    if (typeof animal.id !== 'number' || typeof animal.title_key !== 'string') {
      continue;
    }
    const name = text[animal.title_key];
    wildlife.set(animal.id, {
      name: typeof name === 'string' ? name : fromKey(animal.title_key),
      latin: typeof animal.latin === 'string' && animal.latin !== '' ? fromKey(animal.latin) : null,
      thumb: httpUrl(asObject(asObject(animal.images).thumb).url),
    });
  }

  return {
    current: labelTable(logbook.current, text),
    // "Boat Dive" would read oddly under the heading Entry; SSI has a short form.
    entry: labelTable(logbook.entry, text, 'entry_'),
    level: labelTable(asObject(vars.divesite_vars).level, text, 'level_'),
    environment,
    wildlife,
  };
}
