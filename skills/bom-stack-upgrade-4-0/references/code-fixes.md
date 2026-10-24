# Code fixes (phase A7)

What the 4.x packages and Next 16.4 change in an App Router project's own code. The full list, with evidence, is `KNOWN-BREAKING.md` of the bom 3 → 4 compatibility repo; this file keeps what a bom-sample-style project meets. Work through the build and type errors first, then the behaviour checks.

## Errors you will see

### `TS2321: Excessive stack depth comparing types` in structured-data components

Two `schema-dts` copies: the project on 1.x, `@websolutespa/bom-next` on 2.x. Fix: `schema-dts` `2.1.0` (dependencies.md). No code change.

### A bom-core user passed to `useUser().setUser`

Fixed in 4.0.0-next.6: `IUser`/`IEndUser` of `@websolutespa/bom-next` accept both the generated bowl documents and the `@websolutespa/bom-core` contract, and `roles` is typed on both. Remove casts that were added as a workaround (`as unknown as IEndUser`).

### Mock types in tests

`TS2348 … Mock<Procedure | Constructable> is not callable`: Vitest 5, see toolchain.md §3.

### `next lint` / ESLint config crash

`next lint` was removed in Next 16, and `@websolutespa/eslint-config` 4.x needs ESLint 10 (`Could not find "preserve-caught-error"` on ESLint 9). Both go away with phase A5 (oxlint).

## Runtime behaviour to fix

### One-shot effects run twice in development (Next 16.4)

With `reactStrictMode: true`, React runs effects twice in development, and on Next 16.4 the second run still reads a query flag the first run removed with `history.replaceState`. An effect that shows a toast for `?newsletter=optin` and then removes the flag shows two toasts (Playwright: `strict mode violation … resolved to 2 elements`). Make one-shot effects idempotent; with sonner, give the toast a fixed `id`:

```ts
useEffect(() => {
  if (status !== 'optin' && status !== 'optout' && status !== 'error') {
    return;
  }
  // one toast id: in development react runs the effect twice, and next 16.4 still reports the flag
  // on the second run (the replaceState below is not seen yet), a second toast replaces the first
  if (status === 'error') {
    toast.error(label('newsletter.error'), { id: NEWSLETTER_OPT_PARAM });
  } else {
    toast.success(label(`newsletter.${status}`), { id: NEWSLETTER_OPT_PARAM });
  }
  const url = new URL(window.location.href);
  url.searchParams.delete(NEWSLETTER_OPT_PARAM);
  window.history.replaceState(window.history.state, '', url);
}, [status, label]);
```

Search for other effects that act on `useSearchParams()` values and then rewrite the URL.

### API routes are `-x`

bom-next and payload-plugin-bowl call `/api/-route`, `/api/-preview`, `/api/-revalidate`, `/api/-image` (and the mock store `/api/-mock`). An App Router project created from bom-sample already has them under `src/app/api/-*`; an older project with `_preview`, `__revalidate`, `_image` folders renames them (`git mv`). A missing route does not 404: a catch-all answers it, so check each path answers its own handler.

### Thron without credentials

`payload-plugin-thron` warns at config time and `/thron/token` answers 503 when `clientId`, `appId` or `appKey` are missing. Set the `THRON_*` variables, or pass `enabled: false` if the project doesn't use Thron.

## Behaviour changes to review (no error)

- **Rich text on page reads** is HTML under a mixer context; request `?richText=true` for the JSON.
- **Media URLs** carry `?updatedAt=<date>`: build `images.remotePatterns` without `search`, keep `PAYLOAD_PUBLIC_SERVER_URL` set, strip the parameter where URLs are compared.
- **The image route** serves AVIF by default and sends shared-cache headers: `IMAGE_AVIF=false` keeps WebP; review CDN rules (`Vary: Accept`).
- **Globals** are decorated (schema, HTML rich text) only for authenticated mixer reads (api key or logged-in user).
- **Redirects**: more are created automatically on page and category edits in production.
- **Seed** (`payload-plugin-seed`): blocks keep their own `type`; a `payload seed` command is registered (`bin: false` to opt out).
- **`payload-plugin-bowl` re-exports its generated types** (`User`, `Page`, `Config`, …): import the app's own types from `src/payload-types.ts`, not from the plugin.

## Projects coming from `@websolutespa/bom-next` 3.0.2

- Session helpers take the cookie store: `createSession(token, cookies)`, `getSession(cookies)`, `hasValidSession(cookies)`, `updateSession(cookies)`.
- `createPageContext` / `createLayoutContext` take an options object (`{ config, headers, draft, layout }`); the positional form is deprecated.
- Pages are read at depth 2 and the layout at depth 1 by default; pass `depth: 0` for the old shape. `draft` defaults to `false`: the template reads `draftMode()` and passes `draft`.
- `getPayload` no longer reads `headers()`: pass `headers` in draft mode. `getMetadata` returns full metadata (canonical, alternates, Open Graph, Twitter).
- `context`, `page`, `layout` and `lazy` are `server-only`: scripts, the Payload CLI and Vitest need `--conditions=react-server` or a mock of `server-only`.
- `@sentry/nextjs` is an optional peer, loaded only with `NEXT_PUBLIC_SENTRY_DSN`.
