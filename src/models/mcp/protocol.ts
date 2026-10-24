// AI-generated (Claude)
// The Model Context Protocol over HTTP, as the MCP server in Settings speaks it.
//
// This is the "Streamable HTTP" transport reduced to what a read-only tool
// server needs: every JSON-RPC request is a POST, answered with a single JSON
// body (the transport allows that in place of an event stream), notifications
// get 202, and GET - the optional server-to-client stream - is 405. There are no
// sessions: nothing a client does changes what the next request sees.
//
// No authentication, by design: the server runs only while the user has it
// switched on, on the local network. What is checked is what keeps a web page
// out: a browser can reach a LAN address too, so a request carrying a foreign
// Origin is refused, and only `application/json` bodies are accepted - which a
// page cannot send cross-origin without a CORS preflight this server never
// approves.
//
// Pure TypeScript; the native listener (modules/http-server) only moves bytes.

import type { HttpRequest, HttpResponse } from '../../../modules/http-server/src/HttpServer.types';
import { MCP_TOOLS, ToolArgumentError, type McpLogbook, type McpTool } from './tools';

/** Newest first. The newest is offered to a client asking for anything else. */
export const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

export const MCP_PATH = '/mcp';

export type ServerInfo = { name: string; title: string; version: string };

type JsonRpcId = string | number | null;

type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: JsonRpcId; result: unknown }
  | { jsonrpc: '2.0'; id: JsonRpcId; error: { code: number; message: string } };

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

const INSTRUCTIONS =
  'Read-only access to the Subsurface dive logbook on this phone. Start with list_dives or ' +
  'get_statistics; get_dive has notes, cylinders and weights; export_dive_csv returns the ' +
  'computed profile of a dive. Times are the local time of the dive. Values are metric; the ' +
  'unit is in each field name.';

function rpcError(id: JsonRpcId, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function json(status: number, body: unknown): HttpResponse {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The host part of a `Host` header or an origin URL, port and brackets kept. */
function hostOf(value: string): string {
  return value
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

export type McpHandler = (request: HttpRequest) => Promise<HttpResponse>;

export function createMcpHandler(
  logbook: McpLogbook,
  info: ServerInfo,
  tools: readonly McpTool[] = MCP_TOOLS,
): McpHandler {
  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  async function callTool(params: Record<string, unknown>): Promise<unknown> {
    const name = params.name;
    const tool = typeof name === 'string' ? byName.get(name) : undefined;
    if (!tool) {
      throw Object.assign(new Error(`Unknown tool: ${String(name)}`), { code: INVALID_PARAMS });
    }
    const args = params.arguments ?? {};
    if (typeof args !== 'object' || Array.isArray(args)) {
      throw Object.assign(new Error('"arguments" must be an object'), { code: INVALID_PARAMS });
    }
    try {
      const result = await tool.run(args as Record<string, unknown>, logbook);
      if (result.text !== undefined) {
        return { content: [{ type: 'text', text: result.text }] };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(result.data) }],
        structuredContent: result.data,
      };
    } catch (error) {
      // Reported in the result, not as a protocol error, so the model sees
      // what went wrong and can correct the call.
      const prefix = error instanceof ToolArgumentError ? 'Invalid arguments: ' : '';
      return { content: [{ type: 'text', text: prefix + errorMessage(error) }], isError: true };
    }
  }

  async function dispatch(method: string, params: Record<string, unknown>): Promise<unknown> {
    switch (method) {
      case 'initialize': {
        const requested = params.protocolVersion;
        return {
          protocolVersion:
            typeof requested === 'string' && PROTOCOL_VERSIONS.includes(requested)
              ? requested
              : PROTOCOL_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: info,
          instructions: INSTRUCTIONS,
        };
      }
      case 'ping':
        return {};
      case 'tools/list':
        return {
          tools: tools.map((tool) => ({
            name: tool.name,
            title: tool.title,
            description: tool.description,
            inputSchema: tool.inputSchema,
            ...(tool.annotations ? { annotations: tool.annotations } : {}),
          })),
        };
      case 'tools/call':
        return callTool(params);
      // Offered by many clients regardless of capabilities; empty is correct.
      case 'resources/list':
        return { resources: [] };
      case 'prompts/list':
        return { prompts: [] };
      default:
        throw Object.assign(new Error(`Method not found: ${method}`), { code: METHOD_NOT_FOUND });
    }
  }

  /** One JSON-RPC message; null for a notification or a response, which get no reply. */
  async function handleMessage(message: unknown): Promise<JsonRpcResponse | null> {
    if (typeof message !== 'object' || message === null || Array.isArray(message)) {
      return rpcError(null, INVALID_REQUEST, 'Expected a JSON-RPC object');
    }
    const { id, method, params } = message as Record<string, unknown>;
    if (typeof method !== 'string') {
      // A response to a server request - this server sends none - or garbage.
      return 'id' in message ? null : rpcError(null, INVALID_REQUEST, 'Missing "method"');
    }
    const isNotification = !('id' in message);
    if (isNotification) {
      return null;
    }
    const requestId: JsonRpcId = typeof id === 'string' || typeof id === 'number' ? id : null;
    if (
      params !== undefined &&
      (typeof params !== 'object' || params === null || Array.isArray(params))
    ) {
      return rpcError(requestId, INVALID_PARAMS, '"params" must be an object');
    }
    try {
      const result = await dispatch(method, (params ?? {}) as Record<string, unknown>);
      return { jsonrpc: '2.0', id: requestId, result };
    } catch (error) {
      const code = (error as { code?: number }).code ?? INTERNAL_ERROR;
      return rpcError(requestId, code, errorMessage(error));
    }
  }

  return async (request) => {
    const path = request.path.split('?')[0];
    if (path !== MCP_PATH && path !== `${MCP_PATH}/`) {
      return {
        status: 404,
        contentType: 'text/plain',
        body: `Not found. The MCP endpoint is ${MCP_PATH}\n`,
      };
    }

    const origin = request.headers.origin;
    if (origin && origin !== 'null' && hostOf(origin) !== hostOf(request.headers.host ?? '')) {
      return {
        status: 403,
        contentType: 'text/plain',
        body: 'Cross-origin requests are not allowed\n',
      };
    }

    // GET would open a server-to-client stream and DELETE end a session; this
    // server has neither.
    if (request.method !== 'POST') {
      return { status: 405 };
    }

    const contentType = (request.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    if (contentType !== 'application/json') {
      return { status: 415, contentType: 'text/plain', body: 'Send application/json\n' };
    }

    let payload: unknown;
    try {
      payload = JSON.parse(request.body);
    } catch {
      return json(400, rpcError(null, PARSE_ERROR, 'Parse error'));
    }

    // Batches were part of protocol 2025-03-26; older clients may still send them.
    if (Array.isArray(payload)) {
      if (payload.length === 0) {
        return json(400, rpcError(null, INVALID_REQUEST, 'Empty batch'));
      }
      const replies: JsonRpcResponse[] = [];
      for (const message of payload) {
        const reply = await handleMessage(message);
        if (reply) {
          replies.push(reply);
        }
      }
      return replies.length > 0 ? json(200, replies) : { status: 202 };
    }

    const reply = await handleMessage(payload);
    return reply ? json(200, reply) : { status: 202 };
  };
}
