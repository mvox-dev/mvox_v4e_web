# Josquin scratchpad

Personal notes. Only Josquin writes here.

---

## [CHECKPOINT] 2026-05-22 session 14 — #40 / #41 / #45 / #42 / #46 / #47 merged + mvox live on multivox.pages.dev

Session shipped six PRs to main and got mvox publicly reachable for the first time. Merge SHAs (in order): `a120248` #40, `a506266` #41, `52a5fca` hotfix (nodejs_compat), `2fa3b7b` #45, `c490591` #42, `bb12049` #46, `c73b82b` #47. Tests landed at 403/403; `multivox.pages.dev` HTTP 200; OAuth flow live with CSRF binding + JWT cookie session.

### Durables worth keeping (ephemeral PR-detail pruned)

[GOTCHA] **`pnpm deploy` is shadowed by pnpm's reserved workspace subcommand.** `pnpm deploy` returns `ERR_PNPM_CANNOT_DEPLOY`. Always use `pnpm run deploy` for npm-script-defined deploy. Documented in `docs/operations/deploy.md` with explicit callout near the top. Forgetting this once = ~2min of confused dispatch surfacing.

[GOTCHA] **Cloudflare Pages projects on this account are Direct Upload (no git provider).** Created via `pnpm wrangler pages project create multivox --production-branch main`. Push-to-main does NOT auto-deploy; need explicit `pnpm run deploy --branch main` to populate the canonical URL. Feature-branch deploys land at `<hash>.multivox.pages.dev` + `<branch>.multivox.pages.dev` aliases but NOT canonical. Verified via `wrangler pages project list` → `Git Provider: No` across all 6 projects on the account. CHORE-43 tracked if PO ever wants to wire CF↔GitHub OAuth.

[GOTCHA] **`compatibility_flags: ["nodejs_als"]` does NOT expose `process` global in CF Workers — `nodejs_compat` does.** `als` is older/partial (AsyncLocalStorage only). Cost us a half-deployed `/auth/login` 500 (`ReferenceError: process is not defined`) before the hotfix. **Belt-and-braces stance**: even after CHORE-47 migrated all 5 call sites to `$env/dynamic/private`, the `nodejs_compat` flag stays in `wrangler.json` as defense-in-depth for transitive deps that might do `process.X` internally. The flag is no longer load-bearing for our own env access but remains a safety net.

[PATTERN] **Stop-and-surface beats blind retry on deploy failures.** Both deploy errors this session (`Project not found 8000007` then `process is not defined`) were diagnosed in <2 minutes via `wrangler pages deployment tail <deployment-id> --format json` + JSON inspection. The `tail` subcommand requires the specific deployment ID (not just project name) in non-interactive mode. Pattern: on CF deploy 500, grab `wrangler pages deployment list --project-name <name>` for the latest deployment ID, then `wrangler pages deployment tail <id> --format json > /tmp/cf-tail.log` while hitting the failing route. The structured logs include `logs[].message` with the actual stack trace.

[PATTERN] **`$env/dynamic/private` in vitest requires explicit handling.** SvelteKit's virtual module isn't resolvable outside `vite dev`/`vite build` context. Two options that both work:
- Per-spec `vi.mock('$env/dynamic/private', () => ({ env: mockEnv }))` with a mutable `mockEnv` object (Tallis's pattern across 4 OAuth specs).
- Global default via `vitest.config.ts` `setupFiles: ['src/tests/setup.ts']` that mocks with `{ env: {} }` — per-spec overrides still work (vitest mock-hoisting respects later mock declarations).

The global setup is required for any spec that TRANSITIVELY imports migrated code (e.g., `api/organizations/server.spec.ts` doesn't touch env directly but imports `EntuClient` which now imports `$env/dynamic/private`). Without the setup file, 27 specs that pre-existed CHORE-47 will RED on "Cannot find module".

[PATTERN] **Squash-merge chaining defends against harness-branch-flip mid-sequence.** Per the auto-memory feedback I noticed: `git checkout main && git pull && merge --squash <branch> && commit && push && push --delete && branch -D` chained in a single Bash call. The harness sometimes flips branches between Bash calls if multi-call sequences span unrelated tool calls; chaining everything atomic blocks the flip. Used 6 times this session without state loss. Caveat: stash-then-chain still needed if the worktree has unstaged teammate scratchpad edits.

[PATTERN] **`git stash pop` refuses 3-way merge when worktree already has matching unstaged content.** Symptom: pop fails silently with "stash entry is kept" but no obvious error. Fix: `git add <file>` first to move worktree state into the index, then `git stash apply` (which DOES force 3-way) → resolve markers → `git stash drop`. Encountered when popping 3 session-14 stashes onto a worktree that already had scratchpad edits. The stash-pop dance for end-of-session reconciliation needs the apply+drop variant whenever the destination file is dirty.

[PATTERN] **Test fixture path resolution via `new URL('../../../', import.meta.url)`.** From spec file at `src/tests/deploy/no-process-env.spec.ts`, walking up THREE levels lands at the repo root (`/home/michelek/workspace`). FOUR levels overshoots by one. Tallis's first version overshot, making `existsSync` return false and the meta-spec pass vacuously. **Always verify a regression-net meta-spec actually red-flags a known violation BEFORE declaring RED phase done.** This is the L40-style "vacuously-passing spec" anti-pattern; Bentham caught the same class of bug in session 13 with the `.skip()` test that referenced a non-existent feature.

[CONTRACT] **CSRF gate sequencing on `/auth/cookie`: read → 403-if-missing → delete-always → JWT-validate.** Order matters: csrf_state cookie is single-use, so delete BEFORE JWT validation aborts. Otherwise malformed/expired JWT paths leave csrf_state intact for replay-after-shape-fix. Bentham encoded this as a review PATTERN in his scratchpad; worth mirroring here because future BFF endpoints that consume single-use cookies should follow the same shape.

[CONTRACT] **`/auth/login` server-load shape** (what Byrd consumes):
```typescript
{ providers: Array<{ id: string; label: string; url: string }> }
```
Each `url` is a fully-formed Entu OAuth URL with the csrf_state both as a top-level `&state=` (for the assertion regex pattern Tallis pinned) AND inside the encoded `next=` callback (for Entu to redirect back with). 6 providers in PO-locked order: `smart-id`, `mobile-id`, `id-card`, `google`, `apple`, `e-mail`.

[CONTRACT] **`/auth/callback` server-load shape** (what callback page's client JS consumes): `{ sessionToken: string; db: string }`. NO server-side Entu call (per `expect(event.fetch).not.toHaveBeenCalled()` invariant). Exchange happens client-side via `src/lib/auth/exchange.ts` because Entu's session token is IP-bound and CF Workers don't preserve client IP on outbound.

[DECISION] **Single source of truth for Entu base URL: `src/lib/entu-config.ts` exports `ENTU_API_BASE = 'https://entu.app/api/'`** (path form, trailing slash). Lives OUTSIDE `src/lib/server/` so both server (`client.ts`, `auth/+server.ts`, `auth/login/+page.server.ts`) and client (`auth/exchange.ts`) can import without crossing the server-only boundary. The `DEFAULT_BASE_URL` alias was dropped in CHORE-45 YELLOW-45.2; all consumers now `import { ENTU_API_BASE }` direct.

[DECISION] **Co-located config zone: `src/lib/<topic>-config.ts` is the home for cross-boundary VALUES** (URLs, timeouts, port numbers). Reserve `src/lib/types.ts` for cross-boundary TYPES; reserve `src/lib/server/<feature>/` for server-only feature code. Bentham logged this PATTERN; encode here too for future similar decisions.

### Deferred / open items at session-14 close

- CHORE-43 — Wire CF Git Provider integration (one-time CF↔GitHub OAuth grant) to enable push-to-main auto-deploys. PO-scope.
- YELLOW-41.3 — JWT signature verification on `/auth/cookie`. Deferred until Entu publishes JWKS or we settle on a verification library.
- `nodejs_compat` flag removal — could be revisited now that CHORE-47 landed, but defense-in-depth posture stands. Don't remove without a probe-then-implement step.
- Tallis's `tests/oauth-flow.spec.ts` Playwright suite has all tests `.skip()` pending issue #36 (mock-Entu E2E harness).

---

## [CHECKPOINT] 2026-05-22 session 13 — #32 merged @ `8fd3ed0`, #35 merged @ `db2040e`

Both PRs landed on main this session. Key durables below; ephemeral PR-detail pruned.

### #32 BFF MVP — orgs + sections endpoints

[PATTERN] **Vitest doesn't resolve `$lib`** — confirmed again. Route handlers tested via vitest must use relative imports (`../../../lib/server/entu/client.ts`). Same gotcha as 2026-05-21 (`client.spec.ts`); reappeared here for `+server.ts` imports inside `vi.resetModules()` dynamic-import test pattern. Mental model: if a file is reachable from a vitest spec via `import()`, traverse cross-tree with relative paths only.

[PATTERN] **BFF JSON-envelope errors > SvelteKit `throw error()`.** Bentham settled this on the #32 review (now in `architecture-decisions.md`): all BFF errors `return json({ error: '<code>' }, { status })`. Predictable JSON for frontend consumers; tests pin `body.error === 'auth_required'`. Use `throw error(...)` only when you want SvelteKit's HTML error page — never for `+server.ts` API routes.

[PATTERN] **Property extractor helpers stay inlined until route 3.** GH #33 tracks factoring to `src/lib/server/bff/{pagination,props}.ts` when the third `+server.ts` lands. Until then the duplication is "three similar lines" territory. Bentham YELLOWs at 4× duplication; REDs when route 3 ships without the factor.

[GOTCHA] **Voice is a composite multi-value.** v4E section.voice is declared `reference`, but Entu surfaces `{ reference: 'voice-id', string: 'voice-name' }` per value. Tests expect `{ _id, name }` in the response — both from the same property value, no second fetch. If a future reference property needs the same shape, name the helper `extractReferenceWithLabel` not `extractVoice`.

[GOTCHA] **`EntuClient.get` throws on !res.ok.** Route uses `.catch(() => null)` to collapse Entu 403+404 → 404 (hide existence). GH #34 tracks adding direct `client.spec.ts` tests pinning the throw behavior — Tallis-owned. Indirect coverage via route specs is GREEN-eligible but not durable on its own.

### #35 Frontend Scaffolding — server load + landing

[CONTRACT] **Three-branch server-load shape.** `src/routes/+page.server.ts` returns one of:
- `{ session: null, orgs: null }` — no entuJwt
- `{ session: { jwt }, orgs: OrgEntity[] }` — signed-in, BFF 200
- `{ session: { jwt }, orgs: null, error: true }` — signed-in, BFF non-200 or fetch threw

Reusable shape for future authenticated landing-style routes. Session is currently `{ jwt }`; GH #39 tracks lifting to `+layout.server.ts` once a second authenticated route needs it.

[DEFERRED] **CHORE-36 — mock-Entu E2E harness.** Byrd's #35 landed with `+page.svelte` using a browser-side `$effect` fetch instead of `data.orgs`, because Playwright's `page.route()` can't intercept SvelteKit's internal `event.fetch` (server-side node fetch bypasses Chromium's network layer). One Playwright test (SSR-presence) is RED as a result. PO decided ship-with-YELLOW; CHORE-36 will stand up a mockable Entu HTTP layer beneath SvelteKit, flip the landing to seed orgs from `data.orgs`, drop the `$effect`-on-mount, turn the 18th test GREEN. Rights-aware contract doc §1 BFF-as-single-surface isn't violated in prod — the `$effect` is a CI accommodation, not an architectural shift.

[LEARNED] **Test-environment constraints can dominate design-doc posture.** I argued for "remove `$effect`, seed from `data`" based on the rights-aware design doc. Byrd pointed out that with no Entu in CI, the server load returns `error: true` regardless, so my proposal would have broken 17 GREENs while still not earning the 18th. **The right framing was the test infra, not the code shape.** Future-self: when proposing a design change that interacts with tests, first ask "what does the test environment actually allow?" before invoking the design doc.

[LEARNED] **Conceding fast when wrong is cheap; doubling down is expensive.** When Byrd's option-C analysis arrived, I checked the numbers, found he was right, and reframed in the next message rather than defending the prior position. Took ~3 minutes; lost nothing. Pattern worth keeping: validate the counterargument's claims numerically, then either rebut with specifics or yield clean. Don't litigate framing.

---

## [DECISION] 2026-05-22 session 12 — BFF rights-aware design APPROVED, merged to main at `e42cb1e`

PO walked Q1-Q5 in session 12. All five answered, design doc finalized + `docs/migration/findings/v4e-rename-avatar-logo-to-photo-2026-05-21.md` written as a paste-ready entu/research PR draft. Both files merged to main at `e42cb1e` (team-lead per the shutdown note). Implementation now gated on the upstream rename PR landing + Pérotin migrating polyphony db; mvox impl PR (first to consume `organization.photo` + `_thumbnail`) must carry the `Schema-Change:` + `PO-Approved:` trailers per session-2 convention.

**Locked answers** (full table in design doc §0; one-liner each here for fast recall):
- Q1 orgs-list scope: **rights-driven** (trust Entu's filter; orphan cascade = cleanup task)
- Q2 empty-state: **generic** (no `rights_state` hint; would require elevation → violates §1)
- Q3 pagination: **`limit=50` default, `200` max, offset `?limit=N&skip=M`** 1:1 with Entu
- Q4 shape: **narrow / typed per-endpoint**
- Q5 file URLs: **rename `avatar`+`logo` → `photo`** to unlock Entu's hardcoded `_thumbnail` → `photo` resolver (one-hop signed S3, anonymous-capable for `sharing: 'public'`)

**Finn's `_thumbnail` finding worth keeping** (won't re-derive): `entu/api/utils/entity.js` `cleanupEntity` does the resolution; it looks for a property literally named `photo`. `picture` is NOT special (zero refs across `entu/api` + `entu/app`). `?props=_thumbnail` on entity/search populates `_thumbnail` inline as a 60s pre-signed URL — no second property fetch. Only resolves a single property, so `list: true` file collections (e.g. `edition.file`) don't benefit and were excluded from the rename.

**Implementation-phase blockers (refreshed)** — in dependency order:
1. **entu/research rename PR lands** — PO submits using the paste-ready findings doc; capture merge SHA for the mvox impl trailer.
2. **Pérotin polyphony data migration** — type-def name update + ~2 person + ~6 org instance value re-attaches under new property name. Manifest-first pattern.
3. **#19 CSRF gate** — still pending; required before the FIRST mutation route, not the first read. MVP surface is GET-only so the first impl PR doesn't need it; second impl PR does. Recommended path (design doc §6): SvelteKit's built-in `csrf.checkOrigin` (default-on).
4. **base URL split** (`entu.app/api/` path-form vs `api.entu.app/{db}/` subdomain-form) — still out of scope until a real BFF caller exists; first impl PR is that caller, so flag + probe at that PR. See 2026-05-21 GOTCHA below.

## [PATTERN] 2026-05-22 session 12 — surface "regen ripple" in cross-repo schema PR drafts

The entu/research rename PR draft mostly wrote itself, but one non-blocking question surfaced at report time: should the PR include the regenerated `schema.json` (via `pnpm build-schema` per the header comment of `schema.ts`) in the same commit, or as a follow-up? I flagged it to team-lead rather than guessing.

**Generalizable:** any time a v4E schema change is being drafted for entu/research, check `schema.ts` header comment for build-artefact regen instructions. If there's one, mention it in the report-out — PO can decide single-commit (schema + regenerated artefact, keeps upstream CI green) vs two-commit (schema then regen). My default recommendation in the report was single-commit. Either is fine; the cost of NOT mentioning it is upstream catching it at PR review and bouncing.

Small pattern but easy to forget when most of the work is the diff itself — the "what gets regenerated by this change" question is invisible from inside `schema.ts` unless you scroll up to the header. Worth a 30-second sweep at draft time.

## [LEARNED] 2026-05-22 session 12 — self-calibration carried forward, all three calls held

The three calibration points from session 11 (empty elevated-ops list, generic empty-state, narrow typed shapes) all survived PO review without revision — Q2 Q4 Q5 all came back resolved as recommended. The one I half-expected to bounce was Q4 (narrow vs passthrough); writing it out as "BFF-as-contract posture demands shaping" was apparently load-bearing for the call. Lesson: when an instinct disagrees with what writes well, follow the writing — the post-hoc justification IS the actual reason. Will lean on this when next torn between velocity-shape and contract-shape.

## [LEARNED] 2026-05-21 session 11 — docs-only branch flow

For docs-only PRs (no `src/` edits), the branch convention is `docs/<topic>` rather than `feat/<issue>` — there's no issue, no TDD chain, no Bentham gate. Workflow:

1. Branch from main, write the doc, commit (auto-co-author trailer), `git push -u origin <branch>`.
2. Do NOT merge — PO reviews on origin via the GitHub UI before greenlighting.
3. The branch stays open across sessions until PO either approves (then squash-merge per usual) or asks for revisions.

Differs from feature branches because:
- No local-only convention — push to origin so PO can review the rendered markdown on GitHub.
- No squash-merge in the same session — design proposals are PO-gated, not engineer-gated.
- Memory file mods in the working tree at the time of `git checkout -b` still tag along; stage carefully (just the doc).

I used this for the BFF rights design today. Same pattern works for any future design proposal (`docs/<topic>` branch, push-don't-merge, PO reviews on GitHub).

---

## [PATTERN] 2026-05-21 — Test fixtures pin historical defaults; don't DRY them

When a beforeEach stubs an env var to match the production default literal, that's a **fixture**, not duplication. If you replace the literal with an import of the production constant, the assertion becomes tautological (`stubEnv(X, X)`) and silently loses its ability to catch drift if production shifts the default. Surfaced via Bentham's #20 v1 review: I had switched `client.spec.ts:7` from `'https://entu.app/api/'` literal to `DEFAULT_BASE_URL` — wrong move, reverted in v2.

**Rule:** DRY applies to production-to-production duplication. Test fixtures hardcode expected values *on purpose* — that's how they catch drift. If two test files share a fixture, factor it into a test helper (still a literal there), not into the production code under test.

**Also:** the SvelteKit `$lib` alias does NOT resolve in `vitest.config.ts` (separate from `vite.config.ts`, no sveltekit plugin loaded). Use relative paths (`'../../lib/...'`) for cross-tree imports in `src/routes/**` when the file is tested via vitest. Or teach vitest the alias if it ever becomes painful — for now relative is the smaller diff.

---

## [GOTCHA] 2026-05-21 — Entu API base URL: client.ts uses legacy `entu.app/api/` form, prompt says `api.entu.app/{db}/`

Surfaced during #20. My prompt (L107) declares the canonical Entu API base as `https://api.entu.app/{db}/` (subdomain form), but `src/lib/server/entu/client.ts` defaults to `'https://entu.app/api/'` (path form). The path form is also baked into the SvelteKit cookie name expectations and was apparently inherited from the CHORE-5 skeleton (#16/#17).

Out of scope for #20 (cosmetic DRY). Two possibilities:
1. Legacy form works (path-based routing on the same MongoDB+S3 backend) — likely, given CHORE-5 GREEN landed and the test/probe suite exercises the live API via this path elsewhere. Worth confirming the next time a BFF route actually calls Entu for real (today the client lives but has no live caller).
2. Legacy form is broken — would be caught the first time we make a real Entu call. Risk: silent failure path or wrong-host CORS.

**Action when next BFF route lands:** before merging, swap `DEFAULT_BASE_URL` to `'https://api.entu.app/'` and adjust `entityUrl` / `search` URL construction (the current code does `${baseUrl}${db}/entity/...` which works for both forms since baseUrl already has the trailing slash and db slots in next). Then probe live to confirm. May warrant its own chore issue — flag to team-lead when the first real-call route is in flight.

---

## [LEARNED] 2026-05-20 — Squash-merge flow on this team

Each PR landed on main via the same local squash-merge ritual (no PRs opened on GitHub; all feature branches stayed local). Steps that became muscle memory:

1. **Stash unstaged scratchpads** (Bentham's and/or Pérotin's) before `git checkout main` — they routinely leave their `teams/mvox-dev/memory/*.md` dirty in the worktree between cycles. `git stash push -- <paths>`. Pop after push.
2. **`git merge --squash <branch>` then commit with the team-lead-supplied message** verbatim (including the `(*MVOX:<author>*)` trailer, which is sometimes Tallis for test-only PRs not me). Co-author trailer auto-added by `prepare-commit-msg` hook.
3. **`git branch -D` for local cleanup** — `-d` always fails because squash-merge doesn't update the merge graph. Expected.
4. **`git push origin --delete <branch>` always errors** with "remote ref does not exist" because nobody pushed the feature branch — all GREEN/RED commits stayed local until squash. This is normal, not a failure mode.

The 7 squash-merges I did across session 8 (3-2-2-3 grouping was wrong — actually 9 PRs: #44, #52+#54 bundle, #56, A, B, C, D, E, #58) all followed this exact pattern. If future me sees a remote feature branch actually exists, that's a sign someone pushed it (e.g., for a non-local review surface) and the cleanup step might do something — verify before the delete.

## [LEARNED] 2026-05-20 — Toolkit lib union-arg discriminator pattern

When two RED specs pin the same positional arg to different types (Tallis: `listInstancesByType(client, type, props, 50)` expects `limit` at position 3 as `number`; Pérotin: same position needs `Record<string,string>` for extraQuery), don't param-swap — union-type the arg and discriminate at runtime with `typeof === 'number'`. Position 4 becomes overflow for "I want both" cases (limit at 3, extraQuery at 4). The lib at `scripts/migrations/lib/entu-client.ts` has the production pattern; #58 added direct lib-side coverage so a regression in the discriminator surfaces directly rather than through the Pérotin-side spec.

The principle is broader: when an existing GREEN spec pins a positional contract, prefer **type-level discrimination** over rearranging args. Adding a new branch to a union is non-breaking; reordering is.

---

## [GOTCHA] 2026-05-19 — `pnpm dlx sv create` tsconfig has JSON-incompatible comments
The minimal scaffold's `tsconfig.json` contains `//` line comments after the `compilerOptions` block. They are valid for TypeScript's JSONC parser but crash `JSON.parse`. Any AC test that does `JSON.parse(readFileSync('tsconfig.json'))` will fail until comments are stripped. Stripping is safe — TypeScript itself doesn't need them. Worth knowing for future scaffolds (sv may also drop similar comments in `package.json` derivatives).

## [GOTCHA] 2026-05-19 — Playwright `fullyParallel: true` + execSync('pnpm build') from one test = race
If one Playwright test invokes `pnpm build` while another navigates the preview server, vite rewrites `.svelte-kit/output/` with new content-hashed filenames mid-flight. The preview server's already-served `index.html` references the old chunks → `ENOENT` on the file read → ECONNRESET on the next HTTP call. Pattern: keep "did the build produce X?" checks in vitest (no live server); keep "does the running app behave correctly?" checks in Playwright.

## [DECISION] 2026-05-19 — Hook install pattern (`.githooks/` + `scripts/install-hooks.sh`)
We picked the "versioned hooks dir + pnpm prepare script" approach for the co-author trailer hook. Files of record:
- `.githooks/prepare-commit-msg` — uses `git interpret-trailers --if-exists doNothing --in-place` (idempotent, normalises trailer block).
- `scripts/install-hooks.sh` — copies + chmods, no-ops if `.git/hooks` is absent (tarball/CI scenarios).
- `package.json` `"prepare"` chains `scripts/install-hooks.sh && (svelte-kit sync || echo '')` — pnpm runs this on every fresh `pnpm install`.

If we add more hooks later (`pre-commit` lint, `commit-msg` format), drop them in `.githooks/` and the install script picks them up for free.

## [PATTERN] 2026-05-19 — Branch hygiene during squash-merge with concurrent worktree edits
When a teammate's scratchpad write is unstaged in the working tree at merge time, `git stash push -- <file>` before the squash, then `git stash pop` after. Keeps the squash diff clean without dropping anyone's WIP.

## [DECISION] 2026-05-19 — `wrangler.json` shape for CHORE-1
Minimal Pages-targeted config that we landed in `feat(#1)`:
- `name: "multivox"`
- `compatibility_date: "2026-05-18"`
- `compatibility_flags: ["nodejs_als"]` (required by adapter-cloudflare for AsyncLocalStorage; per SvelteKit Cloudflare adapter docs)
- `pages_build_output_dir: ".svelte-kit/cloudflare"`
- NO bindings (no D1/R2/KV/Durable Objects).

If/when we need bindings for a later story (e.g., a KV cache for Entu responses), add them here — and remember to revisit Bentham's review checklist for the "no extra bindings" AC.

## [LEARNED] 2026-05-20 — Phase A shipped (live execution successful, exit 0)

Phase A executed against polyphony at 2026-05-20T03:46:18Z. **9 entity types created + 79 properties added + 0 failures.** Report committed on main as `a127729`. PR #26 (impl, merged at `e3ceb28`) + PR #27 (Bentham's partial-failure-recovery bypass, merged at `0400cba`). The session-6 [CHECKPOINT] issues (fetchDbState filter, v4E field-name mismatch, missing dry-run markdown sections, ESM `__dirname`) are all resolved in code — no future-session value in keeping the list of bugs; this entry captures the durable patterns instead.

### Patterns worth keeping (for Phases B/C/D)

**Probe-then-implement when the spec disagrees with reality.** The first live dry-run revealed three spec-vs-real-db mismatches that unit tests (mocked fetch + 2-type fixture) could not catch. Always run at least one live dry-run before claiming Phase X impl is "done" — and structure the dry-run report so it's directly diff-able against the divergence audit. The 22:18 → 22:37 dry-run delta caught the §4.2-vs-actual gap before any write hit the db.

**v4E → Entu field name translation lives in its own module.** `scripts/migrations/lib/v4e-translator.ts` maps blurb→label, sharing→_sharing, inheritsRights→_inheritrights, required→mandatory, oauth→string, ref:true→reference. Phase B/C/D scripts should reuse it (or its successor) rather than re-derive these mappings. Spec field naming is **not** API field naming.

**Phase scope filter as a hard whitelist.** `scripts/migrations/lib/phase-a-scope.ts` is the source of truth for what Phase A touches — encoded as `PHASE_A_PROPERTY_ADDITIONS: Record<string, Set<string>>` (35 entries from divergence §4.2) + `PHASE_A_NEW_TYPES: Set<string>` (9 entries from §4.1) with `isInPhaseAScope` / `isPhaseANewType` helpers. Pattern for Phase B/C/D: same shape, derived from the divergence audit's per-phase tables. Without it, an additive diff over-creates (Phase B renames get spuriously added as Phase A new properties).

**Partial-failure recovery via PHASE_X_NEW_TYPES bypass.** Bentham caught this YELLOW in PR #26: if `createEntity(<§4.1 type>)` succeeds but the inline-property loop crashes mid-iteration, a naive re-run hits the scope filter and silently skips the missing inline props. Bypass = `isPhaseANewType(parent) || isInPhaseAScope(parent, prop)`. Phase B/C/D scripts that batch inline operations should ship the same recovery path before the first live run.

**Squash-merge while peers are editing scratchpads.** `git stash push -- teams/mvox-dev/memory/*.md` before `git merge --squash`, then `git stash pop` after. Keeps the squash diff clean and doesn't drop in-flight WIP from other agents. Used twice this session.

### Polyphony db layout gotcha (still relevant for Phases B/C/D)

App entity types in polyphony's Entu db are **root-level** (no `_parent` set on the type-definition entity), NOT children of the polyphony db entity `69bcfd8e9c031ab8e6ce807a`. Only the 6 system meta-types (database/entity/menu/plugin/property + the original `person`) are parented under it. Filter to enumerate entity types: `_type.reference=69bcfd8e9c031ab8e6ce8034` with NO `_parent` constraint. Documented in `docs/migration/v4e-divergence-2026-05-19.md` §1 and now in the handbook's lesson-learned column.

### Three formula touch-saves pending for Phase B prep

After Phase A, these three properties exist with formulas but their existing instances haven't been touch-saved to materialize the computed values:

1. `lending.name` — formula `member.*.name copy.*.name ' — ' CONCAT_WS` — 0 existing instances; touch-save is a no-op until lending instances start being created.
2. `organization.member_count_per_section` — formula `SUM(_child section.member_count)` — 6 existing org instances; inner `section.member_count` formula itself is Phase B work, so values will be stale until Phase B fixes both layers.
3. `edition.work` — formula `_parent` — unblocks `program_item.name` chain in Phase B.

Touch-save = POST any field on the instance to re-trigger formula evaluation (see handbook §5.1). Phase B's first task should batch these.

### Per-entity IDs from the live execution

Full ID listing in `scripts/migrations/reports/2026-05-19-phase-a-2026-05-20T03-46-18-833Z.{md,json}`. Top-level type IDs to bookmark for Phase B referencing:
- voice `6a0d2e8090c8df7a1cc7dd6a`
- library `6a0d2e8090c8df7a1cc7dd9d`
- copy `6a0d2e8190c8df7a1cc7ddb0`
- lending `6a0d2e8190c8df7a1cc7dde8`
- invitation `6a0d2e8290c8df7a1cc7de3e`
- application `6a0d2e8390c8df7a1cc7de81`
- event_series `6a0d2e8490c8df7a1cc7deb1`
- rsvp `6a0d2e8590c8df7a1cc7df1b`
- attendance `6a0d2e8690c8df7a1cc7df4b`

(*MVOX:Josquin*)
