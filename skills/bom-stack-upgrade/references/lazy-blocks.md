# Mixer lazy block server/client split

Applies only if the Mixer UI package has a `lazy/` folder with blocks
registered via a `withLazyProps('block_name', async (props) => {...})` call
mixed into the same file as the client React component. This pattern breaks
under Next.js 15 / React 19 Server Components because server-only
data-fetching code and client component code can no longer live in the same
module boundary the old way.

If this repo already has a completed prior-art reference for this exact
transformation (e.g. a `refactor-lazy.md` progress tracker and/or a
`.github/prompts/lazy.prompt.md` file at the repo root, or under
`.github/prompts/`), **read those first** — they contain the exact
per-component mapping (which server functions/types each block needs, its
parameter destructuring shape) already discovered for this codebase, and you
should reuse/update that tracker instead of re-deriving everything from
scratch.

## Pattern

For every `lazy/block_xxx/block_xxx.tsx` that calls `withLazyProps`:

**`block_xxx.tsx`** (client) keeps only:
- The exported type (`BlockXxxItem`)
- The client React component (`BlockXxx`)
- Imports needed exclusively by the component (hooks, sections,
  `ILazyableProps`, etc.)
- Remove: `withLazyProps`, `ILazyFuncProps`, all server-side data-fetching
  imports and any helper functions only used by the server logic.

**`block_xxx.server.tsx`** (new file) contains:
```tsx
'use server';

import { /* server data functions and types */ } from '@givi/models/server'; // or the project's equivalent server-only models export
import { ILazyFuncProps } from '@websolutespa/bom-mixer-models';
import { BlockXxxItem } from './block_xxx';

export async function BlockXxxServer({ page, component, layout }: ILazyFuncProps<BlockXxxItem>) {
  // exact same logic that used to be inside the withLazyProps(...) callback — copy verbatim, do not "improve" it
  return component;
}
```

Move any private helper functions used only by the server logic
(e.g. `getAllDescendantCategories`, `fetchAkeneoDownloads`) into the
`.server.tsx` file too.

**`lazy/server.ts`** — central registry, create/update:
```ts
import { withLazyProps } from '@websolutespa/bom-mixer-models/server';
import { BlockXxxServer } from './block_xxx/block_xxx.server';
// ...one import per migrated block

export function registerLazyProps() {
  withLazyProps('block_xxx', BlockXxxServer);
  // ...one call per migrated block
}

export async function getPageProps<T, B = any>(props, extraComponents?) {
  registerLazyProps();
  return await mixerGetPageProps(props, extraComponents); // wraps the bom-mixer-models/server getPageProps
}
```

Every page/route that previously imported `getPageProps` from
`@websolutespa/bom-mixer-models`/`@givi/models` for server rendering should
now import it from this local `lazy/server.ts` wrapper instead, so
`registerLazyProps()` always runs before props are resolved.

## Rules

- **Do not change any logic** — copy the `withLazyProps` callback body
  verbatim into the server function. This is a mechanical split, not a
  rewrite.
- **Do not add or remove error handling** beyond what already existed.
- Preserve existing client-file imports; only remove the ones that were
  exclusively used by server logic.
- Blocks with no real server logic (e.g. `return component;` with everything
  commented out) still get a `.server.tsx` file for consistency with the
  registry pattern.
- Every `lazy/**/*.server.tsx` file must start with `'use server';`.
- Any `.tsx` file that still contains React hooks after the split must start
  with `'use client';`.
- If lazy server files import from `@givi/models/server` (or equivalent
  server-only model exports), ensure the corresponding models plugin server
  export files and `src/mixer/packages/models/src/exports/server.ts` all start
  with `'use server';`.

## Resume instructions

1. Check the progress tracker (`refactor-lazy.md` or equivalent) for
   already-checked items — do not redo them.
2. Continue with the next unchecked block.
3. After every block is migrated, verify `lazy/server.ts` has one
   `withLazyProps` registration per migrated block, and that no `.tsx` file
   under `lazy/` still imports `withLazyProps` directly.

## Verification

```
npx tsc --noemit
npm run build   # ensure server-only imports aren't leaking into client bundles
```

If the build reports a server-only module (e.g. a DB client) being pulled
into a client chunk, a helper function or import was left in the `.tsx` file
by mistake — move it to `.server.tsx`.
