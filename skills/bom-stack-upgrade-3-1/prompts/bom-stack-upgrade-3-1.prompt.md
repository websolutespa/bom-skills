---
agent: agent
description: Upgrade a BOM-stack 3.0.x monorepo (Bowl/Payload + Mixer/Next.js, created from the bom samples) to bom-stack 3.1 (Payload 3.91, Next 16.4, TypeScript 6, ESLint 10, Vitest 5), following the bom-stack-upgrade-3-1 skill, with guardrails and a resumable local checklist.
---

# Task: BOM Stack 3.x → 3.1 upgrade

Run the **`bom-stack-upgrade-3-1`** skill against this repository:
[.claude/skills/bom-stack-upgrade-3-1/SKILL.md](../../.claude/skills/bom-stack-upgrade-3-1/SKILL.md)

Read the whole `SKILL.md` first. Then read the reference file for the phase you are on, under [.claude/skills/bom-stack-upgrade-3-1/references/](../../.claude/skills/bom-stack-upgrade-3-1/references). Also read `held-back.md` before phase 1.

## Non-negotiable rules

1. **Guardrails first.** Follow `references/guardrails.md` before editing anything. **Stop immediately, without modifying any file,** in any of these cases:
   - the repo is not a BOM-stack project;
   - it is still on bom-stack 2.x (in that case, point the user to the `bom-stack-upgrade` skill);
   - it is already on 3.1 (`@websolutespa/*` `^3.1`, `payload >= 3.91.0`);
   - 3.1 is not published yet.
2. **Resumable checklist.** Create or resume `bom-upgrade/UPGRADE_3_1_TODO.md` from [assets/UPGRADE_3_1_TODO.template.md](../../.claude/skills/bom-stack-upgrade-3-1/assets/UPGRADE_3_1_TODO.template.md). Read it before starting, and keep it updated as you go.
3. **Phase order.** Work through the phases in order: dependencies → tooling → Payload 3.91 → Next 16.4 → code fixes → tests. Verify after each one. Skip what doesn't apply, and record `[skip] reason` in the checklist.
4. **Exact versions.** Use the versions in `references/dependencies.md`. Never upgrade a package listed in `references/held-back.md`; in particular, **styled-components stays on 5.3.11**.
5. **Verify, don't assume.** After each phase run `npm install`, `npx turbo run types`, `npx turbo run lint` (0 errors), `npx turbo run test`, and the app builds. Fix what each phase surfaces before moving on.
6. **Keep the diff reviewable.**
   - Don't bulk-fix lint warnings, and don't refactor unrelated code.
   - Make one commit per phase, including the checklist.
   - Never hand-merge `package-lock.json`; regenerate it.
7. **No destructive git operations.** No force-push and no `reset --hard`. If the working tree is dirty when you start, ask the user how to proceed.
8. **Ask, don't guess.** If versions are mixed or the structure differs from the samples, ask one short question. Do the same for the optional steps (`BOM_DB=memory`, the Playwright smoke tests): ask whether the user wants them.

## When to stop and report

- A guardrail fails → stop, explain why, and make no edits.
- Every checklist item is checked or skipped and the final gate passes → summarize:
  - what changed;
  - what was skipped, and why;
  - the lint warning count, as a follow-up;
  - the manual follow-ups from the checklist (Node 24.22 on hosting, `AZURE_STORAGE_CONTAINER_ACCESS`, the `Origin` header for REST integrations, manual QA).
- If you run out of context mid-task → make sure the checklist reflects exactly what is done, so the next run can resume cleanly.
