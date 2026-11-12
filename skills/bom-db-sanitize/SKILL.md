---
name: bom-db-sanitize
description: 'Check and fix the MongoDB data of a Websolute BOM-stack project on Payload 3: relationship and upload ids still stored as strings by Payload 2 (the v2 → v3 data migration that bom-stack-upgrade does not do), and documents with more than one (or no) `latest` version, which show up as duplicated or missing rows in the admin list of draft-enabled collections. Installs db:check / db:fix scripts and a runtime fix (withLatestVersionFix) into the Payload app. USE FOR: after bom-stack-upgrade (2.x → 3.x) and before go-live; before bom-stack-upgrade-3-1 and bom-stack-upgrade-4-0 (their guardrails require a clean db:check); duplicated rows in a Payload admin list; CI gating with db:check. DO NOT USE on Payload 2 projects (run bom-stack-upgrade first) or on non-MongoDB adapters.'
argument-hint: 'Path to the Payload app (defaults to auto-detection)'
---

# BOM DB sanitize (Payload 3 + MongoDB)

Payload 2 stored relationship and upload ids, and the `parent` of every version, as **strings**. Payload 3 stores them as **ObjectId**. `bom-stack-upgrade` moves the code to Payload 3 but not the data, and Payload 3 doesn't convert old documents when it reads them. Every query that compares ids then misses the old values.

The visible symptom: the admin list of a draft-enabled collection shows the **same document twice**. On save, Payload's `createVersion()` clears the previous `latest` version with `parent: { $eq: <ObjectId> }`. That never matches the pre-upgrade version whose `parent` is a string, so after the first save on Payload 3 the document has two `latest` versions, and the list shows one row per `latest` version. Details in [references/data-model.md](./references/data-model.md).

This skill installs a tool that finds and fixes both problems, and a runtime fix that stops new duplicates. It was built on a real project (kirey-group): 14,621 string ids in 1,974 documents, and 10 documents listed twice.

## VS Code prompt template

The skill ships `prompts/bom-db-sanitize.prompt.md`. To copy it into the project's `.github/prompts`:

```powershell
powershell -ExecutionPolicy Bypass -File .agents/skills/bom-db-sanitize/scripts/install-vscode-prompts.ps1 -ProjectRoot .
```

## 0. Guardrails: run first

1. **Payload app.** Find the `package.json` that depends on `payload`. Its major must be **3**. On Payload 2, stop: run `bom-stack-upgrade` first. The tool loads the Payload 3 config.
2. **MongoDB.** The app must depend on `@payloadcms/db-mongodb`. With any other adapter, stop: there is nothing to sanitize.
3. **Which database.** The tool reads `DATABASE_URL` the way Next.js does (`.env`, `.env.local`, …); a value set in the shell wins. Before running anything, tell the user which database the local env points to (the tool prints it, password masked). `.env.local` may point at shared or production data.
4. **Dirty working tree.** Ask the user whether to commit, stash or continue. Never decide silently.

## 1. Install the tool

From the project root:

```bash
node .agents/skills/bom-db-sanitize/scripts/install.mjs --dry-run   # see what changes
node .agents/skills/bom-db-sanitize/scripts/install.mjs             # install (add --app <dir> if asked)
```

It is idempotent. It installs:

| Where | What |
|---|---|
| app `scripts/db/` | `db-check.mjs`, `db-fix.mjs` and `utils/`: plain `.mjs`, so `next build` never type-checks them |
| app `src/db/withLatestVersionFix.ts` | the runtime fix (step 2) |
| app `package.json` | `db:check`, `db:fix`, `db:fix:apply` scripts; `tsx` in devDependencies if the app can't resolve it (pnpm) |
| **repository root** `.gitignore` | `db-fix-backup-*.json`: `db:fix:apply` writes its backups to the repository root, and they hold database ids and values. The installer checks with git that a root backup is ignored |

It never overwrites an existing `db:*` script or an edited runtime fix without `--force`. It fails if a `.gitignore` rule would hide the installed files from git: on kirey-group a `lib` rule kept the scripts' folder out of the repo, and the production build broke. After installing, run `npm install` / `pnpm install` if it added `tsx`, and commit the installed files.

Payload is never booted. The scripts only load the config (found like `payload` CLI does: `PAYLOAD_CONFIG_PATH`, tsconfig `@payload-config`, `src/payload.config.ts`), so no cron job, seed or `onInit` runs.

## 2. Wire the runtime fix

In `payload.config.ts`, wrap the adapter:

```ts
import { withLatestVersionFix } from './db/withLatestVersionFix'; // path relative to the config

db: withLatestVersionFix(mongooseAdapter({
  url: process.env.DATABASE_URL || '',
  transactionOptions: false,
})),
```

After every version write it keeps exactly one `latest` version per document. It matches `parent` both as a string and as an ObjectId, so a document left with an old string-parent `latest` heals on its next save. It also covers the second cause of duplicates: concurrent saves without transactions (see [references/transactions.md](./references/transactions.md)). Keep it even after the data is fixed: it costs one indexed query per save.

Verify: the app's `types` and `build` pass.

## 3. Check, review, apply (per environment)

Follow [references/runbook.md](./references/runbook.md). In short:

```bash
npm run db:check -- -v                          # read-only; exit 0 clean, 1 action needed, 2 error
npm run db:fix -- -v                            # dry run: every planned change, writes nothing
npm run db:fix:apply -- --expect-db=<db name>   # writes a backup, applies, re-checks
npm run db:check                                # must print "Database is clean." (exit 0)
```

With pnpm: `pnpm db:check -v`, `pnpm db:fix:apply --expect-db=<db>`.

Rules for the agent:

- `db:check` and the `db:fix` dry run are read-only: run them freely on the database the local env points to.
- **Never run `db:fix:apply` without the user's explicit go-ahead** for that database name, after they have seen the dry run. The `--expect-db` guard refuses to write unless it matches the connected database.
- **Staging and production: the user runs the commands**, with `DATABASE_URL` set in their own shell. Give them the exact commands and the runbook. Never ask for production credentials.
- Deploy the runtime fix (step 2) **before** applying on a deployed environment, otherwise editors can create new duplicates right after the fix.
- A `db:fix` dry run listing "no latest → set" rows means those documents are hidden from the admin list today: point them out to the user.

## 4. Record the result

Copy [assets/DB_SANITIZE.template.md](./assets/DB_SANITIZE.template.md) to `<repo-root>/bom-upgrade/DB_SANITIZE.md` and fill it in for every environment: database name, date, `db:check` before and after, backup file, who applied. The upgrade skills' guardrails read this file. For environments the user handled, record their confirmation and the `db:check` output they pasted.

Optionally, add `db:check` to CI or to the deploy pipeline. Its exit code 1 blocks a deploy on unsanitized data.

## 5. Completion

Done when:

- the runtime fix is wired and the app builds;
- `db:check` exits 0 on dev, and on every deployed environment (confirmed by the user);
- `bom-upgrade/DB_SANITIZE.md` records it;
- the backups are kept, outside git, until the user has validated the admin and the site.

Tell the user which environments are still pending.
