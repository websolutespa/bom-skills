# What `db:check` finds, and why

## 1. Relationship ids: string (Payload 2) vs ObjectId (Payload 3)

Payload 2's MongoDB adapter stored the id in a relationship or upload field as a **string**. Payload 3 stores it as an **ObjectId** whenever the related collection uses the default id. Collections with a custom `id` field (`type: 'text'` or `'number'`) keep their ids as they are: in BOM projects `category`, `template`, `market`, `label`, the `i18n_*` collections and others use text ids, and the tool leaves those alone.

Payload doesn't convert old documents. The official converter is `migrateRelationshipsV2_V3` in `@payloadcms/db-mongodb/migration-utils`. It has to be run on purpose, and the BOM upgrade never ran it. Until the data is converted:

- every equality query on those fields (`where: { media: { equals: id } }`, joins, `parent` lookups) misses the old values;
- versions' `parent` is mixed: old versions as strings, new ones as ObjectId.

`db:check` reports this as **`relationships: NEEDS MIGRATION`** with the paths, for example:

```text
[needs migration] homepage versions   950/961 docs, 11635 values: version.components.*.items.*.media (4648), …, parent (950)
[needs migration] news_detail         45/50 docs, 45 values: media (45)
[needs migration] menu                5/9 docs, 33 values: items.*.page.value (9), …
```

How it decides: for each document it runs Payload's own write `transform` (from `@payloadcms/db-mongodb/internal`, the same function the official migration uses) on a copy, and keeps only the values that went from a string to an ObjectId **with the same hex**. That covers uploads, hasMany relationships, polymorphic `{ relationTo, value }`, localized fields, arrays, blocks and tabs, plus Payload's own `payload-preferences` and the search plugin's `doc.value`. `db:fix` then `$set`s exactly those paths. Unlike the official migration, it doesn't rewrite whole documents.

## 2. Versions: more than one (or no) `latest`

Each document of a draft-enabled collection must have exactly one version with `latest: true`. The admin list of those collections (`queryDrafts`) returns **one row per `latest` version**: two flags mean the document is listed twice, none means it isn't listed at all.

`createVersion()` in `@payloadcms/db-mongodb` (3.x):

1. inserts the new version with `latest: true`;
2. `updateMany({ parent: { $eq: <ObjectId> }, latest: true, _id: { $ne: <new> }, updatedAt: { $lt: <new.updatedAt> } }, { $unset: { latest: 1 } })`.

`db:check` reports **`latest: NEEDS FIX`**, with a reason for each document:

| Reason | Cause |
|---|---|
| `mixed-parent-type` | the old `latest` version has a string `parent` (Payload 2); step 2 compares with an ObjectId and misses it. Happens on the **first save of every document after the upgrade**. The common case. |
| `same-updatedAt` | two saves stamped in the same millisecond: `$lt` misses an equal timestamp |
| `out-of-order-updatedAt` | concurrent saves without transactions: the save stamped later inserted first (see transactions.md) |
| `unset-not-applied` | step 2 never ran for that version (crash, manual edit) |
| `no-latest` | no version is flagged: the document is missing from the admin list |

The fix keeps the newest version by `updatedAt`, then `_id` (the one Payload's own `findVersions({ sort: '-updatedAt' })` resolves as latest) and unsets the others. When no version is flagged, it flags the newest.

**Orphans**: version groups whose parent document no longer exists. They are reported but skipped, unless `--include-orphans` is passed.

## 3. Info lines (no action)

- "configured collections not present in the db": never written yet, normal.
- "versions collections in the db with no matching versioned collection": leftovers from collections that dropped `versions` or were removed. Ignored by the tool.
