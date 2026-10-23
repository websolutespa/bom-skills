# Phase 5: code fixes

Apply these after the dependency and config phases, then let `npx turbo run types` and `build` show you what's left. Each item says how to find the affected code.

## 1. `renderEmail` is async (`@websolutespa/bom-mixer-emails` 3.1)

`@react-email/render` 2 renders asynchronously, so `renderEmail` now returns `Promise<string>`. If you forget the `await`, emails go out with `[object Promise]` as the body. The type checker catches it only when the result goes into a `string` field.

```bash
git grep -n "renderEmail" -- src
```

```diff
-      const html = renderEmail<ContactConfirmProps>({
+      const html = await renderEmail<ContactConfirmProps>({
         Component: ContactConfirm,
         Layout: LayoutDefault,
         origin,
```

Make the enclosing function `async` if it isn't already. In the website sample this affected `pages/api/action/contact/subscribe.ts` (3 calls) and `pages/api/action/newsletter/subscribe.ts` (2 calls). Email templates that use `@react-email/components` 1.x keep the same component API (`Html`, `Body`, `Container`, …).

## 2. Library majors

The samples needed **no code changes** for these, only version bumps. Check project code that uses them directly:

| Library | Change to check |
|---|---|
| `iron-session` 8 → 9 | It requires **Node ≥ 22.13**, which is why `engines` moved to `>=22.13`. The bom auth packages wrap it. Check any direct `getIronSession` calls against the iron-session changelog. |
| `react-error-boundary` 4 → 6 | It is an ES module package now (a CJS build still ships). The samples use `ErrorBoundary` unchanged. If `types` reports errors on custom `fallbackRender`/`FallbackProps` code, align it with the v6 typings. |
| `marked` 12 → 18 | It is ESM only and needs Node ≥ 20. Since marked 13, custom renderers (`marked.use({ renderer })`) receive **token objects** instead of positional strings: `heading({ tokens, depth })` instead of `heading(text, level)`, with `this.parser.parseInline(tokens)` to render the children. bom-mixer-llm's text renderer was ported this way. Only projects with their own renderers are affected: `git grep -n "marked" -- src`. |
| `uuid` 9 → 14 | It ships an ES module with a `require` export. Named imports (`import { v4 } from 'uuid'`) work. Deep imports such as `uuid/v4` don't. |
| `html-to-text` 9 → 10 | It needs Node ≥ 20.19. The samples use `convert(html, options)` unchanged. |
| `fast-equals` 4 → 6 | Named exports such as `deepEqual`; the samples needed no change. |
| `schema-dts` 1 → 2 | Type-only. Fix any type errors that `types` reports in JSON-LD code. |
| `dotenv` 16 → 18 | `import 'dotenv/config'` is unchanged. |
| `cross-env` 7 → 10 | The CLI usage in the scripts is unchanged. |

If a library listed here produces a type or runtime error not described above, read its changelog for the versions in between before changing code.

## 3. TypeScript 6 / React types 19.2.18 errors

| Symptom | Fix |
|---|---|
| `Type '… \| undefined' is not assignable to type 'string \| TrustedHTML'` on `dangerouslySetInnerHTML={{ __html: … }}` | Cast or convert the value. The website sample `sections/header/header-card.tsx` uses `__html: item.title as string`. For localized values, resolve them to a string first. |
| A union that includes a `Record<string, unknown>` member no longer narrows on a discriminant (`if (x.type === 'a') x.payload` errors) | Write a type guard. bom-mixer-llm uses `isChunkType(chunk, 'actionGroup')`, which returns `chunk is Extract<Known, { type: T }>`. |
| `Cannot find name 'SpeechRecognition' \| 'google' \| …` | Add the global types to `types`, or add a `/// <reference types="…" />` (tooling.md). |
| `Option 'baseUrl' is deprecated` | Remove `baseUrl` (tooling.md). |
| `Cannot find module 'x'` for something that used to work | The package relied on hoisting. Declare `x` in that package's `package.json` (dependencies.md, "Declare what each package imports"). |

## 4. Imports across projects and packages

A package must import only packages it declares. The llm sample had UI sections that imported `@basic/icons`, which belongs to another sample. That only worked because both live in one monorepo:

```diff
-import { IconWebsolute } from '@basic/icons';
+import { IconWebsolute } from '@llm/icons';
```

Projects copied from a sample often keep the sample's package scope in a few imports. Search for every scope that isn't the project's own:

```bash
git grep -nE "from '@(basic|llm|website)/" -- src
```

## 5. Custom `beforeOperation` hooks (Bowl)

See payload-3-91.md §4. If a hook reads `req.user` or the mixer context, it must return early when there is no user, for non-read operations, and for auth collections. Otherwise the admin login fails with 403 on Payload 3.90+.

## 6. Do NOT do in this phase

- Don't bulk-fix lint warnings (tooling.md "Lint warnings").
- Don't upgrade the held-back libraries (held-back.md).
- Don't refactor unrelated code. The upgrade diff should be reviewable.

## Verification

```bash
npx turbo run types
npx turbo run build
```

Also send one test email (website: the contact form), and check that the HTML body isn't `[object Promise]`.
