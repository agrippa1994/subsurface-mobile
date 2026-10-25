// AI-generated (Claude)
// The library owns SSI's wire protocol; the app handles business refusals and
// persists sessions in SecureStore. Clients are per-call so signing out cannot
// leave an authenticated singleton behind.

import { createClient, DivessiHttpError, type ApiResponse } from 'divessi-client';

export function createSsiClient(token?: string) {
  return createClient({ token, metadata: { lang: 'eng' } });
}

export class SsiApiError extends Error {
  readonly unauthenticated: boolean;

  constructor(message: string, unauthenticated: boolean) {
    super(message);
    this.name = 'SsiApiError';
    this.unauthenticated = unauthenticated;
  }
}

/** SSI returns authentication refusals with HTTP 200, not just HTTP errors. */
export async function ssiData<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  let data: T;
  try {
    ({ data } = await request);
  } catch (error) {
    if (error instanceof DivessiHttpError) {
      throw new SsiApiError(`SSI returned HTTP ${error.status}.`, false);
    }
    throw error;
  }

  if (
    data !== null &&
    typeof data === 'object' &&
    'authenticated' in data &&
    data.authenticated === false
  ) {
    const body = data as Record<string, unknown>;
    for (const key of ['error_message', 'message', 'authenticated_message']) {
      const message = body[key];
      if (typeof message === 'string' && message.trim() !== '') {
        throw new SsiApiError(message.trim(), true);
      }
    }
    throw new SsiApiError('SSI refused the request.', true);
  }
  return data;
}
