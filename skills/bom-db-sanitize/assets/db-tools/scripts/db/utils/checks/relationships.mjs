// Check "relationships": ids stored as strings where Payload 3 stores ObjectIds.
//
// Payload 2 on MongoDB stored relationship / upload ids (and versions' `parent`) as strings,
// Payload 3 stores them as ObjectId (when the related collection has no custom text/number id).
// The official migration for this is `migrateRelationshipsV2_V3` (@payloadcms/db-mongodb/migration-utils).
// Mixed types break every equality query on those fields — e.g. createVersion() clearing the
// previous `latest` version with `parent: { $eq: ObjectId }` misses string parents, which leaves two
// latest versions and duplicated rows in the admin list.
//
// Detection reuses Payload's own write `transform` (the one the official migration uses) on a clone
// of each document, then keeps ONLY the values that went from a string to an ObjectId with the same
// hex. The fix `$set`s exactly those paths: nothing else in the document is rewritten.
import { transform } from '@payloadcms/db-mongodb/internal';
import { deserializeId, isObjectId, ObjectId, serializeId } from '../db.mjs';

const isPlainObject = value =>
  value !== null && typeof value === 'object' && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

/** Deep clone of plain objects / arrays; BSON values (ObjectId, Date, Binary…) are kept by reference. */
function cloneDoc(value) {
  if (Array.isArray(value)) return value.map(cloneDoc);
  if (isPlainObject(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = cloneDoc(v);
    return out;
  }
  return value;
}

function diffStringToObjectId(original, transformed, path, out) {
  if (typeof original === 'string') {
    if (isObjectId(transformed) && transformed.toHexString() === original) out.push({ path, from: original });
    return;
  }
  if (Array.isArray(original) && Array.isArray(transformed)) {
    original.forEach((item, i) => diffStringToObjectId(item, transformed[i], path ? `${path}.${i}` : String(i), out));
    return;
  }
  if (isPlainObject(original) && isPlainObject(transformed)) {
    for (const key of Object.keys(original)) {
      if (key === '_id') continue;
      diffStringToObjectId(original[key], transformed[key], path ? `${path}.${key}` : key, out);
    }
  }
}

export function findConversions(config, target, doc) {
  const clone = cloneDoc(doc);
  transform({
    adapter: { payload: { config }, allowAdditionalKeys: true, useBigIntForNumberIDs: false },
    data: clone,
    fields: target.fields,
    globalSlug: target.kind === 'global' ? target.slug : undefined,
    operation: 'write',
    validateRelationships: false,
  });
  const out = [];
  diffStringToObjectId(doc, clone, '', out);
  return out;
}

export async function analyzeRelationships(db, config, targets) {
  const reports = [];
  for (const target of targets) {
    const report = { target, scanned: 0, docs: [], values: 0, paths: {} };
    reports.push(report);
    if (!target.exists) continue;
    for await (const doc of db.collection(target.name).find(target.filter || {})) {
      report.scanned++;
      const conversions = findConversions(config, target, doc);
      if (!conversions.length) continue;
      report.docs.push({ id: doc._id, conversions });
      report.values += conversions.length;
      for (const c of conversions) {
        const pattern = c.path.replace(/\.\d+(?=\.|$)/g, '.*');
        report.paths[pattern] = (report.paths[pattern] || 0) + 1;
      }
    }
  }
  return reports;
}

export function relationshipsBackupEntries(reports) {
  return reports.flatMap(r => r.docs.flatMap(d => d.conversions.map(c => ({
    check: 'relationships', collection: r.target.name, ...serializeId(d.id), path: c.path, previous: c.from,
  }))));
}

/**
 * $set only the detected paths. Each update is guarded: it matches only if every path still holds
 * the original string, so a document edited in the meantime is skipped (reported) rather than clobbered.
 */
export async function applyRelationships(db, reports, batch) {
  let modified = 0;
  let skipped = 0;
  for (const report of reports) {
    const ops = report.docs.map(d => ({
      updateOne: {
        filter: { _id: d.id, ...Object.fromEntries(d.conversions.map(c => [c.path, c.from])) },
        update: { $set: Object.fromEntries(d.conversions.map(c => [c.path, new ObjectId(c.from)])) },
      },
    }));
    for (let i = 0; i < ops.length; i += batch) {
      const chunk = ops.slice(i, i + batch);
      const result = await db.collection(report.target.name).bulkWrite(chunk, { ordered: false });
      modified += result.modifiedCount;
      skipped += chunk.length - result.matchedCount;
    }
  }
  return { modified, skipped };
}

export async function restoreRelationships(db, entries) {
  let restored = 0;
  for (const e of entries) {
    const result = await db.collection(e.collection).updateOne(
      { _id: deserializeId(e), [e.path]: new ObjectId(e.previous) },
      { $set: { [e.path]: e.previous } },
    );
    restored += result.modifiedCount;
  }
  return restored;
}
