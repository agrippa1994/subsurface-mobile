// AI-generated (Claude)
// Shapes crossing the http-server module boundary. Kept apart from the module
// itself so the request handling in src/lib/mcp can be tested in Node.

/** One request, as the native listener read it. */
export type HttpRequest = {
  /** Opaque; pass it back to `respond`. */
  id: string;
  method: string;
  /** The request target, query string included. */
  path: string;
  /** Header names are lower-case. */
  headers: Record<string, string>;
  /** The body decoded as UTF-8; empty without one. */
  body: string;
};

export type HttpResponse = {
  status: number;
  /** Ignored when `body` is empty. */
  contentType?: string;
  body?: string;
};

/** An IPv4 address of one of the device's network interfaces. */
export type NetworkAddress = {
  /** e.g. `en0` (iOS Wi-Fi), `wlan0` (Android Wi-Fi). */
  name: string;
  address: string;
};
