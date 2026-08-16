// AI-generated (Claude)
// Everything the Settings screen does, minus the rendering, so the iOS and the
// portable variant of the screen cannot drift apart.
//
// The developer actions exist because task 07's acceptance asks for the empty
// and error states to be checked against real files: they write a logbook with
// no dives, and a file that is not XML at all, and load them through the same
// path a picked file takes. They also stand in for the file picker, which a
// simulator cannot drive.

import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useCallback, useState } from 'react';
import { Alert, Linking } from 'react-native';

import { useTransfer, type Transfer } from '@/features/transfer/use-transfer';
import { clearDiagnostics, readDiagnostics } from '@/lib/diagnostics';
import { diagnosticsSummary } from '@/models/diagnostics';
import type { AboutInfo } from '@/models/about';
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

  /** Version and licence facts for the About section. */
  about: AboutInfo;
  /** Opens the source repository, which the GPL notice points at. */
  openSource: () => void;
  /** e.g. "3 entries, last on 2026-08-16", or "No problems recorded". */
  diagnostics: string;
  /** Hands the problem log to the share sheet. Nothing leaves the device first. */
  shareDiagnostics: () => void;
  clearDiagnostics: () => void;
};

function aboutInfo(): AboutInfo {
  const extra = Constants.expoConfig?.extra ?? {};
  const core = (extra.core ?? {}) as { commit?: string; version?: string };
  return {
    appVersion: Constants.expoConfig?.version ?? '0.0.0',
    buildNumber: Constants.expoConfig?.ios?.buildNumber ?? '',
    coreCommit: core.commit ?? 'unknown',
    coreVersion: core.version ?? 'unknown',
    sourceUrl: typeof extra.sourceUrl === 'string' ? extra.sourceUrl : '',
  };
}

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

  const about = aboutInfo();
  const [diagnostics, setDiagnostics] = useState(() => diagnosticsSummary(readDiagnostics()));

  const openSource = useCallback(() => {
    if (about.sourceUrl !== '') {
      void Linking.openURL(about.sourceUrl);
    }
  }, [about.sourceUrl]);

  const shareDiagnostics = useCallback(() => {
    void (async () => {
      const log = readDiagnostics();
      if (log.trim() === '') {
        Alert.alert('Nothing to share', 'No problems have been recorded on this device.');
        return;
      }
      // Copied under a name that says what it is, because the name is what the
      // receiving app shows.
      const target = new File(Paths.cache, 'subsurface-problems.txt');
      if (target.exists) {
        target.delete();
      }
      target.create();
      target.write(log);
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Problem log', log);
        return;
      }
      await Sharing.shareAsync(target.uri, {
        UTI: 'public.plain-text',
        mimeType: 'text/plain',
        dialogTitle: 'Share problem log',
      });
    })();
  }, []);

  const clear = useCallback(() => {
    clearDiagnostics();
    setDiagnostics(diagnosticsSummary(''));
  }, []);

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
    about,
    openSource,
    diagnostics,
    shareDiagnostics,
    clearDiagnostics: clear,
  };
}
