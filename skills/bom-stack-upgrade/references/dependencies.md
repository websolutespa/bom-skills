# Dependency upgrade matrix

Target baseline observed in a real bom-stack 2→3 migration (verify current
patch/minor via `npm view <pkg> version` before committing, since 3.x keeps
releasing — the **majors** below are what matters for compatibility, exact
patch pins are a "known-good" starting point).

## Core runtime

| Package | 2.x (before) | 3.x (after) |
|---|---|---|
| `payload` | `^2.28.0` | `3.74.0` |
| `next` | `^14.1.4` | `15.4.10` |
| `react` / `react-dom` | `^18.2.0` | `19.2.3` |
| `typescript` | `^5.4.5` | `5.8.3` |
| `eslint` | `^8.56.0` | `9.31.0` |

## Payload plugins — replace old `@payloadcms/*` with new ones, all pinned to the same Payload version (3.74.0 in the reference migration)

| Before | After |
|---|---|
| `@payloadcms/bundler-webpack` | *(removed — Payload 3 uses Next.js directly, no bundler)* |
| `@payloadcms/db-mongodb@^1.x` | `@payloadcms/db-mongodb@3.x` |
| `@payloadcms/plugin-cloud@^2.x` | `@payloadcms/payload-cloud@3.x` |
| `@payloadcms/plugin-cloud-storage@^1.x` | `@payloadcms/plugin-cloud-storage@3.x` |
| `@payloadcms/plugin-seo@^1.x` | `@payloadcms/plugin-seo@3.x` |
| `@payloadcms/richtext-slate@^1.x` | `@payloadcms/richtext-slate@3.x` (or `@payloadcms/richtext-lexical` if migrating the editor too — see payload-config.md) |
| *(none)* | `@payloadcms/email-nodemailer@3.x` — new, replaces raw `email.transportOptions` |
| *(none)* | `@payloadcms/next@3.x` — new, required for the App Router integration |
| *(none)* | `@payloadcms/ui@3.x` — new, required for admin custom components |
| *(none)* | `@payloadcms/storage-azure` / `-gcs` / `-s3` @3.x — add whichever storage backends are actually used |
| *(none)* | `@payloadcms/live-preview@3.x` — add to the **frontend** app if using `payload-bowl-live-preview` |

## Websolute proprietary packages — bump every occurrence to `^3.0.x`

Applies wherever referenced (dependencies, devDependencies, or peerDependencies):
`@websolutespa/bom-core`, `@websolutespa/bom-env`, `@websolutespa/bom-cli`,
`@websolutespa/test`, `@websolutespa/tsconfig`, `@websolutespa/eslint-config`
(new — replaces `eslint-config-websolute`), `@websolutespa/payload-plugin-bowl`,
`@websolutespa/payload-plugin-cloud-storage-fs`,
`@websolutespa/payload-plugin-cron-job`,
`@websolutespa/payload-plugin-localization`,
`@websolutespa/payload-plugin-search`, `@websolutespa/payload-plugin-seed`,
`@websolutespa/payload-plugin-seo`, `@websolutespa/payload-plugin-storage`
(new — generic storage plugin replacing manual `cloudStorage` wiring),
`@websolutespa/payload-plugin-thron`, `@websolutespa/payload-utils`,
`@websolutespa/payload-bowl-live-preview`, `@websolutespa/bom-mixer-emails`,
`@websolutespa/bom-mixer-forms`, `@websolutespa/bom-mixer-hooks`,
`@websolutespa/bom-mixer-icons`, `@websolutespa/bom-mixer-image`,
`@websolutespa/bom-mixer-llm`, `@websolutespa/bom-mixer-models`,
`@websolutespa/bom-mixer-store`, `@websolutespa/bom-mixer-ui`.

Do **not** leave any of these as `"latest"` or `"*"` — pin to an explicit
`^3.0.x` (or newer, still major 3) so the lockfile is reproducible.

`eslint-config-websolute` is retired — remove it wherever present, replaced
by `@websolutespa/eslint-config` (see tooling.md).

## Test/build tooling

| Before | After |
|---|---|
| `jest` + `@swc/jest` / `ts-jest` | `vitest` (+ `@vitejs/plugin-react`, `vite-tsconfig-paths` where needed) |
| `tsup` (build step for `bom-mixer-*`/UI packages) | removed — shared packages become source-only (`"type": "module"`, `main`/`types` point at `src/index.ts`, with a `prepack`/`postpack` exports-map swap for when they *are* built) |
| `ts-node` | removed where no longer needed (Payload 3 config runs via `next`, not `ts-node`) |
| `playwright` | bump to `1.5x.x` (reference: `1.56.1`), keep `@playwright/test` in sync |

## Root `package.json`

- `workspaces` glob: prefer explicit `src/<bowl>/packages/*` + `src/<bowl>/<app>`
  over a broad `src/<bowl>/**` (avoids workspace collisions with the app's own
  `node_modules`/`.next`). Same for mixer: `src/<mixer>/packages/*`,
  `src/<mixer>/web`. Drop any workspace entries for tooling that was removed
  (e.g. a `storybook`/`theme` package no longer present).
- `turbo` script invocation: `--scope=<pkg>` (Turbo 1.x) → `--filter=<pkg>`
  (Turbo 2.x). Bump `turbo` devDependency to `2.x`.
- `engines.node`: bump to match the new Next.js/React baseline (reference
  migration used `>=23`; at minimum match whatever Next 15 requires).
- Move app-specific runtime deps (`payload`, `react`, `iron-session`, etc.)
  out of the root `package.json` and into the apps that actually use them —
  the root should only keep cross-cutting devDependencies (turbo, prettier,
  changesets, vitest, typescript).
- Remove root `overrides`/`resolutions` that were only needed for the old
  dependency tree (verify each one is still necessary before dropping it).

## Process

1. Enumerate every workspace `package.json` from the guardrail scan.
2. For each, apply the table above: bump versions, remove retired packages,
   add new required packages for that app's role (Bowl app needs the
   `@payloadcms/*` set; Mixer packages need updated peer ranges).
3. Update `packageManager` field if the reference lockfile was generated with
   a newer npm (`npm@10.9.2` in the reference migration).
4. Run `npm install` at the root once all `package.json` files are updated —
   do this once per phase, not after every single file, to avoid thrashing.
5. Expect a very large `package-lock.json` diff — that is normal and
   expected, do not try to hand-edit the lockfile.
