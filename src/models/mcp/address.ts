// AI-generated (Claude)
// The addresses the MCP server's URLs are shown with. The listener binds every
// interface, so each of the device's addresses is a URL a client might use:
// Wi-Fi from the same network, a VPN address (Tailscale and the like) from
// anywhere on the tailnet. Settings lists them all, labelled, best first.

import type { NetworkAddress } from '../../../modules/http-server/src/HttpServer.types';
import { MCP_PATH } from './protocol';

/** The port the server asks for first, so the URL stays the same between runs. */
export const MCP_DEFAULT_PORT = 8765;

export type AddressKind = 'Wi-Fi' | 'Ethernet' | 'VPN' | 'Hotspot' | 'Cellular' | 'Other';

export type LabelledAddress = NetworkAddress & { kind: AddressKind };

/** Interface name patterns, in the order the kinds are listed. */
const KINDS: readonly [AddressKind, RegExp][] = [
  // en0 on iOS, wlan0 on Android.
  ['Wi-Fi', /^(en0|wlan\d+)$/],
  ['Ethernet', /^(eth\d+|en\d+)$/],
  // iOS puts every VPN on a utun; Android names Tailscale's tailscale0.
  ['VPN', /^(utun|ipsec|tun|ppp|tailscale|wg)/],
  ['Hotspot', /^(bridge\d+|ap\d+|swlan\d+)$/],
  ['Cellular', /^(pdp_ip|rmnet|ccmni)/],
];

/** 100.64.0.0/10, where Tailscale hands out addresses. */
function isCgnat(address: string): boolean {
  const [a, b] = address.split('.').map(Number);
  return a === 100 && b >= 64 && b <= 127;
}

function kindOf(entry: NetworkAddress): AddressKind {
  const match = KINDS.find(([, pattern]) => pattern.test(entry.name));
  if (match) {
    return match[0];
  }
  return isCgnat(entry.address) ? 'VPN' : 'Other';
}

/**
 * Every address a client could reach the server on, labelled and ordered by
 * kind (Wi-Fi first, cellular last). Only link-local addresses are dropped -
 * they are what an interface has before it got a real one - and duplicates.
 */
export function labelAddresses(addresses: readonly NetworkAddress[]): LabelledAddress[] {
  const order = (kind: AddressKind) => {
    const index = KINDS.findIndex(([name]) => name === kind);
    return index < 0 ? KINDS.length : index;
  };
  const seen = new Set<string>();
  return addresses
    .filter((entry) => !entry.address.startsWith('169.254.'))
    .filter((entry) => !seen.has(entry.address) && Boolean(seen.add(entry.address)))
    .map((entry, index) => ({ entry: { ...entry, kind: kindOf(entry) }, index }))
    .sort((a, b) => order(a.entry.kind) - order(b.entry.kind) || a.index - b.index)
    .map(({ entry }) => entry);
}

export function mcpUrl(address: string, port: number): string {
  return `http://${address}:${port}${MCP_PATH}`;
}
