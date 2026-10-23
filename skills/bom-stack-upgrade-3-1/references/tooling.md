# Phase 2: tooling (TypeScript 6, ESLint 10, rimraf 6, turbo, git)

## TypeScript 6: tsconfig

`@websolutespa/tsconfig` 3.1 targets TypeScript 6.0. It also keeps the configs ready for TypeScript 7.

1. **Remove `baseUrl`** from every `tsconfig.json`: the Bowl app, the Mixer web app and every `src/mixer/packages/*`. TS 6 deprecates it, and it breaks under TS 7. Keep `paths`, but make sure each target is relative and starts with `./`:

   ```jsonc
   "compilerOptions": {
     // "baseUrl": ".",          ← remove
     "declaration": false,
     "declarationMap": false,
     "paths": {
       "@/*": ["./src/*"],
       "@payload-config": ["./src/payload.config.ts"]   // Bowl app only
     }
   }
   ```

2. **`types` is no longer implicit.** TS 6 defaults `types` to `[]`, so global types are no longer pulled in from every `@types/*`. The base config sets `"types": ["node"]`. If a package uses other ambient globals, add them in one of two ways:
   - in that tsconfig: `"types": ["node", "google.maps"]`;
   - or in the file that uses them: `/// <reference types="dom-speech-recognition" />`. That is what bom-mixer-llm does for `SpeechRecognition`.

   Symptom: `Cannot find name 'google'` / `'SpeechRecognition'` / `'jest'`.

3. **Don't add `typeRoots`.** Old configs with `typeRoots: ["./node_modules/@types"]` break in workspaces; remove them.

4. **Side-effect imports.** The base config sets `noUncheckedSideEffectImports: false`, so `import 'swiper/css'` and similar keep compiling. Don't override it.

5. For narrowing errors that TS 6 introduces in project code, see code-fixes.md.

## ESLint 10

The `eslint.config.js` files stay as they are: `@websolutespa/eslint-config/base`, `/next`, `/react`. Change these:

1. **Lint scripts.** `next lint` no longer exists in Next 16, and `eslint *.ts*` matches almost nothing. Use `eslint .` everywhere:

   ```diff
   -    "lint": "next lint",
   +    "lint": "eslint .",
   ```

   ```diff
   -    "lint": "eslint *.ts*"
   +    "lint": "eslint ."
   ```

2. **Disable directives.** The formatting rules are now `@stylistic/*`, so a comment like `/* eslint-disable quotes */` no longer applies. Rename the rule in every such comment:

   ```bash
   git grep -nE "eslint-disable(-next-line|-line)? .*\b(quotes|comma-dangle|indent|semi|no-extra-semi|no-multi-spaces|jsx-quotes)\b"
   ```

   ```diff
   -/* eslint-disable comma-dangle */
   -/* eslint-disable quotes */
   +/* eslint-disable @stylistic/comma-dangle */
   +/* eslint-disable @stylistic/quotes */
   ```

   Mock data files (`mock-*.ts`, `mock/**`) usually carry these comments.

3. **Config resolution.** ESLint 10 resolves the config from each file's directory upwards. A package without its own `eslint.config.js` (the samples' `icons` package) uses the nearest parent config. `@websolutespa/eslint-config` 3.1 ignores `**/dist/**`, `**/build/**`, `**/.next/**`, `**/.turbo/**` and `**/.rollup.cache/**` at any depth, so build output isn't linted. If you see warnings in `dist/` files, the package is still on eslint-config 3.0.x.

4. **Lint warnings.** Because the old scripts linted almost nothing, `eslint .` now reports a lot of warnings that were always there. `eslint-plugin-only-warn` makes every rule a warning: on the bom monorepo it reported 0 errors and about 2,400 warnings, mostly `no-unused-vars` and `no-explicit-any`.
   - The gate for this upgrade is **0 errors**.
   - **Don't** mass-fix warnings as part of the upgrade, and don't mass-add `eslint-disable`. Keep the upgrade diff reviewable, and record the warning count in the checklist as a follow-up.
   - If the user asks for the formatting warnings to be fixed, the chosen style is in `.prettierrc.json`: `singleQuote`, `semi`, `trailingComma: es5`, `printWidth: 100`, 2 spaces. Prettier output agrees with the `@stylistic` rules, except for strings that contain a single quote. Fix them in one separate commit that contains formatting only.

## rimraf 6 scripts

rimraf 4+ no longer expands globs unless you pass `--glob`, and it doesn't support `!` negations.

```diff
-    "reinstall:clean": "rimraf \"**/node_modules/**\" \"**/dist/**\" \"**/\\.next/**\" \"**/\\.turbo/**\" \"package-lock.json\"",
+    "reinstall:clean": "rimraf --glob \"**/node_modules/**\" \"**/dist/**\" \"**/\\.next/**\" \"**/\\.turbo/**\" \"package-lock.json\"",
```

```diff
-    "clean": "rimraf \"**/\\.next/**\" \"**/\\.turbo/**\"",
+    "clean": "rimraf --glob \"**/\\.next/**\" \"**/\\.turbo/**\"",
```

Mixer web:

```diff
-    "pre:clean": "rimraf public/* \"!public/.gitkeep\"",
+    "pre:clean": "rimraf --glob \"public/*\"",
-    "build:clean": "rimraf public/* \"!public/.gitkeep\"",
+    "build:clean": "rimraf --glob \"public/*\"",
```

`public/*` is generated (copied from `../public`) and listed in the web `.gitignore`. If the project tracks `public/.gitkeep`, the clean step now deletes it. Either stop tracking it, or restore it in the next script.

Declare `rimraf` 6.1.3 in every package whose scripts call it.

## `turbo.json`

`globalEnv` is in the root `turbo.json`. Add the variables introduced by 3.1, and remove the Jest one:

```diff
     "AZURE_STORAGE_CONNECTION_STRING",
+    "AZURE_STORAGE_CONTAINER_ACCESS",
     "AZURE_STORAGE_CONTAINER_NAME",
+    "BOM_DB",
+    "BOM_TEST_DB",
     "BUILD_STRATEGY",
 ...
-    "TS_JEST",
     "VERCEL"
```

Turbo 2.11 needs no other schema change from 2.8.

## `.gitignore`

In **both** apps, `src/bowl/payload/.gitignore` and `src/mixer/web/.gitignore`:

```gitignore
# generated by next dev
AGENTS.md
```

Next.js 16.4 `next dev` writes an `AGENTS.md` into the app folder. If the project already has a hand-written `AGENTS.md` there, rename it before you ignore the generated one.

If the project adopts Playwright (testing.md), add this to the Mixer web `.gitignore`:

```gitignore
# playwright
test-results
playwright-report
```

`next-env.d.ts` is generated. If the Bowl app tracks it, remove it with `git rm --cached src/bowl/payload/next-env.d.ts` and make sure it's ignored. The web app already ignores it.

## Visual Studio project files (if present)

In `src/bowl/bowl.esproj` and `src/mixer/mixer.esproj`:

```diff
-    <JavaScriptTestFramework>Jest</JavaScriptTestFramework>
+    <JavaScriptTestFramework>Vitest</JavaScriptTestFramework>
```

## Verification

```bash
npm install
npx turbo run types
npx turbo run lint      # 0 errors
```
