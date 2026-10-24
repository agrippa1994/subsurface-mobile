// AI-generated (Claude)
import { NativeModule, requireNativeModule } from 'expo';

import type { HttpRequest, NetworkAddress } from './HttpServer.types';

type HttpServerEvents = {
  onRequest(request: HttpRequest): void;
  /** The listener died on its own - the network went away, the app was suspended. */
  onStop(event: { error: string | null }): void;
};

declare class HttpServerModule extends NativeModule<HttpServerEvents> {
  start(port: number): Promise<number>;
  stop(): Promise<void>;
  respond(id: string, status: number, headers: Record<string, string>, body: string): void;
  addresses(): NetworkAddress[];
}

export default requireNativeModule<HttpServerModule>('HttpServer');
