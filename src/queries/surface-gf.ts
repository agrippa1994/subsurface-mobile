// AI-generated (Claude)
// The surface GF series out of the core, and the preferences that steer it.
//
// Under ['log', 'data'] like every other read of the logbook, so an edit, an
// import or a new dive recomputes it (a new latest dive changes everything).
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useCallback } from 'react';

import { surfaceGf } from '../../modules/ssrf-core/src';
import { queryKeys } from '@/lib/query-keys';
import type { GradientFactors, SurfaceGfSeries } from '@/models';
import type { SurfaceGfSettings } from '@/models/surface-gf';
import { useLogLoaded } from '@/queries/logbook';
import { useSettings, useUpdateSettings } from '@/queries/settings';

/**
 * `diveId` null is the latest dive. `enabled` false skips the native call, for
 * a card that already knows the latest dive is days old.
 */
export function useSurfaceGfSeries(
  diveId: number | null,
  gf: GradientFactors,
  ambientMbar: number,
  enabled = true,
): UseQueryResult<SurfaceGfSeries> {
  return useQuery({
    queryKey: queryKeys.surfaceGf(diveId, gf, ambientMbar),
    queryFn: () =>
      surfaceGf({ ...gf, ambientMbar, ...(diveId === null ? {} : { id: diveId }) }),
    enabled: useLogLoaded() && enabled,
    // A new barometer reading changes the key; keep drawing the last series
    // meanwhile rather than flashing the card away.
    placeholderData: keepPreviousData,
  });
}

export function useSurfaceGfSettings(): SurfaceGfSettings {
  return useSettings().surfaceGf;
}

export function useSetSurfaceGfSettings(): (patch: Partial<SurfaceGfSettings>) => void {
  const settings = useSurfaceGfSettings();
  const { mutate } = useUpdateSettings();
  return useCallback(
    (patch: Partial<SurfaceGfSettings>) => mutate({ surfaceGf: { ...settings, ...patch } }),
    [mutate, settings],
  );
}
