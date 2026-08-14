// AI-generated (Claude)
// Everything the Settings screen does, minus the rendering, so the iOS and the
// portable variant of the screen cannot drift apart.
//
// The developer actions exist because task 07's acceptance asks for the empty
// and error states to be checked against real files: they write a logbook with
// no dives, and a file that is not XML at all, and load them through the same
// path a picked file takes. They also stand in for the file picker, which a
// simulator cannot drive.

import { useCallback } from 'react';

import { useTransfer, type Transfer } from '@/features/transfer/use-transfer';
import {
  ensureLogbook,
  resetLogbook,
  sampleSuuntoPath,
  sampleSuuntoXmlPath,
  writeScratchFile,
} from '@/lib/logbook-file';
import type { UnitSystem } from '@/models';
import { useLogStore } from '@/store/log-store';
import { useSettingsStore } from '@/store/settings-store';

const EMPTY_LOGBOOK = "<divelog program='subsurface' version='3'>\n  <dives/>\n</divelog>\n";
const MALFORMED_LOGBOOK = 'this is not a logbook\n';

export type SettingsScreen = {
  /** Import and export (task 11), so the screen has one object to render from. */
  transfer: Transfer;
  unitSystem: UnitSystem;
  setUnitSystem: (system: UnitSystem) => void;
  diveCount: number;
  siteCount: number;
  logbookPath: string | null;
  /** Reloads the working logbook from disk. */
  reload: () => void;
  /** Deletes the working logbook and seeds it from the bundled sample again. */
  restoreSample: () => void;
  loadEmptyLogbook: () => void;
  loadMalformedLogbook: () => void;
  /**
   * Imports the bundled Suunto DM4 database into the loaded log. The user-facing
   * import is `transfer.importFile`; this one needs no file picker, which is
   * what makes it usable from a simulator.
   */
  importSuuntoSample: () => void;
  /**
   * Imports the bundled Suunto DM4 XML export. That path runs through the XSLT
   * stylesheets the native module ships, so it is the on-device check that they
   * were found - the database above needs none of them.
   */
  importSuuntoXmlSample: () => void;
};

export function useSettingsScreen(): SettingsScreen {
  const transfer = useTransfer();
  const unitSystem = useSettingsStore((state) => state.unitSystem);
  const setUnitSystem = useSettingsStore((state) => state.setUnitSystem);
  const dives = useLogStore((state) => state.dives);
  const sites = useLogStore((state) => state.sites);
  const path = useLogStore((state) => state.path);
  const open = useLogStore((state) => state.open);
  const loadPath = useLogStore((state) => state.loadPath);
  const importSuuntoFile = useLogStore((state) => state.importFile);

  const reload = useCallback(() => {
    void ensureLogbook().then((target) => loadPath(target));
  }, [loadPath]);

  const restoreSample = useCallback(() => {
    resetLogbook();
    void open();
  }, [open]);

  const loadEmptyLogbook = useCallback(() => {
    void loadPath(writeScratchFile('empty-logbook.ssrf', EMPTY_LOGBOOK));
  }, [loadPath]);

  const loadMalformedLogbook = useCallback(() => {
    void loadPath(writeScratchFile('malformed-logbook.ssrf', MALFORMED_LOGBOOK));
  }, [loadPath]);

  const importSuuntoSample = useCallback(() => {
    void sampleSuuntoPath().then((path) => importSuuntoFile(path));
  }, [importSuuntoFile]);

  const importSuuntoXmlSample = useCallback(() => {
    void sampleSuuntoXmlPath().then((path) => importSuuntoFile(path));
  }, [importSuuntoFile]);

  return {
    transfer,
    unitSystem,
    setUnitSystem,
    diveCount: dives.length,
    siteCount: sites.length,
    logbookPath: path,
    reload,
    restoreSample,
    loadEmptyLogbook,
    loadMalformedLogbook,
    importSuuntoSample,
    importSuuntoXmlSample,
  };
}
