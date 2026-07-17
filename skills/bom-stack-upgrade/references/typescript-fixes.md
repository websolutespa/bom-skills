# Common TypeScript fixes (apply last, repo-wide)

After phases 1–7, run `tsc --noemit` across every app/package and expect a
long tail of small type errors. These are the recurring categories observed
in a real migration — recognize the pattern rather than fixing each error in
isolation.

## 1. Request/response handler typing

Payload endpoint handlers no longer take implicit `(req, res)` — type the
request explicitly and drop the unused/removed `res` parameter if the new
Payload endpoint signature doesn't provide one:

```ts
// before
export const importDealers = async (req, res): Promise<ImportResult> => { ... };

// after
import { PayloadRequest } from 'payload';
export const importDealers = async (req: PayloadRequest): Promise<ImportResult> => { ... };
```

## 2. `catch` blocks need explicit `any`/`unknown`

```ts
} catch (err) { ... }
// becomes
} catch (err: any) { ... }   // or `unknown` + narrowing, if the project prefers stricter catch typing
```

## 3. Numeric IDs previously typed as `string`

Fields imported from external systems (e.g. `externalId` on Dealer/Retailer
models) that are actually numeric in the source system but were loosely
typed as `string` should become `number`, with `parseInt`/`Number(...)` added
at the point CSV/import string values are assigned to them:

```ts
// model
export type IRetailer = IEntity & {
  externalId: number; // was: string
  ...
};

// importer
const data = {
  externalId: parseInt(id), // was: externalId: id
  ...
} as unknown as Retailer;
```

Apply this kind of "tighten the type to match reality, then fix the call
sites" pattern for any other field where the generated `@/payload-types`
now disagrees with a hand-written model type.

## 4. Use generated types over hand-written collection interfaces

Replace `TypeWithID & Record<string, unknown>` / bespoke `IThing` interfaces
with the generated `@/payload-types` types (`Retailer`, `Dealer`, etc.) once
they exist (see app-router.md / custom-components.md) — this eliminates a
whole class of drift-induced type errors.

## 5. Null-safety on optional/nullable fields

Payload 3's generated types mark far more fields as optional/nullable than
the old hand-written interfaces did. Add guards rather than non-null
assertions where the value can genuinely be absent:

```ts
const thronMediaLink = asset?.thronMediaLink || '';
const familyCode = asset?.familyCode || '';
```

Only use `!` (non-null assertion) where the code path guarantees the value
exists (e.g. right after a regex `.match()` whose pattern is known to always
match given upstream validation) — and only if the reference migration used
one there too; otherwise prefer the `|| fallback` / optional-chaining style
already established across the codebase for consistency.

## 6. Import style — single quotes, no trailing double-quoted JSX attrs mismatch

The new `@websolutespa/eslint-config` preset enforces single-quoted imports
and consistent JSX attribute quoting. Run the linter with `--fix` after the
mechanical rename/import-path changes to clean up quote-style-only diffs
before hunting for real type errors — don't hand-fix quote style.

```
npx eslint . --fix
```

## 7. Optional/possibly-undefined array spreads

```ts
// before
...pinBlock.fields,
// after
...(pinBlock.fields || []),
```

Same category as #5, just for arrays instead of objects — apply wherever a
config type widened a previously-required array field to optional.

## Verification for this phase (final gate before declaring the upgrade done)

```
npm install
npx tsc --noemit           # zero errors, every app
npm run lint                # zero errors, every app
npm run build                # every app builds successfully
npm run test:integration     # if present, must pass
```

Only check off the final "TypeScript fixes" checklist item once all four
commands succeed for every app that was in scope for this migration.
