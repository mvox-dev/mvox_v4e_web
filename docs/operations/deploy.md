# Deploy — multivox to Cloudflare Pages

mvox deploys to Cloudflare Pages as a single project: **`multivox`** (production at `multivox.pages.dev` and the custom domain `mvox.eu`).

As of #44, `multivox` is a **Git-connected** Pages project. Normal deploys are **automatic** — there is no manual step. A manual `wrangler` deploy survives as an emergency fallback only (see [Emergency manual fallback](#emergency-manual-fallback)).

## Primary flow — Git-connected auto-deploy

The `multivox` Pages project is connected to the GitHub repo (`mvox-dev/mvox_v4e_web`). Cloudflare builds and deploys on every push:

- **Push / merge to `main`** → CF auto-builds (`pnpm run build`) and deploys to **production**, serving both `multivox.pages.dev` and `mvox.eu`.
- **Any other branch / PR** → CF creates an automatic **preview** deployment at a CF-generated URL (e.g. `<hash>.multivox.pages.dev` and a branch alias `<branch>.multivox.pages.dev`). This replaces the old manual `wrangler pages deploy --branch=preview-seasons` convention — preview deploys are now free per-branch.

There is nothing to run for a normal deploy: merge to `main` and CF takes it from there. Watch the build in the Cloudflare dashboard (multivox → Deployments) or via API (see [Verifying a deploy](#verifying-a-deploy)).

> A push to `main` always triggers a production rebuild + redeploy, even for docs-only changes. That is expected and harmless (the app bundle is identical); just don't be surprised by the deployment notification.

## CF project build config (reference / disaster recovery)

If the project ever needs to be reconnected or recreated, mirror this configuration:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Build command | `pnpm run build` |
| Build output directory | `.svelte-kit/cloudflare` |
| Framework preset | SvelteKit |
| Build env var | `NODE_VERSION=22` |
| Build env var | `PUBLIC_ENTU_DB=polyphony` (Production **and** Preview) |

**Why `PUBLIC_ENTU_DB` must be a *build* env var:** the app reads it via `$env/static/public`, which SvelteKit inlines **at build time**. Because CF builds remotely (not from your laptop), the value must be present in CF's build environment — a runtime-only var would not be baked into the bundle. The local `.env` covers `pnpm dev` / local builds only.

`wrangler.json` (committed at the repo root) supplies the runtime project metadata CF honors: `compatibility_date`, `compatibility_flags` (`nodejs_compat`), and `pages_build_output_dir`. It also carries `vars.PUBLIC_ENTU_DB=polyphony` (note: a `vars` block in `wrangler.json` locks the CF dashboard plaintext-vars UI — wrangler.json is the source of truth for plaintext vars; the dashboard manages secrets only).

The `account_id` is **not** in `wrangler.json` — it comes from `CLOUDFLARE_ACCOUNT_ID` in the environment, keeping account-scoped values out of the repo.

## Custom domain — mvox.eu

`mvox.eu` is wired to the `multivox` Pages project (done in #44):

- Apex `CNAME mvox.eu → multivox.pages.dev` (proxied); `www.mvox.eu → mvox.eu` (proxied).
- The `mvox.eu` DNS zone lives on our own Cloudflare account, so the custom-domain attachment auto-manages the CNAME and there is no external registrar/DNS step.
- TLS is auto-provisioned by Cloudflare (Google Trust Services cert). Allow a short window for cert issuance on a fresh attach.
- Do **not** touch the zone's `MX` / SPF / DKIM `TXT` records or the unrelated `A ai.mvox.eu` record when working on Pages — only the `mvox.eu` + `www.mvox.eu` proxied CNAMEs relate to the Pages project.

## Verifying a deploy

After a `main` build completes (dashboard shows all stages green, or poll the API):

```bash
# Load credentials into the current shell
set -a; source ~/.config/mvox/credentials.env; set +a

# Latest deployment status (expect latest_stage deploy -> success, environment production)
wrangler pages deployment list --project-name multivox

# Production health
curl -sI https://multivox.pages.dev/      # expect HTTP 200 + `x-sveltekit-page: true`
curl -sI https://mvox.eu/                 # expect HTTP 200 + `x-sveltekit-page: true`
curl -sI https://mvox.eu/library          # expect 302 -> /auth/login?redirect=%2Flibrary (auth guard)
```

Grab the served entry chunk hash from the HTML (`app.<hash>.js`) and confirm it differs from the previously-deployed build. Note: a CF-built chunk hash will **not** match a locally-built one even for the identical commit — CF builds on its own toolchain (Node 22), so hashes differ while the source is the same. Compare the served hash against what `multivox.pages.dev` serves, not against your local `.svelte-kit/cloudflare` output.

If the response is `404` or a Cloudflare placeholder, the build deployed an empty/wrong directory — check the build log in the dashboard.

> *TLS may take ~60s to provision on a fresh unique-URL alias (`<hash>.multivox.pages.dev`); retry once before treating cert errors as deploy failures.*

## Emergency manual fallback

When CF's git build is broken (e.g. a CF-side build outage) and you must ship a known-good local artifact, a manual `wrangler` deploy still works on a git-connected project — it lands as a Direct Upload override of the current production deployment.

> **Note on `pnpm run deploy` vs `pnpm deploy`:** pnpm reserves `deploy` as a workspace subcommand (`ERR_PNPM_CANNOT_DEPLOY`). Always invoke with `pnpm run deploy` — the explicit `run` makes pnpm execute the `package.json` script rather than its built-in.

```bash
# 1. Load credentials (token with Pages:Edit scope + account id)
set -a; source ~/.config/mvox/credentials.env; set +a

# 2. Build + deploy in one step
pnpm run deploy
```

The `deploy` script (`package.json`) runs:

```
pnpm build && wrangler pages deploy .svelte-kit/cloudflare --project-name multivox
```

Prerequisites for the fallback:

1. **Cloudflare API token** with `Pages:Edit` scope, stored at:

   ```
   ~/.config/mvox/credentials.env
   ```

   Expected variables (wrangler reads these from the environment):

   ```
   CLOUDFLARE_API_TOKEN=<token with Pages:Edit scope>
   CLOUDFLARE_ACCOUNT_ID=1431b76f0b65e3d23833966744ff2bdf
   ```

   `Pages:Read` alone will fail at deploy time.

2. **pnpm** + repo bootstrapped (`pnpm install`), on a clean working tree (ship a known git SHA, not local edits).

After the fallback deploy, push the fixed commit to `main` once CF's git build recovers so the project state and git stay in sync — the manual upload is an override, not a permanent state.

## Failure modes

- **`Authentication error [code: 10000]`** (manual fallback) — the API token is missing, expired, or lacks `Pages:Edit` scope. Re-issue from the Cloudflare dashboard (My Profile → API Tokens), update `~/.config/mvox/credentials.env`, re-source.
- **CF git build fails** — open the failing deployment in the dashboard (multivox → Deployments → the build) and read the build log. Common causes: a build that passes locally but trips the remote env (missing build env var, Node version mismatch — confirm `NODE_VERSION=22` and `PUBLIC_ENTU_DB`), or a genuinely broken `main`. Fix on a branch (gets a preview build to validate), then merge.
- **`8000000` (CF transient)** — on a manual fallback deploy, retry up to 3×.
- **Wrong content deployed** — confirm the deployment's source commit matches the intended `main` SHA (`wrangler pages deployment list` shows the commit). For a manual fallback, ensure `.svelte-kit/cloudflare/` reflects current source (always deploy via the `deploy` script so `pnpm build` runs first).

## Rollback

Cloudflare Pages retains the full deployment history per project. To roll back:

1. Open the `multivox` project in the Cloudflare dashboard.
2. **Deployments** tab → find the last-known-good deployment.
3. Use **Rollback to this deployment** (or set it as the new active deployment).

CLI alternative — list deployments and inspect:

```bash
wrangler pages deployment list --project-name multivox
```

There is no `wrangler pages deployment rollback` subcommand; rollback is a dashboard action. Note that a subsequent push to `main` will deploy again and supersede a dashboard rollback — to hold a rollback, also revert the offending commit on `main`.

## Future work

- **CI checks before deploy** — CF deploys on push regardless of test status. A GitHub Actions workflow gating `main` on `pnpm check` + `pnpm test` (branch protection) would prevent a red build from auto-shipping. Candidate follow-up.

(*MVOX:Josquin*)
