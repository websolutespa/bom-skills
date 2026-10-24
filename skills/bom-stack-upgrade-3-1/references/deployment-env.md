# Phase 2b: deployment (Dockerfiles, docker-compose, env vars)

A build that passes on the developer's machine can still fail in Docker or on Coolify. Locally the variables come from `.env.local` (gitignored) and from the shell. In the image they exist only if the Dockerfile and `docker-compose.yml` pass them. The 3.1 packages read some variables that a 3.0-era project never forwarded.

## 1. `MIXER_SECRET` (required at build time)

`getImageSecret()` in `@websolutespa/bom-core` reads `process.env.MIXER_SECRET` (not `IMAGE_SECRET`), and `next build` calls it while prerendering `/404`. The session helpers read it too. If it's empty, the build fails:

```text
getImageSecret MIXER_SECRET not defined
Error occurred prerendering page "/404"
Export encountered an error on /404, exiting the build.
```

Projects created before 3.1 usually forward only `IMAGE_SECRET`. Check every deployable that builds the Mixer web app:

```bash
git grep -n "MIXER_SECRET" -- "**/Dockerfile" "**/docker-compose*.yml" "**/.env*"
git grep -n "IMAGE_SECRET" -- "**/Dockerfile" "**/docker-compose*.yml"
```

Every file that mentions `IMAGE_SECRET` must also mention `MIXER_SECRET`.

**`src/mixer/Dockerfile`**, in the builder stage:

```diff
 ARG IMAGE_SECRET=secret
+ARG MIXER_SECRET
 ...
   echo "IMAGE_SECRET=${IMAGE_SECRET}" >> ./src/mixer/web/.env.production; \
+  echo "MIXER_SECRET=${MIXER_SECRET}" >> ./src/mixer/web/.env.production; \
```

**`docker-compose.yml`**, in `mixer.build.args`:

```diff
         - IMAGE_SECRET=${IMAGE_SECRET}
+        - MIXER_SECRET=${MIXER_SECRET}
```

The bom samples already do this. See `sample/basic/src/mixer/Dockerfile` and `sample/basic/docker-compose.yml` in the bom repo.

Writing the secret into `.env.production` puts it in the builder stage only. The runtime stage copies `node_modules`, `.next/standalone`, `.next/static` and `public`, so keep it that way. Never `COPY` the builder's `.env*` into the runtime image. Also provide `MIXER_SECRET` to the runtime container as an environment variable, because the session and image routes need it there too.

## 2. Audit every other variable the same way

For each variable the app reads, confirm it reaches the build and the runtime:

```bash
git grep -nE "process\.env\.[A-Z_]+" -- "src/mixer/**" "src/packages/**" ":!**/node_modules/**"
```

Compare the result with three places:

1. `ARG` lines and the `.env.production` `echo` block in each `Dockerfile`.
2. `build.args` in `docker-compose.yml`, plus the service's `environment:` for runtime values.
3. The root `turbo.json` `globalEnv` (phase 2). A variable missing there is invisible to turbo's task hash and can leave a stale cached build.

Typical gaps after a 3.1 upgrade:

| Variable | Where it must be set |
|---|---|
| `MIXER_SECRET` | Mixer Dockerfile, compose args, runtime env |
| `AZURE_STORAGE_CONTAINER_ACCESS` | Bowl runtime env (phase 3), `turbo.json` |
| `BOM_DB`, `BOM_TEST_DB` | `turbo.json` only |
| `NEXT_PUBLIC_*` | Build time only. Next inlines them, so a runtime value has no effect |

## 3. Hosting dashboards (Coolify, Vercel, …)

The repo can't verify these, so list them under the manual follow-ups:

- `MIXER_SECRET` exists, is non-empty, and is available at **build time** (Coolify: tick "Available at Buildtime"). A Coolify build log that lists `--build-arg 'MIXER_SECRET'` only shows the variable is declared, not that it has a value.
- Build-time values must be real. `ARG X=secret` defaults hide a missing variable until runtime.

## 4. Mixer runtime image: Turbopack hashed externals

Next 16 builds with Turbopack. It doesn't bundle some packages (ESM packages imported from transpiled workspace packages, for example `react-error-boundary`, `lenis`, `motion`, `swiper`, `@websolutespa/bom-mixer-image`). It loads them at runtime through symlinks named after the package plus a hash:

```text
.next/node_modules/react-error-boundary-7c9546dab3426252 -> /app/src/mixer/web/.next/standalone/node_modules/react-error-boundary
.next/node_modules/@websolutespa/bom-mixer-image-cffff9afd519e2ba -> /app/src/mixer/web/.next/standalone/node_modules/@websolutespa/bom-mixer-image
```

The link targets are **absolute paths inside the builder stage**. The runtime stage copies `.next/standalone/src/mixer/web` to `/app`, but not the standalone `node_modules` that the links point to. The build passes, `next start` boots, and every page returns "Internal Server Error":

```text
Error: Failed to load external module react-error-boundary-7c9546dab3426252:
Error: Cannot find module 'react-error-boundary-7c9546dab3426252'
```

It works locally, because the standalone folder exists on disk at the same path.

Fix it in the runtime stage of `src/mixer/Dockerfile`: put the standalone `node_modules` at the path the links reference. The runtime `WORKDIR` must be the same as the builder's (`/app`):

```diff
 COPY --from=pruner /app/src/mixer/public ./public
+# Turbopack loads some packages through hashed symlinks (.next/node_modules/<pkg>-<hash>) whose absolute
+# targets are inside the builder's standalone folder. Provide the same path so they resolve at runtime.
+COPY --from=builder /app/src/mixer/web/.next/standalone/node_modules /app/src/mixer/web/.next/standalone/node_modules
 ENV NODE_ENV=production
```

Keep it as a `COPY`. Don't rewrite the links with a shell loop, and don't change `next.config.ts` to hide the problem. If the app folder or the `WORKDIR` changes, update the path.

Check whether the project is affected before changing anything:

```bash
ls -l src/mixer/web/.next/standalone/src/mixer/web/.next/node_modules
```

If the directory has no hashed links, skip this section and mark the checklist item `[skip]`.

## Verification

```bash
docker compose build mixer
docker compose run --rm --no-deps mixer ls -lL /app/.next/node_modules
```

The second command must list every hashed entry without a "No such file" error. Then request a page from the running container. A build that passes is not enough: this failure only shows at request time.

If Docker isn't available locally, reproduce the failure mode: run `npm run build:web` after removing `MIXER_SECRET` from `src/mixer/web/.env.local` and from the shell. The build must fail on `/404`, and pass again once the variable is set. This confirms the variable is the only source of the secret.
