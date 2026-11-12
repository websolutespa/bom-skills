// Runs the selected checks and prints their status / planned changes.
import { analyzeLatest, describeVersion } from './checks/latest.mjs';
import { analyzeRelationships } from './checks/relationships.mjs';
import { getTargets } from './config.mjs';

export const label = t => {
  const kind = t.kind === 'collection' ? '' : t.kind === 'versions' ? ' versions' : t.kind === 'global' ? ' (global)' : ' (global versions)';
  return `${t.slug}${kind}`;
};

export async function analyze(db, config, args) {
  const { targets, unknownVersionCollections } = await getTargets(db, config, args.collections);
  const analysis = {
    database: db.databaseName, latestIssues: [], orphanIssues: [], unknownVersionCollections,
    missingCollections: targets.filter(t => !t.exists && (t.kind === 'collection' || t.kind === 'versions')),
    needsMigration: false, needsFix: false,
  };
  if (args.checks.includes('relationships')) {
    analysis.relationships = await analyzeRelationships(db, config, targets);
    analysis.needsMigration = analysis.relationships.some(r => r.docs.length > 0);
  }
  if (args.checks.includes('latest')) {
    analysis.latest = await analyzeLatest(db, targets);
    const all = analysis.latest.flatMap(r => r.issues);
    analysis.orphanIssues = all.filter(i => i.orphan);
    analysis.latestIssues = all.filter(i => !i.orphan || args.includeOrphans);
    analysis.needsFix = analysis.latestIssues.length > 0;
  }
  return analysis;
}

function topPaths(paths, max = 6) {
  const entries = Object.entries(paths).sort((a, b) => b[1] - a[1]);
  const shown = entries.slice(0, max).map(([p, n]) => `${p} (${n})`).join(', ');
  return entries.length > max ? `${shown}, +${entries.length - max} more` : shown;
}

export function printStatus(a, verbose) {
  if (a.relationships) {
    console.log('\n== relationships: ids stored as strings instead of ObjectId (Payload 2 -> 3 leftover)');
    for (const r of a.relationships) {
      if (!r.target.exists) continue;
      const status = r.docs.length ? '[needs migration]' : '[ok]             ';
      const detail = r.docs.length ? `${r.docs.length}/${r.scanned} docs, ${r.values} values: ${topPaths(r.paths)}` : `${r.scanned} docs`;
      console.log(`${status} ${label(r.target).padEnd(32)} ${detail}`);
      if (verbose) {
        for (const d of r.docs.slice(0, 5)) {
          console.log(`      ${String(d.id)}: ${d.conversions.slice(0, 4).map(c => c.path).join(', ')}${d.conversions.length > 4 ? ` +${d.conversions.length - 4}` : ''}`);
        }
        if (r.docs.length > 5) console.log(`      … ${r.docs.length - 5} more docs`);
      }
    }
  }

  if (a.latest) {
    console.log('\n== latest: documents must have exactly one `latest` version (draft listings)');
    for (const r of a.latest) {
      if (!r.target.exists) continue;
      const dup = r.issues.filter(i => i.type === 'duplicate');
      const missing = r.issues.filter(i => i.type === 'missing');
      const fixable = r.issues.filter(i => a.latestIssues.includes(i));
      const status = fixable.length ? '[needs fix]      ' : '[ok]             ';
      const types = Object.entries(r.parentTypes).map(([t, n]) => `${t}:${n}`).join(' ');
      const orphans = r.issues.filter(i => i.orphan).length;
      console.log(`${status} ${label(r.target).padEnd(32)} ${r.versions} versions (parent ${types || '-'})  >1 latest: ${dup.length}  no latest: ${missing.length}${orphans ? `  (orphans: ${orphans})` : ''}`);
      for (const issue of r.issues) {
        console.log(`      parent ${issue.parent}${issue.orphan ? ' ORPHAN' : ''}: ${issue.type === 'duplicate' ? `latest x${issue.stale.length + 1}` : 'no latest'} -> ${issue.reasons.join(', ')}`);
        if (verbose) {
          console.log(`        ${issue.type === 'duplicate' ? 'keep ' : 'set  '} ${describeVersion(issue.keep)}`);
          for (const v of issue.stale) console.log(`        unset ${describeVersion(v)}`);
        }
      }
    }
  }

  if (a.missingCollections.length) {
    console.log(`\nInfo: configured collections not present in the db (never written yet): ${a.missingCollections.map(t => t.name).join(', ')}`);
  }
  if (a.unknownVersionCollections.length) {
    console.log(`Info: versions collections in the db with no matching versioned collection in the config (ignored): ${a.unknownVersionCollections.join(', ')}`);
  }
}

export function printPlan(a, verbose) {
  if (a.relationships) {
    const affected = a.relationships.filter(r => r.docs.length);
    console.log(`\n== relationships: convert string ids to ObjectId (${affected.length} collections)`);
    for (const r of affected) {
      console.log(`  ${label(r.target)} (${r.target.name}): ${r.docs.length} docs, ${r.values} values`);
      for (const d of verbose ? r.docs : r.docs.slice(0, 3)) {
        console.log(`      ${String(d.id)}`);
        for (const c of verbose ? d.conversions : d.conversions.slice(0, 3)) console.log(`        ${c.path}: "${c.from}" -> ObjectId("${c.from}")`);
        if (!verbose && d.conversions.length > 3) console.log(`        … +${d.conversions.length - 3} paths`);
      }
      if (!verbose && r.docs.length > 3) console.log(`      … ${r.docs.length - 3} more docs (-v to list all)`);
    }
  }
  if (a.latest) {
    console.log(`\n== latest: ${a.latestIssues.length} documents`);
    for (const issue of a.latestIssues) {
      console.log(`  ${label(issue.target)} parent ${issue.parent}${issue.orphan ? ' ORPHAN' : ''} (${issue.reasons.join(', ')})`);
      console.log(`      ${issue.type === 'duplicate' ? 'keep ' : 'set  '} ${describeVersion(issue.keep)}`);
      for (const v of issue.stale) console.log(`      unset ${describeVersion(v)}`);
    }
  }
}

export function printSummary(a) {
  const rel = a.relationships;
  const relDocs = rel ? rel.reduce((n, r) => n + r.docs.length, 0) : 0;
  const relValues = rel ? rel.reduce((n, r) => n + r.values, 0) : 0;
  const stale = a.latestIssues.reduce((n, i) => n + i.stale.length, 0);
  const missing = a.latestIssues.filter(i => i.type === 'missing').length;
  console.log('\nSummary');
  if (rel) console.log(`  relationships : ${relDocs ? `NEEDS MIGRATION — ${relValues} string ids in ${relDocs} documents` : 'ok'}`);
  if (a.latest) {
    console.log(`  latest        : ${a.needsFix ? `NEEDS FIX — ${a.latestIssues.filter(i => i.type === 'duplicate').length} docs with >1 latest (${stale} flags to unset), ${missing} docs with no latest` : 'ok'}`);
    if (a.orphanIssues.length) console.log(`                  ${a.orphanIssues.length} orphan parents (no main document) ${a.latestIssues.some(i => i.orphan) ? 'included' : 'excluded, pass --include-orphans to fix them too'}`);
  }
}
