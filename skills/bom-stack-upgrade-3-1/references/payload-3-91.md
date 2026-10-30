# Phase 3: Payload 3.91 (Bowl app)

Payload 3.75 → 3.91 contains no config-shape change for a bom Bowl app. What needs attention is the 3.90 **security release**, some build configuration, and regenerating the generated files.

## 1. Regenerate the generated files

After `npm install`, in `src/bowl/payload`:

```bash
npm run generate          # payload generate:importmap + generate:types
```

This regenerates `src/app/(payload)/admin/importMap.js` and `src/payload-types.ts`. 3.90 added auth and upload fields, so the types change even if the project's collections didn't. The samples gitignore both files and regenerate them in `build`; if the project commits them, commit the regenerated versions. Then run `npm run types`.

## 2. Sass `loadPaths` for `@payloadcms/ui` SCSS

The samples' `next.config.ts` hard-coded a relative `node_modules` path. That breaks with any other install layout, including pnpm and hoisting changes. Resolve it through Node instead:

```diff
 import { withPayload } from '@payloadcms/next/withPayload';
+import { createRequire } from 'module';
 import { NextConfig } from 'next';
+import path from 'path';
+
+const require = createRequire(import.meta.url);
 ...
   sassOptions: {
-    loadPaths: ['./../../../../../node_modules/@payloadcms/ui/dist/scss/'],
+    // resolved through node, independent of the node_modules layout
+    loadPaths: [path.dirname(require.resolve('@payloadcms/ui/scss'))],
   },
```

Only `sample/basic` had this block. Apply the change wherever `git grep "node_modules/@payloadcms"` finds a match.

## 3. Payload 3.90 security defaults (behaviour changes)

| Change | Impact on a bom project | What to do |
|---|---|---|
| **CSRF check on cookie auth.** REST calls authenticated by the `payload-token` cookie must carry an `Origin` header (or `Sec-Fetch-Site`) that matches the server. | Browsers send it, so the admin and the frontend are unaffected. Server-side scripts, tests, Postman collections and proxies that forward the cookie without `Origin` now get **403** or are treated as anonymous. | Add `Origin: <bowl origin>` to those calls (see `api()` in assets/tests/bowl/tests/e2e/helpers.ts). Calls authenticated by an API key aren't affected. |
| **Azure containers are private by default** when the storage plugin creates them. | New environments get private containers, so media URLs return 403. | Set `AZURE_STORAGE_CONTAINER_ACCESS=blob` (or `container`) in the env of deployments that serve media directly from Azure. Existing containers keep their access level. `@websolutespa/payload-plugin-storage` 3.1 reads the variable. |
| **Multipart uploads are capped at 50 MB.** | Bigger uploads fail. | Raise the upload limits in the config only if the project really needs it. |
| **SVG/XML uploads are validated** (script content is rejected). | Some icon uploads may be refused. | Clean the files. |
| **API keys are no longer revealed** after they are saved. | Admin users can't read an existing key again. | Communicate this to the editors. |
| **Scheduled publish needs a `user`**, and jobs access is stricter (3.89). | Custom jobs or scheduled-publish code that runs without a user fails access checks. | Run them with `overrideAccess` or a user. The bom cron-job and bowl plugins are already adapted. |

Payload 3.91 moves to **nodemailer 10** inside `@payloadcms/email-nodemailer`. The `nodemailerAdapter({...})` config is unchanged. See dependencies.md for the direct `nodemailer` dependency.

## 4. Plugin behaviour that changed in `@websolutespa/*` 3.1

You don't need to edit anything for these, but you need to know them when you test:

- **payload-plugin-bowl** builds the mixer context only for reads by an authenticated user. Payload 3.90+ resolves the JWT user with the request query and populates tenants before `req.user` is set, and the old behaviour made the admin login fail with 403.
  - If the project has its **own** `beforeOperation` hooks that read `req.user` or the mixer context, add the same guard to them:

    ```ts
    if (operation !== 'read' || collection.auth || !req.user) { return args; }
    ```

  - The plugin also keeps the app's `config.custom` and creates redirects when a slug changes.
- **payload-plugin-bowl-llm** (llm projects): the MCP endpoint (`POST /bowl/api/llm/mcp?appKey=…&apiKey=…&locale=…`) now runs on mcp-handler 2. It never worked on 3.0.x. Route, auth and tool names are unchanged.

## 4b. Check: public media URLs on projects migrated from 2.x

Projects that came from bom 2.x through an older run of `bom-stack-upgrade`
may have lost their public media URLs. The symptom is that media urls are
`/bowl/api/media/file/<filename>` instead of `https://<site>/oven/media/<filename>`.
Once the URL is fixed, the Oven returns 404 on `/oven/media/...` without
reaching the Bowl. Check both:

1. `git log -S generateFileURL -- src/bowl`: if the 2.x config passed
   `generateFileURL` to `cloudStorage` and the current `storagePlugin` call
   uses `collections: [slug.media]` with an `s3`/`azure` adapter, the URL was
   lost. `payload-plugin-storage` 3.1 reads `FS_STORAGE_*` only for `fs`.
2. `grep -n '"/media/{everything}"' src/oven/ext-settings*.json`: a
   `downstreamPathTemplate` of `/media/{everything}` targets the Payload 2
   Express route, which no longer exists.

The fix for both is in the `bom-stack-upgrade` skill,
references/payload-config.md, section "Public media URLs". Skip this section
when neither check matches, and record `[skip]`.

## 5. Optional: in-memory database switch (`BOM_DB=memory`)

The samples can now start the Bowl app without MongoDB. The e2e tests use this, and it also works for quick local runs. To adopt it, add `@websolutespa/payload-db-memory` `^3.1.0` to the Bowl app's dependencies (dependencies.md), then:

```diff
 import { lexicalEditor } from '@payloadcms/richtext-lexical';
+import { memoryAdapter } from '@websolutespa/payload-db-memory';
 ...
-  db: mongooseAdapter({
+  // BOM_DB=memory: in-memory database (e2e tests, local dev without mongo)
+  db: process.env.BOM_DB === 'memory' ? memoryAdapter() : mongooseAdapter({
     url: databaseURL,
     transactionOptions: false,
```

Data lives in process memory and is lost on restart. Never set `BOM_DB` in a deployed environment. Skip this section if the user doesn't want it, and record `[skip]`.

## Verification

```bash
cd src/bowl/payload
npm run generate
npm run types
npm run build
npm run dev    # open http://localhost:4000/bowl/admin, log in, open a few collections
```
