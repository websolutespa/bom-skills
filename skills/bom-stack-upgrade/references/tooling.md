# Tooling migration (ESLint, TypeScript, vitest, turbo, Docker)

## ESLint: `.eslintrc.cjs` → flat `eslint.config.js`

Delete every `.eslintrc.cjs` (and any `eslint-config-websolute`
dependency/reference) and add a flat config per app/package:

Root (`eslint.config.js`):
```js
import { base } from '@websolutespa/eslint-config/base';
import { defineConfig } from 'eslint/config';

/** @type {import("eslint").Linter.Config} */
export default defineConfig(base, {
  rules: {
    // project-specific overrides, keep minimal
  },
});
```

Next.js apps (Bowl and Mixer web — `eslint.config.js`):
```js
import { next } from '@websolutespa/eslint-config/next';
import { defineConfig } from 'eslint/config';

/** @type {import("eslint").Linter.Config} */
export default defineConfig(next);
```

Shared UI/model/icon packages: same `next` or `base` preset depending on
whether the package ships React components (`next`) or plain TS (`base`).

Also add `eslint-config-next` as a devDependency alongside `eslint@9.x` on
apps using the `next` preset (peer requirement of Next's own eslint plugin).

## TypeScript: tsconfig extends + path aliases

Payload/Next.js apps: change `extends` from `@websolutespa/tsconfig/tsreact.json`
or `tsnext.json` to `@websolutespa/tsconfig/next.json`, and align `include`/
`exclude`/`compilerOptions` with the Next.js App Router conventions:

```jsonc
{
  "extends": "@websolutespa/tsconfig/next.json",
  "include": [
    ".next/types/**/*.ts",
    "**/*.ts",
    "**/*.tsx",
    "next-env.d.ts",
    "next.config.ts"
  ],
  "exclude": ["node_modules"],
  "compilerOptions": {
    "baseUrl": ".",
    "declaration": false,
    "declarationMap": false,
    "paths": {
      "@/*": ["./src/*"],
      // Bowl (Payload) app only:
      "@payload-config": ["./src/payload.config.ts"]
    }
  }
}
```

Notes:
- Drop `outDir`/`rootDir`/`module: "commonjs"` and any `ts-node` block — the
  Payload config is executed by Next.js now, not `ts-node`/`swc-node`.
- The `@/*` alias must resolve to the app's own `src/` and is required by the
  Payload admin `importMap` convention (phase: custom-components.md) and by
  generated `@/payload-types` type imports.
- Shared packages (non-Next) keep a simpler tsconfig but should still extend
  the corresponding `@websolutespa/tsconfig/*.json` v3 preset name (check
  what the package actually needs — React component packages typically still
  need JSX + DOM lib, drop `ts-node`/`tsup` specific fields since there is no
  longer a build step for source-only packages).

## Test runner: Jest → Vitest

- Delete `jest.config.ts`, `jest.setup.js`, and any `jest.mock*.js`.
- Add `vitest.config.mts` (or `.ts`) and a `vitest.setup.ts` where the app
  previously had a jest setup file (jsdom polyfills, testing-library setup).
- Update `package.json` scripts:
  - `"test:integration": "vitest run --config ./vitest.config.mts"` (adjust
    path/extension to match what you created).
  - `"test-watch": "vitest"`.
  - Keep Playwright e2e scripts, just bump the Playwright version
    (`@playwright/test`, `playwright`, `playwright-core`).
- Add devDependencies as needed: `vitest`, `@vitejs/plugin-react` (React
  packages), `vite-tsconfig-paths`, `jsdom` (if DOM APIs are exercised),
  `@testing-library/react` (already a dep on Next 19/React 19 compatible
  version).

## `turbo.json`

- Bump `turbo` devDependency to 2.x; the pipeline schema key may need
  updating (`pipeline` → `tasks` depending on the Turbo version already
  targeted — check the installed major and adjust the top-level key
  accordingly).
- Add task entries for any new scripts introduced by the migration:
  `generate` (Payload's `generate:types`/`generate:importmap`), `types`
  (`tsc --noemit`).
- Rename any `--scope=<pkg>` usages in root scripts to `--filter=<pkg>`.

## Docker / infra (only if the repo builds Docker images)

- Bowl's Dockerfile typically switches to a Next.js **standalone** output
  build (`next.config.ts` → `output: 'standalone'`), copying
  `.next/standalone` + `.next/static` + `public` into the final image, and
  the start command becomes `node .next/standalone/<path-to-app>/server.js`
  instead of `node dist/server.js`.
- Mixer's Dockerfile: bump the Node base image to match the new
  `engines.node` requirement; no structural change otherwise (Next.js
  frontend build/start commands stay conceptually the same, just add
  `--turbopack` to dev/build scripts if the reference migration's approach
  is adopted).
- Add any new compose file / env vars introduced by the Payload 3 database
  variable rename (see payload-config.md — `DATABASE_URL` replaces
  `MONGODB_URI`) to `docker-compose*.yml` and `*.env` samples.

## Verification for this phase

```
npm install
npx eslint . --max-warnings=0   # or the app-level lint script
npx tsc --noemit                # or the app-level types/types:check script
```

Fix all new ESLint/type errors surfaced purely by the config swap before
moving to the next phase — don't mix "config migrated" with "code migrated"
errors; the latter are handled in later phases (payload-config,
custom-components, typescript-fixes).
