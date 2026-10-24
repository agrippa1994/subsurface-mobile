// AI-generated (Claude)
// The Settings section of the MCP server (src/lib/mcp/server.ts): the switch,
// where the server stands, and a URL to copy for every address it can be
// reached on.

import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { networkAddresses } from '../../../modules/http-server/src';
import { operationSucceeded } from '@/lib/haptics';
import { startMcpServer, stopMcpServer, useMcpServer } from '@/lib/mcp/server';
import {
  labelAddresses,
  mcpUrl,
  type AddressKind,
  type LabelledAddress,
} from '@/models/mcp/address';
import { mcpStatusLabel } from '@/models/mcp/status';

export type McpUrl = {
  /** What the address is on: "Wi-Fi", "VPN" (Tailscale and the like), ... */
  kind: AddressKind;
  /** e.g. `http://192.168.1.20:8765/mcp`. */
  url: string;
};

export type McpSection = {
  /** The switch: on unless the server is off. */
  on: boolean;
  setOn: (on: boolean) => void;
  /** e.g. "Off", "Starting...", "Running", or what went wrong. */
  status: string;
  /** One per device address while running, Wi-Fi first; empty otherwise. */
  urls: McpUrl[];
  /** Copies one of `urls`; `copied` names it for a moment afterwards, for its button label. */
  copyUrl: (url: string) => void;
  copied: string | null;
};

/** How often the addresses are re-read while the section is on screen. */
const ADDRESS_POLL_MS = 5000;

/** Identity of an address list, so an unchanged poll keeps the same state. */
function addressKey(addresses: readonly LabelledAddress[]): string {
  return addresses.map((entry) => `${entry.kind}:${entry.address}`).join(',');
}

/**
 * The addresses, re-read every few seconds while the server runs and on every
 * return to the foreground: joining another Wi-Fi or bringing a VPN up changes
 * them without the app ever leaving the foreground.
 */
function useAddresses(running: boolean): LabelledAddress[] {
  const [addresses, setAddresses] = useState<LabelledAddress[]>([]);

  useEffect(() => {
    if (!running) {
      return;
    }
    const read = () => {
      const next = labelAddresses(networkAddresses());
      setAddresses((current) => (addressKey(current) === addressKey(next) ? current : next));
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

  return addresses;
}

export function useMcpSection(): McpSection {
  const server = useMcpServer();
  const addresses = useAddresses(server.status === 'running');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (copied === null) {
      return;
    }
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  // Addresses from a previous run are never shown: no URLs unless running.
  const urls = useMemo(
    () =>
      server.status === 'running'
        ? addresses.map((entry) => ({ kind: entry.kind, url: mcpUrl(entry.address, server.port) }))
        : [],
    [server, addresses],
  );

  const setOn = useCallback((on: boolean) => (on ? startMcpServer() : stopMcpServer()), []);

  const copyUrl = useCallback((url: string) => {
    void Clipboard.setStringAsync(url).then(() => {
      operationSucceeded();
      setCopied(url);
    });
  }, []);

  return {
    on: server.status !== 'off',
    setOn,
    status: mcpStatusLabel(server, urls.length),
    urls,
    copyUrl,
    copied,
  };
}
