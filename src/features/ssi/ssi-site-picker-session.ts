// AI-generated (Claude)
// Ephemeral picker callbacks keep the dive form's draft in its own screen;
// only a position crosses into the native modal route.
import { useSyncExternalStore } from 'react';
import type { SitePosition } from '@/models/ssi/site-browse';
import type { SsiSite } from '@/models/ssi/sites';
export type SsiPickerSession = {
  position: SitePosition | null;
  onSelect: (site: SsiSite) => void;
  onClose: () => void;
};
let session: SsiPickerSession | null = null;
const listeners = new Set<() => void>();
export function setSsiPickerSession(next: SsiPickerSession | null) {
  session = next;
  listeners.forEach((listener) => listener());
}
export function useSsiPickerSession() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => session,
    () => null,
  );
}
