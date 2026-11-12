#!/usr/bin/env node
// Installs the bom-db-sanitize tool into a Payload 3 + MongoDB app:
//   <app>/scripts/db/                 db-check.mjs, db-fix.mjs and their utils
//   <app>/src/db/withLatestVersionFix.ts   runtime fix (wire it in payload.config.ts yourself)
//   <app>/package.json                db:check, db:fix, db:fix:apply scripts (+ tsx devDependency if missing)
//   <repo root>/.gitignore            db-fix-backup-*.json (db:fix:apply writes its backups to the repo root)
//
// Usage (from the project root):
//   node .agents/skills/bom-db-sanitize/scripts/install.mjs [--app <dir>] [--dry-run] [--force]
//
//   --app      the Payload app folder (the one whose package.json depends on `payload`).
//              Auto-detected when there is exactly one.
//   --dry-run  print what would change, write nothing.
//   --force    overwrite an edited src/db/withLatestVersionFix.ts and existing db:* scripts.
//
// Idempotent: running it again only reports "unchanged".
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(skillRoot, 'assets', 'db-tools');

const SCRIPTS = {
  'db:check': 'tsx scripts/db/db-check.mjs',
  'db:fix': 'tsx scripts/db/db-fix.mjs',
  'db:fix:apply': 'tsx scripts/db/db-fix.mjs --apply',
};
const GITIGNORE_LINE = 'db-fix-backup-*.json';

function parseArgs(argv) {
  const args = { app: undefined, dryRun: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--app') args.app = argv[++i];
    else if (arg.startsWith('--app=')) args.app = arg.slice('--app='.length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const dependsOn = (pkg, name) => Boolean(pkg.dependencies?.[name] || pkg.devDependencies?.[name]);

/** package.json files (no node_modules / build output) up to a few levels deep. */
function findPackageJsons(dir, depth = 0, out = []) {
  if (depth > 4) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'package.json' && entry.isFile()) out.push(path.join(dir, entry.name));
    else if (entry.isDirectory() && !entry.name.startsWith('.') && !['node_modules', 'dist', 'build', 'out', 'coverage'].includes(entry.name)) {
      findPackageJsons(path.join(dir, entry.name), depth + 1, out);
    }
  }
  return out;
}

function detectApp(cwd, explicit) {
  if (explicit) {
    const dir = path.resolve(cwd, explicit);
    const file = path.join(dir, 'package.json');
    if (!fs.existsSync(file)) throw new Error(`No package.json in --app ${dir}`);
    if (!dependsOn(readJson(file), 'payload')) throw new Error(`${file} does not depend on "payload"`);
    return dir;
  }
  const candidates = findPackageJsons(cwd).filter(file => {
    try { return dependsOn(readJson(file), 'payload'); } catch { return false; }
  });
  if (candidates.length === 1) return path.dirname(candidates[0]);
  if (!candidates.length) throw new Error('No package.json depending on "payload" found. Pass --app <dir>.');
  throw new Error(`Several Payload apps found, pass --app <dir>:\n${candidates.map(c => `  ${path.relative(cwd, path.dirname(c)) || '.'}`).join('\n')}`);
}

/** package.json of an installed dependency (its `exports` may not expose ./package.json). */
function packageJsonOf(appRequire, name) {
  for (let dir = path.dirname(appRequire.resolve(name)); path.dirname(dir) !== dir; dir = path.dirname(dir)) {
    const file = path.join(dir, 'package.json');
    if (fs.existsSync(file) && readJson(file).name === name) return file;
  }
  throw new Error(`package.json of ${name} not found`);
}

/** git repository root of a folder, or undefined outside git. */
function gitRoot(dir) {
  try {
    return path.resolve(execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
  } catch {
    return undefined;
  }
}

function packageManager(appDir) {
  for (let dir = appDir; ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml')) || fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(dir, 'package-lock.json'))) return 'npm';
    if (path.dirname(dir) === dir) return 'npm';
  }
}

function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full, base) : [path.relative(base, full)];
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const appDir = detectApp(cwd, args.app);
  const rel = p => path.relative(cwd, p) || '.';
  const pkgFile = path.join(appDir, 'package.json');
  const pkgText = fs.readFileSync(pkgFile, 'utf8');
  const pkg = JSON.parse(pkgText);
  const pm = packageManager(appDir);
  const changes = [];
  const warnings = [];
  const write = (file, content) => {
    if (args.dryRun) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };

  console.log(`${args.dryRun ? '[dry run] ' : ''}Installing bom-db-sanitize into ${rel(appDir)} (${pm})`);
  if (!dependsOn(pkg, '@payloadcms/db-mongodb')) {
    throw new Error(`${rel(pkgFile)} does not depend on @payloadcms/db-mongodb: the tool only supports the MongoDB adapter.`);
  }
  const payloadMajor = Number(String(pkg.dependencies?.payload || pkg.devDependencies?.payload).replace(/^[^\d]*/, '').split('.')[0]);
  if (payloadMajor !== 3) {
    throw new Error(`payload ${pkg.dependencies?.payload || pkg.devDependencies?.payload}: the tool needs Payload 3 (on Payload 2, run the bom-stack-upgrade skill first).`);
  }

  // 1. scripts/db
  const installed = [];
  const scriptsSrc = path.join(assets, 'scripts', 'db');
  for (const file of listFiles(scriptsSrc)) {
    const src = path.join(scriptsSrc, file);
    const dest = path.join(appDir, 'scripts', 'db', file);
    installed.push(dest);
    const content = fs.readFileSync(src);
    if (fs.existsSync(dest) && fs.readFileSync(dest).equals(content)) continue;
    changes.push(`${fs.existsSync(dest) ? 'update' : 'create'} ${rel(dest)}`);
    write(dest, content);
  }

  // 2. runtime fix (never overwrite a project-edited copy unless --force)
  const fixSrc = path.join(assets, 'src', 'db', 'withLatestVersionFix.ts');
  const fixDest = path.join(appDir, 'src', 'db', 'withLatestVersionFix.ts');
  installed.push(fixDest);
  const fixContent = fs.readFileSync(fixSrc);
  if (!fs.existsSync(fixDest)) {
    changes.push(`create ${rel(fixDest)}`);
    write(fixDest, fixContent);
  } else if (!fs.readFileSync(fixDest).equals(fixContent)) {
    if (args.force) {
      changes.push(`overwrite ${rel(fixDest)} (--force)`);
      write(fixDest, fixContent);
    } else {
      warnings.push(`${rel(fixDest)} differs from the skill's version: kept. Compare with ${fixSrc}, or re-run with --force.`);
    }
  }

  // 3. package.json scripts + tsx
  pkg.scripts ||= {};
  let pkgChanged = false;
  for (const [name, command] of Object.entries(SCRIPTS)) {
    if (pkg.scripts[name] === command) continue;
    if (pkg.scripts[name] && !args.force) {
      warnings.push(`package.json script "${name}" already exists ("${pkg.scripts[name]}"): kept. Re-run with --force to replace it with "${command}".`);
      continue;
    }
    changes.push(`package.json scripts.${name} = "${command}"`);
    pkg.scripts[name] = command;
    pkgChanged = true;
  }
  const appRequire = createRequire(pkgFile);
  let tsxResolvable = true;
  try { appRequire.resolve('tsx/package.json'); } catch { tsxResolvable = false; }
  if (!tsxResolvable && !dependsOn(pkg, 'tsx')) {
    let version = '^4.21.0';
    try { version = readJson(packageJsonOf(appRequire, 'payload')).dependencies?.tsx || version; } catch { /* keep default */ }
    pkg.devDependencies ||= {};
    pkg.devDependencies.tsx = version;
    changes.push(`package.json devDependencies.tsx = "${version}" (not resolvable from the app; Payload's own version)`);
    pkgChanged = true;
    warnings.push(`Run \`${pm} install\` to install tsx.`);
  }
  if (pkgChanged) {
    const indent = pkgText.match(/^[ \t]+(?=")/m)?.[0] || '  ';
    write(pkgFile, `${JSON.stringify(pkg, null, indent)}${pkgText.endsWith('\n') ? '\n' : ''}`);
  }

  // 4. .gitignore: backups hold database ids and values, they must never be committed.
  //    db:fix:apply writes them to the repository root, so the rule goes in the root .gitignore
  //    (a pattern without a slash also matches backups written anywhere else with --backup-dir).
  const root = gitRoot(appDir);
  const sampleBackup = path.join(root ?? appDir, 'db-fix-backup-2000-01-01T00-00-00-000Z.json');
  const isIgnored = () => {
    try {
      execFileSync('git', ['check-ignore', '-q', '--no-index', sampleBackup], { cwd: root, stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };
  if (!root || !isIgnored()) {
    const gitignore = path.join(root ?? appDir, '.gitignore');
    const gitignoreText = fs.existsSync(gitignore) ? fs.readFileSync(gitignore, 'utf8') : '';
    if (!gitignoreText.split(/\r?\n/).some(line => line.trim() === GITIGNORE_LINE)) {
      changes.push(`${rel(gitignore)} += ${GITIGNORE_LINE}`);
      const sep = gitignoreText && !gitignoreText.endsWith('\n') ? '\n' : '';
      write(gitignore, `${gitignoreText}${sep}\n# backups written by db:fix:apply (bom-db-sanitize)\n${GITIGNORE_LINE}\n`);
    }
    if (root && !args.dryRun && !isIgnored()) {
      throw new Error(`${rel(sampleBackup)} is still not gitignored after adding "${GITIGNORE_LINE}" to ${rel(gitignore)}: a negation rule probably re-includes it (\`git check-ignore -v --no-index ${rel(sampleBackup)}\`).`);
    }
  }

  // 5. the installed files must be committable (a `lib` rule in .gitignore once hid utils from git)
  let ignored = [];
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: appDir, stdio: 'ignore' });
    try {
      ignored = execFileSync('git', ['check-ignore', '--no-index', ...installed], { cwd: appDir, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
    } catch { /* exit 1 = nothing ignored */ }
  } catch {
    warnings.push('Not a git work tree: could not check that the installed files are committable.');
  }

  console.log(changes.length ? changes.map(c => `  ${c}`).join('\n') : '  everything already installed (unchanged)');
  for (const w of warnings) console.log(`  ! ${w}`);
  if (ignored.length) {
    console.error(`\nERROR: these installed files are gitignored and would never reach CI/production builds:\n${ignored.map(f => `  ${rel(path.resolve(appDir, f))}`).join('\n')}\nFix the .gitignore rule that matches them (\`git check-ignore -v <file>\`).`);
    process.exitCode = 1;
    return;
  }

  const run = s => (pm === 'pnpm' ? `pnpm ${s}` : `npm run ${s}`);
  console.log(`
Next steps:
  1. Wire the runtime fix in payload.config.ts (if not done yet):
       import { withLatestVersionFix } from './db/withLatestVersionFix';   // path relative to the config
       db: withLatestVersionFix(mongooseAdapter({ url: process.env.DATABASE_URL || '', ... })),
  2. ${run('db:check')}            read-only report (exit 1 = action needed)
  3. ${run('db:fix')} ${pm === 'pnpm' ? '' : '-- '}-v        dry run: every planned change
  4. ${run('db:fix:apply')} ${pm === 'pnpm' ? '' : '-- '}--expect-db=<db name>   only after reviewing step 3`);
}

try {
  main();
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 2;
}
