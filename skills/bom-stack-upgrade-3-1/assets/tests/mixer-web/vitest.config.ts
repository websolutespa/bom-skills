import { defineNodeConfig } from '@websolutespa/test/vitest';

export default defineNodeConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // playwright e2e tests, see test-e2e
    exclude: ['src/**/*.e2e.test.{ts,tsx}'],
  },
});
