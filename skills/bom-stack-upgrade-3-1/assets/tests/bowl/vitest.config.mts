import { defineNodeConfig } from '@websolutespa/test/vitest';

export default defineNodeConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
    // payload init seeds the in-memory database
    hookTimeout: 5 * 60_000,
    // the full app config with seed (images, sharp) exceeds the default heap in the vitest 5 module runner
    execArgv: ['--max-old-space-size=8192'],
    env: {
      // in-memory database, no mongo required
      BOM_DB: process.env.BOM_DB || 'memory',
    },
  },
});
