// Environment, arguments and runner helpers for db:check / db:fix.
// Installed by the `bom-db-sanitize` skill into <payload-app>/scripts/db/.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'payload/node';

/** The Payload app root: scripts live in <app>/scripts/db/utils/. */
export const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** The git repository root (where db-fix backups go by default), or the app root outside git. */
export function repoRoot() {
  try {
    return path.resolve(execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: appRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
  } catch {
    return appRoot;
  }
}

/**
 * Run from the app root and load env the way Next.js does (.env, .env.local, .env.development…).
 * Variables already set in the shell win, so `DATABASE_URL=… npm run db:check` targets another db.
 */
export function initEnv() {
  process.chdir(appRoot);
  loadEnv();
}

export const CHECKS = ['relationships', 'latest'];

/**
 * @typedef {{
 *   apply: boolean, verbose: boolean, json?: string, collections: string[], checks: string[],
 *   includeOrphans: boolean, batch: number, expectDb?: string, restore?: string, backupDir: string,
 * }} Args
 */

/** @returns {Args} */
export function parseArgs(argv = process.argv.slice(2)) {
  /** @type {Args} */
  const args = {
    apply: false, verbose: false, collections: [], checks: [...CHECKS],
    includeOrphans: false, batch: 500, backupDir: repoRoot(),
  };
  const value = arg => arg.slice(arg.indexOf('=') + 1);
  for (const arg of argv) {
    if (arg === '--') continue; // pnpm passes the separator through
    if (arg === '--apply') args.apply = true;
    else if (arg === '--dry-run') args.apply = false;
    else if (arg === '--verbose' || arg === '-v') args.verbose = true;
    else if (arg === '--include-orphans') args.includeOrphans = true;
    else if (arg.startsWith('--json=')) args.json = value(arg);
    else if (arg.startsWith('--collection=')) args.collections.push(...value(arg).split(',').filter(Boolean));
    else if (arg.startsWith('--check=')) {
      const checks = value(arg).split(',').filter(Boolean);
      const unknown = checks.filter(x => !CHECKS.includes(x));
      if (unknown.length) throw new Error(`Unknown --check: ${unknown.join(', ')} (available: ${CHECKS.join(', ')})`);
      args.checks = checks;
    }
    else if (arg.startsWith('--batch=')) args.batch = Math.max(1, Number(value(arg)) || 500);
    else if (arg.startsWith('--expect-db=')) args.expectDb = value(arg);
    else if (arg.startsWith('--restore=')) args.restore = path.resolve(process.env.INIT_CWD || process.cwd(), value(arg));
    else if (arg.startsWith('--backup-dir=')) args.backupDir = path.resolve(process.env.INIT_CWD || process.cwd(), value(arg));
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

/** `npm run x -- --flag` vs `pnpm x --flag`, for the hints printed to the user. */
export function runHint(script, flags = '') {
  const pm = (process.env.npm_config_user_agent || '').startsWith('pnpm') ? 'pnpm' : 'npm';
  if (!flags) return `${pm} run ${script}`;
  return pm === 'pnpm' ? `pnpm ${script} ${flags}` : `npm run ${script} -- ${flags}`;
}
