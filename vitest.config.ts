// AI-generated (Claude)
// vitest runs in Node, not in React Native: the tests cover the pure TypeScript
// model layer plus the C++ bindings through the host driver (see
// tests/harness/ssrf-host.ts). Nothing here imports React Native.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    // One process per file keeps each test file's divelog isolated, and the
    // golden files are large enough that the parse dominates anyway.
    fileParallelism: true,
    testTimeout: 120000,
    hookTimeout: 120000,
  },
});
