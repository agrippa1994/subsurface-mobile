// AI-generated (Claude)
import { describe, expect, it } from 'vitest';

import { labelAddresses, mcpUrl } from './address';

describe('labelAddresses', () => {
  it('keeps every interface, VPN and cellular included, Wi-Fi first', () => {
    const labelled = labelAddresses([
      { name: 'pdp_ip0', address: '10.12.0.4' },
      { name: 'utun3', address: '100.101.102.103' },
      { name: 'en2', address: '169.254.10.1' },
      { name: 'bridge100', address: '172.20.10.1' },
      { name: 'en0', address: '192.168.1.20' },
    ]);
    expect(labelled.map(({ kind, address }) => [kind, address])).toEqual([
      ['Wi-Fi', '192.168.1.20'],
      ['VPN', '100.101.102.103'],
      ['Hotspot', '172.20.10.1'],
      ['Cellular', '10.12.0.4'],
    ]);
  });

  it('knows the Android names, Tailscale included', () => {
    const labelled = labelAddresses([
      { name: 'rmnet_data0', address: '100.70.1.2' },
      { name: 'tailscale0', address: '100.64.3.4' },
      { name: 'wlan0', address: '10.0.0.15' },
    ]);
    expect(labelled.map((entry) => entry.kind)).toEqual(['Wi-Fi', 'VPN', 'Cellular']);
  });

  it('calls an unknown interface with a Tailscale address a VPN', () => {
    expect(labelAddresses([{ name: 'foo0', address: '100.88.1.1' }])[0].kind).toBe('VPN');
    expect(labelAddresses([{ name: 'foo0', address: '192.168.0.9' }])[0].kind).toBe('Other');
  });

  it('lists an address once', () => {
    const labelled = labelAddresses([
      { name: 'en0', address: '192.168.1.20' },
      { name: 'en0', address: '192.168.1.20' },
    ]);
    expect(labelled).toHaveLength(1);
  });
});

describe('mcpUrl', () => {
  it('points at the MCP endpoint', () => {
    expect(mcpUrl('192.168.1.20', 8765)).toBe('http://192.168.1.20:8765/mcp');
  });
});
