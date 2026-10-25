# Path B: 3.1 monorepo → bom-sample App Router architecture

A 3.1 project (turborepo: `src/bowl/payload` Payload app on :4000, `src/mixer/web` Pages Router site on `@websolutespa/bom-mixer-*`, local `src/mixer/packages/{models,ui,icons}`) becomes one Next.js App Router app like **bom-sample** (`websolute-dev/bom-sample`, branch `next`, on `4.0.0-next.7`). bom-sample is the reference implementation: read its `.claude/CLAUDE.md` and `.claude/skills/*` before porting anything.

**This is not a mechanical upgrade.** The two architectures don't share a frontend stack:

| | 3.1 monorepo | bom-sample |
|---|---|---|
| Apps | two (Bowl, Mixer) + turbo/workspaces | one package, no turbo, no workspaces (`.claude/CLAUDE.md`: "do not add Turbo, workspaces, or package-source aliases") |
| Payload | own app, REST at `/bowl/api` | embedded: `src/app/(payload)`, REST at `/admin/api` |
| Site | Pages Router, `getStaticProps`/`getServerSideProps`, `bom-mixer-models`/`-store`/`-hooks` | App Router RSC on `@websolutespa/bom-next`: `createPageContext`, `LazyLoader`, Payload Local API |
| UI | styled-components 5, `bom-mixer-ui` (`<Box>`, `<Text variant>`, `<Flex.Row>`), SCSS, `theme.json` | Tailwind 4 + shadcn (`@base-ui/react`, `lucide-react`); **styled-components forbidden** |
| Mock store | `mixer.json` + `.mixer/store.json` (`bom mock`), `/api/_mock` | `STORE_STRATEGY=mock` = real Payload on `memoryAdapter`, seeded from typed `src/store/<slug>.ts` |
| Models | `@acme/models` interfaces and `getStore()` services | generated `src/payload-types.ts` + Local API |

The content model (collections, blocks, plugins) ports closely; routing, data loading and **every UI component are rebuilt**.

## B0. Plan with the user (no edits)

Present this table and agree, in writing in the checklist:

1. **Where**: a new branch of the project, scaffolded from bom-sample (B1). The old apps stay in place until B9, as the source to port from.
2. **UI**: the sections and blocks are rebuilt with Tailwind/shadcn and the bom-sample `src/ui` components. Ask whether the project has a design to follow (Figma: bom-sample's `bom-figma-*` skills) or ports the existing look.
3. **Content and data**: which collections and blocks are kept, renamed (`homepage` → `page`) or dropped (the `App` global: bom-sample has no globals). For a MongoDB with production content, the renames need a data migration: tell the developer, don't write one unless asked.
4. **Features in use**: auth/end users, actions and emails, search, Thron, cron jobs, storage (S3/Azure), Redis cache, LLM (`bom-mixer-llm`, `payload-plugin-bowl-llm`: not in bom-sample, port separately), shop/checkout (not in bom-sample).

Stop if the user doesn't confirm the plan.

## B1. Scaffold the app from bom-sample

- Copy bom-sample (branch `next`, its git-tracked files, never `.env.local`) into the project branch as the new root app, then remove the disposable sample content (`.claude/CLAUDE.md`: the `post_*`, `text_description`, `components` showcase and examples are disposable).
- Keep bom-sample's toolchain as is: it is already the path A target (pnpm 11, TS 6, Vitest 5, oxlint/oxfmt on `@websolutespa/oxc`).
- Keep bom-sample's `.claude/` (CLAUDE.md, skills): it is how agents build on this architecture.
- `pnpm install`, `STORE_STRATEGY=mock pnpm run dev`: the empty app runs before porting starts.

## B2. Payload config

| 3.1 | bom-sample |
|---|---|
| `src/bowl/payload/src/payload.config.ts` | `src/payload.config.ts` (db switch on `STORE_STRATEGY`: `memoryAdapter()` for `mock`, `mongooseAdapter` otherwise) |
| collections `src/bowl/payload/src/collections/*` | `src/collections/*` as `BowlCollection`; page models `type: 'withPage'` (never rebuild routing fields by hand) |
| blocks | `src/blocks/*` as `BowlBlock` (`type: 'withBlock'`), each with `withAnchor`; shared ones in `src/blocks/shared.ts` |
| `homepage` collection | the generic `page` collection |
| `App` global | removed (`globals: []`); move its fields to a collection or the layout data |
| users, end users, actions | `src/collections/users/*` (`withUser`, `withEndUser`), `src/collections/actions/*` (`withAction`) |
| plugins | the same family: bowl, storage, seo, localization, seoWebsolute, search, thron, cronJob, seed |
| collection lists | `src/config.ts` (`slug`, `pages`, `roles`, locales, markets) |

Then `pnpm run generate` and `pnpm run types`.

## B3. Data: seed instead of the JSON mock store

- Each `mixer/web/store/<collection>.json` (and the Bowl seed that imported it) becomes a typed fixture `src/store/<slug>.ts` (`IMockPage<Page>[]`, `IMockCollection<T>[]`, `IMockMenu<Menu>[]` from `@websolutespa/bom-next`), registered only in the `seed()` map of `payload.config.ts`. Localized values `{ en, it }`, compact media `{ src, type }`.
- `mixer.json`, `.mixer/store.json`, `bom mock` and `/api/_mock` are gone.
- Labels: `src/store/label.ts`. Menus: `src/store/menu.ts` (`blockType: 'Level N'`).
- `SEED_DROP=true|slug,slug` reseeds a database that already has records.

## B4. Routing and templates

| 3.1 | bom-sample |
|---|---|
| `pages/[market]/[locale]/<schema>/[id].tsx` + `getStaticProps`/`getStaticPaths` | `src/app/(frontend)/[market]/[locale]/<schema>/[id]/page.tsx`: `createPageContext(market, locale, '<schema>', id, { config, draft })`, `await decorateLazyComponents()`, `<DefaultLayout page>` + `<LazyLoader components={page.components} />`; `generateMetadata = getPageMetadata('<schema>')`, `generateStaticParams = getStaticParams('<schema>', config)`, `export const revalidate = 3600` |
| `getServerSideProps` pages (listings, catch-all) | RSC templates; listings through a server decorator (B5) |
| `_app.tsx`, `_document.tsx`, `Page.Layout` | `[market]/[locale]/layout.tsx` (html, fonts, providers, `createLayoutContext`) + `<DefaultLayout>` per template |
| `proxy.ts` (`routeInterceptor`), `[[...slug]].tsx` | `src/proxy.tsx` (`createProxy(routeAutoDetection, createRouteProxy(protectedRouteProxy))`, no Payload imports) + `/api/-route` + `[...slug]/page.tsx` → `notFound()` |
| `404.tsx`, `500.tsx` | `not-found.tsx`, `error.tsx`, `global-error.tsx`, the `not_found` collection |
| `<OpenGraph>`/`Meta` components | `generateMetadata` (`src/lib/seo/metadata.ts`) + `<StructuredData />` |
| sitemaps, `captions.vtt` pages | route handlers `src/app/sitemap.xml|xsl/route.ts`, `src/app/captions.vtt/route.ts`, `[market]/[locale]/sitemap.xml|xsl/route.ts` |

Request data (`headers()`, `cookies()`, `draftMode()`, `searchParams`) is read **only in the template files** and passed down: a read in a helper, decorator or `generateMetadata` makes ISR pages fail with `DYNAMIC_SERVER_USAGE` at runtime. The project's `oxlint.config.ts` flags `next/headers` outside `src/app`.

## B5. Blocks and UI (the large phase)

- One block = the same snake_case slug in the `BowlBlock`, the page collection's components, the seed `blockType`, the `LAZY_MODULES` key in `src/ui/lazy/lazy.tsx` and the optional server decorator.
- Renderers: `src/ui/lazy/<kebab-name>.tsx`, `ILazyableProps<Item>` from `@websolutespa/bom-next`, `id={item.anchor?.hash}`.
- Old `withLazyProps` decorators → `src/ui/lazy/server.ts` with `withLazyProps` from `@websolutespa/bom-next/server`; data through `payload.find({ ...buildReadOptions({ user, locale, depth }), … })`, not `getStore()` services.
- Components: bom-sample `src/ui/components` first, then shadcn / the `@bom-ui` registry, then a new component. Tailwind utilities and theme tokens (`src/ui/theme`) only. Icons: `lucide-react` + `src/ui/icons`.
- Navigation is data: the `menu` collection with `useMenu('<id>')` and `MenuLink`, never a hard-coded href.
- Follow bom-sample's skills for each piece: `bom-page`, `bom-block`, `bom-collection`, `bom-seed`, `bom-listing`, `bom-menu`, `bom-routing`.

Port block by block, each with its seed, and check it in `STORE_STRATEGY=mock pnpm run dev` before the next.

## B6. API routes

| 3.1 `pages/api` | bom-sample `src/app/api` |
|---|---|
| `_image/[...slugs]` | `-image/[...slugs]/route.ts` (`imageGetHandler`, `bom-mixer-image`) |
| `_preview` | `-preview/route.ts` (`previewHandler`, guarded to logged-in editors) |
| `__revalidate` | `-revalidate/route.ts` (POST, `Authorization: Bearer ${MIXER_SECRET}`) |
| `_vars` | `-vars/route.ts` |
| `[...collections]`, `index.ts` | `[...collections]/route.ts`, `route.ts` |
| `_mock` | none (B3) |
| (new) | `-route` (proxy resolver), `auth/me` |

App Router treats `_folder` as private: the 4.x routes use a `-` prefix.

## B7. Actions, emails, auth

- Actions: `src/actions/<name>.ts` (zod schema, consents) + `<name>.server.ts` (`defineAction`), route `src/app/api/action/<name>/route.ts` (`createActionRoute`), everything through `createAction`. React Email templates in `src/emails`. Recipients from `email_config`, never from the request. Skill: `bom-action`.
- Users: `UserProvider`/`useUser` from `@websolutespa/bom-next/client` (reads `/api/auth/me`); protected templates under `(auth)` check `user.roles` and redirect to the login page.
- Emails: `nodemailerAdapter` only when `PAYLOAD_SMTP_HOST` is set.

## B8. Environment and deployment

- One `.env` (committed, no secrets) + `.env.production`; secrets in `.env.local` / `docker.env` / the hosting dashboard. bom-sample's `docker.env.sample` lists the required ones: `PAYLOAD_SECRET`, `MIXER_SECRET` (revalidate bearer, session JWT, image secret), `STORE_API_KEY` (API key of the seeded guest user).
- `STORE_URL`/`STORE_API` of the separate Bowl are legacy; `NEXT_PUBLIC_API=/api`, Payload REST at `/admin/api`.
- One Dockerfile (bom-sample's: standalone server, Payload included); nixpacks/Vercel as bom-sample.
- Bowl's revalidation calls `PAYLOAD_PUBLIC_PREVIEW_URL` + `/api/-revalidate` with `MIXER_SECRET`.

## B9. Remove the old apps and verify

- Delete `src/bowl`, `src/mixer`, `turbo.json` and the workspace config once every page, block and route is ported and the checklist says so.
- Run path A from A1: most items are quick checks on a bom-sample scaffold.
- Full verification loop (SKILL.md §4), including `pnpm run build && pnpm run start` with two requests per template (dev hides `DYNAMIC_SERVER_USAGE`).
