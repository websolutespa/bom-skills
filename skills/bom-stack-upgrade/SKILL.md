---
name: bom-stack-upgrade
description: 'Upgrade a Websolute BOM-stack monorepo (Bowl/Payload CMS + Oven/.NET + Mixer/Next.js) from bom-stack 2.x (Payload 2.x, Next 14) to bom-stack 3.x (Payload 3.x, Next 15, React 19). USE FOR: migrating payload.config.ts, moving Bowl to the Next.js App Router, migrating Payload admin custom components to Client/Server components, splitting mixer lazy blocks into client/server files, renaming middleware to proxy, upgrading @websolutespa/* and @payloadcms/* dependencies, converting ESLint/tsconfig to the v3 toolchain. DO NOT USE on a repo that is not a BOM-stack project, or one already fully on bom-stack 3.x/Payload 3.x/Next 15 — run the guardrail check first. Resumable via a local todo checklist.'
argument-hint: 'Path to the monorepo root (defaults to workspace root)'
---

# BOM Stack 2.x → 3.x Upgrade

Upgrades a Websolute "BOM stack" monorepo — **Bowl** (Payload CMS headless
admin), **Oven** (.NET middleware, not touched by this skill), **Mixer**
(Next.js frontend) — from Payload 2.x/Next 14 to Payload 3.x/Next 15/React 19,
along with all `@websolutespa/*` proprietary package upgrades and the
associated refactors and TypeScript fixes.

This is a large, multi-hour, multi-file refactor. Treat it as **resumable**:
always work off a local todo checklist file, never redo completed steps, and
never guess — verify with the build/typecheck/lint tools after each phase.

## VS Code Prompt Template

This skill ships a prompt template in `prompts/bom-stack-upgrade.prompt.md`.
When this skill repository is installed with `npx skills add`, prompt files are
installed with the skill and are not auto-copied into the target project's
`.github/prompts` folder.

To copy prompt templates into a target project, run:

```powershell
powershell -ExecutionPolicy Bypass -File .agents/skills/bom-stack-upgrade/scripts/install-vscode-prompts.ps1 -ProjectRoot .
```

## 0. Guardrails — run first, every time

Before touching any file, run the checks in
[references/guardrails.md](./references/guardrails.md). This determines one
of three outcomes:

1. **Not a BOM-stack project** → stop, explain why, do nothing else.
2. **Already upgraded** (Payload/`@websolutespa/bom-core` already major `3`)
   → stop, tell the user it's already on v3, do nothing else. If it is on
   3.0.x (`@websolutespa/*` below 3.1, Payload below 3.91), suggest the
   `bom-stack-upgrade-3-1` skill to move it to the 3.1 release.
3. **Eligible** → continue to step 1. If a todo checklist already exists from
   a previous run, resume it instead of recreating it (step 1).

Never skip this step, even if the user insists — if the guardrail fails,
report why and stop.

## 1. Create or resume the todo checklist

- Checklist path: `<repo-root>/bom-upgrade/UPGRADE_TODO.md`.
- If it does not exist, copy it from
  [assets/UPGRADE_TODO.template.md](./assets/UPGRADE_TODO.template.md),
  filling in the actual package.json paths discovered during the guardrail
  scan (root + every app/package under `src/*/package.json` and
  `src/*/packages/*/package.json`).
- If it exists, read it, find the first unchecked `[ ]` item, and resume
  there. Do not re-run already-checked phases.
- After finishing each item (a file, a small group of files, or a phase),
  check it off (`[x]`) and briefly note anything unusual directly under the
  item. Commit the checklist update along with the code change so progress
  survives a crash/interruption.
- Work phase by phase, top to bottom. Do not jump ahead to a later phase
  before all items in the current one are checked, unless a later phase is
  blocked on something only resolvable earlier.

## 2. Phases

Each phase has its own reference doc with the exact before/after patterns
observed in a real bom-stack 2→3 migration. Read the relevant reference file
in full before editing files for that phase.

| # | Phase | Reference | Scope |
|---|-------|-----------|-------|
| 1 | Dependency upgrade | [references/dependencies.md](./references/dependencies.md) | every `package.json` in the monorepo |
| 2 | Tooling migration | [references/tooling.md](./references/tooling.md) | ESLint flat config, tsconfig, vitest, turbo.json, workspaces glob, Docker |
| 3 | Payload config migration | [references/payload-config.md](./references/payload-config.md) | `src/bowl/*/payload.config.ts` (or equivalent Bowl app) |
| 4 | App Router migration | [references/app-router.md](./references/app-router.md) | Bowl's Next.js app scaffold (`src/app/(payload)`, `src/app/(frontend)`) |
| 5 | Payload custom components | [references/custom-components.md](./references/custom-components.md) | Bowl admin custom Field/UI components |
| 6 | Mixer lazy block split | [references/lazy-blocks.md](./references/lazy-blocks.md) | Mixer UI package `lazy/` blocks using `withLazyProps`, plus every page template's `getPageProps` import |
| 7 | Middleware → proxy | [references/proxy-middleware.md](./references/proxy-middleware.md) | Mixer web `middleware.ts` |
| 8 | TypeScript fixes | [references/typescript-fixes.md](./references/typescript-fixes.md) | repo-wide compile error cleanup, applied last |

Phases 3–7 only apply to the apps that actually contain that pattern (e.g. a
project without lazy blocks skips phase 6) — record in the checklist which
phases were skipped and why.

## 2.1 Cross-cutting directive rules

Apply these rules whenever touching Mixer UI, lazy blocks, or models server
exports during this upgrade. These are mandatory compatibility constraints for
Next.js 15 / React 19 Server Components.

1. Any `.tsx` file that uses React hooks (`useXxx(...)`) must start with:
   `'use client';`
2. Any lazy server file (`src/mixer/packages/ui/src/lazy/**/*.server.tsx`)
   must start with:
   `'use server';`
3. In the models plugin, every file re-exported by
   `src/mixer/packages/models/src/exports/server.ts` (and the barrel file
   itself) must start with:
   `'use server';`

When in doubt, validate these with a scripted pass before running build/lint.

## 3. Verification loop (after every phase)

Run, in order, stopping to fix issues before moving on:

1. `npm install` at the repo root (regenerates the lockfile for the new
   dependency graph — expect a large diff, that's normal).
2. `npx tsc --noemit` (or the app's `types`/`types:check` script) in each
   touched app.
3. `npm run lint` / the app's `lint` script (flat ESLint config).
4. `npm run build` (or the app's `build` script) for each touched app.

Record failures in the checklist under the relevant phase instead of losing
them; fix and re-run before checking the phase off.

## 4. Completion

The task is done when every item in `UPGRADE_TODO.md` is checked and phase 3
(verification) passes for every app that was touched. Summarize for the user:
what changed, what was skipped and why, and any manual follow-up needed
(secrets/env vars, infra, private registry credentials) that the agent cannot
verify itself.
