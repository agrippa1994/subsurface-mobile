// AI-generated (Claude)
// A web page cannot listen on a port; every call fails loudly, like the other
// modules' web stubs.
const unavailable = () => {
  throw new Error('The HTTP server is not available on web');
};

export default {
  start: () => Promise.reject(new Error('The HTTP server is not available on web')),
  stop: () => Promise.resolve(),
  respond: unavailable,
  addresses: () => [],
  addListener: () => ({ remove: () => undefined }),
};
