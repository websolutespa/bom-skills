---
agent: agent
description: Upgrade the project's Node.js runtime to a patched release (security advisory or EOL line), following the node-upgrade skill, with a change-driven test plan.
---

# Task: Node.js upgrade

Run the **`node-upgrade`** skill against this repository:
[.claude/skills/node-upgrade/SKILL.md](../../.claude/skills/node-upgrade/SKILL.md)

Read the whole `SKILL.md` first. If the user linked a Node security advisory or release post, read it before choosing the target version.

## Non-negotiable rules

1. **Stop before editing** if this is really a bom-stack upgrade (e.g. 3.0.x → 3.1): point the user to `bom-stack-upgrade` or `bom-stack-upgrade-3-1`, which already move Node.
2. **Smallest reasonable jump.** Stay on the current line if it is supported and patched; otherwise move to the nearest LTS line. Never pick odd-numbered or non-LTS lines. Recommend one target and list the alternatives.
3. **Every pin, one version.** Update every place found by the search in step 1, keeping each file's style and the project's `engines` convention. Say which files affect production.
4. **Research, don't assume.** Read the changelogs, release posts and security posts between the current and target versions. Don't answer from memory.
5. **Verify, then compare.** Run install, types, lint, tests and builds with the target version. A failure counts as caused by the upgrade only if it doesn't happen on the default branch with the old version.
6. **Keep the diff reviewable.** Commit only version-related files and the regenerated lockfile. Never hand-merge the lockfile, never commit env files or secrets.
7. **No destructive git operations.** No force-push and no `reset --hard`. If the working tree is dirty when you start, ask the user how to proceed. Don't push or open a PR without confirmation.

## When to stop and report

Summarize:
- the chosen version and why, with the alternatives;
- files changed, and which ones affect production;
- the changes found that affect the project;
- the outcome of each check: passed, failing also on the baseline, not run (and why);
- the manual test plan, each item linked to the change it covers.
