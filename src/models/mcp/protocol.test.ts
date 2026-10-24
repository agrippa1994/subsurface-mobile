// AI-generated (Claude)
// The HTTP and JSON-RPC side of the MCP server, against a stub logbook. The
// tools themselves run against the real core in tests/mcp-server.test.ts.

import { describe, expect, it } from 'vitest';

import type { HttpRequest } from '../../../modules/http-server/src/HttpServer.types';
import { createMcpHandler, PROTOCOL_VERSIONS } from './protocol';
import { MCP_TOOLS, type McpLogbook } from './tools';

const stub: McpLogbook = {
  listDives: () => [],
  getDive: () => {
    throw new Error('No dive with id 1');
  },
  listDiveSites: () => [],
  getStatistics: () => {
    throw new Error('not used');
  },
  exportDiveCsv: () => '',
  gradientFactors: () => ({ gfLow: 30, gfHigh: 75 }),
};

const handler = createMcpHandler(stub, { name: 'test', title: 'Test', version: '1.0.0' });

function request(overrides: Partial<HttpRequest> = {}): HttpRequest {
  return {
    id: '1',
    method: 'POST',
    path: '/mcp',
    headers: { host: '192.168.1.20:8765', 'content-type': 'application/json' },
    body: '',
    ...overrides,
  };
}

async function rpc(message: unknown) {
  const response = await handler(request({ body: JSON.stringify(message) }));
  return { ...response, json: response.body ? JSON.parse(response.body) : undefined };
}

describe('MCP over HTTP', () => {
  it('negotiates the protocol version and announces tools', async () => {
    const reply = await rpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'c', version: '1' },
      },
    });
    expect(reply.status).toBe(200);
    expect(reply.contentType).toBe('application/json');
    expect(reply.json).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'test', version: '1.0.0' },
      },
    });
  });

  it('offers its newest version to a client asking for one it does not know', async () => {
    const reply = await rpc({
      jsonrpc: '2.0',
      id: 'a',
      method: 'initialize',
      params: { protocolVersion: '1999-01-01' },
    });
    expect(reply.json.result.protocolVersion).toBe(PROTOCOL_VERSIONS[0]);
  });

  it('acknowledges notifications with 202 and no body', async () => {
    const reply = await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' });
    expect(reply.status).toBe(202);
    expect(reply.body).toBeUndefined();
  });

  it('lists every tool as read-only with an object schema', async () => {
    const reply = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const tools = reply.json.result.tools as {
      name: string;
      inputSchema: { type: string };
      annotations: { readOnlyHint: boolean };
    }[];
    expect(tools.map((tool) => tool.name)).toEqual(MCP_TOOLS.map((tool) => tool.name));
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.annotations.readOnlyHint).toBe(true);
    }
  });

  it('answers ping, and unknown methods with -32601', async () => {
    expect((await rpc({ jsonrpc: '2.0', id: 3, method: 'ping' })).json.result).toEqual({});
    expect((await rpc({ jsonrpc: '2.0', id: 4, method: 'sampling/nope' })).json.error.code).toBe(
      -32601,
    );
  });

  it('reports a failing tool in the result, so the model can correct the call', async () => {
    const failing = await rpc({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'get_dive', arguments: { id: 1 } },
    });
    expect(failing.json.result).toEqual({
      content: [{ type: 'text', text: 'No dive with id 1' }],
      isError: true,
    });

    const badArgs = await rpc({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: { name: 'list_dives', arguments: { from: 'last tuesday' } },
    });
    expect(badArgs.json.result.isError).toBe(true);
    expect(badArgs.json.result.content[0].text).toMatch(/^Invalid arguments: "from"/);
  });

  it('rejects an unknown tool as invalid params', async () => {
    const reply = await rpc({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: { name: 'drop_logbook', arguments: {} },
    });
    expect(reply.json.error.code).toBe(-32602);
  });

  it('answers a batch with the replies to its requests only', async () => {
    const reply = await rpc([
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 8, method: 'ping' },
    ]);
    expect(reply.json).toEqual([{ jsonrpc: '2.0', id: 8, result: {} }]);
  });

  it('turns away what is not a JSON-RPC POST to /mcp', async () => {
    expect((await handler(request({ method: 'GET' }))).status).toBe(405);
    expect((await handler(request({ method: 'DELETE' }))).status).toBe(405);
    expect((await handler(request({ path: '/' }))).status).toBe(404);
    expect(
      (await handler(request({ headers: { host: 'x', 'content-type': 'text/plain' }, body: '{}' })))
        .status,
    ).toBe(415);
    const garbage = await handler(request({ body: '{nope' }));
    expect(garbage.status).toBe(400);
    expect(JSON.parse(garbage.body ?? '').error.code).toBe(-32700);
  });

  it('accepts a query string and a trailing slash on the endpoint', async () => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'ping' });
    expect((await handler(request({ path: '/mcp/?x=1', body }))).status).toBe(200);
  });

  it('refuses requests from a web page on another origin', async () => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 10, method: 'ping' });
    const foreign = await handler(
      request({
        body,
        headers: {
          host: '192.168.1.20:8765',
          'content-type': 'application/json',
          origin: 'https://evil.example',
        },
      }),
    );
    expect(foreign.status).toBe(403);

    const sameOrigin = await handler(
      request({
        body,
        headers: {
          host: '192.168.1.20:8765',
          'content-type': 'application/json',
          origin: 'http://192.168.1.20:8765',
        },
      }),
    );
    expect(sameOrigin.status).toBe(200);
  });
});
