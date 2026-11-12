// Check "latest": every document of a draft-enabled collection must have exactly one version
// flagged `latest: true`. The admin list of draft collections (queryDrafts) shows one row per
// latest version, so >1 means duplicated rows and 0 means the document disappears from the list.
//
// Versions are grouped by the STRING form of `parent`, so a document whose old versions store
// `parent` as a string (Payload 2) and new ones as an ObjectId (Payload 3) is seen as one group.
// Fix: keep the newest (updatedAt desc, _id desc — what Payload resolves as latest), unset the others;
// when none is flagged, flag the newest.
import { deserializeId, idForms, isObjectId, iso, serializeId } from '../db.mjs';

const PROJECTION = {
  _id: 1, parent: 1, latest: 1, autosave: 1, snapshot: 1, publishedLocale: 1,
  createdAt: 1, updatedAt: 1, 'version._status': 1,
};

const time = v => (v ? new Date(v).getTime() : 0);

export function compareNewestFirst(a, b) {
  const diff = time(b.updatedAt) - time(a.updatedAt);
  return diff !== 0 ? diff : String(b._id).localeCompare(String(a._id));
}

const parentType = value => (isObjectId(value) ? 'objectId' : typeof value);

/**
 * Why createVersion() did not clear the older flag. Pairs are taken in insertion order (_id asc):
 * the later insert should have unset the earlier one.
 *   mixed-parent-type       Payload 2 string parent vs Payload 3 ObjectId parent (data never migrated)
 *   same-updatedAt          two saves in the same millisecond (the unset filter is updatedAt $lt)
 *   out-of-order-updatedAt  concurrent saves without transactions, older timestamp inserted later
 *   unset-not-applied       the unset never ran (crash, manual edit)
 */
function classify(flagged) {
  const reasons = new Set();
  if (new Set(flagged.map(v => parentType(v.parent))).size > 1) reasons.add('mixed-parent-type');
  const byInsertion = [...flagged].sort((a, b) => String(a._id).localeCompare(String(b._id)));
  for (let i = 1; i < byInsertion.length; i++) {
    const prev = byInsertion[i - 1];
    const next = byInsertion[i];
    if (parentType(prev.parent) !== parentType(next.parent)) continue; // explained by the type mismatch
    const delta = time(next.updatedAt) - time(prev.updatedAt);
    reasons.add(delta === 0 ? 'same-updatedAt' : delta < 0 ? 'out-of-order-updatedAt' : 'unset-not-applied');
  }
  if (flagged.some(v => v.snapshot)) reasons.add('involves-snapshot');
  if (flagged.some(v => v.autosave)) reasons.add('involves-autosave');
  return [...reasons];
}

export async function analyzeLatest(db, targets) {
  const reports = [];
  for (const target of targets.filter(t => t.kind === 'versions')) {
    const report = { target, versions: 0, parentTypes: {}, issues: [] };
    reports.push(report);
    if (!target.exists) continue;
    const versions = db.collection(target.name);
    report.versions = await versions.estimatedDocumentCount();
    for (const t of await versions.aggregate([{ $group: { _id: { $type: '$parent' }, n: { $sum: 1 } } }]).toArray()) {
      report.parentTypes[t._id] = t.n;
    }

    const groups = await versions.aggregate([
      { $group: { _id: { $toString: '$parent' }, latestIds: { $push: { $cond: [{ $eq: ['$latest', true] }, '$_id', '$$REMOVE'] } } } },
      { $match: { $expr: { $ne: [{ $size: '$latestIds' }, 1] } } },
    ], { allowDiskUse: true }).toArray();
    if (!groups.length) continue;

    const parents = groups.flatMap(g => idForms(g._id));
    const existing = new Set((await db.collection(target.parentCollection).find({ _id: { $in: parents } }, { projection: { _id: 1 } }).toArray()).map(x => String(x._id)));

    for (const group of groups) {
      const orphan = !existing.has(group._id);
      if (group.latestIds.length > 1) {
        const flagged = await versions.find({ _id: { $in: group.latestIds } }, { projection: PROJECTION }).toArray();
        flagged.sort(compareNewestFirst);
        const [keep, ...stale] = flagged;
        report.issues.push({ target, type: 'duplicate', parent: group._id, orphan, reasons: classify(flagged), keep, stale });
      } else {
        const [newest] = await versions.find({ parent: { $in: idForms(group._id) } }, { projection: PROJECTION })
          .sort({ updatedAt: -1, _id: -1 }).limit(1).toArray();
        if (newest) report.issues.push({ target, type: 'missing', parent: group._id, orphan, reasons: ['no-latest'], keep: newest, stale: [] });
      }
    }
  }
  return reports;
}

export function describeVersion(v) {
  return `${v._id} updatedAt=${iso(v.updatedAt)} status=${v.version?._status} parent=${parentType(v.parent)}${v.autosave ? ' autosave' : ''}${v.snapshot ? ' snapshot' : ''}${v.publishedLocale ? ` locale=${v.publishedLocale}` : ''}`;
}

export function latestBackupEntries(issues) {
  return issues.flatMap(i => i.type === 'missing'
    ? [{ check: 'latest', collection: i.target.name, ...serializeId(i.keep._id), previous: i.keep.latest ?? null }]
    : i.stale.map(v => ({ check: 'latest', collection: i.target.name, ...serializeId(v._id), previous: true })));
}

export async function applyLatest(db, issues) {
  let unset = 0;
  let set = 0;
  let skipped = 0;
  for (const issue of issues) {
    const versions = db.collection(issue.target.name);
    if (issue.type === 'duplicate') {
      // guard: the version we keep must still be flagged, otherwise something changed since planning
      if (!(await versions.countDocuments({ _id: issue.keep._id, latest: true }))) {
        skipped++;
        continue;
      }
      const result = await versions.updateMany({ _id: { $in: issue.stale.map(v => v._id) }, latest: true }, { $unset: { latest: '' } });
      unset += result.modifiedCount;
    } else {
      // guard: still no latest for this parent
      if (await versions.countDocuments({ parent: { $in: idForms(issue.parent) }, latest: true })) {
        skipped++;
        continue;
      }
      const result = await versions.updateOne({ _id: issue.keep._id }, { $set: { latest: true } });
      set += result.modifiedCount;
    }
  }
  return { unset, set, skipped };
}

export async function restoreLatest(db, entries) {
  let restored = 0;
  for (const e of entries) {
    const update = e.previous === true ? { $set: { latest: true } } : { $unset: { latest: '' } };
    const result = await db.collection(e.collection).updateOne({ _id: deserializeId(e) }, update);
    restored += result.modifiedCount;
  }
  return restored;
}
