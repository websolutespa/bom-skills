# `payload.config.ts` migration (Payload 2 → 3)

## Structural change: async wrapper → plain `buildConfig`

Payload 2 configs in this codebase were wrapped in a `bomEnv().then(() => ...)`
promise (to load env vars before building config) and exported a `Promise`.
Payload 3 expects a **synchronous** default export of `buildConfig({...})`
(env loading happens via Next.js's own env handling / `dotenv` import at the
top of the file, not a wrapping promise).

Before:
```ts
export default bomEnv().then(() => {
  const cors = process.env.PAYLOAD_PUBLIC_CORS_URLS || '*';
  // ...
  return buildConfig({ /* ... */ });
});
```

After:
```ts
const cors = process.env.PAYLOAD_PUBLIC_CORS_URLS || '*';
// ...top-level const declarations for every env-derived value...

export default buildConfig({
  // ...
});
```

Move every `const` that used to live inside the `.then()` callback to module
top-level scope (collections array, globals array, cors/csrf/serverURL/etc).

## Import changes

| Before | After |
|---|---|
| `import { webpackBundler } from '@payloadcms/bundler-webpack'` | removed entirely |
| `import { cloudStorage } from '@payloadcms/plugin-cloud-storage'` + `azureBlobStorageAdapter` from its `/azure` subpath | `import { storagePlugin } from '@websolutespa/payload-plugin-storage'` (generic — see below) |
| `import seo from '@payloadcms/plugin-seo'` | `import { seoPlugin } from '@payloadcms/plugin-seo'` (named export) |
| `import { Payload } from 'payload'` + `import { buildConfig } from 'payload/config'` + `import { CollectionConfig, FieldBase, GlobalConfig } from 'payload/types'` | all of these now come from the single `payload` package: `import { buildConfig, CollectionConfig, FieldBase, GlobalConfig, Payload } from 'payload'` |
| `import { Configuration } from 'webpack'` (for the custom `admin.webpack` fn) | removed — no more `admin.bundler`/`admin.webpack` |
| *(none)* | `import { nodemailerAdapter } from '@payloadcms/email-nodemailer'` |
| *(none)* | `import sharp from 'sharp'` (must be passed explicitly to `buildConfig`) |
| *(none)* | `import { fileURLToPath } from 'url'` + compute `__dirname` equivalent: `const filename = fileURLToPath(import.meta.url); const dirname = path.dirname(filename);` (config is ESM now, no native `__dirname`) |

## `buildConfig` option changes

| Option | Before | After |
|---|---|---|
| `db` | `mongooseAdapter({ url: mongoDbUri, transactionOptions: false })` reading `process.env.MONGODB_URI` | same adapter/shape, but reads `process.env.DATABASE_URL` (rename the env var everywhere: `.env`, docker-compose, deployment config) |
| `secret` | not required explicitly in some 2.x setups | **required**: `secret: process.env.PAYLOAD_SECRET \|\| ''` |
| `admin.bundler` / `admin.webpack` | `webpackBundler()` + custom `webpack(config)` fallback shims | removed — bundling is Next.js's job now |
| `admin.css` (`path.resolve(__dirname, './styles.scss')`) | replaced by importing `'./custom.scss'` from the generated `(payload)/layout.tsx` (see app-router.md) |
| `admin.meta.favicon` / `admin.meta.ogImage` | flat string paths | `admin.meta.icons: [{ rel: 'icon', type: 'image/png', url: ... }]` and `admin.meta.openGraph: { images: [{ url, width, height }], siteName, title, description }` |
| `admin.components.graphics.{Logo,Icon}` | custom Logo/Icon components | typically dropped in favor of `admin.meta.icons`/default branding, or re-added as Client Components if still needed (see custom-components.md for the pattern) |
| `admin.importMap` | n/a | new required-ish field: `{ baseDir: '@/' }` — enables the admin import-map mechanism used by custom component path strings |
| `editor` | `slateEditor({ admin: { elements: [...] } })` | same API, still supported; `@payloadcms/richtext-lexical` is also available if adopting the new default editor — only switch if the project wants Lexical, otherwise keep Slate to minimize risk |
| `i18n` | `{ resources: translations, fallbackLng: defaultLocale, debug: false }` | `{ fallbackLanguage: defaultLocale as AcceptedLanguages, translations }` |
| `express` | custom `express.preMiddleware` hooks | removed entirely — there is no Express layer; move any middleware logic into Next.js route handlers or the Mixer `proxy.ts` |
| `endpoints` | inside a wrapped object | unchanged shape, still a top-level `endpoints: [...]` array of custom REST endpoints |
| `typescript.outputFile` | `path.resolve(__dirname, 'generated-types.ts')` | `path.resolve(dirname, 'payload-types.ts')` (also add `typescript.declare: false`); update every import of the old generated types file to `@/payload-types` (via the new `@/*` tsconfig path alias) |
| `graphQL.schemaOutputFile` | present | typically removed/simplified unless GraphQL is actively used — check before deleting |
| `routes` | `{ api, admin, graphQL, graphQLPlayground }` derived from `basePath` | simplified/removed in favor of Next.js route groups (see app-router.md) — only keep if `basePath` support is still required and verify against the installed Payload version's supported `routes` keys |
| `sharp` | implicit (bundled) | must be passed explicitly: `sharp,` at the top level of `buildConfig` |
| rate limiting (`rateLimit: {...}`) | present in some 2.x configs | Payload 3 does not expose the same option — drop it, or replace with the framework's own request-limiting middleware if it's a hard requirement |

## Plugin call-site changes

- `storagePlugin({ collections: slug.media, adapter: 'azure', connectionString, containerName, allowContainerCreate, baseURL })`
  replaces the old pattern of manually building `cloudStorage({ collections: { [slug.media]: { adapter: azureBlobStorageAdapter({...}) } } })`.
  The new plugin picks the adapter package (`@payloadcms/storage-azure`, `-gcs`,
  `-s3`) based on the `adapter` field — make sure the matching
  `@payloadcms/storage-*` dependency is installed (see dependencies.md).
- `seoPlugin({ collections, globals, fields: (args) => [...args.defaultFields, ...], uploadsCollection, tabbedUI })`
  — `fields` is now a function receiving `defaultFields` instead of a static
  array; migrate any custom SEO fields accordingly.
- Custom token `replacementFunction` signatures in `@websolutespa/payload-plugin-seo`
  now receive nullable `locale`/field configs — add the corresponding
  null/undefined guards (`fieldConfig?.localized`, `doc.title ?? ''`, etc).
- The `bowl()` plugin call now expects `slug` cast as `BowlSlug` (a
  `@websolutespa/payload-plugin-bowl` v3 type) — add the type import and cast:
  `slug: slug as unknown as BowlSlug`.
- Collection-mutating plugin functions (the trailing `(config) => {...}`
  entry in the `plugins` array) must guard `config.collections` being
  possibly undefined before calling array methods on it (Payload 3's plugin
  config type widens this field to optional).

## Verification for this phase

```
npx tsc --noemit                         # payload.config.ts must type-check
npx payload generate:types               # regenerates @/payload-types
npx payload generate:importmap           # regenerates admin importMap.js — only works once app-router.md is also done
```

Note: `generate:importmap` requires the App Router scaffold (phase 4) to
already exist, since it writes to `src/app/(payload)/admin/importMap.js`. If
phase 4 isn't done yet, it's fine for this command to fail — just don't skip
recording that in the checklist.
