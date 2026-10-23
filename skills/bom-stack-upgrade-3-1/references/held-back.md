# Held back on purpose: do not upgrade

`npm outdated` will list newer majors for the packages below. **Leave them at the versions shown.** The 3.1 packages are built and tested against exactly these, and several are peer dependencies of `@websolutespa/bom-mixer-*`.

| Package | Stay on | Why |
|---|---|---|
| `styled-components` / `@types/styled-components` | **5.3.11** / 5.1.34 | v6 has breaking changes that the bom mixer UI library is not compatible with. This is a decision of the BOM maintainers, so don't upgrade even if asked casually; refer the user to them. |
| `zustand` | 4.5.7 | The 3.1 release held these majors back: they touch every mixer component and need visual checks of the web apps. They will be upgraded in a coordinated `@websolutespa/bom-mixer-*` release, together with the peer ranges. |
| `swiper` | 11.2.10 | Same as above. |
| `motion` | 12.23.12 | Same as above. |
| `@googlemaps/js-api-loader` | ^1.x | Same as above (`bom-mixer-google-map`). |
| `mongoose` / `mongodb` | as resolved by `@payloadcms/db-mongodb` 3.91 | Payload pins them. Never add them as direct dependencies to change the version. |
| `graphql` | 16.8.1 | Payload requires `graphql ^16`. |
| `typescript` | 6.0.3 | typescript-eslint (inside `@websolutespa/eslint-config`) supports TS < 6.1. |
| `eslint` | 10.13.0 | Matches `@websolutespa/eslint-config` 3.1. |
| `vitest` | 5.0.5 | It is a peer of `@websolutespa/test` 3.1 (`^5.0.5`). |
| `@react-email/*` | 1.0.12 / 2.1.1 | Match `@websolutespa/bom-mixer-emails` 3.1. |
| `@vitejs/plugin-react`, `jsdom`, `@testing-library/*` | — | Don't add them to the project; `@websolutespa/test` provides them. |

Two later changes are planned on the bom side. Don't anticipate them in a project:

- the switch from npm to **pnpm**;
- the switch from ESLint + Prettier to **oxlint + oxfmt**.

They will come with their own release notes.
