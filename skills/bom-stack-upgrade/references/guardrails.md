# Guardrails — run before anything else

Goal: only ever run this skill on a BOM-stack project that has **not yet**
been upgraded to bom-stack 3.x. Abort cleanly and explain why otherwise.

## Step A — Is this a BOM-stack project at all?

A project qualifies if **any** of the following are true:

- The root `package.json` (or any workspace package) depends on
  `@websolutespa/bom-core` (dependencies or devDependencies), **or**
- There is a `turbo.json` at the root **and** at least one workspace package
  depends on a `@websolutespa/*` package, **or**
- The repo layout matches the BOM convention: a headless CMS app built on
  `payload` (often under a folder literally or conceptually named "bowl") and
  a Next.js frontend app that depends on `@websolutespa/bom-mixer-*` packages
  (often named "mixer").

If none of these hold: **stop**. Tell the user this does not look like a
BOM-stack monorepo and this skill should not run here.

## Step B — Discover every relevant package.json

Search the repo for `package.json` files (excluding `node_modules`) and keep
only the ones that are workspace members (listed by the root `package.json`
`workspaces` globs, or matched by `turbo.json`). Typical layout:

```
package.json                              (root)
src/<bowl-app>/package.json               (Payload CMS app)
src/<mixer-app>/web/package.json          (Next.js frontend)
src/<mixer-app>/packages/*/package.json   (shared UI/model/icon/llm packages)
src/packages/*/package.json               (other shared packages, if present)
```

Record every discovered path — the todo checklist needs this list.

## Step C — Determine current version state

For each discovered `package.json`, inspect `dependencies` /
`devDependencies` for:

- `payload` (the Bowl/CMS app)
- `next` (Bowl and Mixer)
- `@websolutespa/bom-core`, `@websolutespa/bom-env`, any `@websolutespa/*`
- `react` / `react-dom`

Parse the **major** version (ignore `^`/`~`/`latest`/workspace ranges — resolve
`latest`/`*` from the lockfile if present, otherwise treat as "unknown, needs
investigation" and lean cautious).

## Step D — Decide

- **Already upgraded**: if the Bowl app's `payload` dependency major version
  is `>= 3` **and** `@websolutespa/bom-core` major version is `>= 3`
  everywhere it appears → the project is already on bom-stack 3.x. **Stop**
  and tell the user so. Do not modify anything. (If the user wants to
  re-verify a partially-completed upgrade, that's a different task — point
  them at the checklist file instead, see below.)
- **Partially upgraded / resuming**: if `bom-upgrade/UPGRADE_TODO.md` already
  exists in the repo, this is a resume, not a fresh guardrail decision — skip
  straight to reading the checklist and continuing from the first unchecked
  item, regardless of what step C found (the repo is mid-migration).
- **Not yet upgraded**: `payload` major version is `1` or `2` (or `next` major
  is `<15`, or `@websolutespa/*` majors are `<3`) and no checklist exists yet
  → eligible. Proceed to create the checklist and start phase 1.
- **Ambiguous** (e.g. dependencies pinned to `latest`/`*` with no lockfile, or
  mixed majors across apps that don't match any of the above): ask the user
  one clarifying question rather than guessing, showing what was found.

## Step E — Never run destructively

- Do not delete or force-push branches.
- Do not run `git reset --hard` or discard uncommitted user changes.
- Prefer creating/updating files over rewriting whole files when the change
  is localized.
- If the working tree is dirty when the skill starts, tell the user and ask
  whether to proceed, stash, or commit first — do not silently commit or
  stash on their behalf.
