# Bowl App Router migration (Payload 3 requirement)

Payload 3 no longer ships its own Express server + bundler — it is a Next.js
plugin. The Bowl app must become a Next.js app with the **App Router**,
hosting both the admin UI and the frontend/API under two route groups:

```
src/app/
  (payload)/                      # Payload admin + REST/GraphQL API
    admin/
      [[...segments]]/
        page.tsx
        not-found.tsx
      importMap.js                # auto-generated — do not hand-write, run `payload generate:importmap`
    api/
      [...slug]/route.ts          # REST API catch-all
      graphql/route.ts
      graphql-playground/route.ts
    custom.scss                   # replaces the old admin.css option
    layout.tsx
  (frontend)/                     # optional: any Bowl-served public page (health check, etc.)
    layout.tsx
    page.tsx
    styles.css
```

These are (mostly) Payload's own generated blank-template boilerplate —
prefer copying them verbatim from Payload's official Next.js
blank-template/App Router integration docs rather than hand-authoring, then
only customize `custom.scss` import and any project-specific
metadata/branding. The exact reference content observed in a real migration:

## `src/app/(payload)/layout.tsx`
```tsx
/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from '@payload-config';
import '@payloadcms/next/css';
import type { ServerFunctionClient } from 'payload';
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts';
import React from 'react';

import { importMap } from './admin/importMap.js';
import './custom.scss';

type Args = { children: React.ReactNode };

const serverFunction: ServerFunctionClient = async function (args) {
  'use server';
  return handleServerFunctions({ ...args, config, importMap });
};

const Layout = ({ children }: Args) => (
  <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
    {children}
  </RootLayout>
);

export default Layout;
```

## `src/app/(payload)/admin/[[...segments]]/page.tsx`
```tsx
import type { Metadata } from 'next';
import config from '@payload-config';
import { RootPage, generatePageMetadata } from '@payloadcms/next/views';
import { importMap } from '../importMap';

type Args = {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] }>;
};

export const generateMetadata = ({ params, searchParams }: Args): Promise<Metadata> =>
  generatePageMetadata({ config, params, searchParams });

const Page = ({ params, searchParams }: Args) => RootPage({ config, params, searchParams, importMap });

export default Page;
```

`not-found.tsx` follows the same shape using `@payloadcms/next/views`'s
`NotFoundPage`/`generatePageMetadata` exports — mirror `page.tsx` but call the
not-found view export instead of `RootPage`.

## `src/app/(payload)/api/[...slug]/route.ts`
```ts
import config from '@payload-config';
import '@payloadcms/next/css';
import { REST_DELETE, REST_GET, REST_OPTIONS, REST_PATCH, REST_POST, REST_PUT } from '@payloadcms/next/routes';

export const GET = REST_GET(config);
export const POST = REST_POST(config);
export const DELETE = REST_DELETE(config);
export const PATCH = REST_PATCH(config);
export const PUT = REST_PUT(config);
export const OPTIONS = REST_OPTIONS(config);
```

`graphql/route.ts` and `graphql-playground/route.ts` are similarly thin
wrappers around `@payloadcms/next/routes` GraphQL handlers — check the
installed Payload version's export names (`GRAPHQL_POST`,
`GRAPHQL_PLAYGROUND_GET`, etc.) rather than assuming.

## `src/app/(frontend)/layout.tsx` (minimal placeholder, only if Bowl serves any public page itself)
```tsx
import React from 'react';
import './styles.css';

export const metadata = { description: '...', title: '...' };

export default async function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><main>{props.children}</main></body>
    </html>
  );
}
```

## `next.config.ts` — wrap with `withPayload`

```ts
import { withPayload } from '@payloadcms/next/withPayload';
import { NextConfig } from 'next';
import packagejson from './package.json';

const dependencies = Object.keys(packagejson.dependencies).filter(
  (x) => x.indexOf('@websolutespa') === 0 || x.indexOf('@givi') === 0 // adjust prefix(es) to the project's internal scope(s)
);

const basePath = process.env.PAYLOAD_PUBLIC_BASE_PATH || '';

const nextConfig: NextConfig = {
  basePath,
  assetPrefix: basePath,
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  transpilePackages: [...dependencies], // required so workspace TS packages get compiled by Next
  // add rewrites/sass/webpack fallback tweaks only as actually needed by the project
};

export default withPayload(nextConfig, { devBundleServerPackages: false });
```

## What to remove

- `src/server.ts` (the old Express bootstrap) and its `dist/server.js` build
  output/scripts.
- `nodemon.json`, `.editorconfig` if it was only there for the old
  ts-node/nodemon dev loop.
- `jest.config.ts`/`jest.mock*.js`/`jest.setup.js` (see tooling.md).
- Old `admin.css` scss path reference in `payload.config.ts` (now imported
  directly by `(payload)/layout.tsx` as `custom.scss`).

## Order of operations

1. Scaffold the folders/files above (they can be copied close to verbatim).
2. Update `payload.config.ts` per payload-config.md (`admin.importMap`,
   `typescript.outputFile`, remove bundler/webpack/express options).
3. Run `payload generate:importmap` to produce `admin/importMap.js` (do not
   hand-write it — it lists every custom component referenced via the
   `'@/path/to/file#ExportName'` string convention, see
   custom-components.md).
4. Run `payload generate:types` to produce `@/payload-types`.
5. Update `package.json` scripts to the Next.js-based ones (`dev`, `build`,
   `start` via `next`, plus `generate:*`) — see dependencies.md for the
   reference script set.

## Verification

```
npm run generate      # generate:importmap + generate:types
npx tsc --noemit
npm run build          # next build must succeed end-to-end
```
