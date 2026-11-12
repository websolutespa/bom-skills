// db:fix — fixes what db:check reports. DRY RUN by default.
// Installed by the `bom-db-sanitize` skill.
//
//   relationships : $set string ids to ObjectId, only on the exact paths Payload's own write transform
//                   converts (the v2 -> v3 relationship migration, versions' `parent` included)
//   latest        : one `latest: true` version per document (keep newest, unset the others / set when missing)
//
// Writing requires --apply AND --expect-db=<database name> matching the connected database.
// A backup of every touched value is written before any change; revert with --restore.
// Updates are guarded (a value changed since planning is skipped, not overwritten).
// Exit code: 0 done (dry run or apply; leftovers are reported as a warning), 2 error
// (connection, bad arguments, --expect-db guard). Use db:check (exit 1 = action needed) to gate CI.
//
// Usage:
//   npm run db:fix -- -v                                    # dry run: planned changes
//   npm run db:fix:apply -- --expect-db=<db>                # write
//   npm run db:fix -- --check=latest --collection=homepage  # limit scope
//   npm run db:fix -- --apply --expect-db=<db> --restore=./db-fix-backup-<ts>.json
//
// Runbook for every environment (dev, staging, production):
//   1. deploy the app with withLatestVersionFix wired in payload.config.ts
//   2. set DATABASE_URL in the shell (it wins over .env / .env.local); check the db name printed
//   3. npm run db:check -- -v --json=db-check-before.json
//   4. npm run db:fix -- -v                                 # review. "no latest -> set" rows are docs
//                                                           # hidden from the admin list today
//   5. npm run db:fix:apply -- --expect-db=<db>             # preferably in a low-traffic window
//   6. npm run db:check                                     # expect: Database is clean
//   7. keep the backup file printed in step 5 (repo root, gitignored) until the result is validated
import { applyLatest, latestBackupEntries, restoreLatest } from './utils/checks/latest.mjs';
import { applyRelationships, relationshipsBackupEntries, restoreRelationships } from './utils/checks/relationships.mjs';
import { loadPayloadConfig } from './utils/config.mjs';
import { assertExpectedDb, connect, readBackup, writeBackup } from './utils/db.mjs';
import { initEnv, parseArgs, runHint } from './utils/env.mjs';
import { analyze, printPlan, printSummary } from './utils/report.mjs';

async function restore(args) {
  const { client, db } = await connect({ write: args.apply });
  try {
    if (args.apply) assertExpectedDb(db, args.expectDb);
    const backup = readBackup(db, args.restore);
    const rel = backup.entries.filter(e => e.check === 'relationships');
    const latest = backup.entries.filter(e => e.check === 'latest');
    console.log(`${args.apply ? 'Restoring' : '[dry run] Would restore'} ${rel.length} relationship values and ${latest.length} latest flags from ${args.restore}`);
    if (!args.apply) return;
    // reverse order of apply: latest flags first, then relationship ids
    const restoredLatest = await restoreLatest(db, latest);
    const restoredRel = await restoreRelationships(db, rel);
    console.log(`Restored ${restoredLatest} latest flags, ${restoredRel} relationship values.`);
  } finally {
    await client.close();
  }
}

async function main() {
  initEnv();
  const args = parseArgs();
  if (args.restore) {
    await restore(args);
    return;
  }

  const config = await loadPayloadConfig();
  const { client, db } = await connect({ write: args.apply });
  try {
    if (args.apply) assertExpectedDb(db, args.expectDb);
    console.log(args.apply ? 'Mode: APPLY (writes enabled)' : 'Mode: DRY RUN (no writes)');

    const analysis = await analyze(db, config, args);
    if (!analysis.needsMigration && !analysis.needsFix) {
      printSummary(analysis);
      console.log('\nNothing to fix.');
      return;
    }
    printPlan(analysis, args.verbose);
    printSummary(analysis);

    if (!args.apply) {
      const flags = [
        `--expect-db=${db.databaseName}`,
        args.checks.length < 2 ? `--check=${args.checks.join(',')}` : '',
        args.collections.length ? `--collection=${args.collections.join(',')}` : '',
        args.includeOrphans ? '--include-orphans' : '',
      ].filter(Boolean).join(' ');
      console.log(`\nDry run complete. Re-run with: ${runHint('db:fix:apply', flags)}`);
      return;
    }

    const entries = [
      ...(analysis.relationships ? relationshipsBackupEntries(analysis.relationships) : []),
      ...latestBackupEntries(analysis.latestIssues),
    ];
    console.log(`\nBackup written to ${writeBackup(db, entries, args.backupDir)}`);

    if (analysis.relationships) {
      const r = await applyRelationships(db, analysis.relationships, args.batch);
      console.log(`relationships: ${r.modified} documents updated${r.skipped ? `, ${r.skipped} skipped (changed since planning)` : ''}`);
    }
    if (analysis.latest) {
      const l = await applyLatest(db, analysis.latestIssues);
      console.log(`latest: unset ${l.unset}, set ${l.set}${l.skipped ? `, ${l.skipped} skipped (changed since planning)` : ''}`);
    }

    const after = await analyze(db, config, args);
    const clean = !after.needsMigration && !after.needsFix;
    console.log(clean ? '\nVerification: database is clean.' : '\nWarning: issues remain (documents edited during the run?) — run db:fix again. Use db:check to gate CI.');
  } finally {
    await client.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 2;
});
