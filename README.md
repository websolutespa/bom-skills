# BOM Skills

Custom Agent Skills for Websolute BOM-stack workflows.

This repository is installable with `npx skills` and ships these skills:

- `bom-stack-upgrade` - guided migration from BOM-stack 2.x to 3.x.
- `bom-stack-upgrade-3-1` - guided upgrade of a BOM-stack 3.0.x project to the
  3.1 release (Payload 3.91, Next.js 16.4, TypeScript 6, ESLint 10, Vitest 5).
- `bom-stack-upgrade-4-0` - guided upgrade to the bom-sample 4.0.0-next.8 stack:
  one Next.js 16.4 App Router app with Payload 3.91 and `@websolutespa/bom-next`,
  pnpm 11, TypeScript 6, Vitest 5, oxlint and oxfmt (`@websolutespa/oxc`).
- `bom-db-sanitize` - checks and fixes the MongoDB data of a project on
  Payload 3: relationship ids still stored as strings by Payload 2, and
  documents listed twice (or not at all) in draft listings. Installs
  `db:check` / `db:fix` scripts and a runtime fix into the Payload app.
- `node-upgrade` - upgrade of the Node.js runtime to a patched release (security
  advisory or EOL line), with a test plan built from what changed between the
  two versions. Works on any Node project.

Which one to run depends on the project's current version:

| Project on | Run |
|---|---|
| bom-stack 2.x (Payload 2, Next 14) | `bom-stack-upgrade` (its phase 9 runs `bom-db-sanitize`), then `bom-stack-upgrade-3-1`, then `bom-stack-upgrade-4-0` |
| bom-stack 3.0.x (Payload 3.74, Next 16.1) | `bom-db-sanitize` if the project came from 2.x, then `bom-stack-upgrade-3-1`, then `bom-stack-upgrade-4-0` |
| bom-stack 3.1 monorepo (Bowl + Mixer Pages Router) | `bom-stack-upgrade-4-0` (path B: rebuild on the bom-sample App Router architecture, then path A) |
| 4.0 App Router project (bom-next 4.0.0-next.0 … .6) | `bom-stack-upgrade-4-0` (path A: stack and toolchain) |
| Any Payload 3 + MongoDB project with duplicated rows in draft listings | `bom-db-sanitize` |

Every bom-stack skill starts with a guardrail check and stops if the project is
on the wrong version. They also set the Node version for the target release: use
`node-upgrade` only to patch Node within a bom-stack version.

The upgrade skills move the code, not the data: Payload 3 never converts the
string ids Payload 2 left in MongoDB. `bom-stack-upgrade` therefore ends with
a blocking data sanitization phase, and the `bom-stack-upgrade-3-1` and
`bom-stack-upgrade-4-0` guardrails stop when `db:check` (from
`bom-db-sanitize`) is not clean on the dev database. Staging and production
are sanitized by the user, with the runbook in `bom-db-sanitize`, before
go-live.

## Install

```bash
npx skills add websolutespa/bom-skills
```

Install only one skill explicitly:

```bash
npx skills add websolutespa/bom-skills --skill bom-stack-upgrade
npx skills add websolutespa/bom-skills --skill bom-stack-upgrade-3-1
npx skills add websolutespa/bom-skills --skill bom-stack-upgrade-4-0
npx skills add websolutespa/bom-skills --skill bom-db-sanitize
npx skills add websolutespa/bom-skills --skill node-upgrade
```

The upgrade skills need `bom-db-sanitize` for their data check: install it
together with them.

### DB tool installation

`bom-db-sanitize` installs its scripts into the project's Payload app (it
auto-detects it, or pass `--app <dir>`):

```bash
node .agents/skills/bom-db-sanitize/scripts/install.mjs --dry-run
node .agents/skills/bom-db-sanitize/scripts/install.mjs
```

Then `npm run db:check` / `pnpm db:check` in the Payload app.

## VS Code Prompt Templates

Each skill includes a VS Code prompt template:

- `skills/bom-stack-upgrade/prompts/bom-stack-upgrade.prompt.md`
- `skills/bom-stack-upgrade-3-1/prompts/bom-stack-upgrade-3-1.prompt.md`
- `skills/bom-stack-upgrade-4-0/prompts/bom-stack-upgrade-4-0.prompt.md`
- `skills/bom-db-sanitize/prompts/bom-db-sanitize.prompt.md`
- `skills/node-upgrade/prompts/node-upgrade.prompt.md`

`npx skills add` installs skills in the agent skills directory; it does not
automatically copy prompt files into your project `.github/prompts` folder.

### Prompt installation

Use the helper script from the installed skill to copy its prompt template
into a target project:

```powershell
powershell -ExecutionPolicy Bypass -File .agents/skills/bom-stack-upgrade/scripts/install-vscode-prompts.ps1 -ProjectRoot .
powershell -ExecutionPolicy Bypass -File .agents/skills/bom-stack-upgrade-3-1/scripts/install-vscode-prompts.ps1 -ProjectRoot .
powershell -ExecutionPolicy Bypass -File .agents/skills/bom-stack-upgrade-4-0/scripts/install-vscode-prompts.ps1 -ProjectRoot .
powershell -ExecutionPolicy Bypass -File .agents/skills/bom-db-sanitize/scripts/install-vscode-prompts.ps1 -ProjectRoot .
powershell -ExecutionPolicy Bypass -File .agents/skills/node-upgrade/scripts/install-vscode-prompts.ps1 -ProjectRoot .
```

After running them, you will have:

- `.github/prompts/bom-stack-upgrade.prompt.md`
- `.github/prompts/bom-stack-upgrade-3-1.prompt.md`
- `.github/prompts/bom-stack-upgrade-4-0.prompt.md`
- `.github/prompts/bom-db-sanitize.prompt.md`
- `.github/prompts/node-upgrade.prompt.md`

## Repository Layout

```text
skills/
	bom-stack-upgrade/
		SKILL.md
		assets/
		prompts/
		references/
		scripts/
	bom-stack-upgrade-3-1/
		SKILL.md
		assets/          (checklist template, test files from the bom samples)
		prompts/
		references/
		scripts/
	bom-stack-upgrade-4-0/
		SKILL.md
		assets/          (checklist template, oxc/vitest/pnpm configs)
		prompts/
		references/
		scripts/
	bom-db-sanitize/
		SKILL.md
		assets/          (db-tools: scripts installed into the Payload app, DB_SANITIZE log template)
		prompts/
		references/      (data model, runbook, transactions)
		scripts/         (install.mjs, install-vscode-prompts.ps1)
	node-upgrade/
		SKILL.md
		prompts/
		scripts/
```

## License

MIT
