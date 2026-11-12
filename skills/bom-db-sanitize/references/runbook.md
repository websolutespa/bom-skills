# Runbook: sanitize one environment

Repeat for every environment: dev, staging, production. Commands are shown for npm; with pnpm drop the `run` and the `--` (`pnpm db:fix:apply --expect-db=<db>`).

## Before

1. The runtime fix (`withLatestVersionFix`) is **deployed** on that environment. Otherwise editors can create new duplicates right after the fix.
2. Choose the database explicitly. The tool reads `DATABASE_URL` from `.env` / `.env.local`; a value set in the shell wins:

   ```bash
   # bash
   export DATABASE_URL='mongodb+srv://…/<db>'
   ```

   ```powershell
   # PowerShell
   $env:DATABASE_URL = 'mongodb+srv://…/<db>'
   ```

   Every command prints the host and database it connected to (password masked). Check it.
3. Take a regular database snapshot (Atlas backup / `mongodump`) for production. The tool's own backup only covers the values it changes.

## Run

| Step | Command | Writes? | Expect |
|---|---|---|---|
| 1 | `npm run db:check -- -v --json=db-check-before.json` | no | exit 1 and the findings, or exit 0 (nothing to do: stop here) |
| 2 | `npm run db:fix -- -v` | no | every planned change. Review it, especially "no latest → set" rows: those documents are hidden from the admin list today |
| 3 | `npm run db:fix:apply -- --expect-db=<db>` | **yes** | "Backup written to …", the counts, "Verification: database is clean." |
| 4 | `npm run db:check` | no | "Database is clean." (exit 0) |

Step 3 refuses to run without `--expect-db`, or when it doesn't match the connected database. Run it when few editors are working: a document edited between planning and writing is skipped (reported), not overwritten. If anything is skipped, run steps 2–4 again.

Useful options: `--collection=homepage,news_detail` (limit scope), `--check=latest` or `--check=relationships`, `--include-orphans`, `--backup-dir=<dir>` (default: the repository root; outside git, the Payload app folder).

## After

- Check the admin lists of the draft-enabled collections (no duplicated rows), a few documents with media and relationships, and the site.
- Record the environment in `bom-upgrade/DB_SANITIZE.md`.
- **Backup file** (`<repo root>/db-fix-backup-<timestamp>.json`): gitignored by the root `.gitignore` rule the installer adds. `db:fix:apply` checks it with git and prints a warning if the file is not ignored. Keep it until the result is validated, then delete it, or move it next to the database backups. It holds database ids and values: never commit it.

## Undo

```bash
npm run db:fix -- --apply --expect-db=<db> --restore=db-fix-backup-<timestamp>.json
```

It restores every changed value. Values edited after the fix are skipped (the restore checks each value is still what the fix wrote). Field order inside a document may differ; values are identical.

## CI / deploy gate (optional)

`db:check` exits 1 when action is needed. Run it in CI or before a deploy, with a read-only database user, to block a release on unsanitized data. `db:fix` always exits 0 unless it fails, so don't use it as a gate.

## Exit codes

| Command | 0 | 1 | 2 |
|---|---|---|---|
| `db:check` | clean | action needed | error (connection, config, arguments) |
| `db:fix` / `db:fix:apply` | done (dry run or applied; leftovers are a warning) | — | error, including the `--expect-db` guard |
