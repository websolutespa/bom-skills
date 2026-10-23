# BOM Skills

Custom Agent Skills for Websolute BOM-stack workflows.

This repository is installable with `npx skills` and ships these skills:

- `bom-stack-upgrade` - guided migration from BOM-stack 2.x to 3.x.
- `bom-stack-upgrade-3-1` - guided upgrade of a BOM-stack 3.0.x project to the
  3.1 release (Payload 3.91, Next.js 16.4, TypeScript 6, ESLint 10, Vitest 5).
- `node-upgrade` - upgrade of the Node.js runtime to a patched release (security
  advisory or EOL line), with a test plan built from what changed between the
  two versions. Works on any Node project.

Which one to run depends on the project's current version:

| Project on | Run |
|---|---|
| bom-stack 2.x (Payload 2, Next 14) | `bom-stack-upgrade`, then `bom-stack-upgrade-3-1` |
| bom-stack 3.0.x (Payload 3.74, Next 16.1) | `bom-stack-upgrade-3-1` |

Both bom-stack skills start with a guardrail check and stop if the project is on the
wrong version. They also set the Node version for the target release: use
`node-upgrade` only to patch Node within a bom-stack version.

## Install

```bash
npx skills add websolutespa/bom-skills
```

Install only one skill explicitly:

```bash
npx skills add websolutespa/bom-skills --skill bom-stack-upgrade
npx skills add websolutespa/bom-skills --skill bom-stack-upgrade-3-1
npx skills add websolutespa/bom-skills --skill node-upgrade
```

## VS Code Prompt Templates

Each skill includes a VS Code prompt template:

- `skills/bom-stack-upgrade/prompts/bom-stack-upgrade.prompt.md`
- `skills/bom-stack-upgrade-3-1/prompts/bom-stack-upgrade-3-1.prompt.md`
- `skills/node-upgrade/prompts/node-upgrade.prompt.md`

`npx skills add` installs skills in the agent skills directory; it does not
automatically copy prompt files into your project `.github/prompts` folder.

### Prompt installation

Use the helper script from the installed skill to copy its prompt template
into a target project:

```powershell
powershell -ExecutionPolicy Bypass -File .agents/skills/bom-stack-upgrade/scripts/install-vscode-prompts.ps1 -ProjectRoot .
powershell -ExecutionPolicy Bypass -File .agents/skills/bom-stack-upgrade-3-1/scripts/install-vscode-prompts.ps1 -ProjectRoot .
powershell -ExecutionPolicy Bypass -File .agents/skills/node-upgrade/scripts/install-vscode-prompts.ps1 -ProjectRoot .
```

After running them, you will have:

- `.github/prompts/bom-stack-upgrade.prompt.md`
- `.github/prompts/bom-stack-upgrade-3-1.prompt.md`
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
	node-upgrade/
		SKILL.md
		prompts/
		scripts/
```

## License

MIT
