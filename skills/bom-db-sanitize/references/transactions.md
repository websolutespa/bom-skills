# `transactionOptions: false`: why it's there, and what turning it on changes

Every BOM Bowl config (bom starter, samples, projects created from them) has:

```ts
db: mongooseAdapter({
  url: process.env.DATABASE_URL || '',
  // see issue https://github.com/payloadcms/payload/issues/4350
  transactionOptions: false,
}),
```

**Don't change it as part of an upgrade.** This page explains the setting so the decision can be made on purpose.

## Why it's off

- It was copied from the bom template, which points to payload#4350: a **Payload 2.3** bug ("Attempted illegal state transition … TRANSACTION_ABORTED", "transaction number does not match"), caused by access and validation work running in parallel inside one transaction. It was **fixed in February 2024** (PR #5156). That reason doesn't apply to Payload 3.
- The adapter already turns transactions off by itself when the server isn't a replica set (`@payloadcms/db-mongodb` `connect`): a local standalone `mongo:27017` and the memory adapter are safe without the flag. MongoDB Atlas is a replica set, so there transactions would be on.

## What it costs today

Without transactions, nothing serialises two saves of the same document ("Save draft" and "Publish" together, two tabs, a hook re-saving). `createVersion()` stamps `updatedAt` before inserting and clears older flags with `updatedAt: { $lt }`, so overlapping saves can leave two `latest` versions (`same-updatedAt` / `out-of-order-updatedAt` in `db:check`). `withLatestVersionFix` repairs this after every save, so with it the setting can stay as it is.

A failed save can also leave the document updated without its version, or the reverse.

## What turning transactions on would fix

- Concurrent saves of one document hit a MongoDB `WriteConflict`: one is rolled back entirely instead of leaving two `latest` versions.
- Saves become all-or-nothing.

## What it would break or change

1. **Side effects before commit (main regression).** Payload commits after the `afterChange` and `afterOperation` hooks. The bowl plugin's `afterPageChangeHook` updates the route store and asks the Mixer to revalidate the page inside that window. On rollback, the route store keeps routes that were never saved. The Mixer can read the page before commit and cache the old content until the next revalidation. Today both happen after the write is durable.
2. **Concurrent saves fail instead of duplicating.** Payload doesn't retry on `WriteConflict`: the editor gets an error and saves again.
3. **Nested local API calls without `req`** run in their own transaction and commit even if the outer save fails, as today. One that writes the same document the outer save holds would block until the transaction times out (60 s on Atlas). None found in the bowl plugin, but every new hook must follow the rule.
4. **Large single-transaction operations** (`payload.delete({ where })`, import "replace" modes) must finish within Atlas's 60 s transaction lifetime.
5. **Cost**: one session and transaction per write, a few extra round-trips. Negligible for CMS traffic.

## What re-enabling would require

- Run post-commit side effects after the commit: queue them per transaction (wrap the adapter's `commitTransaction` / `rollbackTransaction`), and move `afterPageChangeHook`'s revalidation and route-store update there. That is a change in `@websolutespa/payload-plugin-bowl`.
- Then `transactionOptions: {}` (or remove the key). Keep `withLatestVersionFix`.
- Test on staging: two tabs saving the same page (one error, no duplicate), publish then check the Mixer shows the new content on first load, imports and cron jobs.
