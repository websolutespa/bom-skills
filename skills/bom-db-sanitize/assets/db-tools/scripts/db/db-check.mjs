// db:check — read-only health report of the Payload MongoDB data.
// Installed by the `bom-db-sanitize` skill. Payload is not booted: the config is only loaded to know
// the fields, so no cron job, seed or onInit hook runs. Never writes to the db.
//
// Checks:
//   relationships  ids stored as strings where Payload 3 stores ObjectIds (Payload 2 -> 3 leftover)
//   latest         documents with more than one (or no) `latest` version: duplicated / missing rows
//                  in the admin list of draft-enabled collections
//
// Usage (DATABASE_URL from .env / .env.local, or set in the shell to target another db):
//   npm run db:check
//   npm run db:check -- -v --collection=homepage --check=latest --json=./db-check.json
//
// Exit code: 0 clean, 1 action needed (run db:fix to see the planned changes), 2 error.
// Use it as a CI / deploy gate.
import fs from 'node:fs';
import { loadPayloadConfig } from './utils/config.mjs';
import { connect } from './utils/db.mjs';
import { initEnv, parseArgs, runHint } from './utils/env.mjs';
import { analyze, label, printStatus, printSummary } from './utils/report.mjs';

async function main() {
  initEnv();
  const args = parseArgs();
  if (args.apply || args.restore) throw new Error('db:check is read-only: use db:fix / db:fix:apply to write');
  const config = await loadPayloadConfig();
  const { client, db } = await connect({ write: false });
  try {
    const analysis = await analyze(db, config, args);
    printStatus(analysis, args.verbose);
    printSummary(analysis);
    const actionNeeded = analysis.needsMigration || analysis.needsFix;
    console.log(actionNeeded ? `\nAction needed: run \`${runHint('db:fix', '-v')}\` to review the planned changes.` : '\nDatabase is clean.');
    if (args.json) {
      fs.writeFileSync(args.json, JSON.stringify({
        generatedAt: new Date().toISOString(),
        database: analysis.database,
        needsMigration: analysis.needsMigration,
        needsFix: analysis.needsFix,
        relationships: analysis.relationships?.filter(r => r.target.exists).map(r => ({
          target: label(r.target), collection: r.target.name, scanned: r.scanned, docs: r.docs.length, values: r.values, paths: r.paths,
          sample: r.docs.slice(0, 20).map(d => ({ id: String(d.id), paths: d.conversions.map(c => c.path) })),
        })),
        latest: analysis.latest?.filter(r => r.target.exists).map(r => ({
          target: label(r.target), collection: r.target.name, versions: r.versions, parentTypes: r.parentTypes,
          issues: r.issues.map(i => ({ type: i.type, parent: i.parent, orphan: i.orphan, reasons: i.reasons, keep: String(i.keep._id), unset: i.stale.map(v => String(v._id)) })),
        })),
      }, null, 2));
      console.log(`Report written to ${args.json}`);
    }
    process.exitCode = actionNeeded ? 1 : 0;
  } finally {
    await client.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 2;
});
