# BOM Skills

Custom Agent Skills for Websolute BOM-stack workflows.

This repository is installable with `npx skills` and currently ships one skill:

- `bom-stack-upgrade` - guided migration from BOM-stack 2.x to 3.x.

## Install

```bash
npx skills add websolutespa/bom-skills
```

Install only this skill explicitly:

```bash
npx skills add websolutespa/bom-skills --skill bom-stack-upgrade
```

## VS Code Prompt Template

The skill includes a VS Code prompt template at:

- `skills/bom-stack-upgrade/prompts/bom-stack-upgrade.prompt.md`

`npx skills add` installs skills in the agent skills directory; it does not
automatically copy prompt files into your project `.github/prompts` folder.

Use the helper script from the installed skill to copy prompt templates into a
target project:

```powershell
powershell -ExecutionPolicy Bypass -File .agents/skills/bom-stack-upgrade/scripts/install-vscode-prompts.ps1 -ProjectRoot .
```

After running it, you will have:

- `.github/prompts/bom-stack-upgrade.prompt.md`

## Repository Layout

```text
skills/
	bom-stack-upgrade/
		SKILL.md
		assets/
		prompts/
		references/
		scripts/
```

## License

MIT
