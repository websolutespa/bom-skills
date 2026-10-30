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

Writing the secret into `.env.production` doesn't keep it out of the runtime image. `next build` copies the app's `.env` and `.env.production` into `.next/standalone/<app path>/`, and the runtime stage copies the standalone tree (section 5). Don't add an explicit `COPY` of the builder's `.env*` on top of that. Also provide `MIXER_SECRET` to the runtime container as an environment variable, because the session and image routes need it there too.

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
| `MIXER_SECRET` | Mixer Dockerfile, compose args, runtime env, `turbo.json` (next to `IMAGE_SECRET`) |
| `AZURE_STORAGE_CONTAINER_ACCESS` | Bowl runtime env (phase 3), `turbo.json` |
| `S3_STORAGE_*` (S3 projects) | Bowl runtime env, with no placeholders in the committed `.env` (section 4) |
| `FS_STORAGE_BASEURL`, `FS_STORAGE_ENABLE_GENERATE_FILE_URL`, `FS_STORAGE_DISABLE_PAYLOAD_ACCESS_CONTROL` (legacy `/oven/media` URLs, any adapter) | Bowl runtime env, `turbo.json` (payload-3-91.md section 4b) |
| `BOM_DB`, `BOM_TEST_DB` | `turbo.json` only |
| `NEXT_PUBLIC_*` | Build time only. Next inlines them, so a runtime value has no effect |

## 3. Hosting dashboards (Coolify, Vercel, …)

The repo can't verify these, so list them under the manual follow-ups:

- `MIXER_SECRET` exists, is non-empty, and is available at **build time** (Coolify: tick "Available at Buildtime"). A Coolify build log that lists `--build-arg 'MIXER_SECRET'` only shows the variable is declared, not that it has a value.
- Build-time values must be real. `ARG X=secret` defaults hide a missing variable until runtime.
- `PAYLOAD_SECRET` and the storage credentials are set on the Bowl service, now that the committed `.env` no longer carries them (section 4).
- `S3_STORAGE_ENDPOINT` is either unset or a URL, for example `https://s3.eu-west-1.amazonaws.com`. A bucket ARN (`arn:aws:s3:::…`) is not a URL. Also check that `S3_STORAGE_BUCKET` is the bucket for that environment, not the dev bucket.

## 4. Committed env files: secrets and placeholders

The Bowl runtime image contains the committed `src/bowl/payload/.env` (the standalone output copies it, and many Bowl Dockerfiles also `COPY .env*`). Next loads it at startup, and any variable the hosting doesn't set takes its value from there. Two consequences:

- **Placeholders become values.** Many projects commit `KEY='KEY'` placeholders. Payload 2 never read `S3_STORAGE_ENDPOINT`. In Payload 3, `@websolutespa/payload-plugin-storage` passes `getEnv('S3_STORAGE_ENDPOINT') || undefined` to the S3 client, so the placeholder `'S3_STORAGE_ENDPOINT'` becomes the endpoint. Every media request returns 500, and uploads fail with `TypeError: Invalid URL` (input `"S3_STORAGE_ENDPOINT"`). This works on a Payload 2 production and breaks as soon as the 3.x image is released.
- **Secrets end up in the image.** A real `PAYLOAD_SECRET` (or `OVEN_API_KEY`, `STORE_API_KEY`, storage credentials) in a committed `.env` ships in every image and stays in git history.

Fix:

1. In the committed `.env`, leave the secrets and the `S3_STORAGE_*` variables empty (`S3_STORAGE_ENDPOINT=`). On AWS an empty endpoint is correct: the SDK derives it from `S3_STORAGE_REGION`, and the generated URLs are identical.
2. Move the real values to `.env.local` (gitignored) for local development, and to the hosting dashboard for deployments (section 3). Set them on the hosting, with the **current** values, **before** releasing the image that drops them. A Bowl without `PAYLOAD_SECRET` builds fine and then fails every request with `Error: missing secret key. A secret key is needed to secure Payload.` Coolify's build log lists the variables it passes (`--build-arg '…'`): if `PAYLOAD_SECRET` is not there, it is not set.
3. A secret that was committed is in git history. Add a manual follow-up to rotate it, as a separate step after the release. Rotating `PAYLOAD_SECRET` logs out admin sessions **and invalidates every API key**: Payload finds a key by an HMAC of the secret (`apiKeyIndex`). The Oven authenticates to the Bowl with an API key, so regenerate that key in the admin and update it on the Oven's hosting in the same step.

Audit the committed env files without printing values. The command lists every key whose value is a placeholder (equal to the key name) or non-empty:

```bash
for f in $(git ls-files "**/.env" "**/.env.production"); do
  awk -F= -v f="$f" '/^[A-Z]/{k=$1; v=substr($0,length(k)+2); gsub(/^'"'"'|'"'"'$/,"",v);
    if (v==k) print f": "k" placeholder"; else if (v!="") print f": "k" set"}' "$f"
done
```

Every placeholder must be emptied. Every `set` key that is a secret must move to `.env.local` and the hosting.

## 5. Mixer runtime image: Turbopack hashed externals

Next 16 builds with Turbopack. It doesn't bundle some packages (ESM packages imported from transpiled workspace packages, for example `react-error-boundary`, `lenis`, `motion`, `swiper`, `@websolutespa/bom-mixer-image`). It loads them at runtime through symlinks named after the package plus a hash. The symlinks are **relative to the standalone root**:

```text
src/mixer/web/.next/standalone/src/mixer/web/.next/node_modules/
  motion-b670d5115ae5de8a -> ../../../../../node_modules/motion
  react-error-boundary-7c9546dab3426252 -> ../../../../../node_modules/react-error-boundary
  @websolutespa/bom-mixer-image-<hash> -> ../../../../../../node_modules/@websolutespa/bom-mixer-image
```

Projects created before 3.1 copy only `.next/standalone/src/mixer/web` to `/app`, together with the builder's whole `node_modules`. The links then point outside the image. The build passes, `next start` boots, and every page returns "Internal Server Error":

```text
Error: Failed to load external module react-error-boundary-7c9546dab3426252:
Error: Cannot find module 'react-error-boundary-7c9546dab3426252'
```

It works locally, because the standalone folder exists on disk.

Fix it in `src/mixer/Dockerfile`. The runtime stage copies the **whole** standalone tree, as the Bowl Dockerfile already does, so the relative links resolve as they are:

```dockerfile
# builder stage: stop here with a clear error if next build produced no standalone server
RUN npm run build:web && test -f src/mixer/web/.next/standalone/src/mixer/web/server.js

FROM base AS runtime
WORKDIR /app
# Next.js standalone output: copy the whole tree, the turbopack externals in .next/node_modules
# are symlinks relative to the standalone root (e.g. motion-<hash> -> ../../../../../node_modules/motion)
COPY --from=builder /app/src/mixer/web/.next/standalone ./
COPY --from=builder /app/src/mixer/web/.next/static ./src/mixer/web/.next/static
COPY --from=pruner /app/src/mixer/public ./src/mixer/web/public
# bom-mixer-image caches resized images in <cwd>/.cache, server.js runs from its own folder
RUN mkdir -p src/mixer/web/.cache
ENV NODE_ENV=production
EXPOSE 80
ENV PORT=80
ENV HOSTNAME="0.0.0.0"
CMD ["pm2-runtime", "src/mixer/web/server.js"]
```

Compared with the pre-3.1 runtime stage:

- `COPY --from=builder /app/node_modules ./node_modules` goes away. The standalone tree has its own traced `node_modules`. On a real project this took the image from 3.86 GB to 2.45 GB, and removed a 7-minute copy step from the deploy.
- Static files, `public` and the image cache move under `src/mixer/web/`, and the `CMD` points to `src/mixer/web/server.js`.
- Without the `test -f` guard, a failed `next build` surfaces only later, as a confusing `not found` on the `COPY`.

If the project already relinks the hashed links with a shell loop (`ln -sfn "/app/node_modules/${n%-*}"`), replace the loop with this stage. The loop depends on the `<pkg>-<hash>` naming and breaks if a future Next changes it.

Check whether the project is affected before changing anything:

```bash
ls -l src/mixer/web/.next/standalone/src/mixer/web/.next/node_modules
```

If the directory has no hashed links, the old runtime stage still works. Adopting the standalone copy is optional then, but it keeps the image smaller.

## Verification

```bash
docker compose build mixer
docker compose run --rm --no-deps mixer ls -lL /app/src/mixer/web/.next/node_modules
```

The second command must list every hashed entry without a "No such file" error. Then start the container and request a page and an `/api/_image` URL, with the production `IMAGE_STRATEGY` (`token` included). A build that passes is not enough: this failure only shows at request time.

For the Bowl, start the container with the `S3_STORAGE_*` variables unset, and open a media URL. It must not fail with `Invalid URL`. Then run the audit in section 4 again: it must print no placeholders and no secrets.

If Docker isn't available locally, reproduce the failure mode: run `npm run build:web` after removing `MIXER_SECRET` from `src/mixer/web/.env.local` and from the shell. The build must fail on `/404`, and pass again once the variable is set. This confirms the variable is the only source of the secret.
