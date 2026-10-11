// AI-generated (Claude)
// No git on web; every call fails loudly, like ssrf-core's web stub.
const unavailable = () => Promise.reject(new Error('git sync is not available on web'));

export default new Proxy({}, { get: () => unavailable });
