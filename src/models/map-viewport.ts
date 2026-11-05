// AI-generated (Claude)
// Where a map is looking, kept outside the map view: the Sites tab replaces one
// map with another (or with a list) and the next one opens where the last left off.
import type { MapCamera } from './site-edit';

type MapHandle = {
  setCameraPosition: (position: {
    coordinates: { latitude: number; longitude: number };
    zoom: number;
  }) => Promise<void> | void;
};

export type MapViewport = {
  /** The last known camera, or null before any map has opened. */
  camera: () => MapCamera | null;
  /** A callback ref for the map on screen. */
  attach: (map: MapHandle | null) => void;
  /** Records where the user has moved the map to. */
  remember: (camera: MapCamera | null) => void;
  /** Moves the map on screen, or the next one to open. */
  move: (camera: MapCamera) => void;
};

export function createMapViewport(): MapViewport {
  let current: MapCamera | null = null;
  let map: MapHandle | null = null;
  return {
    camera: () => current,
    attach: (next) => {
      map = next;
    },
    remember: (camera) => {
      current = camera ?? current;
    },
    move: (camera) => {
      current = camera;
      void map?.setCameraPosition({
        coordinates: { latitude: camera.latitude, longitude: camera.longitude },
        zoom: camera.zoom,
      });
    },
  };
}
