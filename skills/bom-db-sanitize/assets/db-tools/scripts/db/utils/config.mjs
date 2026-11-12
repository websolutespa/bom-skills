// Loads the sanitized Payload config WITHOUT booting Payload (no db connection from Payload,
// no onInit: crons, seeding and static seeding never run) and maps it to MongoDB collections.
import { pathToFileURL } from 'node:url';
import { buildVersionCollectionFields, buildVersionGlobalFields } from 'payload';
import { findConfig } from 'payload/node';
import { mongoose } from './db.mjs';

export async function loadPayloadConfig() {
  const configPath = findConfig(); // PAYLOAD_CONFIG_PATH, tsconfig `@payload-config`, or src/payload.config.ts
  const started = Date.now();
  let config;
  try {
    const mod = await import(pathToFileURL(configPath).href);
    config = await (mod.default ?? mod);
  } catch (error) {
    throw new Error(`Could not load the Payload config ${configPath}: ${error.message}\n`
      + 'It is loaded with the app env (.env, .env.local, …, or variables set in the shell): set the variable it asks for and run again.', { cause: error });
  }
  console.log(`Payload config ${configPath} loaded in ${Date.now() - started}ms (${config.collections.length} collections, ${config.globals.length} globals, Payload not booted)`);
  return config;
}

/**
 * @typedef {'collection' | 'versions' | 'global' | 'globalVersions'} TargetKind
 * @typedef {{
 *   kind: TargetKind, slug: string, name: string, fields: any[], exists: boolean,
 *   parentCollection?: string, filter?: Record<string, unknown>,
 * }} Target
 */

const pluralize = mongoose.pluralize();

const dbNameOf = entity => (typeof entity.dbName === 'function' ? entity.dbName({}) : entity.dbName);

/** Mirrors @payloadcms/db-mongodb init.js + getDBName, with autoPluralization (the adapter default). */
function collectionNames(collection) {
  const dbName = dbNameOf(collection);
  const base = dbName || collection.slug;
  const plural = name => (dbName || !pluralize ? name : pluralize(name));
  return { main: plural(base), versions: plural(`_${base}_versions`) };
}

/** @returns {Promise<{ targets: Target[], unknownVersionCollections: string[] }>} */
export async function getTargets(db, config, only = []) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(x => x.name));
  const wanted = slug => only.length === 0 || only.includes(slug);
  /** @type {Target[]} */
  const targets = [];

  for (const collection of config.collections) {
    if (!wanted(collection.slug)) continue;
    const names = collectionNames(collection);
    targets.push({ kind: 'collection', slug: collection.slug, name: names.main, fields: collection.fields, exists: existing.has(names.main) });
    if (collection.versions) {
      targets.push({
        kind: 'versions', slug: collection.slug, name: names.versions,
        fields: buildVersionCollectionFields(config, collection),
        exists: existing.has(names.versions), parentCollection: names.main,
      });
    }
  }

  for (const global of config.globals) {
    if (!wanted(global.slug)) continue;
    targets.push({ kind: 'global', slug: global.slug, name: 'globals', fields: global.fields, exists: existing.has('globals'), filter: { globalType: global.slug } });
    if (global.versions) {
      const name = `_${dbNameOf(global) || global.slug}_versions`;
      targets.push({ kind: 'globalVersions', slug: global.slug, name, fields: buildVersionGlobalFields(config, global), exists: existing.has(name) });
    }
  }

  // versions collections left in the db for collections that no longer have versions (info only)
  const known = new Set(targets.map(t => t.name));
  const unknownVersionCollections = [...existing].filter(name => /^_.+_versions$/.test(name) && !known.has(name)).sort();
  return { targets, unknownVersionCollections };
}
