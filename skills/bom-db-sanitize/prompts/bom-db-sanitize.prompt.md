---
agent: agent
description: Check and fix the MongoDB data of a BOM-stack project on Payload 3 (relationship ids still stored as strings by Payload 2, duplicated or missing `latest` versions in draft listings), following the bom-db-sanitize skill, with a read-only check, a dry run and a guarded apply.
---

# Task: BOM DB sanitize

Run the **`bom-db-sanitize`** skill against this repository:
[.claude/skills/bom-db-sanitize/SKILL.md](../../.claude/skills/bom-db-sanitize/SKILL.md)

Read the whole `SKILL.md` first, then [references/runbook.md](../../.claude/skills/bom-db-sanitize/references/runbook.md) and [references/data-model.md](../../.claude/skills/bom-db-sanitize/references/data-model.md).

## Non-negotiable rules

1. **Guardrails first.** Stop without changing anything if the app is not on Payload 3 or does not use `@payloadcms/db-mongodb`. On Payload 2, point the user to `bom-stack-upgrade`.
2. **Say which database.** Before any command, tell the user which database the local env points to. `.env.local` may point at shared or production data.
3. **Read-only first.** `db:check` and the `db:fix` dry run are safe. **Never run `db:fix:apply` without the user's explicit go-ahead** for that database name, after they have seen the dry run. Always pass `--expect-db=<db name>`.
4. **Staging and production are run by the user**, with `DATABASE_URL` set in their own shell. Give them the exact commands. Never ask for production credentials.
5. **Runtime fix before apply.** Wire `withLatestVersionFix` in `payload.config.ts`, and make sure it is deployed on an environment before applying there.
6. **Record it.** Fill in `bom-upgrade/DB_SANITIZE.md` for every environment. Never commit `db-fix-backup-*.json`.
7. **No destructive git operations.** If the working tree is dirty, ask the user how to proceed.

## When to stop and report

- A guardrail fails → stop and explain.
- `db:check` is clean on every environment the user cares about → summarize what was converted and fixed per environment, where the backups are, and which environments are still pending.
