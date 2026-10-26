---
name: bom-stack-upgrade-3-1
description: 'Upgrade a Websolute BOM-stack monorepo that is already on bom-stack 3.0.x (Payload 3.x < 3.91, Next 15/16 < 16.3.3, @websolutespa/* 3.0.x) to bom-stack 3.1 (Payload 3.91, Next 16.4, React 19.2.9, TypeScript 6, ESLint 10, Vitest 5, Playwright 1.64, Node 24). USE FOR: bumping @websolutespa/* to ^3.1.0 and @payloadcms/* to 3.91.0, Payload 3.90 security defaults (CSRF Origin header, private Azure containers), Next 16.4 config fixes (images.qualities, sass loadPaths, eslint CLI), TS 6 tsconfig cleanup (baseUrl, types), Jest/old vitest configs → @websolutespa/test/vitest factories, async renderEmail, library majors, optional in-memory DB and Playwright smoke tests. DO NOT USE on bom-stack 2.x projects (use bom-stack-upgrade first) or on a project already on 3.1.x — run the guardrail check first. Resumable via a local todo checklist.'
argument-hint: 'Path to the monorepo root (defaults to workspace root)'
---

# BOM Stack 3.x → 3.1 Upgrade

Upgrades a Websolute BOM-stack monorepo created from the bom 3.0 samples (`sample/basic`, `sample/llm`, `sample/website`) to the **3.1.0** release. Every published `@websolutespa/*` package was released at 3.1.0 together.

The release is a **minor** for the `@websolutespa/*` packages, but the project still has to change, because it moves the whole stack:

| Area | 3.0.x | 3.1 |
|---|---|---|
| Payload / `@payloadcms/*` | 3.74.0 | 3.91.0 |
| Next.js | 16.1.6 | 16.4.2 |
| React / react-dom | 19.2.3 | 19.2.9 |
| Node.js | 24.7.0 (`engines >=23`) | 24.22.1 (`engines >=22.13`) |
| TypeScript | 5.8.3 | 6.0.3 |
| ESLint | 9.31.0 | 10.13.0 |
| Vitest | 3.2.3 (+ Jest in web apps) | 5.0.5 only |
| Playwright | 1.50 / 1.56 | 1.64.1 |

Everything in this skill comes from the actual upgrade of the bom monorepo and its three samples. The exact before/after patterns are in the reference files.

Plan for a few hours of work. The upgrade is **resumable**:

- Always work from the checklist file.
- Never redo checked items.
- Verify with install, types, lint, test and build after each phase.

## VS Code prompt template

The skill ships a prompt template, `prompts/bom-stack-upgrade-3-1.prompt.md`. `npx skills add` installs it with the skill but doesn't copy it into the project's `.github/prompts`. To copy it, run:

```powershell
powershell -ExecutionPolicy Bypass -File .agents/skills/bom-stack-upgrade-3-1/scripts/install-vscode-prompts.ps1 -ProjectRoot .
```

## 0. Guardrails: run first, every time

Run the checks in [references/guardrails.md](./references/guardrails.md) before touching any file. They have four possible outcomes:

1. **Not a BOM-stack project.** Stop and explain why.
2. **Still on bom-stack 2.x** (Payload or `@websolutespa/*` major below 3). Stop, and tell the user to run the `bom-stack-upgrade` skill (2.x → 3.x) first.
3. **Already on 3.1** (every `@websolutespa/*` at `^3.1` or later and `payload` at `>=3.91.0`). Stop and say so.
4. **Eligible** (3.0.x). Continue. If the checklist already exists, resume it.

## 1. Create or resume the todo checklist

- The checklist lives at `<repo-root>/bom-upgrade/UPGRADE_3_1_TODO.md`.
- If it doesn't exist, copy [assets/UPGRADE_3_1_TODO.template.md](./assets/UPGRADE_3_1_TODO.template.md) there. Fill in the workspace packages you found during the guardrail scan: the Bowl app, the Mixer web app, every `src/mixer/packages/*` and every `src/bowl/packages/*`.
- If it exists, resume from the first unchecked `[ ]` item.
- When an item is done, check it (`[x]`) and add a short note under it if anything was unusual. Mark items that don't apply as `[skip] reason`.
- Commit the checklist together with the code change. Use one commit per phase.

## 2. Phases

| # | Phase | Reference | Scope |
|---|-------|-----------|-------|
| 1 | Dependencies | [references/dependencies.md](./references/dependencies.md) | every `package.json`, `.nvmrc`, Dockerfiles |
| 2 | Tooling | [references/tooling.md](./references/tooling.md) | tsconfig (TS 6), ESLint 10 scripts, `turbo.json` env, rimraf 6 scripts, `.gitignore` |
| 2b | Deployment | [references/deployment-env.md](./references/deployment-env.md) | `Dockerfile`s, `docker-compose.yml`, `MIXER_SECRET`, hosting build variables, secrets and placeholders in committed `.env` files, Mixer runtime image (full standalone copy) |
| 3 | Payload 3.91 | [references/payload-3-91.md](./references/payload-3-91.md) | Bowl app: `payload.config.ts`, `next.config.ts`, generated files, security defaults, env vars |
| 4 | Next 16.4 (Mixer) | [references/next-16-4.md](./references/next-16-4.md) | Mixer web: `next.config.ts` images, `proxy.ts`, lint |
| 5 | Code fixes | [references/code-fixes.md](./references/code-fixes.md) | async `renderEmail`, library majors, TS 6 type errors, undeclared and cross-project imports |
| 6 | Tests | [references/testing.md](./references/testing.md) | Jest/vitest configs → `@websolutespa/test/vitest`, optional `BOM_DB=memory` and Playwright smoke tests ([assets/tests/](./assets/tests/)) |

Packages and versions that **must not** be upgraded are listed in [references/held-back.md](./references/held-back.md). Read it before phase 1: they include styled-components 5, zustand 4, swiper 11, motion 12 and `@googlemaps/js-api-loader` 1.

## 3. Verification loop (after every phase)

Run these in order, and fix any failure before moving on:

1. `npm install` at the root. Expect a large lockfile diff. Never hand-merge `package-lock.json`; regenerate it.
2. `npx turbo run types` (or `npx tsc --noemit` in each touched app).
3. `npx turbo run lint`. It must report **0 errors**. Warnings are expected, see tooling.md "Lint warnings".
4. `npx turbo run test` (from phase 6, it runs on Vitest only).
5. Build each touched app: `npm run build` in the Bowl app and in the Mixer web app, or the root `build:*` scripts.

Record failures in the checklist under the phase. Don't lose them.

## 4. Completion

The upgrade is done when every checklist item is checked or skipped with a reason, and the final verification gate passes. Then summarize for the user:

- what changed;
- what was skipped, and why;
- the manual follow-ups (see the template's last section). These are:
  - `MIXER_SECRET` set as a build-time variable on every hosting dashboard (Coolify, Vercel, CI);
  - secrets removed from committed `.env` files set on the hosting before release, and rotated;
  - on S3 projects, `S3_STORAGE_ENDPOINT` unset or a URL (never an ARN), and the right bucket per environment;
  - `AZURE_STORAGE_CONTAINER_ACCESS` on deployments that need public blobs;
  - the `Origin` header on scripts that call the Bowl REST API with a session cookie;
  - the Node 24.22 runtime on hosting and CI;
  - a manual QA pass of the admin and frontend.
