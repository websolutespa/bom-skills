# Phase 4: Next.js 16.4 (Mixer web, and Bowl where noted)

The project is already on Next 16, so Next.js 16.1 → 16.4 is a minor upgrade. It has to happen together with Payload 3.91, because `@payloadcms/next@3.91` requires `next >=16.3.3 <17`.

## 1. `images.qualities` (Mixer web `next.config.ts`)

Next 16 accepts only the image qualities listed in `images.qualities`, which defaults to `[75]`. The bom media components request `IMAGE_QUALITY` (90 by default). Without this setting those images fail with **400** from `/_next/image`:

```diff
   images: {
+    // next 16 accepts only the listed qualities (default [75]), media-image requests IMAGE_QUALITY
+    qualities: [...new Set([75, Number(process.env.IMAGE_QUALITY || 90)])],
     remotePatterns: (process.env.IMAGE_DOMAINS || '').split(',').map(x => new URL(x === 'localhost' ? 'http://localhost' : (x.indexOf('http') === 0 ? x : `https://${x}`))),
   },
```

If the project passes any other explicit `quality={…}` to `next/image` or `Media`, add those values too: `git grep -nE "quality=\{?[0-9]"`.

## 2. `proxy.ts`: missing `NextRequest` import

The sample `src/mixer/web/src/proxy.ts` used `NextRequest` as a type without importing it, which TS 6 / Next 16.4 type-checking reports:

```diff
-import { NextFetchEvent, NextResponse } from 'next/server';
+import { NextFetchEvent, NextRequest, NextResponse } from 'next/server';
```

If the project still has a `middleware.ts`, it skipped the 3.0 rename. Apply the `bom-stack-upgrade` skill's proxy-middleware reference first.

## 3. Lint

`next lint` was removed. Both apps use `"lint": "eslint ."` (tooling.md).

## 4. Generated files

`next dev` writes `AGENTS.md` and `next-env.d.ts` in the app folder; ignore both (tooling.md).

## 5. Things that did **not** need changes in the samples

These are listed so you don't go looking for them:

- the pages router, `getStaticProps` / `getServerSideProps` and the `apiHandler` API routes;
- `experimental` options in the samples' `next.config.ts`;
- `output: 'standalone'` and the Dockerfiles, apart from the Node version;
- the `@next/env` `loadEnvConfig` call in `next.config.ts`, apart from declaring `@next/env` as a devDependency.

## Verification

```bash
cd src/mixer/web
npm run types       # needs .mixer/store.json: run `npm run build:mock` (bom mock ./store) first on a clean checkout
npm run build
npm run dev         # http://localhost:3000, homepage renders on the mock store
```

When `.env.local` is missing, the web app reads the mock store (`STORE_STRATEGY=mock`), so no Bowl instance is needed to check that the homepage renders.
