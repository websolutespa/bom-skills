param(
  [string]$ProjectRoot = "."
)

$ErrorActionPreference = "Stop"

$skillRoot = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $skillRoot "prompts"
$targetDir = Join-Path (Resolve-Path $ProjectRoot).Path ".github/prompts"

if (-not (Test-Path $sourceDir)) {
  throw "Prompt source directory not found: $sourceDir"
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

Get-ChildItem -Path $sourceDir -Filter "*.prompt.md" -File | ForEach-Object {
  $dest = Join-Path $targetDir $_.Name
  Copy-Item -Path $_.FullName -Destination $dest -Force
  Write-Output "Installed prompt: $dest"
}
