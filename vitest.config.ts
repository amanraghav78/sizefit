import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // Vitest's worker pool intermittently fails to spawn on this machine
    // ("UNKNOWN spawn", errno -4094). The suite is fast enough that running
    // files serially costs little.
    fileParallelism: false,
    testTimeout: 300_000,
    hookTimeout: 300_000,
  },
});
