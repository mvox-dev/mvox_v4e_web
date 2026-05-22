# Deploy — multivox to Cloudflare Pages

mvox deploys to Cloudflare Pages as a single project: **`multivox`** (live at `multivox.pages.dev`).

Deploy is invoked locally; there is no CI deploy yet. Production deploys go through `pnpm run deploy` from a workstation with a valid Cloudflare API token loaded into the environment.

> **Note on `pnpm run deploy` vs `pnpm deploy`:** pnpm reserves `deploy` as a workspace subcommand (`ERR_PNPM_CANNOT_DEPLOY`). Always invoke with `pnpm run deploy` — the explicit `run` makes pnpm execute the `package.json` script rather than its built-in.

## Prerequisites

1. **Cloudflare API token** with `Pages:Edit` scope, stored at:

   ```
   ~/.config/mvox/credentials.env
   ```

   Expected variables (wrangler reads these from the environment):

   ```
   CLOUDFLARE_API_TOKEN=<token with Pages:Edit scope>
   CLOUDFLARE_ACCOUNT_ID=1431b76f0b65e3d23833966744ff2bdf
   ```

   The account ID is the mvox project's Cloudflare account (`multivox` project lives there). The token must include the `Pages:Edit` permission — `Pages:Read` alone will fail at deploy time.

2. **pnpm** + repo bootstrapped (`pnpm install`).

3. **A clean working tree** — deploys should ship a known git SHA, not local edits. The runbook does not enforce this; convention is the deployer's responsibility.

4. **The `multivox` Cloudflare Pages project exists.** This is a one-time setup, performed against the CF account behind `CLOUDFLARE_ACCOUNT_ID`. If `wrangler pages deploy` returns `Project not found [code: 8000007]`, the project hasn't been created yet — create it before re-deploying:

   ```bash
   pnpm wrangler pages project create multivox --production-branch main
   ```

   `--production-branch main` makes deploys from `main` land on the canonical `multivox.pages.dev` URL; other branches get branch-aliased URLs (e.g. `feat-foo.multivox.pages.dev`) and a unique-deployment URL (`<hash>.multivox.pages.dev`).

## Deploy procedure

```bash
# Load credentials into the current shell
set -a; source ~/.config/mvox/credentials.env; set +a

# Build + deploy in one step
pnpm run deploy
```

The `deploy` script (`package.json`) runs:

```
pnpm build && wrangler pages deploy .svelte-kit/cloudflare --project-name multivox
```

- `pnpm build` runs `vite build`, which invokes the SvelteKit Cloudflare adapter (`@sveltejs/adapter-cloudflare`) and writes the build output to `.svelte-kit/cloudflare/`.
- `wrangler pages deploy` uploads that directory to the `multivox` Cloudflare Pages project. Wrangler reads `wrangler.json` at the repo root for project metadata (`name`, `compatibility_date`, `compatibility_flags`, `pages_build_output_dir`).
- The `account_id` is NOT in `wrangler.json` — it comes from `CLOUDFLARE_ACCOUNT_ID` in the environment. This keeps account-scoped secrets out of the repo.

On success, wrangler prints the deployment URL. The canonical production URL is:

```
https://multivox.pages.dev
```

## Verifying a deploy

After `pnpm run deploy` completes:

```bash
curl -I https://multivox.pages.dev
```

Expected: HTTP `200` and the response body should be the SvelteKit landing page (the post-CHORE-35 shell).

If the response is `404` or a Cloudflare placeholder, the deploy uploaded an empty/wrong directory — check `pnpm build` output and the contents of `.svelte-kit/cloudflare/` before re-deploying.

## Failure modes

- **`Authentication error [code: 10000]`** — the API token is missing, expired, or lacks `Pages:Edit` scope. Re-issue the token from the Cloudflare dashboard (My Profile → API Tokens), update `~/.config/mvox/credentials.env`, and re-source.
- **`Project not found [code: 8000007]`** — either `CLOUDFLARE_ACCOUNT_ID` doesn't match the account that owns the `multivox` Pages project, the project was renamed, or the project has never been created. Verify existence with `pnpm wrangler pages project list`; create with `pnpm wrangler pages project create multivox --production-branch main` if missing (see Prerequisites §4).
- **Build fails** — `pnpm build` returned non-zero. Don't proceed to deploy; fix the build locally and re-run.
- **Wrong content deployed** — check that `.svelte-kit/cloudflare/` reflects the current source. Stale output from a prior branch can ship if `pnpm build` was skipped manually. Always run via the `deploy` script.

## Rollback

Cloudflare Pages retains the full deployment history per project. To roll back:

1. Open the `multivox` project in the Cloudflare dashboard.
2. **Deployments** tab → find the last-known-good deployment.
3. Use **Rollback to this deployment** (or set it as the new active deployment).

CLI alternative — list deployments and inspect:

```bash
wrangler pages deployment list --project-name multivox
```

There is no `wrangler pages deployment rollback` subcommand at the moment; rollback is a dashboard action.

## Future work

- **Custom domain wiring** — `mvox.eu` (or whichever final domain) attaches to the `multivox` Pages project. Tracked as CHORE-42; out of scope for this runbook.
- **CI deploy** — currently manual; a GitHub Actions workflow that runs `pnpm run deploy` on push-to-main is a candidate once the deploy story has settled.

(*MVOX:Josquin*)
