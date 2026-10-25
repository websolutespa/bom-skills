# Toolchain (phases A1, A3–A6)

Each section is one phase and one commit. The configs are in [../assets/config/](../assets/config/).

## 1. Runtime and pnpm 11 (A1)

- `.nvmrc`: `v24.22.1`. `engines.node`: `>=24`. Dockerfile: `ARG NODE_VERSION=24.22.1-alpine`. CI and hosting: Node 24.22.
- `packageManager`: `pnpm@11.28.8`. Use it through corepack (`corepack pnpm …`, or `corepack enable`): a globally installed pnpm 10 cannot switch itself to 11 on Windows.
- `pnpm-workspace.yaml` holds the pnpm settings, also in a single-package project. Copy [../assets/config/pnpm-workspace.yaml](../assets/config/pnpm-workspace.yaml):
  - `allowBuilds`: pnpm 11 **fails the install** on any dependency build script that is not listed (`ERR_PNPM_IGNORED_BUILDS`). List what the install reports; `@sentry/cli: false` (its binary comes from optional platform packages).
  - `minimumReleaseAgeExclude: ['@websolutespa/*']`: pnpm 11 installs only versions published at least a day ago, also on `--frozen-lockfile`. The `@websolutespa` packages are released and consumed together.
  - `overrides` for `@babel/core` and `supports-color`: auto-installed peers of different versions otherwise create two `next` / `@payloadcms/ui` / `styled-components` instances.
- Dockerfile: copy `pnpm-workspace.yaml` next to `package.json`, `pnpm-lock.yaml` and `.npmrc` before `pnpm install --frozen-lockfile`.
- Switching from pnpm 10: pnpm 11 wants to recreate `node_modules`; in a non-interactive shell run `corepack pnpm install --config.confirmModulesPurge=false` once.

Check: `corepack pnpm install --frozen-lockfile` passes; `pnpm why next` shows one app instance.

## 2. TypeScript 6 (A3)

- `typescript`: `6.0.3`; `@websolutespa/tsconfig` `^4.0.0-next.8` is already TS 6 ready.
- Remove `"baseUrl": "."` from `tsconfig.json` (deprecated in TS 6). `paths` stay as they are: they resolve relative to the tsconfig.
- If a global type stops resolving, add it to `compilerOptions.types` or a `/// <reference types="…" />`.

Check: `pnpm run types:check`.

## 3. Tests (A4)

- `vitest` `5.0.5`, `@websolutespa/test` `^4.0.0-next.8`, `jsdom` `26.1.0` (devDependencies, it also satisfies the payload-utils peer, see [dependencies.md](./dependencies.md); move it out of `dependencies` if the app code doesn't import it; drop a `jsdom` override), `@testing-library/react` `16.3.3`, `@playwright/test` `1.64.1`.
- Remove `@vitejs/plugin-react` and `vite-tsconfig-paths`: the shared config includes react and Vitest 5 resolves tsconfig paths itself.
- `vitest.config.mts` uses the shared factory ([../assets/config/vitest.config.mts](../assets/config/vitest.config.mts)): `defineDomConfig` (jsdom + `@testing-library/jest-dom` matchers), `defineNodeConfig` or `definePayloadConfig`. Keep the project's `setupFiles`, `include` and `exclude`. Files with `// @vitest-environment node` keep working.
- The shared config inlines `@websolutespa/*` (`server.deps.inline`): Vitest compiles them like Next does, so their extensionless imports (`next/server`) resolve.
- **Mock types (Vitest 5).** `vi.fn()` and `ReturnType<typeof vi.fn>` now include constructors and are not callable (`TS2348: Value of type 'Mock<Procedure | Constructable>' is not callable`). Type the mock with its signature:

  ```ts
  import { vi, type Mock } from 'vitest';
  const state = vi.hoisted(() => ({
    create: undefined as unknown as Mock<(args: { collection: string }) => Promise<{ id: string }>>,
  }));
  ```

- `pnpm exec playwright install chromium` once for the new Playwright version.

Check: `pnpm run test:integration`, `pnpm run types:check` (tests are type-checked too), `pnpm run test:e2e`.

## 4. oxlint replaces ESLint (A5)

`@websolutespa/oxc` is published from `4.0.0-next.7`. Only `@websolutespa/eslint-config@4.0.0-next.6` exported `./oxlint`: a project that used it (often with a local `.d.ts` declaring the module) switches the import to `@websolutespa/oxc/oxlint` and deletes the declaration; `@websolutespa/eslint-config` 4.0.0-next.7 and later is the ESLint 10 configs only.

- Add `oxlint` `1.89.0`, `oxlint-tsgolint` `7.0.2005`, `@websolutespa/oxc` `^4.0.0-next.8`. Remove `eslint`, `eslint-config-next`, `@websolutespa/eslint-config`, every `eslint.config.*` and any local `.d.ts` that declared `@websolutespa/eslint-config/oxlint`.
- Script: `"lint": "oxlint --type-aware"` (Next 16 removed `next lint`).
- `oxlint.config.ts` uses the shared `next` preset ([../assets/config/oxlint.config.ts](../assets/config/oxlint.config.ts)). The presets are complete configs (rules, overrides, plugins); extend them by spreading, never with `extends`.
- **Port project rules.** Translate each custom rule of the old `eslint.config.*` to oxlint and verify it with a probe file. bom-sample's request-data rule:
  - the shared base preset already restricts `next/headers` everywhere (warning);
  - the project sets its own message and turns it **off** for the templates under `src/app` and for tests with an `overrides` entry;
  - probe: a file in `src/lib` importing `next/headers` is reported, the same import under `src/app/**` and in a `*.test.ts` is not.
- Not a turborepo: drop the preset's turbo JS plugin (`jsPlugins: []` and remove the `turbo/no-undeclared-env-vars` rule), as the assets config does.
- Every rule is a warning, as with ESLint `only-warn`: `lint` exits 0. Record the warning count; don't bulk-fix warnings in the upgrade.
- Docs and editor: README and `.claude/CLAUDE.md` mentions of ESLint, `.vscode/extensions.json` `oxc.oxc-vscode` instead of `dbaeumer.vscode-eslint`, `source.fixAll.oxc` instead of `source.fixAll.eslint`, remove the `eslint.*` settings.

Check: `pnpm run lint` exits 0, `pnpm run types:check`.

## 5. oxfmt replaces Prettier (A6)

Three commits, in this order:

1. **Config.** Add `oxfmt` `0.74.0`; remove `prettier` and `.prettierrc*`/`.prettierignore`. Add `oxfmt.config.ts` ([../assets/config/oxfmt.config.ts](../assets/config/oxfmt.config.ts)), which oxfmt and the oxc editor extension discover. Scripts:

   ```json
   "format": "oxfmt \"**/*.{ts,tsx,js,mjs,cjs,md}\"",
   "format:check": "oxfmt \"**/*.{ts,tsx,js,mjs,cjs,md}\" --check"
   ```

   The shared `ignorePatterns` skip generated files (`payload-types.ts`, `importMap.js`, `src/app/(payload)/**`, CHANGELOGs, the lockfile); add project ones with `[...ignorePatterns, '…']`.
2. **Formatting only.** `pnpm run format`, then check types, unit tests and lint, then commit with `style: format with oxfmt` and nothing else. Expect most files to change (the BOM style is 100 columns, single quotes, trailing commas es5). Check no generated file is in the diff.
3. **Blame.** `.git-blame-ignore-revs` with the full hash of the formatting commit:

   ```text
   # formatting-only commits: `git config blame.ignoreRevsFile .git-blame-ignore-revs` (GitHub applies it automatically)

   # style: format with oxfmt
   <full sha>
   ```

**Editor.** VS Code must format with oxfmt, or format-on-save rewrites files in another style: in `.vscode/settings.json` set `"editor.defaultFormatter": "oxc.oxc-vscode"` for `[javascript][javascriptreact][typescript][typescriptreact]` (the oxc extension's oxfmt formatter is on by default and reads `oxfmt.config.ts`).

**Windows line endings.** With `core.autocrlf=true`, files written by git can be CRLF in the working copy and `format:check` flags them although the committed content is LF. `pnpm run format` normalizes them; `git diff` then shows no content change.

Check: `pnpm run format:check` exits 0; CI runs it after the install.
