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
npm view @websolutespa/bom-next dist-tags      # next: 4.0.0-next.8 or later 4.0.0-next.N
npm view @websolutespa/oxc dist-tags            # next: 4.0.0-next.8 or later
```

If `@websolutespa/oxc` is not published, **stop**: phases A5 and A6 depend on it.

## Step D: decide

- **Resuming.** `bom-upgrade/UPGRADE_4_0_TODO.md` exists → continue from the first unchecked item, whatever step C found.
- **bom-stack 2.x** (`payload` major < 3, or `@websolutespa/*` major < 3) → **stop**: run `bom-stack-upgrade` (with its phase 9, data sanitization), then `bom-stack-upgrade-3-1`, then this skill.
- **bom-stack 3.0.x monorepo** (`@websolutespa/*` `^3.0.x`, `payload` < 3.91) → **stop**: run `bom-stack-upgrade-3-1` first.
- **bom-stack 3.1 monorepo** (`@websolutespa/*` `^3.1.x`, `payload` 3.91) → **path B**. Show the user the plan in `monorepo-to-app-router.md` and get an explicit go-ahead before any edit.
- **4.0 App Router project** (`@websolutespa/bom-next` `4.0.0-next.0` … `4.0.0-next.6`, or bom-next `3.0.x` with Payload 3.x) → **path A**.
- **Already on the target** (every `@websolutespa/*` at `^4.0.0-next.8` or later, `@websolutespa/oxc` present, `payload` 3.91, `next` 16.4, `typescript` 6, `vitest` 5, `oxlint` and `oxfmt` in use, no `eslint`/`prettier`) → **stop** and say so.
- **Mixed or ambiguous** (a half-done manual upgrade) → show the user what you found and ask one question. Usually: continue path A from A1, every phase is idempotent.

For path A and path B, run step D2 before creating the checklist.

## Step D2: data pre-check (blocking, path A and path B)

Projects that went through bom-stack 2.x usually still have Payload 2 data: relationship ids and versions' `parent` stored as strings, and draft listings that show documents twice. Payload 3 never converts them, and neither does this upgrade. Check before starting:

1. Install the `bom-db-sanitize` tool in the Payload app if it has no `db:check` script (`npx skills add websolutespa/bom-skills --skill bom-db-sanitize`, then its `scripts/install.mjs`; with pnpm it adds `tsx` to devDependencies, so run `corepack pnpm install`).
2. Run `pnpm db:check` (or `npm run db:check` in an npm monorepo). It is read-only, and Payload is not booted (no seeds, no cron jobs). Tell the user which database it connected to: `.env.local` may point at production data.
3. Decide:
   - **exit 0, "Database is clean."** → continue.
   - **exit 1** → **stop**. Show the summary; the user runs the `bom-db-sanitize` skill first (dev now, staging and production by them), then this skill again.
   - **exit 2, or no database reachable** (mock store, `STORE_STRATEGY=mock`, no `DATABASE_URL`) → ask the user to run `db:check` against the dev database and paste the summary. Never skip it silently. If the user explicitly decides to proceed without it, record the decision and the reason in the checklist's guardrail item.

Not on MongoDB (`@payloadcms/db-mongodb` not a dependency) → `[skip] not MongoDB`.

Path B renames or drops collections (`monorepo-to-app-router.md` §0.3). After that data migration, run `db:check` again: it must still be clean.

## Step E: never be destructive

- Dirty working tree → ask whether to commit, stash or continue. Never decide silently.
- No `reset --hard`, no force-push, no branch deletion.
- Never hand-merge a lockfile; regenerate it.
- Never run e2e tests or seeds against a real database: use the mock store (`STORE_STRATEGY=mock`) / in-memory database. The project's `.env.local` may point at production data.
- Never publish packages, and never commit secrets (`.env.local`, `docker.env`).
