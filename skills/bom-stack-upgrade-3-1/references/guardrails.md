# Guardrails: run before anything else

Run this skill only on a BOM-stack project that is on **3.0.x** and not yet on 3.1. Otherwise, stop cleanly and explain why.

## Step A: is this a BOM-stack project?

It qualifies if any of these is true:

- a workspace `package.json` depends on `@websolutespa/bom-core`;
- there is a root `turbo.json` and some workspace package depends on a `@websolutespa/*` package;
- the layout is the BOM one: a Payload app (usually `src/bowl/payload`) and a Next.js app (`src/mixer/web`) that depends on `@websolutespa/bom-mixer-*`.

If none of these holds, **stop**.

## Step B: find every workspace package

Read the root `package.json` `workspaces`. The samples use this layout:

```text
package.json                          (root: turbo, changesets, prettier, typescript, vitest)
src/bowl/payload/package.json         (Payload app, port 4000, basePath /bowl)
src/bowl/packages/*/package.json      (project Payload plugins, if any)
src/mixer/web/package.json            (Next.js pages-router app, port 3000)
src/mixer/packages/*/package.json     (icons, models, ui, emails, llm-plugin, …)
src/packages/*/package.json           (other shared packages, if any)
```

Record every path, because the checklist needs them.

## Step C: read the current versions

From each `package.json` (and the lockfile when a range is `latest` or `*`), read:

- `payload` and `@payloadcms/*` in the Bowl app;
- `next` and `react` in both apps;
- every `@websolutespa/*` range;
- `typescript`, `eslint`, `vitest` and `jest` in the root and the apps.

Also confirm that 3.1 is actually published: `npm view @websolutespa/bom-core version` must print `3.1.x` or later (still major 3). If it doesn't, **stop**. The release isn't available yet.

## Step D: decide

- **Resuming.** `bom-upgrade/UPGRADE_3_1_TODO.md` exists → continue from the first unchecked item, whatever step C found.
- **Bom-stack 2.x.** `payload` major is below 3, or any `@websolutespa/*` major is below 3 → **stop**. Tell the user to run the `bom-stack-upgrade` skill (2.x → 3.x) first.
- **Already on 3.1.** Every `@websolutespa/*` is at `^3.1.0` or later, and `payload` is at `>= 3.91.0` → **stop** and say so. Change nothing. To move on to 4.x (the bom-sample App Router stack), suggest the `bom-stack-upgrade-4-0` skill.
- **Eligible.** `payload` is at `3.x < 3.91` and the `@websolutespa/*` ranges are `^3.0.x` → create the checklist and start phase 1.
- **Mixed or ambiguous.** For example, `@websolutespa/*` is already on 3.1 but `payload` is still 3.74, which is a half-done manual upgrade. Show the user what you found and ask one question. Usually the answer is to continue from phase 1, which is idempotent.

## Step E: never be destructive

- If the working tree is dirty, ask the user whether to commit, stash, or continue. Never do either silently.
- Don't use `reset --hard` or force-push, and don't delete branches.
- Never merge a lockfile; regenerate it with `npm install`.
- Don't upgrade anything listed in held-back.md, even if `npm outdated` suggests it.
