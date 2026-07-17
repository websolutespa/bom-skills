# Payload admin custom component migration (Client/Server Components)

Payload 3's admin panel is a React Server Components app. Any custom admin
component (custom `Field` components, custom `ui` fields, custom
Logo/Icon/graphics) must be updated:

## 1. Add `'use client'` when the component uses hooks/state/events

Every custom component that calls `useState`, `useEffect`, `useCallback`,
Payload's field hooks (`useField`, `useForm`, `useFormFields`), or handles DOM
events must start with:

```tsx
'use client';

import ...
```

Purely presentational/server-safe components (no hooks, no browser APIs) may
remain server components — don't add `'use client'` to files that don't need
it.

## 2. Import Payload UI primitives from `@payloadcms/ui`, not `payload/components/*`

| Before | After |
|---|---|
| `import { Drawer, DrawerToggler } from 'payload/components/elements'` | `import { Drawer, DrawerToggler, useField } from '@payloadcms/ui'` |
| `import { useField } from 'payload/components/forms'` | (merged into the same `@payloadcms/ui` import) |
| `import { Button } from 'payload/components/elements'` | `import { Button, useForm, useFormFields } from '@payloadcms/ui'` |
| `import { useForm, useFormFields } from 'payload/components/forms'` | (merged into the same `@payloadcms/ui` import) |

## 3. Type components with Payload 3's client component types

```tsx
// before
export const AkeneoSelector: React.FC<{ name: string; path: string; custom?: MyConfig }> = ({ name, path, custom }) => { ... };

// after
import type { JSONFieldClientComponent } from 'payload';

export const AkeneoSelector: JSONFieldClientComponent = ({ path, field }) => {
  // read custom config via field.admin?.custom, not a bespoke prop
  const custom = field.admin?.custom as { attributes: string[] };
  ...
};
```

Pick the matching `*ClientComponent` type for the field kind being
customized (`JSONFieldClientComponent`, `TextFieldClientComponent`,
`UIFieldClientComponent`, etc. — check `payload`'s exported types for the
field type in question).

For custom `ui`-type fields whose component previously took ad-hoc props via
a wrapper function (e.g. `(props) => MyComponent({ ...props, extra: x })`),
read the "extra" values from `props.field`/`props.path` inside the component
itself instead — Payload 3 always instantiates via the import-map string
reference (next point), it cannot pass extra closure props at field-config
time.

## 4. Reference components via import-map path strings, not direct imports

Field configs (in `fields/*.ts`) must stop importing the component directly
and instead reference it by string path, matching the `@/*` tsconfig alias:

```ts
// before
import { AkeneoSelector } from '../components/AkeneoSelector/AkeneoSelector';
// ...
admin: { components: { Field: AkeneoSelector } }

// after
// (no import of the component in this file at all)
admin: {
  components: {
    Field: '@/components/AkeneoSelector/AkeneoSelector#AkeneoSelector',
  },
}
```

The string format is `'<alias-path-to-file-without-extension>#<ExportName>'`.
This is what `payload generate:importmap` scans for to build
`admin/importMap.js` — after changing any of these strings, re-run
`payload generate:importmap` (see app-router.md).

## 5. Use generated `@/payload-types` instead of hand-written collection interfaces

```ts
// before
import { IAkeneoMedia } from '../../collections/AkeneoMedia';

// after
import type { AkeneoMedia } from '@/payload-types';
```

Delete the hand-written interface once every usage is migrated, and add
null-safety for fields that are now typed as possibly-undefined by the
generated types (e.g. `asset?.thronMediaLink || ''`, non-null assertions only
where truly guaranteed).

## 6. Field-config plumbing types

- `import { JSONField } from 'payload/types'` → `import { JSONField } from 'payload'`.
- Nullable defaults must use `| null` explicitly (`let x: BowlField | null = null;`
  instead of `let x: BowlField = null;`) since `strictNullChecks`-adjacent
  settings are stricter under the new tsconfig preset.
- Spread of possibly-undefined arrays needs a guard/fallback:
  `...(pinBlock.fields || [])` instead of `...pinBlock.fields`.
- `addFieldRow`/other form APIs in `@payloadcms/ui` changed shape — check the
  new signature (e.g. `addFieldRow({ blockType, path, rowIndex, schemaPath })`
  replaced a simpler `{ path, data }` shape) and update call sites plus any
  now-required fields (`rowIndex`, `schemaPath`) to match the current API.

## Checklist per custom component

- [ ] `'use client'` added if it uses hooks/state/events
- [ ] imports switched to `@payloadcms/ui`
- [ ] typed with the correct `*ClientComponent` type
- [ ] field config references it via `'@/...#ExportName'` string, no direct import
- [ ] uses `@/payload-types` instead of a hand-written interface
- [ ] null-safety added for any field now typed as optional
- [ ] `payload generate:importmap` re-run after all field configs are updated
