# Phase 1: dependencies

These are the target versions verified on the three bom samples. Pin exactly the versions listed here. They are a known-good set: Payload 3.91 needs `next >=16.3.3 <17`, and the `@websolutespa/*` 3.1 peer ranges are built around it.

Conventions in the samples, keep them:

- App and package `dependencies`/`devDependencies` use **exact** versions.
- The `peerDependencies` of shared packages under `src/mixer/packages/*` use **ranges**.
- Internal `@websolutespa/*` references use `^3.1.0`.
- Project packages reference each other as `"*"` (e.g. `"@basic/icons": "*"`).

## Runtime: `.nvmrc`, `engines`, Dockerfiles

| File | Before | After |
|---|---|---|
| `.nvmrc` | `v24.7.0` | `v24.22.1` |
| `engines.node` (root, Bowl app) | `>=23` | `>=22.13` |
| `src/bowl/Dockerfile`, `src/mixer/Dockerfile` | `FROM node:24.7.0 AS base` | `FROM node:24.22.1 AS base` |
| `src/bowl/payload/Dockerfile` | `FROM node:22.12.0-alpine AS base` | `FROM node:24.22.1-alpine AS base` |

Also update any CI workflow `node-version` and any other Docker/nixpacks files with a Node version.

## `@websolutespa/*`: every occurrence → `^3.1.0`

This applies to every `dependencies`, `devDependencies` and `peerDependencies` entry. All the packages were released together, so there is no reason to mix 3.0.x and 3.1.x.

## Root `package.json`

| Package | Before | After |
|---|---|---|
| `prettier` | 3.6.2 | 3.9.10 |
| `turbo` | 2.8.3 | 2.11.10 |
| `typescript` | 5.8.3 | 6.0.3 |
| `vitest` | 3.2.3 | 5.0.5 |

Scripts: the `rimraf` globs need `--glob` (rimraf 6), see tooling.md.

## Bowl app (`src/bowl/payload/package.json`)

**dependencies**

| Package | Before | After |
|---|---|---|
| `payload` | 3.74.0 | 3.91.0 |
| every `@payloadcms/*` (db-mongodb, email-nodemailer, next, plugin-cloud-storage, plugin-seo, richtext-lexical, richtext-slate, storage-azure/gcs/s3, ui) | 3.74.0 | 3.91.0 |
| `next` | 16.1.6 | 16.4.2 |
| `react`, `react-dom` | 19.2.3 | 19.2.9 |
| `cross-env` | 7.0.3 | 10.1.0 |
| `dotenv` | 16.4.7 | 18.0.8 |
| `graphql` | 16.8.1 | 16.8.1 (unchanged, pinned by Payload) |
| `sharp`, `redis` | — | unchanged |
| `@websolutespa/payload-db-memory` | — | `^3.1.0`, **optional**: only if you adopt `BOM_DB=memory` (testing.md) |

Remove these:

- `@payloadcms/payload-cloud`: not used by the samples. Keep it only if `payload.config.ts` imports `payloadCloudPlugin`.
- `nodemailer` and `@types/nodemailer`: `@payloadcms/email-nodemailer` 3.91 brings nodemailer 10. Keep them only if project code imports `nodemailer` directly, and then pin `nodemailer` to the same major as `@payloadcms/email-nodemailer`'s dependency (`npm ls nodemailer`). Drop `@types/nodemailer`, because nodemailer 10 ships its own types.
- `@next/env` in the Bowl app, if nothing imports it (`git grep "@next/env"`).
- Never add a direct `lexical` dependency. Payload 3.90+ refuses it; use `@payloadcms/richtext-lexical`.

**devDependencies**

| Package | Before | After |
|---|---|---|
| `@playwright/test` | 1.50.0 | 1.64.1 |
| `@types/node` | 22.19.8 | 24.19.2 |
| `@types/react` | 19.2.10 | 19.2.18 |
| `@types/react-dom` | 19.2.3 | 19.2.7 |
| `eslint` | 9.31.0 | 10.13.0 |
| `eslint-config-next` | 16.1.6 | 16.4.2 |
| `prettier` | 3.6.2 | 3.9.10 |
| `typescript` | 5.8.3 | 6.0.3 |
| `vitest` | 3.2.3 | 5.0.5 |
| `rimraf` | — | 6.1.3 (add it; the `clean` script uses it, don't rely on hoisting) |
| `@websolutespa/test` | — | `^3.1.0` (add it; it provides the vitest config factories) |

Remove `playwright`, `playwright-core`, `jsdom`, `@testing-library/react`, `@vitejs/plugin-react` and `vite-tsconfig-paths`:

- `@playwright/test` is the only Playwright package needed.
- `@websolutespa/test` bundles jsdom, testing-library and `@vitejs/plugin-react`.
- Vitest 5 resolves tsconfig paths natively.

## Mixer web app (`src/mixer/web/package.json`)

**dependencies**

| Package | Before | After |
|---|---|---|
| `next` | 16.1.6 | 16.4.2 |
| `payload`, `@payloadcms/live-preview` | 3.74.0 | 3.91.0 |
| `react`, `react-dom` | 19.2.3 | 19.2.9 |
| `react-error-boundary` | 4.1.2 | 6.1.6 |
| `iron-session` | 8.0.4 | 9.0.1 |
| `html-to-text` | 9.0.5 | 10.0.1 (`@types/html-to-text` stays 9.0.4) |
| `marked` (llm) | 12.0.2 | 18.1.1 |
| `sonner` (llm) | 2.0.7 | 2.0.8 |
| `uuid` (llm) | 9.0.1 | 14.0.3 |
| `fast-equals` (website) | ^4.0.1 | 6.2.1 |
| `styled-components`, `zustand`, `swiper`, `motion`, `lenis`, `@googlemaps/*` | — | **unchanged**, see held-back.md |

**devDependencies**

| Package | Before | After |
|---|---|---|
| `@next/bundle-analyzer` | 16.1.6 | 16.4.2 |
| `@next/env` | (implicit) | 16.4.2 (add it; `next.config.ts` imports it) |
| `@playwright/test` | — | 1.64.1 (add it if you adopt the homepage e2e test) |
| `@types/node` | 22.19.8 | 24.19.2 |
| `@types/react` / `@types/react-dom` | 19.2.10 / 19.2.3 | 19.2.18 / 19.2.7 |
| `eslint` / `eslint-config-next` | 9.31.0 / 16.1.6 | 10.13.0 / 16.4.2 |
| `rimraf` | 3.0.2 | 6.1.3 (needs `--glob`, see tooling.md) |
| `schema-dts` | 1.1.5 | 2.1.0 |
| `typescript` | 5.8.3 | 6.0.3 |
| `vitest` | — | 5.0.5 (replaces Jest for `test:integration`) |

Remove `raw-loader`, which isn't used, and every `jest*`, `@types/jest` and `@swc/jest` package.

## Mixer shared packages (`src/mixer/packages/*/package.json`)

**peerDependencies**: widen them to ranges.

| Package | Before | After |
|---|---|---|
| `next` | 16.1.6 | `^16.3.3` |
| `react`, `react-dom` | 19.2.3 | `^19.2.1` |
| `react-error-boundary` | 4.1.2 | `^6.1.6` |
| `iron-session` | 8.0.4 | `^9.0.1` |
| `marked` | 12.0.2 | `^18.1.1` |
| `sonner` | 2.0.7 | `^2.0.8` |
| `styled-components`, `zustand`, `motion`, `swiper`, `lenis`, `@ariakit/react` | — | unchanged (exact, held back) |

**devDependencies** use the same exact versions as the apps:

- `react`/`react-dom` 19.2.9, `@types/react` 19.2.18, `@types/react-dom` 19.2.7
- `eslint` 10.13.0, `typescript` 6.0.3, `vitest` 5.0.5 (where the package has tests)
- `react-error-boundary` 6.1.6, `marked` 18.1.1
- `@vitest/coverage-istanbul` 5.0.5, where a `coverage*` script uses `--coverage.provider=istanbul`

Also:

- Replace `svgo: "latest"` in the icons package with `4.0.0`. Never leave `latest`.
- Remove `raw-loader`, which isn't used.
- `emails` package: `@react-email/components` 0.0.20 → 1.0.12 and `@react-email/render` 0.0.16 → 2.1.1. These are needed for React 19, and they make `renderEmail` async (code-fixes.md).

### Declare what each package imports

Packages must not rely on npm hoisting. Every import and every script binary belongs in the `package.json` of the package that uses it. The samples needed these additions:

| Package | Added |
|---|---|
| `ui` (basic) | `dependencies.schema-dts` 2.1.0 (imported by `lazy/test-pagination`) |
| `ui` (website) | `dependencies.swiper` 11.2.10 |
| `emails` (website) | `@websolutespa/bom-mixer-auth` `^3.1.0`, as a peer and a dev dependency |
| `llm-plugin` (llm) | `dependencies.transliteration` 2.3.5 |

To find the rest, run `npx knip --no-progress` from the root. Every "unlisted dependency" it reports is a missing declaration. Its "unused" reports need a manual check before removing anything.

## After editing

```bash
npm install
npm ls payload next react --depth=0   # one version each, no "invalid"
```

The samples' `.npmrc` contains `legacy-peer-deps=true`, which hides peer conflicts, so check `npm ls` explicitly. One `invalid` line is expected and harmless: tsdown 0.21's optional `typescript ^5` peer (tsdown comes in through `@websolutespa/bom-cli`). Investigate any other.
