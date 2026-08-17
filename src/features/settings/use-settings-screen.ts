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
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Linking } from 'react-native';

import { useTransfer, type Transfer } from '@/features/transfer/use-transfer';
import { clearDiagnostics, readDiagnostics } from '@/lib/diagnostics';
import { operationFailed, operationSucceeded, warned } from '@/lib/haptics';
import { groupDivesByTrip, NO_TRIP_LABEL } from '@/models/dive-list';
import { describeError } from '@/models/errors';
import { diagnosticsSummary } from '@/models/diagnostics';
import type { AboutInfo } from '@/models/about';
import {
  resetLogbook,
  sampleSuuntoPath,
  sampleSuuntoXmlPath,
  writeScratchFile,
} from '@/lib/logbook-file';
import type { UnitSystem } from '@/models';
import { useDives, useLogbook, useSites } from '@/queries/logbook';
import {
  useImportFile,
  useLoadPath,
  useReloadLogbook,
  useUngroupDives,
} from '@/queries/logbook-mutations';
import { useSsiAccount, useSsiSiteIndexInfo } from '@/queries/ssi';
import {
  useGfSeries,
  useGradientFactors,
  useSetGfSeries,
  useSetGradientFactors,
  useSetUnitSystem,
  useUnitSystem,
} from '@/queries/settings';

const EMPTY_LOGBOOK = "<divelog program='subsurface' version='3'>\n  <dives/>\n</divelog>\n";
const MALFORMED_LOGBOOK = 'this is not a logbook\n';

export type SettingsScreen = {
  /** Import and export (task 11), so the screen has one object to render from. */
  transfer: Transfer;
  unitSystem: UnitSystem;
  setUnitSystem: (system: UnitSystem) => void;
  /** Buehlmann gradient factors, in percent, the profile ceiling is computed with. */
  gfLow: number;
  gfHigh: number;
  /** Both setters clamp to GF_RANGE and keep gfLow <= gfHigh. */
  setGfLow: (percent: number) => void;
  setGfHigh: (percent: number) => void;
  /**
   * Whether the profile draws the two gradient factor curves. Display only: the
   * core computes both for every plot regardless, so neither costs a recompute.
   */
  showGfNow: boolean;
  showGfSurface: boolean;
  setShowGfNow: (show: boolean) => void;
  setShowGfSurface: (show: boolean) => void;
  diveCount: number;
  siteCount: number;
  logbookPath: string | null;
  /** Reloads the working logbook from disk. */
  reload: () => void;
  /** Deletes the working logbook and seeds it from the bundled sample again. */
  restoreSample: () => void;
  /**
   * Takes every dive out of its trip, after confirming. Trips a build that
   * still autogrouped wrote into the logbook cannot be told from ones the user
   * made in desktop Subsurface (see api.cpp, ungroup_dives), so this removes
   * all of them and says so before it does.
   */
  ungroupDives: () => void;
  /** Trips in the loaded log, so the row can say what would be removed. */
  tripCount: number;
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

  /** The SSI section: an account elsewhere, so a status and a way in. */
  ssi: {
    /** The signed-in email, or null. */
    account: string | null;
    /** e.g. "36,281 sites" or "Not downloaded". */
    siteCatalogue: string;
    /** Pushes the account screen, where signing in actually happens. */
    open: () => void;
  };

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
  const unitSystem = useUnitSystem();
  const setUnitSystem = useSetUnitSystem();
  const { gfLow, gfHigh } = useGradientFactors();
  const setGradientFactors = useSetGradientFactors();

  // Raising gf low past gf high pushes gf high along with it, and lowering gf
  // high pulls gf low down, so a stepper never lands on an inverted pair.
  const setGfLow = useCallback(
    (percent: number) => setGradientFactors({ gfLow: percent, gfHigh }),
    [gfHigh, setGradientFactors],
  );

  const setGfHigh = useCallback(
    (percent: number) => setGradientFactors({ gfLow: Math.min(gfLow, percent), gfHigh: percent }),
    [gfLow, setGradientFactors],
  );
  const { showGfNow, showGfSurface } = useGfSeries();
  const setGfSeries = useSetGfSeries();

  const setShowGfNow = useCallback(
    (show: boolean) => setGfSeries({ showGfNow: show }),
    [setGfSeries],
  );

  const setShowGfSurface = useCallback(
    (show: boolean) => setGfSeries({ showGfSurface: show }),
    [setGfSeries],
  );

  const { data: dives = [] } = useDives();
  const { data: sites = [] } = useSites();
  const path = useLogbook().data?.path ?? null;
  const reloadLogbook = useReloadLogbook();
  const loadPath = useLoadPath();
  const importSuuntoFile = useImportFile();
  const ungroupInLog = useUngroupDives();
  // A trip reaches the app only as its location string, so the count is taken
  // off the same sections the dive list shows rather than from the module.
  const tripCount = useMemo(
    () => groupDivesByTrip(dives).filter((section) => section.title !== NO_TRIP_LABEL).length,
    [dives],
  );

  const reload = useCallback(() => {
    reloadLogbook.mutate();
  }, [reloadLogbook]);

  const restoreSample = useCallback(() => {
    resetLogbook();
    reloadLogbook.mutate();
  }, [reloadLogbook]);

  const ungroupDives = useCallback(() => {
    if (tripCount === 0) {
      Alert.alert('No trips', 'None of the dives in this logbook are in a trip.');
      return;
    }
    warned();
    Alert.alert(
      'Ungroup all dives',
      `This removes ${tripCount === 1 ? 'the trip' : `all ${tripCount} trips`} from the logbook ` +
        'and leaves the dives themselves untouched. Trips made in desktop Subsurface go too - ' +
        'a saved logbook does not record which trips were generated.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Ungroup',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await ungroupInLog.mutateAsync();
                operationSucceeded();
              } catch (error) {
                operationFailed();
                Alert.alert('Could not ungroup', describeError(error).message);
              }
            })();
          },
        },
      ],
    );
  }, [tripCount, ungroupInLog]);

  const loadEmptyLogbook = useCallback(() => {
    loadPath.mutate(writeScratchFile('empty-logbook.ssrf', EMPTY_LOGBOOK));
  }, [loadPath]);

  const loadMalformedLogbook = useCallback(() => {
    loadPath.mutate(writeScratchFile('malformed-logbook.ssrf', MALFORMED_LOGBOOK));
  }, [loadPath]);

  // The sample paths resolve an asset, which is the one asynchronous step; a
  // failure to find it is reported rather than left as a floating rejection.
  const importSample = useCallback(
    (resolve: () => Promise<string>) => {
      void resolve()
        .then((path) => importSuuntoFile.mutateAsync(path))
        .catch((error: unknown) => {
          operationFailed();
          Alert.alert('Import failed', describeError(error).message);
        });
    },
    [importSuuntoFile],
  );

  const importSuuntoSample = useCallback(
    () => importSample(sampleSuuntoPath),
    [importSample],
  );

  const importSuuntoXmlSample = useCallback(
    () => importSample(sampleSuuntoXmlPath),
    [importSample],
  );

  // SSI is an account on someone else's server, so Settings only reports what
  // the app has - the signing in is a screen of its own.
  const ssiAccount = useSsiAccount();
  const ssiSites = useSsiSiteIndexInfo();
  const router = useRouter();
  const openSsi = useCallback(() => router.push('/settings/ssi'), [router]);
  const ssi = useMemo(
    () => ({
      account: ssiAccount.data?.email ?? null,
      siteCatalogue:
        (ssiSites.data?.count ?? 0) === 0
          ? 'Not downloaded'
          : `${(ssiSites.data?.count ?? 0).toLocaleString()} sites`,
      open: openSsi,
    }),
    [ssiAccount.data, ssiSites.data, openSsi],
  );

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
    gfLow,
    gfHigh,
    setGfLow,
    setGfHigh,
    showGfNow,
    showGfSurface,
    setShowGfNow,
    setShowGfSurface,
    diveCount: dives.length,
    siteCount: sites.length,
    logbookPath: path,
    reload,
    restoreSample,
    ungroupDives,
    tripCount,
    loadEmptyLogbook,
    loadMalformedLogbook,
    importSuuntoSample,
    importSuuntoXmlSample,
    ssi,
    about,
    openSource,
    diagnostics,
    shareDiagnostics,
    clearDiagnostics: clear,
  };
}
