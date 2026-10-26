---
name: node-upgrade
description: 'Upgrade the Node.js runtime of a project to a target release, typically the first patched release after a Node security advisory. Finds every place the version is pinned (.nvmrc, engines, Dockerfiles, CI, platform configs), picks the smallest reasonable jump, researches what actually changed between the current and target versions, maps those changes to how the project uses Node, and produces a test plan from them. Works on any Node project; on BOM-stack monorepos it knows where Bowl and Mixer pin Node. USE FOR: Node security releases, Node line EOL, a nodejs.org vulnerability or release post linked by the user. DO NOT USE to move Node as part of a bom-stack upgrade (bom-stack-upgrade and bom-stack-upgrade-3-1 already set the runtime).'
argument-hint: 'Target Node version or advisory URL (optional)'
---

# Upgrading Node.js

Goal: move the project to the right Node version with the **smallest reasonable jump**, change every place the version is declared, and give the user a test plan built from **what really changed** between the two versions, not a generic list.

Work on a dedicated branch. Don't push or open a PR without explicit confirmation. If the working tree is dirty when you start, ask the user how to proceed. No force-push and no `reset --hard`.

## VS Code prompt template

The skill ships a prompt template, `prompts/node-upgrade.prompt.md`. `npx skills add` installs it with the skill but doesn't copy it into the project's `.github/prompts`. To copy it, run:

```powershell
powershell -ExecutionPolicy Bypass -File .agents/skills/node-upgrade/scripts/install-vscode-prompts.ps1 -ProjectRoot .
```

## BOM-stack projects

If the repo is a BOM-stack monorepo (`@websolutespa/*` dependencies, `src/bowl` and `src/mixer`):

- If the user actually wants a bom-stack upgrade (e.g. 3.0.x → 3.1), stop and point them to `bom-stack-upgrade-3-1` (or `bom-stack-upgrade` from 2.x): those skills already move Node. This skill is for runtime patches **within** a bom-stack version.
- Node is pinned in: `.nvmrc`, `engines.node` in the root and Bowl app `package.json`, `src/bowl/Dockerfile`, `src/mixer/Dockerfile`, `src/bowl/payload/Dockerfile` (`-alpine` variant), plus CI and any nixpacks file. Still run the search in step 1: projects drift from the samples.
- Stay on the Node major the bom-stack version targets (bom-stack 3.1: Node 24, `engines >=22.13`). Changing major also means checking Payload and Next.js support; tell the user instead of doing it silently.
- Use the repo's verification commands in step 6: `npm install` at the root, `npx turbo run types`, `npx turbo run lint`, `npx turbo run test`, and the Bowl and Mixer builds.

## 1. Find the current version and where it's declared

Search the whole repo (excluding `node_modules`, `.git` and lockfiles) for anything that pins Node:

```bash
grep -rnE "FROM node:|image: *node:|nodejs_[0-9]+|NODE_VERSION|node-version|setup-node|\"node\" *:|runtime: *nodejs|nodejs[0-9]+\.x" \
  --exclude-dir=node_modules --exclude-dir=.git \
  --exclude=package-lock.json --exclude=yarn.lock --exclude=pnpm-lock.yaml .
ls -a | grep -E "^\.(nvmrc|node-version|tool-versions)$"
```

Typical places:

| Place | Field |
|---|---|
| `.nvmrc`, `.node-version`, `.tool-versions` | version |
| `Dockerfile*`, `docker-compose*.yml` | `FROM node:…`, `image: node:…` (all stages) |
| `package.json` (root and workspaces) | `engines.node`, `volta.node`, `devEngines` |
| Lockfile | root package `engines`; regenerated, never edited by hand |
| CI (`.github/workflows`, `.gitlab-ci.yml`, `azure-pipelines.yml`, …) | `node-version`, `setup-node`, `image:` |
| Platform configs (`nixpacks.toml`, `netlify.toml`, `vercel.json`, `app.yaml`, `serverless.yml`, `.devcontainer/*`, Terraform/IaC) | runtime/version keys |
| `@types/node` in any `package.json` | major should match the runtime |

Then figure out **which of these the production deploy actually uses** (read the deploy config, CI, compose files, README, or ask the user). Say clearly which files affect production and which you're only updating for consistency. If a pinned build image or platform snapshot can't deliver the target version, flag it.

Note the current **exact** version, e.g. from the Dockerfile tag or `.nvmrc`. A range like `20` or `lts` means the real version depends on build time: say so.

## 2. Pick the target version

1. If the user linked a security advisory, read it and note: affected lines, patched version per line, the CVEs and what they touch. Read it yourself (or through a web-fetch agent), don't answer from memory.
2. Get release metadata:
   ```bash
   curl -s https://nodejs.org/dist/index.json -o <tmp>/node-index.json
   python3 -I -c "import json,sys; d=json.load(open(sys.argv[1])); [print(r['version'], r['date'], r['lts'] or '-', r['security']) for r in d if r['version'].startswith(sys.argv[2])]" <tmp>/node-index.json v22.
   ```
   (`<tmp>` is a temporary directory outside the repo, e.g. the agent's scratchpad.)
   Check EOL dates in the Release schedule: https://github.com/nodejs/Release#release-schedule
3. Choose:
   - Current line still supported and patched → patched version **in the same line**.
   - Current line EOL → **nearest newer LTS line**, its first patched version. Don't jump further than needed.
   - Never pick odd-numbered or non-LTS lines for production.
   - If several options are reasonable, recommend one and list the others.
4. Check the artifacts the project needs exist (e.g. Docker tag: `curl -s -o /dev/null -w "%{http_code}" https://hub.docker.com/v2/repositories/library/node/tags/<version>` → `200`; or the matching variant, such as `-alpine` or `-slim`, if that's what the Dockerfile uses).

## 3. Research what actually changed

This is the core of the skill. Build a list of concrete changes between the **current** and **target** versions, then filter it by what the project uses.

**a. Bundled components.** Diff the metadata of the two versions from `node-index.json` (fields `npm`, `v8`, `uv`, `zlib`, `openssl`, `modules`):
- `modules` changed → native-addon ABI changed: every native module must be rebuilt or have a prebuilt binary for the new ABI.
- `openssl` major/minor changed → TLS defaults, ciphers, legacy algorithms (e.g. MD4, old key sizes), certificate checks.
- `v8` changed → language features, performance, memory behavior; rarely breaking.
- `npm` changed → lockfile format, `npm ci` behavior, peer-deps handling.
- Also check undici (`fetch`), c-ares, ICU, llhttp in the changelog (not in index.json).

**b. Changelogs and migration notes.** Read only what lies between the two versions:
- Same line: the entries in `https://github.com/nodejs/node/blob/main/doc/changelogs/CHANGELOG_V<major>.md` after the current version, up to the target.
- Across majors: for each major crossed, its `v<major>.0.0` release post (`https://nodejs.org/en/blog/release/v<major>.0.0`), the **SEMVER-MAJOR** section of its changelog, and any official migration guide (`https://nodejs.org/en/blog/migrations`). Then the minor/patch entries of the target line up to the target version.
- Deprecations that became runtime warnings or errors, or were removed: https://nodejs.org/api/deprecations.html (check the "Type" history of each).
- Every security post between the two versions, not just the one the user linked: they change behavior on purpose (stricter parsing, TLS checks, HTTP handling).

Changelogs are long: if subagents are available, delegate reading them to one with a precise brief (versions, what to extract: breaking changes, removals, new runtime deprecations, default changes, dependency bumps, security behavior changes) instead of pulling whole files into context.

**c. Check official migrations.** If Node publishes codemods for the jump (see the migration guide / `nodejs/userland-migrations`), mention them; run them only if the user agrees.

Write the result as a short table: change → affected API/area → source link.

## 4. Map changes to the project

For each change in step 3, check whether the project is exposed:

- **Code usage**: grep the project's own code (not `node_modules`) for the affected APIs, flags and modules (e.g. removed `util.is*`, `url.parse`, `punycode`, `crypto` algorithms, `--experimental-*` flags, `NODE_OPTIONS`, `fs` APIs, `http` agent options).
- **Native modules**: find them with
  ```bash
  find node_modules -name binding.gyp -not -path "*/node_modules/*/node_modules/*" | head -50
  find node_modules -name "*.node" | head -50
  ```
  Common ones: `sharp`, `bcrypt`, `argon2`, `canvas`, `sqlite3`/`better-sqlite3`, `node-sass`, `re2`, `@swc/*`, `esbuild`, `prisma`. Check each supports the target version (its `engines`, release notes, prebuilt binaries).
- **Dependencies' `engines`**: after installing with the new version, look for `EBADENGINE` warnings; list packages whose `engines.node` excludes the target.
- **Frameworks and tooling**: check the framework/runtime versions in use (Next.js, NestJS, Express, Payload, Jest, TypeScript, ts-node, webpack…) officially support the target Node version.
- **Runtime surface**: what the app does at runtime that the changes touch — outbound HTTPS/TLS, DNS, `fetch`, compression, crypto, file uploads, workers, cron jobs, child processes, streams, sockets between services.

Keep only items where the project is actually exposed; each becomes a test in step 6.

## 5. Apply the changes

1. Update every place found in step 1 (pinned exact versions where the project already pins exactly; keep the existing style). For `engines.node`, keep the project's convention: if it's a floor (e.g. `>=22.13`), leave it unless the old floor now allows a vulnerable version the project must not run on, and then raise it to the patched version of each allowed line; don't narrow it to a single line, since it would break developers and CI on other supported lines.
2. Bump `@types/node` to the target major.
3. Activate the target version locally (`nvm install <v> && nvm use <v>`, or `fnm`/`volta`) and regenerate the lockfile with the project's package manager and the **same flags the build uses** (look at the Dockerfile/CI, e.g. `--legacy-peer-deps`).
4. Review the lockfile diff: it should contain only the intended changes. If many unrelated dependencies moved, stop and ask the user.

## 6. Verify

Run what the project already has, in this order, with the target Node version active:

1. Install (`npm ci` or equivalent) — note any `EBADENGINE` or native build failures.
2. Typecheck, lint, unit/integration tests.
3. Production build, including Docker images if the deploy uses them (run long builds in the background, logs to a temporary directory outside the repo).
4. Start the app or containers and check `node -v` inside them and the startup logs.

When something fails, **compare with a baseline**: run the same step on the default branch with the old version (e.g. in a `git worktree` in a temporary directory, copying any untracked local env files it needs; remove the worktree and baseline images afterwards). Only failures that don't happen on the baseline are caused by the upgrade. Report pre-existing failures as such.

Also try `node --trace-deprecation` (or `NODE_OPTIONS=--trace-deprecation`) when starting the app to surface new deprecation warnings.

## 7. Manual test plan

Give the user a test plan built from steps 3 and 4. Each item must say **what to test, how, and which change it covers** (with the link). Order by risk:

1. Startup and logs (process manager not restarting, no new errors, version check).
2. Native modules found in step 4.
3. Areas touched by breaking changes, removals or new runtime deprecations the code uses.
4. Areas touched by security fixes (TLS/certificates, DNS, HTTP parsing and keep-alive, compression, crypto…) mapped to the real flows that use them (outbound API calls, webhooks, uploads, scheduled jobs, inter-service calls).
5. Areas touched by bundled component bumps (OpenSSL, undici/`fetch`, npm).
6. A short smoke test of the main user flows.

Say which known harmless warnings to ignore, if any. Don't pad the list with tests unrelated to the changes found.

## 8. Commit and hand-off

- Commit only the version-related files and the lockfile. Never commit local env files or secrets that happen to be modified.
- In the commit message, list the files touched and the reason (EOL line / CVEs).
- Summarize for the user:
  - the chosen version and why, with the alternatives;
  - files changed, and which ones affect production;
  - the changes found (step 3) that affect the project (step 4);
  - the outcome of each check: passed, failing also on the baseline, not run (and why);
  - the manual test plan (step 7).
