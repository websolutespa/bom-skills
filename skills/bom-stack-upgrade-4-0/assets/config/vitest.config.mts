import { defineDomConfig } from '@websolutespa/test/vitest';

// the shared bom vitest config: jsdom with the @testing-library/jest-dom matchers, react, the tsconfig
// paths, and @websolutespa/* compiled by vite like next compiles them
export default defineDomConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['src/**/*.e2e.test.ts'],
  },
});
