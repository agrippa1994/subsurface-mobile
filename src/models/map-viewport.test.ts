// AI-generated (Claude)
import { describe, expect, it, vi } from 'vitest';
import { createMapViewport } from './map-viewport';

const here = { latitude: 47, longitude: 13, zoom: 9 };

describe('createMapViewport', () => {
  it('keeps the last camera when a report has none', () => {
    const viewport = createMapViewport();
    viewport.remember(here);
    viewport.remember(null);
    expect(viewport.camera()).toEqual(here);
  });

  it('moves the attached map', () => {
    const viewport = createMapViewport();
    const setCameraPosition = vi.fn();
    viewport.attach({ setCameraPosition });
    viewport.move(here);
    expect(setCameraPosition).toHaveBeenCalledWith({
      coordinates: { latitude: 47, longitude: 13 },
      zoom: 9,
    });
  });

  it('keeps a move made without a map for the next one to open', () => {
    const viewport = createMapViewport();
    viewport.move(here);
    expect(viewport.camera()).toEqual(here);
  });
});
