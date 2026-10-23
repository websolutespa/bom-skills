# Phase 6: tests (Vitest 5 only, optional Playwright smoke tests)

From 3.1, **Vitest is the only unit and integration runner**. Jest is gone, Playwright is used for e2e only, and `@websolutespa/test` no longer exports Jest presets.

## 1. Replace every vitest config with the shared factories

`@websolutespa/test/vitest` exports three factories. Each one takes an optional config that is deep-merged over the defaults.

| Factory | Environment | Use for |
|---|---|---|
| `defineNodeConfig()` | node | libraries, server code, Bowl int tests, packages whose tests don't touch the DOM |
| `defineDomConfig()` | jsdom, plus `@testing-library/jest-dom` matchers and cleanup | React components and hooks |
| `definePayloadConfig()` | node, `BOM_TEST_DB` (`memory` by default), 5-minute hook timeout | Payload plugin suites built with `@websolutespa/test/payload` |

All three include `@vitejs/plugin-react`, native tsconfig `paths` resolution (Vite 8), 30-second test and hook timeouts, and exclude `dist/` and `.next/`. Don't use jsdom for suites that call the Payload REST API, because jsdom breaks it.

Mixer packages (`ui`, `emails`, `llm-plugin`, …):

```diff
-import react from '@vitejs/plugin-react';
-import tsconfigPaths from 'vite-tsconfig-paths';
-import { defineConfig } from 'vitest/config';
-
-export default defineConfig(() => {
-  return {
-    plugins: [tsconfigPaths(), react()],
-    test: {
-      environment: 'node', // 'jsdom' breaks rest api
-      hookTimeout: 2000_000,
-      ...
-    },
-    onConsoleLog(...) { ... },
-  };
-});
+import { defineNodeConfig } from '@websolutespa/test/vitest';
+
+export default defineNodeConfig();
```

Use `defineDomConfig()` instead if the package renders components in its tests.

Bowl app (`src/bowl/payload/vitest.config.mts`):

```diff
-import { defineConfig } from 'vitest/config';
-import react from '@vitejs/plugin-react';
-import tsconfigPaths from 'vite-tsconfig-paths';
+import { defineNodeConfig } from '@websolutespa/test/vitest';

-export default defineConfig({
-  plugins: [tsconfigPaths(), react()],
+export default defineNodeConfig({
   test: {
-    environment: 'jsdom',
     setupFiles: ['./vitest.setup.ts'],
     include: ['tests/int/**/*.int.spec.ts'],
+    // payload init seeds the in-memory database
+    hookTimeout: 5 * 60_000,
+    // the full app config with seed (images, sharp) exceeds the default heap in the vitest 5 module runner
+    execArgv: ['--max-old-space-size=8192'],
+    env: {
+      // in-memory database, no mongo required
+      BOM_DB: process.env.BOM_DB || 'memory',
+    },
   },
 });
```

Drop the `env.BOM_DB` block if you skipped the memory database (payload-3-91.md §5). The int tests then need a reachable MongoDB.

Bowl app int test: the samples ship `tests/int/api.int.spec.ts` ([assets/tests/bowl/tests/int/api.int.spec.ts](../assets/tests/bowl/tests/int/api.int.spec.ts)). It boots the full config and runs a `find` on `users`. Delete the placeholder `src/__tests/example.test.ts`, as well as any `src/__tests/startup.e2e.test.ts` in the Bowl app: those were Playwright files sitting where Vitest looked for tests.

Mixer web (`src/mixer/web`): it ran Jest before. Replace `"test:integration": "jest"` with `"test:integration": "vitest run"`, delete `jest.config.*`, `jest.setup.*` and `jest.mock*.js`, and add `vitest.config.ts`. Keep `*.e2e.test.ts` out of it, because those belong to Playwright:

```ts
import { defineNodeConfig } from '@websolutespa/test/vitest';

export default defineNodeConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // playwright e2e tests, see test-e2e
    exclude: ['src/**/*.e2e.test.{ts,tsx}'],
  },
});
```

## 2. Test files: explicit vitest imports, no Jest API

The factories don't enable `globals`. Every test file must import what it uses:

```diff
-import '@testing-library/jest-dom';
+import { describe, expect, it } from 'vitest';
```

These replacements cover the Jest API:

- `jest.fn`, `jest.spyOn`, `jest.mock`, `jest.useFakeTimers`, `jest.resetModules`, `jest.resetAllMocks` → `vi.*`
- `jest.requireActual` → `await vi.importActual`
- `@testing-library/jest-dom` → nothing extra with `defineDomConfig()`, or `@testing-library/jest-dom/vitest` in a custom setup file
- `jest-styled-components` snapshot serializers → assert computed styles directly, or drop the snapshot

Gate: `git grep -niE "\bjest\b" -- ':!**/CHANGELOG.md' ':!**/package-lock.json'` finds nothing in source, config or `package.json` files.

## 3. Optional: Playwright smoke tests (recommended)

The samples ship two smoke suites that catch most upgrade regressions in a few minutes. Copy them from [assets/tests/](../assets/tests/) and adapt the marked spots.

**Bowl admin**: needs `@playwright/test` 1.64.1 and, ideally, `BOM_DB=memory`. Copy these files to `src/bowl/payload/`:

- `playwright.config.ts`. It starts `npm run dev` on port 4000 with `BOM_DB=memory`, waits for `<basePath>/api/access`, and runs a single worker, because the suite shares one in-memory database.
- `tests/e2e/helpers.ts`, which provides:
  - `login()`: creates the first user on an empty database;
  - `api(page)`: REST calls that send `Origin`, as the Payload 3.90 CSRF check requires;
  - `trackErrors()`: collects page errors and 5xx responses;
  - `getNavRoutes()`.
- `tests/e2e/admin.e2e.spec.ts`. It logs in, opens **every** navigation route and checks that there is no error, no 5xx and no not-found page. It then creates a `label` doc and localizes it through the `payload-plugin-localization` modal.

What to adapt:

- In `login()`, the `#field-roles` / `admin` option assumes the bowl `users` collection with a `roles` select. Change it if the project's first-user form is different.
- The localized-modal test needs the bowl `label` collection with a localized `text` field, and the `it` and `en` locales. Adapt the locales, or remove the test if the project doesn't use `payload-plugin-localization`.
- `basePath` defaults to `/bowl` (`PAYLOAD_PUBLIC_BASE_PATH`).
- The admin keeps the last-used locale as a user preference, so the tests open `?locale=en` explicitly.
- Hydration errors in `next dev` are recorded as annotations, not failures.

Run it with `npm run test:e2e`. The first route compiles slowly in dev, so timeouts are generous.

**Mixer web homepage**: copy `playwright.config.ts` (port 3000, `npm run dev`) and `src/__tests/startup.e2e.test.ts` to `src/mixer/web/`. The test opens `/` on the mock store and checks four things: status below 400, a non-empty title, a non-empty body, and no page errors. It needs no Bowl instance and no `.env.local`.

Add `test-results` and `playwright-report` to `.gitignore` (tooling.md), then run `npx playwright install chromium` once per machine.

Run one Playwright suite at a time: the Bowl dev server and the web dev server use fixed ports.

## 4. Known environment issue

MongoMemoryReplSet (`BOM_TEST_DB=mongo`) doesn't start on Windows. Use the memory database locally, and run the mongo variant in Linux CI.

## Verification

```bash
npx turbo run test
cd src/bowl/payload && npm run test:e2e      # if adopted
cd src/mixer/web && npx playwright test      # if adopted
```
