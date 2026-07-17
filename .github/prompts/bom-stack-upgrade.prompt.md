---
agent: agent
description: Upgrade a BOM-stack monorepo (Bowl/Payload + Mixer/Next.js) from bom-stack 2.x to 3.x, following the bom-stack-upgrade skill, with guardrails and a resumable local checklist.
---

# Task: BOM Stack 2.x → 3.x upgrade

Run the **`bom-stack-upgrade`** skill against this repository:
[.claude/skills/bom-stack-upgrade/SKILL.md](../../.claude/skills/bom-stack-upgrade/SKILL.md)

Read the full `SKILL.md` file now, before doing anything else. Then read
every reference file it links to under
[.claude/skills/bom-stack-upgrade/references/](../../.claude/skills/bom-stack-upgrade/references)
that is relevant to the phase you're currently on — don't load all of them
upfront if the SKILL.md's own phase table is enough to decide what's needed
next.

## Non-negotiable rules

1. **Guardrails first.** Follow `references/guardrails.md` before editing
   anything. If the repo is not a BOM-stack project, or is already on
   bom-stack 3.x (Payload major `>= 3` and `@websolutespa/bom-core` major
   `>= 3` everywhere), **stop immediately** and report why — do not modify
   any file in that case.
2. **Resumable checklist.** Create or resume
   `bom-upgrade/UPGRADE_TODO.md` from
   [assets/UPGRADE_TODO.template.md](../../.claude/skills/bom-stack-upgrade/assets/UPGRADE_TODO.template.md)
   as described in the skill. Always check the checklist for existing
   progress before starting work, and keep it updated as you go — this is
   what makes the task resumable across sessions if interrupted.
3. **Phase order.** Work through the phases in the table in `SKILL.md`
   (dependencies → tooling → payload config → app router → custom components
   → lazy blocks → proxy/middleware → TypeScript fixes), verifying after each
   one before moving to the next. Skip phases that don't apply to this repo
   and record why in the checklist rather than silently ignoring them.
4. **Verify, don't assume.** After each phase, run the verification commands
   specified in that phase's reference file (install/typecheck/lint/build).
   Fix issues surfaced by that phase before moving on.
5. **No destructive git operations.** Don't force-push, reset --hard, or
   discard uncommitted changes. If the working tree is dirty when you start,
   stop and ask the user how to proceed.
6. **Ask, don't guess.** If the guardrail check is ambiguous, or a phase
   doesn't clearly apply/not-apply to this repo's actual structure, ask a
   short clarifying question instead of assuming.

## When to stop and report

- Guardrail says "not a BOM-stack project" → stop, explain, no edits.
- Guardrail says "already upgraded" → stop, explain, no edits.
- All checklist items are checked and the final verification gate in
  `UPGRADE_TODO.md` passes → summarize what changed, what was skipped and
  why, and any manual follow-ups the user needs to handle (secrets, infra,
  registry access) that you could not verify yourself.
- Otherwise, if you run out of turns/context mid-task, make sure the
  checklist accurately reflects what's done so the next run can resume
  cleanly — this is the whole point of the checklist.
