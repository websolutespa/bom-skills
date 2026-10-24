import { next } from '@websolutespa/oxc/oxlint';
import { defineConfig } from 'oxlint';

/**
 * Request data (`headers()`, `cookies()`, `draftMode()`, the `searchParams` prop) is read in the template files
 * under `src/app` only and passed down as values. A helper, lib, block or component that reads it itself makes
 * every page that uses it dynamic, or fails with `DYNAMIC_SERVER_USAGE` (HTTP 500) on static/ISR pages while
 * `next build` still reports them as static.
 * The shared presets report every rule as a warning (editor and `pnpm lint`); it cannot fail a build.
 */
const requestData = {
  paths: [
    {
      name: 'next/headers',
      message:
        'Read headers(), cookies() and draftMode() in the page, layout or route handler under src/app and pass the value to this function as an argument.',
    },
  ],
};

// not a turborepo: the shared preset's turbo plugin (undeclared env vars) does not apply
const { 'turbo/no-undeclared-env-vars': _turbo, ...rules } = next.rules;

export default defineConfig({
  ...next,
  jsPlugins: [],
  rules: { ...rules, 'no-restricted-imports': ['warn', requestData] },
  overrides: [
    ...next.overrides,
    {
      // the templates read request data, the tests mock it
      files: ['src/app/**', 'src/**/*.test.ts', 'src/**/*.test.tsx', 'src/__tests__/**'],
      rules: { 'no-restricted-imports': 'off' },
    },
  ],
});
