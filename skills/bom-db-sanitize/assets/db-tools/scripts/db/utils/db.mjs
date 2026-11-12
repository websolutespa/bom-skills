// MongoDB access for db:check / db:fix: connection, --expect-db guard, ids, backups.
// The driver is taken from the project's own @payloadcms/db-mongodb (through its mongoose),
// so no extra dependency is needed and it works with pnpm's strict node_modules too.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const requireFromAdapter = createRequire(import.meta.resolve('@payloadcms/db-mongodb'));
/** mongoose as used by the project's Payload adapter */
export const mongoose = requireFromAdapter('mongoose');
/** the mongodb driver bundled with that mongoose */
export const { MongoClient, ObjectId } = mongoose.mongo;

export function maskUrl(url) {
  return url.replace(/(\/\/)[^@/]*@/, '$1***@');
}

/** Read-only connections prefer secondaries, keeping diagnostic load off the primary. */
export async function connect({ write = false } = {}) {
  const url = process.env.DATABASE_URL;
  if (!url || !/^mongodb(\+srv)?:\/\//.test(url)) {
    throw new Error('DATABASE_URL is missing or is not a mongodb connection string');
  }
  const client = new MongoClient(url, write ? {} : { readPreference: 'secondaryPreferred' });
  await client.connect();
  const db = client.db();
  console.log(`Connected to ${maskUrl(url)} (db: ${db.databaseName}, ${write ? 'read-write' : 'read-only, secondaryPreferred'})`);
  return { client, db };
}

export function assertExpectedDb(db, expectDb) {
  if (!expectDb) {
    throw new Error(`Refusing to write without --expect-db=<name>. Connected database is "${db.databaseName}".`);
  }
  if (expectDb !== db.databaseName) {
    throw new Error(`--expect-db="${expectDb}" does not match the connected database "${db.databaseName}". Nothing written.`);
  }
}

/**
 * ObjectId check by BSON type tag, not `instanceof`: the driver and Payload's transform can come
 * from different `bson` copies, whose ObjectId classes are not the same.
 */
export function isObjectId(value) {
  return value !== null && typeof value === 'object' && value._bsontype === 'ObjectId';
}

/** Both representations of an id, for queries that must match a string and an ObjectId. */
export function idForms(id) {
  const hex = isObjectId(id) ? id.toHexString() : String(id);
  return ObjectId.isValid(hex) && new ObjectId(hex).toHexString() === hex ? [new ObjectId(hex), hex] : [id];
}

export function serializeId(id) {
  if (isObjectId(id)) return { id: id.toHexString(), idType: 'objectId' };
  if (typeof id === 'number') return { id: String(id), idType: 'number' };
  return { id: String(id), idType: 'string' };
}

export function deserializeId({ id, idType }) {
  if (idType === 'objectId') return new ObjectId(id);
  if (idType === 'number') return Number(id);
  return id;
}

/**
 * One backup entry = one field of one document, with the value it had before the fix:
 *   { check: 'relationships', collection, id, idType, path, previous: string }
 *   { check: 'latest', collection, id, idType, previous: true | null }
 */
export function writeBackup(db, entries, dir) {
  const backup = { createdAt: new Date().toISOString(), database: db.databaseName, entries };
  const file = path.resolve(dir, `db-fix-backup-${backup.createdAt.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 2));
  warnIfCommittable(file);
  return file;
}

/** Backups hold database ids and values: warn loudly if git would pick the file up. */
function warnIfCommittable(file) {
  const cwd = path.dirname(file);
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd, stdio: 'ignore' });
  } catch {
    return; // not in a git work tree
  }
  try {
    execFileSync('git', ['check-ignore', '-q', file], { cwd, stdio: 'ignore' });
  } catch {
    console.warn(`\nWARNING: ${file} is NOT gitignored and could be committed. Add \`db-fix-backup-*.json\` to the repository's root .gitignore (the bom-db-sanitize installer does it).`);
  }
}

export function readBackup(db, file) {
  const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (backup.database !== db.databaseName) {
    throw new Error(`Backup was taken on database "${backup.database}", connected to "${db.databaseName}"`);
  }
  return backup;
}

export function iso(value) {
  return value ? new Date(value).toISOString() : '-';
}
