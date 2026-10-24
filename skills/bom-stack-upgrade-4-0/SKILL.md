---
name: bom-stack-upgrade-4-0
description: 'Upgrade a Websolute BOM-stack project to the bom-sample 4.0.0-next.6 stack: one Next.js 16.4 App Router app with Payload 3.91 embedded and the @websolutespa/bom-next frontend, on pnpm 11, Node 24.22, TypeScript 6, Vitest 5, Playwright 1.64, oxlint and oxfmt (@websolutespa/oxc). USE FOR: a 4.0 App Router project on an older 4.0.0-next.x (dependencies, schema-dts 2 peer, ESLint+Prettier → oxlint+oxfmt, pnpm 11 settings, TS 6, Vitest 5 configs and mock types, Next 16.4 dev effect fixes, regenerated Payload types); a 3.1 Bowl+Mixer monorepo moving to the bom-sample App Router architecture; and routing 3.0.x / 2.x projects through the earlier skills first. DO NOT USE on a repo that is not a BOM-stack project or one already on the bom-sample 4.0.0-next.6 stack — run the guardrail check first. Resumable via a local todo checklist.'
argument-hint: 'Path to the project root (defaults to workspace root)'
---

# BOM Stack → 4.0 (bom-sample 4.0.0-next.6) upgrade

Brings a BOM-stack project to the stack of **bom-sample** on `4.0.0-next.6`, the reference 4.x project:

| Area | Target |
|---|---|
| Architecture | one Next.js App Router app: Payload admin under `src/app/(payload)`, the site under `src/app/(frontend)/[market]/[locale]`, built on `@websolutespa/bom-next` |
| `@websolutespa/*` | `^4.0.0-next.6` (`next` dist-tag), all together, plus `@websolutespa/oxc` |
| Next.js / React | 16.4.2 / 19.2.x |
| Payload / `@payloadcms/*` | 3.91.0, all the same version |
| Node / pnpm | 24.22.1 / 11.28.8 (corepack) |
| TypeScript | 6.0.3 |
| Tests | Vitest 5.0.5 (`@websolutespa/test/vitest`), Playwright 1.64.1 |
| Lint / format | oxlint 1.89 `--type-aware` + oxfmt 0.74, configs from `@websolutespa/oxc` (ESLint and Prettier removed) |

Everything here comes from upgrading bom-sample itself and from the bom 3.1 → 4.x compatibility runs. The exact before/after patterns are in the reference files.

## Which path

The guardrail check (step 0) puts the project on one of these paths:

| Project on | Path |
|---|---|
| bom-stack 2.x (Payload 2, Next 14) | stop: run `bom-stack-upgrade`, then `bom-stack-upgrade-3-1`, then this skill |
| bom-stack 3.0.x monorepo (Payload 3.74) | stop: run `bom-stack-upgrade-3-1` first, then this skill |
| bom-stack 3.1 monorepo (Bowl + Mixer Pages Router, `@websolutespa/*` 3.1.x) | **path B**: move to the bom-sample App Router architecture, then path A |
| 4.0 App Router project (`@websolutespa/bom-next` 4.0.0-next.0 … .5, or 3.0.x of bom-next) | **path A**: stack and toolchain upgrade |
| already on the target | stop and say so |

Path A is mechanical and takes a few hours. Path B rebuilds the frontend on bom-next and moves Bowl into the same app: it is a project, plan it with the user before starting, phase by phase.

## VS Code prompt template

The skill ships `prompts/bom-stack-upgrade-4-0.prompt.md`. `npx skills add` installs it with the skill but doesn't copy it into the project. To copy it into `.github/prompts`:

```powershell
powershell -ExecutionPolicy Bypass -File .agents/skills/bom-stack-upgrade-4-0/scripts/install-vscode-prompts.ps1 -ProjectRoot .
```

## 0. Guardrails: run first, every time

Run [references/guardrails.md](./references/guardrails.md) before touching any file. It decides the path above, checks that `4.0.0-next.6` (and `@websolutespa/oxc`) is published, and stops on a dirty working tree until the user decides.

## 1. Create or resume the todo checklist

- The checklist lives at `<repo-root>/bom-upgrade/UPGRADE_4_0_TODO.md`.
- If it doesn't exist, copy [assets/UPGRADE_4_0_TODO.template.md](./assets/UPGRADE_4_0_TODO.template.md) there, keep the sections of the chosen path and fill in what the guardrail scan found.
- If it exists, resume from the first unchecked `[ ]` item. Never redo checked items.
- Check an item (`[x]`) only after its verification passes; add a short note under it if anything was unusual. Mark items that don't apply `[skip] reason`.
- One commit per phase, including the checklist. The formatting commit (phase A6) stays formatting-only.

## 2. Path A phases (4.0 App Router project)

| # | Phase | Reference |
|---|-------|-----------|
| A1 | Runtime and pnpm 11: Node 24.22.1, `packageManager`, `pnpm-workspace.yaml` settings, Docker | [references/toolchain.md](./references/toolchain.md) §1 |
| A2 | Dependencies: `@websolutespa/*` 4.0.0-next.6, Next 16.4.2, Payload 3.91.0, `schema-dts` 2.1.0, regenerated Payload types | [references/dependencies.md](./references/dependencies.md) |
| A3 | TypeScript 6 | [references/toolchain.md](./references/toolchain.md) §2 |
| A4 | Tests: Vitest 5 on `@websolutespa/test/vitest`, Playwright 1.64.1, mock types | [references/toolchain.md](./references/toolchain.md) §3 |
| A5 | oxlint replaces ESLint (`@websolutespa/oxc/oxlint`), project rules ported | [references/toolchain.md](./references/toolchain.md) §4 |
| A6 | oxfmt replaces Prettier (`@websolutespa/oxc/oxfmt`), one formatting-only commit, `.git-blame-ignore-revs`, editor | [references/toolchain.md](./references/toolchain.md) §5 |
| A7 | Code fixes for the 4.x packages and Next 16.4 | [references/code-fixes.md](./references/code-fixes.md) |

Ready-to-copy configs are in [assets/config/](./assets/config/).

## 3. Path B phases (3.1 monorepo → bom-sample architecture)

Read [references/monorepo-to-app-router.md](./references/monorepo-to-app-router.md) in full first, and agree the plan with the user: it rebuilds the Pages Router site on bom-next and moves Bowl into the same app. bom-sample (`next` branch) is the reference implementation to copy patterns from. After path B, run path A from A1 (most items are then already satisfied and become quick checks).

## 4. Verification loop (after every phase)

Run in order and fix any failure before moving on:

1. `corepack pnpm install` (`--frozen-lockfile` must pass at the end of each phase; never hand-merge the lockfile).
2. `pnpm run generate` when Payload config or `@websolutespa/payload-*` changed.
3. `pnpm run types` (generate + `tsc --noemit`).
4. `pnpm run lint`: 0 errors (the shared presets report warnings only; record the count).
5. `pnpm run format:check` (from A6).
6. `pnpm run test:integration` (Vitest).
7. `pnpm run build`.
8. `pnpm run test:e2e` (Playwright) with the mock store / in-memory database, never against a real database.

Record failures under the phase in the checklist. Network failures (Google Fonts in `next build`, the npm registry) are not code failures: retry before changing code.

## 5. Completion

Done when every checklist item is checked or skipped with a reason and the full verification loop passes from a clean `pnpm install --frozen-lockfile`. Then summarize for the user:

- what changed, per phase, and what was skipped and why;
- the lint warning count, as a follow-up (don't bulk-fix warnings in the upgrade);
- the manual follow-ups from the checklist's last section: hosting and CI on Node 24.22 and pnpm 11 (corepack), the editor extensions, the formatting commit in `.git-blame-ignore-revs` (GitHub applies it; locally `git config blame.ignoreRevsFile .git-blame-ignore-revs`), and a manual QA pass of the admin and the site.
