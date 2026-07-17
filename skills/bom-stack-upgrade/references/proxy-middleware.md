# Mixer web: `middleware.ts` → `proxy.ts`

Next.js 15 introduces the `proxy` convention as the successor to
`middleware`. If the target Next.js/BOM-mixer version in use supports it
(check `@websolutespa/bom-mixer-models`/`@websolutespa/bom-mixer-store`
package exports for a `/proxy` subpath — see below), rename accordingly;
otherwise keep `middleware.ts` and only apply the subpath-import change.

## Rename

- `src/middleware.tsx` → `src/proxy.ts` (drop the `.tsx` extension too — the
  file has no JSX, it doesn't need it).
- Exported function `middleware` → `proxy`.

## Subpath imports for edge-safe runtime

`@websolutespa/bom-mixer-models` and `@websolutespa/bom-mixer-store` now
publish a dedicated `/proxy` subpath export containing only edge-runtime-safe
code (no Node-only APIs), separate from their main entry point:

```ts
// before
import { routeInterceptor } from '@websolutespa/bom-mixer-models';
import { isApiRequest, isNextRequest, isStaticRequest } from '@websolutespa/bom-mixer-store';

// after
import { routeInterceptor } from '@websolutespa/bom-mixer-models/proxy';
import { isApiRequest, isNextRequest, isStaticRequest } from '@websolutespa/bom-mixer-store/proxy';
```

Apply the same subpath-import convention to any other package that exposes
a `/proxy` (edge) or `/server` (node-only) export, per the specific
package's `exports` map in its `package.json` — do not assume, check the
installed version's `package.json` `exports` field before importing from a
subpath that may not exist yet.

## Behavior addition observed in the reference migration

A guard for Chrome DevTools' well-known workspace probe request was added
near the top of the function, before the static/next/api checks — harmless
to add defensively, not required for the migration to succeed:

```ts
if (request.nextUrl.pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
  return NextResponse.json({ workspace: { root: '', uuid: '' } });
}
```

## Verification

```
npx tsc --noemit
npm run build
```

Confirm the app still intercepts CMS routes correctly (manually exercise a
localized page route in dev) since a proxy/middleware regression is easy to
miss in a type-check-only verification pass.
