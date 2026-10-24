// AI-generated (Claude)
// Public TypeScript API of the http-server native module: a plain HTTP/1.1
// listener on the local network whose every response is written by JS. The
// native side (ios/HttpServerModule.swift, android/.../HttpServerModule.kt)
// only reads requests and writes responses; one request per connection.
import HttpServerModule from './HttpServerModule';
import type { HttpRequest, HttpResponse, NetworkAddress } from './HttpServer.types';

export * from './HttpServer.types';

/**
 * Starts listening on `port` (0: any free port) and resolves with the port
 * bound. A running listener is stopped first. Each request reaches `handler`,
 * whose answer is sent back; a handler that throws answers 500, and one that
 * takes over a minute is answered 504 by the native side.
 */
export async function startServer(
  port: number,
  handler: (request: HttpRequest) => HttpResponse | Promise<HttpResponse>,
  onStop: (error: string | null) => void,
): Promise<{ port: number; stop: () => Promise<void> }> {
  const requests = HttpServerModule.addListener('onRequest', (request) => {
    void (async () => {
      let response: HttpResponse;
      try {
        response = await handler(request);
      } catch (error) {
        response = {
          status: 500,
          contentType: 'text/plain',
          body: `${error instanceof Error ? error.message : String(error)}\n`,
        };
      }
      HttpServerModule.respond(
        request.id,
        response.status,
        response.contentType ?? 'text/plain',
        response.body ?? '',
      );
    })();
  });
  const stops = HttpServerModule.addListener('onStop', ({ error }) => {
    requests.remove();
    stops.remove();
    onStop(error);
  });

  try {
    const bound = await HttpServerModule.start(port);
    return {
      port: bound,
      stop: async () => {
        requests.remove();
        stops.remove();
        await HttpServerModule.stop();
      },
    };
  } catch (error) {
    requests.remove();
    stops.remove();
    throw error;
  }
}

/** The device's IPv4 addresses, loopback excluded. */
export function networkAddresses(): NetworkAddress[] {
  return HttpServerModule.addresses();
}
