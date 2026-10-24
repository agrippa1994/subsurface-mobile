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
// takes the listening socket with it; the server is then `interrupted` - still
// switched on - and listens again when the app comes back to the foreground.

import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { startServer, type HttpRequest } from '../../../modules/http-server/src';
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

/**
 * The switch is on in every state but `off`. `error` on `off` is why a start
 * failed; on `interrupted`, why the running listener went away.
 */
export type McpServerState =
  | { status: 'off'; error: string | null }
  | { status: 'starting' }
  | { status: 'running'; port: number; stop: () => Promise<void> }
  | { status: 'interrupted'; error: string | null };

/**
 * The tools' view of the logbook: the ssrf-core module itself. Synchronous on
 * purpose - the handler below waits for the logbook once per request, after
 * which a whole tool call runs against one divelog with no reload in between.
 */
const logbook: McpLogbook = {
  listDives,
  getDive,
  listDiveSites,
  getStatistics,
  exportDiveCsv(id, options) {
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

const answer = createMcpHandler(logbook, {
  name: 'subsurface-mobile',
  title: 'Subsurface',
  version: Constants.expoConfig?.version ?? '0.0.0',
});

/** Dive ids are only valid once the logbook load the rest of the app waits on has finished. */
async function handler(request: HttpRequest) {
  await ensureLogbookLoaded(queryClient);
  return answer(request);
}

let state: McpServerState = { status: 'off', error: null };
/** Bumped by every start and stop, so a start that was overtaken drops its result. */
let attempt = 0;
const listeners = new Set<() => void>();

function setState(next: McpServerState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function listen(): Promise<void> {
  const mine = ++attempt;
  setState({ status: 'starting' });
  const onStop = (error: string | null) => {
    if (mine === attempt) {
      if (error) {
        recordProblem('mcp-server', new Error(error));
      }
      setState({ status: 'interrupted', error });
    }
  };
  try {
    // The fixed port keeps the URL the same between runs; when something else
    // holds it (or a socket of ours not yet released), any port beats none.
    const server = await startServer(MCP_DEFAULT_PORT, handler, onStop).catch(() =>
      startServer(0, handler, onStop),
    );
    if (mine !== attempt) {
      await server.stop();
      return;
    }
    setState({ status: 'running', port: server.port, stop: server.stop });
  } catch (error) {
    if (mine === attempt) {
      setState({ status: 'off', error: message(error) });
    }
  }
}

export function startMcpServer(): void {
  if (state.status === 'off' || state.status === 'interrupted') {
    void listen();
  }
}

export function stopMcpServer(): void {
  attempt++;
  const previous = state;
  setState({ status: 'off', error: null });
  if (previous.status === 'running') {
    void previous.stop();
  }
}

// Back in the foreground: the system may have taken the socket while the app
// was suspended.
AppState.addEventListener('change', (next) => {
  if (next === 'active' && state.status === 'interrupted') {
    void listen();
  }
});

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMcpServer(): McpServerState {
  return useSyncExternalStore(subscribe, () => state);
}
