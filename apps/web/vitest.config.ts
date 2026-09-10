import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['app/**/*.test.ts', 'lib/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, '.'),
      'server-only': path.resolve(__dirname, 'testing/server-only-shim.ts'),
    },
  },
});
