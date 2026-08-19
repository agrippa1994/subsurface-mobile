// AI-generated (Claude)
// Query keys.
//
// Everything read out of the loaded logbook lives under ['log', 'data'], and
// the load itself under ['log'] alone. That split matters:
//
//   - a mutation invalidates ['log', 'data'], which re-reads the dives, sites,
//     profiles and statistics but must NOT re-run loadFromXML;
//   - a load, import or replace removes ['log'] wholesale, because dive ids are
//     process-local and are reassigned on every loadFromXML. A key such as
//     ['log','data','dive',7] cached across a load points at a different dive
//     (see modules/ssrf-core/cpp/API.md).
//
// Dive site uuids are persisted and stable, but they live under the same root
// for the simple reason that a reload replaces those objects too.

import type { GradientFactors, StatsFilter } from '@/models';

export const queryKeys = {
  /** The loaded logbook itself: { path, lastLoad }. */
  log: () => ['log'] as const,
  /** Root of everything read out of the loaded logbook. */
  logData: () => ['log', 'data'] as const,

  dives: () => ['log', 'data', 'dives'] as const,
  sites: () => ['log', 'data', 'sites'] as const,
  dive: (id: number) => ['log', 'data', 'dive', id] as const,
  /**
   * One plotted profile. The gradient factors are part of the key because they
   * change what the core computes: without them a cached plot would keep the
   * ceiling of the previous setting.
   */
  profile: (id: number, dcIndex: number, gf: GradientFactors) =>
    ['log', 'data', 'profile', id, dcIndex, gf.gfLow, gf.gfHigh] as const,
  /** Every profile of one dive, whichever dive computer it came from. */
  diveProfiles: (id: number) => ['log', 'data', 'profile', id] as const,
  statistics: (filter?: StatsFilter) => ['log', 'data', 'statistics', filter ?? null] as const,

  /** Preferences: a file of its own, untouched by loading a logbook. */
  settings: () => ['settings'] as const,

  /**
   * Everything about the SSI account and its catalogue. A root of its own for
   * the same reason as settings: none of it comes out of the logbook, so a
   * reload must not drop the signed-in account or the downloaded site index.
   * These are also the app's only keys backed by the network rather than by a
   * synchronous native call, so the queries under them set their own staleTime
   * (see src/queries/ssi.ts).
   */
  ssi: () => ['ssi'] as const,
  ssiAccount: () => ['ssi', 'account'] as const,
  ssiSiteIndex: () => ['ssi', 'site-index'] as const,
  ssiSiteIndexInfo: () => ['ssi', 'site-index', 'info'] as const,
  /**
   * What a sync needs out of the SSI logbook: the next free dive number and the
   * diver's buddy list. One key because it is one `get_divelog` call.
   */
  ssiLogbook: () => ['ssi', 'logbook'] as const,
};
