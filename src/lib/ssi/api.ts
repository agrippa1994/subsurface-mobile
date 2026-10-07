// AI-generated (Claude)
// The SSI app API.
//
// Adapted from the ssi-log project (MIT), rewritten onto fetch: that app runs
// its calls server-side through axios because its token lives in an httpOnly
// cookie, and neither applies here.
//
// Unofficial and undocumented. Everything is one RPC endpoint with a `what=`
// parameter selecting the verb, and four constant parameters that identify the
// app build - SSI rejects requests without them, so they go on every call. Only
// four verbs are used: authenticate, get_user_data, get_divelog, save_divelog.

const BASE_URL = 'https://api.divessi.com';
const RPC_ENDPOINT = '/app/a21.php';

/** Identifies the client to SSI. Copied from the version ssi-log talks to. */
const CLIENT_PARAMS = {
  ssiapp: '0815_ADR',
  lang: 'en',
  version: 'ADR_4.1.268-ssi',
  context: 's',
};

/**
 * The User-Agent of the MySSI app, a Flutter app whose HTTP client (dio over
 * dart:io) sends Dart's default. Since 2026-10-07 SSI only stores a
 * `save_divelog` whose User-Agent is this one: any other is answered with a
 * success body carrying a made-up `odin_user_log_id`, and nothing is stored.
 * Reads are not filtered, but every call sends it so the client looks the same
 * throughout.
 */
const USER_AGENT = 'Dart/3.12 (dart:io)';

/**
 * The shape SSI answers with when the call is refused. It comes back with HTTP
 * 200 and this body rather than a status code, which is why every response is
 * inspected instead of only `response.ok`.
 */
export type SsiErrorBody = {
  authenticated: false;
  /**
   * The sentence meant for the diver. `false` rather than absent when there is
   * none, which is how SSI spells "no value" throughout its API.
   */
  error_message?: string | false;
  /** A machine token such as "not_valid". Never shown on its own. */
  authenticated_message?: string;
  message?: string;
  result?: string;
};

export class SsiApiError extends Error {
  /** True when the token is the problem, so the caller can re-authenticate. */
  readonly unauthenticated: boolean;

  constructor(message: string, unauthenticated: boolean) {
    super(message);
    this.name = 'SsiApiError';
    this.unauthenticated = unauthenticated;
  }
}

// --- Debug logging ---------------------------------------------------------
//
// SSI's API is undocumented and changes without notice, so in development every
// call is logged: verb, payload, HTTP status and (truncated) response body.
// Release builds log nothing. Secrets never reach the log: the password, email
// and session token are redacted from the URL, and a token in a response body
// (authenticate answers with one) is redacted too.

const SHOULD_LOG = typeof __DEV__ !== 'undefined' && __DEV__;
const SECRET_PARAMS = new Set(['p', 'l', 'token']);
const MAX_LOGGED_BODY = 4000;

function redactParams(params: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      SECRET_PARAMS.has(key) ? '<redacted>' : value,
    ]),
  );
}

function redactBody(text: string): string {
  const redacted = text.replace(/("token"\s*:\s*)"[^"]*"/g, '$1"<redacted>"');
  return redacted.length > MAX_LOGGED_BODY
    ? `${redacted.slice(0, MAX_LOGGED_BODY)}... (${redacted.length} chars)`
    : redacted;
}

function logRequest(method: string, params: Record<string, string>, payload?: unknown): void {
  if (!SHOULD_LOG) {
    return;
  }
  console.log(`[ssi] ${method} ${params.what ?? '?'}`, redactParams(params));
  if (payload !== undefined) {
    console.log(`[ssi] ${params.what ?? '?'} payload:`, JSON.stringify(payload, null, 2));
  }
}

function logResponse(params: Record<string, string>, response: Response, text: string): void {
  if (!SHOULD_LOG) {
    return;
  }
  console.log(
    `[ssi] ${params.what ?? '?'} -> HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`,
    redactBody(text),
  );
}

function logFailure(params: Record<string, string>, error: unknown): void {
  if (!SHOULD_LOG) {
    return;
  }
  console.warn(`[ssi] ${params.what ?? '?'} failed:`, error);
}

function rpcUrl(params: Record<string, string>): string {
  const query = new URLSearchParams({ ...CLIENT_PARAMS, ...params });
  return `${BASE_URL}${RPC_ENDPOINT}?${query.toString()}`;
}

/**
 * The most useful sentence in a refusal. `error_message` first: a failed
 * sign-in puts the explanation there and only the token "not_valid" in
 * `authenticated_message`, so the obvious-looking field is the wrong one.
 */
function messageOf(body: SsiErrorBody): string {
  const candidates = [body.error_message, body.message, body.authenticated_message];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim() !== '') {
      return candidate.trim();
    }
  }
  return 'SSI refused the request.';
}

/**
 * Turns a decoded body into the value or the error it stands for. A body
 * carrying `authenticated: false` is a refusal regardless of what else is in
 * it, and is the only signal SSI gives that a token has expired.
 */
function unwrap<T>(body: unknown): T {
  if (
    body !== null &&
    typeof body === 'object' &&
    'authenticated' in body &&
    (body as SsiErrorBody).authenticated === false
  ) {
    throw new SsiApiError(messageOf(body as SsiErrorBody), true);
  }
  return body as T;
}

async function decode<T>(params: Record<string, string>, response: Response): Promise<T> {
  const text = await response.text();
  logResponse(params, response, text);

  if (!response.ok) {
    throw new SsiApiError(`SSI returned HTTP ${response.status}.`, false);
  }

  try {
    return unwrap<T>(JSON.parse(text));
  } catch (caught) {
    if (caught instanceof SsiApiError) {
      throw caught;
    }
    throw new SsiApiError('SSI sent a response this app could not read.', false);
  }
}

export async function ssiGet<T>(params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  logRequest('GET', params);
  try {
    return await decode<T>(
      params,
      await fetch(rpcUrl(params), {
        method: 'GET',
        headers: { 'User-Agent': USER_AGENT },
        signal,
      }),
    );
  } catch (error) {
    logFailure(params, error);
    throw error;
  }
}

/**
 * A write. The body is not JSON: SSI wants a form-encoded request with the
 * whole payload in a single `json_data` field, and sending an application/json
 * body instead is accepted with an empty result.
 */
export async function ssiPost<T>(
  params: Record<string, string>,
  payload: unknown,
  signal?: AbortSignal,
): Promise<T> {
  logRequest('POST', params, payload);
  try {
    const response = await fetch(rpcUrl(params), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: `json_data=${encodeURIComponent(JSON.stringify(payload))}`,
      signal,
    });
    return await decode<T>(params, response);
  } catch (error) {
    logFailure(params, error);
    throw error;
  }
}
