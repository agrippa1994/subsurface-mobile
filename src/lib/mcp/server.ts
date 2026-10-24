// AI-generated (Claude)
// The MCP server the user can switch on in Settings: the http-server module's
// listener, answered by the protocol handler in src/models/mcp over the loaded
// logbook.
//
// Module state rather than React state, because the server outlives every
// screen: it keeps answering while the user browses dives. Settings reads it
// through `useMcpServer`.
//
// It is never started on its own - not at launch, not from a saved preference.
// It is a server without authentication, so it runs only after the user has
// asked for it in this session. iOS suspends the app in the background and
// takes the listening socket with it; if that happens while the server is
// switched on, it is started again when the app comes back to the foreground.

import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { startServer } from '../../../modules/http-server/src';
import {
  exportDiveCSV,
  getDive,
  getStatistics,
  listDives,
  listDiveSites,
} from '../../../modules/ssrf-core/src';
import { recordProblem } from '@/lib/diagnostics';
import { toNativePath } from '@/lib/logbook-file';
import { queryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { MCP_DEFAULT_PORT } from '@/models/mcp/address';
import { createMcpHandler } from '@/models/mcp/protocol';
import type { McpLogbook } from '@/models/mcp/tools';
import { DEFAULT_SETTINGS, type Settings } from '@/models/settings';
import { ensureLogbookLoaded } from '@/queries/logbook';

export type McpServerState =
  | { status: 'stopped'; error: string | null }
  | { status: 'starting' }
  | { status: 'running'; port: number };

let state: McpServerState = { status: 'stopped', error: null };
/** Whether the user has the switch on. Distinct from `state`: the socket can die under it. */
let enabled = false;
let stopListener: (() => Promise<void>) | null = null;
const listeners = new Set<() => void>();

function setState(next: McpServerState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

/**
 * The tools' view of the logbook: the ssrf-core module, behind the load the
 * rest of the app waits on too. Ids are only valid once it has finished.
 */
const logbook: McpLogbook = {
  async listDives() {
    await ensureLogbookLoaded(queryClient);
    return listDives();
  },
  async getDive(id) {
    await ensureLogbookLoaded(queryClient);
    return getDive(id);
  },
  async listDiveSites() {
    await ensureLogbookLoaded(queryClient);
    return listDiveSites();
  },
  async getStatistics(filter) {
    await ensureLogbookLoaded(queryClient);
    return getStatistics(filter);
  },
  async exportDiveCsv(id, options) {
    await ensureLogbookLoaded(queryClient);
    // The core writes CSV to a path only; the file is read back and dropped.
    const target = new File(Paths.cache, `mcp-dive-${id}-${options.format}.csv`);
    try {
      if (target.exists) {
        target.delete();
      }
      exportDiveCSV(id, toNativePath(target.uri), options);
      return target.textSync();
    } finally {
      if (target.exists) {
        target.delete();
      }
    }
  },
  gradientFactors() {
    const settings = queryClient.getQueryData<Settings>(queryKeys.settings()) ?? DEFAULT_SETTINGS;
    return { gfLow: settings.gfLow, gfHigh: settings.gfHigh };
  },
};

const handler = createMcpHandler(logbook, {
  name: 'subsurface-mobile',
  title: 'Subsurface',
  version: Constants.expoConfig?.version ?? '0.0.0',
});

async function listen(): Promise<void> {
  setState({ status: 'starting' });
  const onStop = (error: string | null) => {
    stopListener = null;
    if (error) {
      recordProblem('mcp-server', new Error(error));
    }
    setState({ status: 'stopped', error });
  };
  try {
    let server;
    try {
      server = await startServer(MCP_DEFAULT_PORT, handler, onStop);
    } catch {
      // Taken by something else (or by a socket of ours not yet released):
      // any port beats none; the URL on screen says which.
      server = await startServer(0, handler, onStop);
    }
    if (!enabled) {
      await server.stop();
      setState({ status: 'stopped', error: null });
      return;
    }
    stopListener = server.stop;
    setState({ status: 'running', port: server.port });
  } catch (error) {
    enabled = false;
    setState({ status: 'stopped', error: error instanceof Error ? error.message : String(error) });
  }
}

export function startMcpServer(): void {
  // Switched on already - unless the socket died under it, which the switch
  // shows as off, so turning it on again has to listen again.
  if (enabled && state.status !== 'stopped') {
    return;
  }
  enabled = true;
  void listen();
}

export function stopMcpServer(): void {
  enabled = false;
  const stop = stopListener;
  stopListener = null;
  setState({ status: 'stopped', error: null });
  void stop?.();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Back in the foreground with the switch on but no listener: the system took
// the socket while the app was suspended.
AppState.addEventListener('change', (next) => {
  if (next === 'active' && enabled && state.status === 'stopped') {
    void listen();
  }
});

export function useMcpServer(): McpServerState {
  return useSyncExternalStore(subscribe, () => state);
}
