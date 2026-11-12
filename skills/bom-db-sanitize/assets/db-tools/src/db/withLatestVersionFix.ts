import type { DatabaseAdapter, DatabaseAdapterObj, PayloadRequest } from 'payload';

/**
 * Installed by the `bom-db-sanitize` skill. Wire it in payload.config.ts:
 *   db: withLatestVersionFix(mongooseAdapter({ url: process.env.DATABASE_URL || '', ... })),
 *
 * Fix for duplicated `latest: true` versions (duplicated rows in the admin list of draft collections).
 *
 * Culprit — `createVersion()` in @payloadcms/db-mongodb (3.91.0, dist/createVersion.js):
 *   1. `Model.create([{ ...version, latest: true }])`
 *   2. `Model.updateMany({ parent: { $eq: ObjectId }, latest: true, _id: { $ne: new }, updatedAt: { $lt: new.updatedAt } }, { $unset: { latest: 1 } })`
 *
 * Cause 1 (the one found in the data) — type mismatch after the Payload 2 -> 3 upgrade:
 * Payload 2 stored versions' `parent` as a string, Payload 3 as an ObjectId. Step 2 never matches
 * the string-parent version that was latest before the upgrade, so the first save of every
 * document after the upgrade leaves two latest versions. Data fix: `db:check` / `db:fix` (scripts/db/).
 *
 * Cause 2 — concurrent saves without transactions (`transactionOptions: false`):
 * `updatedAt` is taken from `new Date()` at the start of `saveVersion()`, long before the insert.
 * Without a transaction nothing serialises two saves of the same document, so when save B
 * stamps its time after save A but inserts first (or both land in the same millisecond),
 * A's `$lt` filter cannot match B and B never sees A: both stay `latest: true`.
 * `queryDrafts()` (admin list of draft-enabled collections) returns one row per `latest` version,
 * so the document shows up split / duplicated in the CMS listing.
 *
 * Fix — after every version write, reconcile the parent (matching `parent` as string AND ObjectId,
 * so a document still holding a pre-upgrade string-parent latest heals on its next save):
 * among its `latest: true` versions keep
 * the newest by (`updatedAt` desc, `_id` desc) — the same version Payload's own
 * `findVersions({ sort: '-updatedAt' })` resolves as latest — and unset the flag only on the
 * explicit ids that were seen older than it. Ordering is total and deterministic, so concurrent
 * reconcilers always agree and the newest version can never be unset (no "zero latest" outcome).
 */
type MongooseLikeAdapter = DatabaseAdapter & {
  versions: Record<string, any>;
  sessions?: Record<string | number, any>;
};

async function getSession(adapter: MongooseLikeAdapter, req?: Partial<PayloadRequest>) {
  const transactionID = req?.transactionID instanceof Promise ? await req.transactionID : req?.transactionID;
  const session = transactionID ? adapter.sessions?.[transactionID] : undefined;
  return session?.inTransaction?.() ? session : undefined;
}

/** `parent` as both ObjectId and string when it is an ObjectId-shaped id, else as is. */
function parentForms(Model: any, parent: unknown): unknown[] {
  const ObjectId = Model.base.Types.ObjectId;
  // BSON type tag instead of instanceof: different bson copies have different ObjectId classes
  const isObjectId = parent !== null && typeof parent === 'object' && (parent as { _bsontype?: string })._bsontype === 'ObjectId';
  const hex = isObjectId ? (parent as { toHexString(): string }).toHexString() : String(parent);
  return ObjectId.isValid(hex) && new ObjectId(hex).toHexString() === hex ? [new ObjectId(hex), hex] : [parent];
}

export async function reconcileLatestVersion(
  adapter: MongooseLikeAdapter,
  collectionSlug: string,
  parent: unknown,
  req?: Partial<PayloadRequest>,
): Promise<number> {
  const Model = adapter.versions?.[collectionSlug];
  if (!Model || parent === undefined || parent === null) {
    return 0;
  }
  const session = await getSession(adapter, req);
  // Native collection (no mongoose casting): `parent` must match BOTH representations, because
  // versions written by Payload 2 store it as a string and Payload 3 as an ObjectId.
  const collection = Model.collection;
  const flagged: { _id: unknown }[] = await collection
    .find({ parent: { $in: parentForms(Model, parent) }, latest: true }, { projection: { _id: 1 }, session })
    .sort({ updatedAt: -1, _id: -1 })
    .toArray();
  if (flagged.length <= 1) {
    return 0;
  }
  const stale = flagged.slice(1).map(x => x._id);
  const result = await collection.updateMany(
    { _id: { $in: stale } },
    { $unset: { latest: '' } },
    { session },
  );
  adapter.payload?.logger?.warn(
    `[withLatestVersionFix] ${collectionSlug}:${String(parent)} had ${flagged.length} latest versions, unset ${result.modifiedCount}`,
  );
  return result.modifiedCount;
}

export function withLatestVersionFix<T extends DatabaseAdapterObj>(adapterObj: T): T {
  return {
    ...adapterObj,
    init: (args: Parameters<T['init']>[0]) => {
      const adapter = adapterObj.init(args) as MongooseLikeAdapter;
      if (adapter.name !== 'mongoose') {
        return adapter;
      }
      const createVersion = adapter.createVersion;
      const updateVersion = adapter.updateVersion;

      adapter.createVersion = async function (this: MongooseLikeAdapter, params) {
        const result = await createVersion.call(this, params);
        await reconcileLatestVersion(this, params.collectionSlug, params.parent, params.req);
        return result;
      };

      // updateLatestVersion() (autosave / unpublish) bumps an existing version's updatedAt
      // and forces latest: true on it — reconcile its siblings too.
      adapter.updateVersion = async function (this: MongooseLikeAdapter, params) {
        const result = await updateVersion.call(this, params);
        if (params.versionData?.latest === true) {
          const parent = params.versionData.parent ?? (result as { parent?: unknown } | null)?.parent;
          await reconcileLatestVersion(this, params.collection, parent, params.req);
        }
        return result;
      };

      return adapter;
    },
  } as T;
}
