---
agent: agent
description: Upgrade a BOM-stack project to the bom-sample 4.0.0-next.8 stack (one Next.js 16.4 App Router app with Payload 3.91 and @websolutespa/bom-next, pnpm 11, TypeScript 6, Vitest 5, oxlint + oxfmt via @websolutespa/oxc), following the bom-stack-upgrade-4-0 skill, with guardrails and a resumable local checklist.
---

# Task: BOM Stack → 4.0 (bom-sample 4.0.0-next.8) upgrade

Run the **`bom-stack-upgrade-4-0`** skill against this repository:
[.claude/skills/bom-stack-upgrade-4-0/SKILL.md](../../.claude/skills/bom-stack-upgrade-4-0/SKILL.md)

Read the whole `SKILL.md` first. Then read the reference file for the phase you are on, under [.claude/skills/bom-stack-upgrade-4-0/references/](../../.claude/skills/bom-stack-upgrade-4-0/references).

## Non-negotiable rules

1. **Guardrails first.** Follow `references/guardrails.md` before editing anything. **Stop immediately, without modifying any file,** when:
   - the repo is not a BOM-stack project;
   - it is on bom-stack 2.x or 3.0.x (point the user to `bom-stack-upgrade` / `bom-stack-upgrade-3-1` first);
   - it is already on the bom-sample 4.0.0-next.8 stack;
   - `@websolutespa/bom-next` 4.0.0-next.8 or `@websolutespa/oxc` is not published yet.
2. **Path B needs a plan.** For a 3.1 monorepo, present the plan in `references/monorepo-to-app-router.md` (phase B0) and wait for the user's explicit go-ahead: it rebuilds the site on bom-next with Tailwind/shadcn.
3. **Resumable checklist.** Create or resume `bom-upgrade/UPGRADE_4_0_TODO.md` from [assets/UPGRADE_4_0_TODO.template.md](../../.claude/skills/bom-stack-upgrade-4-0/assets/UPGRADE_4_0_TODO.template.md). Read it before starting and keep it updated.
4. **Phase order.** Path A: A1 runtime/pnpm 11 → A2 dependencies → A3 TypeScript 6 → A4 tests → A5 oxlint → A6 oxfmt → A7 code fixes. Verify after each one; skip what doesn't apply with `[skip] reason`.
5. **Exact versions.** Use `references/dependencies.md`. Every `@websolutespa/*` moves together to `^4.0.0-next.8`; every `@payloadcms/*` is exactly `payload`'s version.
6. **Verify, don't assume.** After each phase: `corepack pnpm install`, `pnpm run types`, `pnpm run lint` (0 errors), `pnpm run test:integration`, `pnpm run build`; e2e only with the mock store.
7. **Keep the diff reviewable.** One commit per phase with the checklist; the oxfmt formatting commit contains only formatting and goes into `.git-blame-ignore-revs`; don't bulk-fix lint warnings or refactor unrelated code; regenerate the lockfile, never hand-merge it.
8. **No destructive git operations and no secrets.** No force-push, no `reset --hard`; never commit `.env.local`; never run e2e or seeds against a real database. If the working tree is dirty, ask the user first.
9. **Ask, don't guess.** If versions are mixed or the structure differs from bom-sample, ask one short question.

## When to stop and report

- A guardrail fails → stop, explain why, make no edits.
- Every checklist item is checked or skipped and the final gate passes → summarize what changed, what was skipped and why, the lint warning count, and the manual follow-ups (Node 24.22 and pnpm 11 on hosting/CI, editor extension and blame ignore, manual QA).
- If you run out of context mid-task → make sure the checklist reflects exactly what is done, so the next run resumes cleanly.
