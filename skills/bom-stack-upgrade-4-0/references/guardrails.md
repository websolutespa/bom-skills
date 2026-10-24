# Guardrails: run before anything else

Decide the path, or stop cleanly and explain why. Never edit a file before this check is done.

## Step A: is this a BOM-stack project?

It qualifies if any of these is true:

- a `package.json` depends on `@websolutespa/bom-core` or `@websolutespa/bom-next`;
- a `package.json` depends on `@websolutespa/payload-plugin-bowl`;
- the layout is a BOM one: a Payload app (`src/bowl/payload` in a monorepo, or `src/payload.config.ts` in a single app) and a Next.js site using `@websolutespa/bom-mixer-*` or `@websolutespa/bom-next`.

If none holds, **stop**.

## Step B: which architecture?

- **Monorepo (bom-stack 2.x/3.x samples).** A root `turbo.json`, `workspaces` (npm) or `pnpm-workspace.yaml` `packages`, `src/bowl/payload` and `src/mixer/web`; the site is a Pages Router app (`src/mixer/web/src/pages/[market]/[locale]/…`, `@websolutespa/bom-mixer-*`).
- **Single App Router app (bom-sample).** One `package.json` with `next`, `payload` and `@websolutespa/bom-next`; `src/app/(payload)` and `src/app/(frontend)/[market]/[locale]`; `src/payload.config.ts`; `src/proxy.tsx`.

Record every `package.json` path: the checklist needs them.

## Step C: read the current versions

From each `package.json` (and the lockfile for `latest`, `*` or `next` ranges):

- `payload`, `@payloadcms/*`, `next`, `react`;
- every `@websolutespa/*` range, especially `bom-core`, `bom-next`, `payload-plugin-bowl`;
- `typescript`, `eslint`, `prettier`, `vitest`, `jest`, `@playwright/test`, `oxlint`, `oxfmt`;
- `packageManager`, `.nvmrc`, `engines.node`.

Confirm the target is published:

```sh
npm view @websolutespa/bom-next dist-tags      # next: 4.0.0-next.6 or later 4.0.0-next.N
npm view @websolutespa/oxc dist-tags            # next: 4.0.0-next.6 or later
```

If `@websolutespa/oxc` is not published, **stop**: phases A5 and A6 depend on it.

## Step D: decide

- **Resuming.** `bom-upgrade/UPGRADE_4_0_TODO.md` exists → continue from the first unchecked item, whatever step C found.
- **bom-stack 2.x** (`payload` major < 3, or `@websolutespa/*` major < 3) → **stop**: run `bom-stack-upgrade`, then `bom-stack-upgrade-3-1`, then this skill.
- **bom-stack 3.0.x monorepo** (`@websolutespa/*` `^3.0.x`, `payload` < 3.91) → **stop**: run `bom-stack-upgrade-3-1` first.
- **bom-stack 3.1 monorepo** (`@websolutespa/*` `^3.1.x`, `payload` 3.91) → **path B**. Show the user the plan in `monorepo-to-app-router.md` and get an explicit go-ahead before any edit.
- **4.0 App Router project** (`@websolutespa/bom-next` `4.0.0-next.0` … `4.0.0-next.5`, or bom-next `3.0.x` with Payload 3.x) → **path A**.
- **Already on the target** (every `@websolutespa/*` at `^4.0.0-next.6` or later, `@websolutespa/oxc` present, `payload` 3.91, `next` 16.4, `typescript` 6, `vitest` 5, `oxlint` and `oxfmt` in use, no `eslint`/`prettier`) → **stop** and say so.
- **Mixed or ambiguous** (a half-done manual upgrade) → show the user what you found and ask one question. Usually: continue path A from A1, every phase is idempotent.

## Step E: never be destructive

- Dirty working tree → ask whether to commit, stash or continue. Never decide silently.
- No `reset --hard`, no force-push, no branch deletion.
- Never hand-merge a lockfile; regenerate it.
- Never run e2e tests or seeds against a real database: use the mock store (`STORE_STRATEGY=mock`) / in-memory database. The project's `.env.local` may point at production data.
- Never publish packages, and never commit secrets (`.env.local`, `docker.env`).
