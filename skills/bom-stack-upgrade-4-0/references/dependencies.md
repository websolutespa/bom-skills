# Dependencies (phase A2)

Target: the versions of bom-sample on `4.0.0-next.8`. Change them all in one commit, then regenerate the lockfile with `corepack pnpm install`.

## `@websolutespa/*`: one release line

Every `@websolutespa/*` dependency, devDependency and peerDependency moves to `^4.0.0-next.8` at the same time. A 4.x project never mixes 3.x and 4.x packages: their peer ranges don't match prereleases.

| Package | Where | Note |
|---|---|---|
| `bom-core`, `bom-next`, `bom-mixer-image` | dependencies | |
| `payload-plugin-bowl`, `payload-plugin-*`, `payload-utils` | dependencies | every Bowl plugin the config uses |
| `payload-db-memory` | dependencies | the `mock` store strategy (`memoryAdapter`) |
| `oxc` | devDependencies | **new**: oxlint and oxfmt configs (phases A5, A6) |
| `test` | devDependencies | **new if missing**: Vitest configs (phase A4) |
| `tsconfig` | devDependencies | |
| `eslint-config` | devDependencies | **removed** in phase A5 (ESLint goes) |

Packages outside the release line (e.g. `@websolutespa/bom-pilot`) keep their own versions.

## Next.js and Payload

| Package | Version |
|---|---|
| `next`, `@next/env`, `@next/bundle-analyzer` (if used) | `16.4.2` |
| `payload` and **every** `@payloadcms/*` | `3.91.0` (exactly the same version: Payload refuses to start on a mismatch) |
| `react`, `react-dom` | `19.2.x` (bom-sample stays on 19.2.3; the 4.x peers accept `^19.2.1`) |

**Every `@payloadcms/*` package a plugin peers on must be a direct dependency at `3.91.0`.** A missing one is auto-installed at the newest version (e.g. `@payloadcms/richtext-slate@3.92.0`) and Payload stops at start with `Mismatching "payload" dependency versions`.

## `schema-dts` 2.1.0

`schema-dts` is a **peer dependency** (`^2.1.0`) of `@websolutespa/bom-next`, `bom-mixer-models`, `bom-mixer-ui` and `bom-mixer-hooks`: their public types (`IMetaData`, structured data) use it. A project on 1.x gets two incompatible copies and `TS2321: Excessive stack depth comparing types` in structured-data components. Set `"schema-dts": "2.1.0"`.

## Tooling versions (phases A1, A3–A6)

| Package | Version |
|---|---|
| `packageManager` | `pnpm@11.28.8` |
| `@types/node` | `24.19.2` |
| `typescript` | `6.0.3` |
| `vitest` | `5.0.5` |
| `@playwright/test` | `1.64.1` (remove `playwright` and `playwright-core` if listed) |
| `@testing-library/react` | `16.3.3` |
| `jsdom` | `26.1.0` (devDependencies). It also satisfies the `jsdom` peer of `@websolutespa/payload-utils`: jsdom 30 requires the ESM-only `@exodus/bytes` and fails with `ERR_REQUIRE_ESM` on Vercel. Remove a `jsdom` entry from `pnpm-workspace.yaml` `overrides`; it is no longer needed from `4.0.0-next.8`. |
| `oxlint` / `oxlint-tsgolint` / `oxfmt` | `1.89.0` / `7.0.2005` / `0.74.0` |
| removed | `eslint`, `eslint-config-next`, `@websolutespa/eslint-config`, `prettier`, `@vitejs/plugin-react`, `vite-tsconfig-paths` |

## Regenerate the Payload files

After the install, regenerate and commit the generated files:

```sh
pnpm run generate   # payload generate:types + generate:importmap
```

4.x adds fields: pages gain `isProtected` and `publicRedirect`, the Locale global `code` and `title`. MongoDB needs no migration; a SQL adapter needs `payload migrate:create`.

## Check

- `corepack pnpm install --frozen-lockfile` passes.
- `pnpm why next` lists a single `next@16.4.2` for the app (dev tools such as `@react-email/preview-server` may pin their own: they run as separate processes).
- `pnpm peers check`: no unmet peer of `@websolutespa/*`, `next`, `payload`, `react`.
- `grep -c richtext-slate pnpm-lock.yaml` is 0 unless the project uses the Slate editor itself.
