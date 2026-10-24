// AI-generated (Claude)
// Public TypeScript API of the http-server native module: a plain HTTP/1.1
// listener on the local network whose every response is written by JS. The
// native side (ios/HttpServerModule.swift, android/.../HttpServerModule.kt)
// only reads requests and writes responses; one request per connection.
import HttpServerModule from './HttpServerModule';
import type { HttpRequest, HttpResponse, NetworkAddress } from './HttpServer.types';

export * from './HttpServer.types';

/**
 * The native module holds one listener, and starting replaces it. Each start
 * takes a generation; events and `stop` act only for the current one, so a
 * start that has been superseded can neither answer requests nor stop the
 * listener that replaced it.
 */
let generation = 0;

/**
 * Starts listening on `port` (0: any free port) and resolves with the port
 * bound. A running listener is replaced. Each request reaches `handler`,
 * whose answer is sent back; a handler that throws answers 500, and one that
 * takes over a minute is answered 504 by the native side.
 */
export async function startServer(
  port: number,
  handler: (request: HttpRequest) => HttpResponse | Promise<HttpResponse>,
  onStop: (error: string | null) => void,
): Promise<{ port: number; stop: () => Promise<void> }> {
  const mine = ++generation;
  const requests = HttpServerModule.addListener('onRequest', (request) => {
    if (mine !== generation) {
      return;
    }
    void (async () => {
      let response: HttpResponse;
      try {
        response = await handler(request);
      } catch (error) {
        response = {
          status: 500,
          headers: { 'Content-Type': 'text/plain' },
          body: `${error instanceof Error ? error.message : String(error)}\n`,
        };
      }
      HttpServerModule.respond(
        request.id,
        response.status,
        response.headers ?? {},
        response.body ?? '',
      );
    })();
  });
  const release = () => {
    requests.remove();
    stops.remove();
  };
  const stops = HttpServerModule.addListener('onStop', ({ error }) => {
    release();
    if (mine === generation) {
      onStop(error);
    }
  });

  try {
    const bound = await HttpServerModule.start(port);
    return {
      port: bound,
      stop: async () => {
        release();
        if (mine === generation) {
          await HttpServerModule.stop();
        }
      },
    };
  } catch (error) {
    release();
    throw error;
  }
}

/** The device's IPv4 addresses, loopback excluded. */
export function networkAddresses(): NetworkAddress[] {
  return HttpServerModule.addresses();
}
