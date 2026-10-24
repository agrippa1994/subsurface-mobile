// AI-generated (Claude)
// Everything the Settings screen does, minus the rendering, so the iOS and the
// portable variant of the screen cannot drift apart.

import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AppState, Linking } from 'react-native';

import { networkAddresses } from '../../../modules/http-server/src';

import { useGitSyncRunner } from '@/features/git/use-git-sync-runner';
import { useTransfer, type Transfer } from '@/features/transfer/use-transfer';
import { clearDiagnostics, readDiagnostics } from '@/lib/diagnostics';
import { startMcpServer, stopMcpServer, useMcpServer } from '@/lib/mcp/server';
import { operationFailed, operationSucceeded, warned } from '@/lib/haptics';
import { groupDivesByTrip, NO_TRIP_LABEL } from '@/models/dive-list';
import { describeError } from '@/models/errors';
import { diagnosticsSummary } from '@/models/diagnostics';
import {
  labelAddresses,
  mcpUrl,
  type AddressKind,
  type LabelledAddress,
} from '@/models/mcp/address';
import type { AboutInfo } from '@/models/about';
import type { UnitSystem } from '@/models';
import { useDives, useSites } from '@/queries/logbook';
import { useUngroupDives } from '@/queries/logbook-mutations';
import { useGitKey, useGitSyncConfig } from '@/queries/git-sync';
import { useSsiAccount, useSsiSiteIndexInfo } from '@/queries/ssi';
import {
  useGfSeries,
  useGradientFactors,
  useSetGfSeries,
  useSetGradientFactors,
  useSetUnitSystem,
  useUnitSystem,
} from '@/queries/settings';

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
  /**
   * Takes every dive out of its trip, after confirming. Trips a build that
   * still autogrouped wrote into the logbook cannot be told from ones the user
   * made in desktop Subsurface (see api.cpp, ungroup_dives), so this removes
   * all of them and says so before it does.
   */
  ungroupDives: () => void;
  /** Trips in the loaded log, so the row can say what would be removed. */
  tripCount: number;

  /** The SSI section: an account elsewhere, so a status and a way in. */
  ssi: {
    /** The signed-in email, or null. */
    account: string | null;
    /** e.g. "36,281 sites" or "Not downloaded". */
    siteCatalogue: string;
    /** Pushes the account screen, where signing in actually happens. */
    open: () => void;
  };

  /** The git sync section: a status, a sync button and a way to set it up. */
  git: {
    /** e.g. "git@github.com:you/logbook.git", or "Not set up". */
    repository: string;
    /** e.g. "Today, 14:02", "Never", or what is missing before a sync can run. */
    lastSync: string;
    /** Whether a URL and a key are both there, so "Sync now" can work. */
    ready: boolean;
    busy: boolean;
    sync: () => void;
    open: () => void;
  };

  /** The MCP server: a switch, where it stands, and its URL to copy. */
  mcp: McpSection;

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

export type McpUrl = {
  /** What the address is on: "Wi-Fi", "VPN" (Tailscale and the like), ... */
  kind: AddressKind;
  /** e.g. `http://192.168.1.20:8765/mcp`. */
  url: string;
};

export type McpSection = {
  /** The switch: on while the server runs or is starting. */
  on: boolean;
  setOn: (on: boolean) => void;
  /** e.g. "Off", "Starting...", "Running", or why it stopped. */
  status: string;
  /** One per device address while running, Wi-Fi first; empty otherwise. */
  urls: McpUrl[];
  /** Copies one of `urls`; `copied` names it for a moment afterwards, for its button label. */
  copyUrl: (url: string) => void;
  copied: string | null;
};

/** How often the addresses are re-read while the section is on screen. */
const ADDRESS_POLL_MS = 5000;

/**
 * The Settings section of the MCP server (src/lib/mcp/server.ts). The URLs are
 * built from the device's addresses, re-read every few seconds while the
 * server runs: joining another Wi-Fi or bringing a VPN up changes them without
 * the app ever leaving the foreground.
 */
function useMcpSection(): McpSection {
  const server = useMcpServer();
  const [addresses, setAddresses] = useState<LabelledAddress[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const running = server.status === 'running';

  useEffect(() => {
    // Stale addresses left over from a previous run are never shown: `urls`
    // below is empty unless the server runs.
    if (!running) {
      return;
    }
    const read = () => {
      const next = labelAddresses(networkAddresses());
      // Same list, same state object, so an unchanged poll renders nothing.
      setAddresses((current) =>
        JSON.stringify(current) === JSON.stringify(next) ? current : next,
      );
    };
    read();
    const timer = setInterval(read, ADDRESS_POLL_MS);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        read();
      }
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [running]);

  useEffect(() => {
    if (copied === null) {
      return;
    }
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const urls = useMemo(
    () =>
      server.status === 'running'
        ? addresses.map((entry) => ({ kind: entry.kind, url: mcpUrl(entry.address, server.port) }))
        : [],
    [server, addresses],
  );

  const status =
    server.status === 'running'
      ? urls.length > 0
        ? 'Running'
        : 'Running, no network'
      : server.status === 'starting'
        ? 'Starting...'
        : server.error
          ? `Stopped: ${server.error}`
          : 'Off';

  const setOn = useCallback((on: boolean) => (on ? startMcpServer() : stopMcpServer()), []);

  const copyUrl = useCallback((url: string) => {
    void Clipboard.setStringAsync(url).then(() => {
      operationSucceeded();
      setCopied(url);
    });
  }, []);

  return { on: server.status !== 'stopped', setOn, status, urls, copyUrl, copied };
}

const lastSyncFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

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
  const ungroupInLog = useUngroupDives();
  // A trip reaches the app only as its location string, so the count is taken
  // off the same sections the dive list shows rather than from the module.
  const tripCount = useMemo(
    () => groupDivesByTrip(dives).filter((section) => section.title !== NO_TRIP_LABEL).length,
    [dives],
  );

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

  // Git sync is set up on a screen of its own; Settings shows where it stands
  // and offers the one action people use daily.
  const gitConfig = useGitSyncConfig();
  const gitKey = useGitKey();
  const gitRunner = useGitSyncRunner();
  const openGit = useCallback(() => router.push('/settings/git'), [router]);
  const git = useMemo(() => {
    const hasKey = gitKey.data != null;
    const configured = gitConfig.url !== '';
    return {
      repository: configured ? gitConfig.url : 'Not set up',
      lastSync: !configured
        ? 'Not set up'
        : !hasKey
          ? 'No SSH key'
          : gitConfig.lastSyncAt === null
            ? 'Never'
            : lastSyncFormatter.format(gitConfig.lastSyncAt),
      ready: configured && hasKey,
      busy: gitRunner.busy,
      sync: () => gitRunner.run('sync'),
      open: openGit,
    };
  }, [gitConfig, gitKey.data, gitRunner, openGit]);

  const mcp = useMcpSection();

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
    ungroupDives,
    tripCount,
    ssi,
    git,
    mcp,
    about,
    openSource,
    diagnostics,
    shareDiagnostics,
    clearDiagnostics: clear,
  };
}
