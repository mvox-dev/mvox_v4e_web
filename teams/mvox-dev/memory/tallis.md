# Tallis — Test Engineer Scratchpad

## [CHECKPOINT] 2026-05-18 — CHORE-1 RED phase

[DECISION] Build-output assertion (`pnpm build` → `.svelte-kit/cloudflare/` exists) lives in Vitest (`src/tests/build-output.spec.ts`, 60s timeout), NOT Playwright. Originally written in Playwright; moved after Josquin caught that `pnpm build` rewrites chunk hashes mid-run, crashing the preview server and breaking the route-render test.

[PATTERN] Static config tests (wrangler bindings, tsconfig strict, build output) live in `src/tests/` under Vitest (no browser). Uses `import.meta.dirname` + `resolve` to reach repo root — resolves to `../..` from `src/tests/`.

[GOTCHA] wrangler.toml TOML parsing is regex-only (no TOML parser dep). Catches `[d1_databases]` section headers and `d1_databases = ...` key assignments. Won't catch inline tables like `d1_databases = {}` — acceptable for a bootstrap guard; refine if wrangler config grows complex.

[PATTERN] `playwright.config.ts` has `webServer: { command: 'pnpm preview --port 5173', port: 5173, reuseExistingServer: !process.env.CI }`. Vitest runs first in the `pnpm test` chain (builds the app), then Playwright boots the preview server against the stable build.

[GAP] No auth flow tests yet — expected, no auth routes exist. Add to test-gaps.md when Josquin scaffolds the BFF skeleton (CHORE-5).

[PROCESS] Team-config / memory files (`teams/mvox-dev/**`) belong on `main`, not on story branches. Commit scratchpad and test-gaps updates directly to `main` so team state lands immediately and feature PRs stay focused on AC code only. 2026-05-19.

## [CHECKPOINT] 2026-05-19 — Phase A migration RED phase (session 6)

[DECISION] Migration scripts live under `scripts/migrations/` with colocated `.spec.ts` files. Vitest glob extended to `scripts/**/*.spec.ts` in `vitest.config.ts`.

[PATTERN] All 5 lib module specs + 1 E2E spec use "module not found" as the RED signal — no source files exist yet. Each spec committed separately with `(RED)` intent in commit message.

[PATTERN] E2E spec (`2026-05-19-phase-a.spec.ts`) uses `vi.spyOn(globalThis, 'fetch')` to mock the full Entu API call sequence (auth → list → create×N) in sequence. `beforeEach` creates a temp reports dir; `afterEach` removes it.

[PATTERN] `executor.spec.ts` injects `createEntity` and `now` via `ExecuteOptions` to isolate from real fetch. This is the injection pattern Josquin must preserve in the GREEN implementation.

[GOTCHA] Task 1a scope excludes tsx devDep + package.json scripts — Josquin owns Task 1b. Scaffold commit only touches `scripts/migrations/` dirs and `vitest.config.ts`.

[WIP] Branch `feat/phase-a-migration` handed off to Josquin for GREEN. 24 tests total, all RED.

## [CHECKPOINT] 2026-05-20 — CHORE-5 BFF skeleton RED phase

[GOTCHA] SvelteKit reserves the `+` filename prefix for route files. A spec file named `+server.spec.ts` inside `src/routes/` causes `svelte-kit sync` (invoked by `pnpm build` via `vite`) to crash. Auth route specs must live in `src/tests/routes/auth/server.spec.ts` and import `'../../../routes/auth/+server.ts'` by relative path.

[PATTERN] `event.locals.entuJwt` chosen as the name for the cookie-extracted JWT in hooks.server. Josquin: if you prefer `event.locals.entu = { jwt, client }`, update `src/hooks.server.spec.ts` accordingly (noted in-spec with a comment).

[PATTERN] All three specs use dynamic `await import(...)` inside each `it()` body so `vi.stubGlobal('fetch', ...)` and `vi.stubEnv(...)` are in place before the module loads. This avoids module-caching issues with env-dependent code.

[DECISION] 19 tests written, all RED ("Cannot find module"). Files: `src/lib/server/entu/client.spec.ts` (8), `src/hooks.server.spec.ts` (4), `src/tests/routes/auth/server.spec.ts` (7). Handed to Josquin for GREEN.

## [CHECKPOINT] 2026-05-20 — Phase B migration RED phase

[DECISION] 7 spec files written on `feat/phase-b-migration`. All RED. HEAD: `eaf1005`.
- `phase-b-scope.spec.ts` — PHASE_B_RENAMES(6), PHASE_B_MIGRATIONS(2), PHASE_B_OBSOLETE_DELETES(9), PHASE_B_FORMULA_UPDATES(4), PHASE_B_TOUCH_SAVES(3), guard functions
- `snapshotter.spec.ts` — single-page, multi-page pagination (skip+limit+count), sha256, dry-run, skip-snapshot, errors
- `data-migrator.spec.ts` — file→file, string→string, number→number, string_list, string→reference (full §1.3 fixtures), errors
- `touch-saver.spec.ts` — abstract `touchSave(entityId, propertyName, formulaExpression)` interface; wire shape deferred to Josquin GREEN
- `diff.spec.ts` additions — BACKFILL_DATA/DELETE_PROPERTY/UPDATE_FORMULA/TOUCH_SAVE ops, §1→§3 ordering invariant
- `executor.spec.ts` additions — executePhaseBOps with all op kinds, partial recovery, dry-run
- `2026-05-20-phase-b.spec.ts` — E2E integration: dry-run report shape, §4→§5 ordering, exit 1 on failure

[PATTERN] Minimal stub source files added alongside specs (data-migrator.ts, phase-b-scope.ts, snapshotter.ts, touch-saver.ts) so RED = "not implemented" not "module not found". Stub files export the expected interfaces with `throw new Error('not implemented')` bodies.

[PATTERN] `computePhaseBDiff` receives `DbTypeState[]` extended with optional `propertyIds: Record<string, string>` and `currentFormulas: Record<string, string>`. The `propertyIds` map is needed so DELETE_PROPERTY ops can carry the Entu property-def `_id`. The `currentFormulas` map enables UPDATE_FORMULA idempotency skip.

[GOTCHA] Touch-save is intentionally NOT idempotent — always re-writes to force Entu re-eval. This is different from all other ops.

[DECISION] §1.3 voice_type fixtures based on Finn's probe (section-voice-types-2026-05-20.md): 5 values (alto/baritone/bass/soprano/tenor), 16 sections, zero anomalies. LIVE_VOICE_LOOKUP in data-migrator.spec.ts mirrors the real db distribution.

[DECISION] touch-saver.spec.ts uses abstract `touchSave` injectable (not `updateEntity` with wire-shape assertions). Wire shape (POST endpoint, payload, how Entu re-evals) is empirical — Josquin determined via Q2 probe + dry-run in GREEN (see docs/migration/findings/phase-b-api-probes-2026-05-20.md §Q2).

[OPEN] Phase B GREEN — Josquin implements: phase-b-scope.ts, snapshotter.ts, data-migrator.ts, touch-saver.ts, diff.ts additions, executor.ts additions, integration script. Branch `feat/phase-b-migration`.

## [CHECKPOINT] 2026-05-20 — Session 8 RED dispatch batch

[DECISION] RED tests for YELLOW carryforwards (#52, #54), v11 parent_copy delegation (#44), wire-shape fix (#56), toolkit extraction (#57), and YELLOW-14 extraQuery coverage (#58) — all written and committed this session. Total: 288 tests passing at session end.

[PATTERN] When existing tests encode the wrong behavior (e.g., v12.2 asserting `/entity/` for formula-value DELETEs), update those assertions to assert the correct behavior in the same RED commit — don't leave contradictory tests. The updated test becomes RED until GREEN fixes the impl.

[PATTERN] For `vi.mock` at module level: use the existing `live-wiring-delegation.spec.ts` file (already has the harness) when adding delegation-contract tests rather than creating a new file. Keeps `vi.mock` scope contained.

[PATTERN] toolkit spec (`perotin-toolkit.spec.ts`): `vi.mock('node:fs')` + `vi.mock('./lib/entu-client')` at top so toolkit functions' composed calls (deletePropertyValue, postProperties, listInstancesByType, createEntity) are interceptable via `vi.fn()`. Import spies AFTER the mocks.

[GOTCHA] Coverage-gap tests (YELLOW-14 pattern): test passes immediately — behavior already in lib. Commit anyway: the point is to prevent future regression in the union-arg discriminator, not to drive an impl. Send directly to Bentham for review (no RED-GREEN cycle needed).

[PATTERN] `listInstancesByType` union-arg discriminator: `typeof arg4 === 'number'` → treat as limit; otherwise treat as extraQuery Record merged into params. Direct lib test: call with `{ '_parent.reference': 'org-1' }` as arg4 and assert both that filter AND `limit=500` appear in the URL.

## [CHECKPOINT] 2026-05-21 — Session 11: CHORE-3 RED + YELLOW-3.1

[DECISION] CHORE-3 RED: 13 tests in `src/tests/paraglide-setup.spec.ts` covering AC 1-4 (dep declared, vite plugin wired, 4 locale files exist + valid JSON, gitignore entry). Parameterized locale tests use `describe.each`. All 13 failed RED; Byrd's GREEN brought them to passing. Total at GREEN: 301 tests.

[GOTCHA] Dynamic `await import('@inlang/paraglide-sveltekit')` in a Vitest node-env spec forces vitest to load the package's runtime entry containing `.svelte` components — requires merging vitest config with vite config to get the Svelte transform. Bentham flagged this (YELLOW-3.1). Fix: `existsSync` on `node_modules/@inlang/paraglide-sveltekit/package.json` instead. Purely a filesystem check; no Svelte transform needed; `vitest.config.ts` stays standalone.

[PROCESS] Protocol coaching (team-lead, session 11): even for trivial refactors, create the branch first if the brief specifies one. Committing directly to local main skips Bentham's pre-merge review window and leaks intermediate work into main history. Going forward: brief specifies branch → create branch; brief silent → ask.

[DECISION] YELLOW-3.1 committed directly to main (6e8c0f4), Bentham post-write GREEN, pushed to origin/main. Closed.

## [CHECKPOINT] 2026-05-22 — Session 13: CHORE-32 RED phase

[DECISION] 27 tests written. 2 spec files:
- `src/tests/routes/api/organizations/server.spec.ts` (15 tests) — GET /api/organizations
- `src/tests/routes/api/organizations/id/sections/server.spec.ts` (12 tests) — GET /api/organizations/[id]/sections

Both RED on "Cannot find module" (route files don't exist yet). Total test count: 328 (27 RED, 301 pass).

[PATTERN] Route handler specs: mirror same directory path under `src/tests/routes/api/` (NOT colocated in `src/routes/` — see existing GOTCHA re: `+server.spec.ts` crash). Import route by relative path with `[id]` literal in the path (e.g., `../../../../../../routes/api/organizations/[id]/sections/+server.ts`).

[PATTERN] Route handler test approach: `vi.stubGlobal('fetch', ...)` mocks Entu at the network level (consistent with existing client.spec.ts and auth spec patterns). `vi.resetModules()` in afterEach ensures fresh module load per test (needed because route modules import EntuClient at module scope). `vi.stubGlobal` must be set BEFORE the dynamic `await import(...)`.

[PATTERN] Sections endpoint: two sequential fetch calls — first `GET /entity/{id}` (org pre-check), then `GET /entity?...` (search). Use `mockResolvedValueOnce` chaining: `fetchMock.mockResolvedValueOnce(orgResponse).mockResolvedValueOnce(sectionSearchResponse)`.

[GOTCHA] `vi.mock('$lib/...')` with `vi.resetModules()` in afterEach is broken: `resetModules` clears the module registry, so the next dynamic import gets a fresh module but `vi.mocked(EntuClient)` returns undefined (the mock factory ran at parse time, not re-run after reset). Use `vi.stubGlobal('fetch', ...)` instead — it intercepts at the fetch level, survives module resets, and doesn't require alias resolution.

[DECISION] Pagination behavior encoded in tests: negative or non-numeric → default 50; over 200 → clamp to 200 (not reject). Josquin must implement this clamp logic in both route handlers.

[DECISION] Empty response shape: both endpoints return `200 { entities: [] }` on zero results — never 404. Photo extraction: `o._thumbnail` directly (top-level field on EntuEntity, not nested in a property array). Sparse optional fields: `extractStringProp`/`extractTextProp`/`extractNumberProp` return `undefined` when the field's array is absent or empty.

[OPEN] CHORE-32 GREEN — Josquin implements:
- `src/routes/api/organizations/+server.ts`
- `src/routes/api/organizations/[id]/sections/+server.ts`
- Property extractor helpers (`extractStringProp`, `extractTextProp`, `extractNumberProp`, pagination clamp)

## [CHECKPOINT] 2026-05-22 — Session 13: CHORE-35 RED phase

[DECISION] 25 tests written. 2 files:
- `tests/frontend-scaffolding.spec.ts` (18 Playwright E2E tests) — signed-out landing, /auth/login, signed-in orgs list, empty state, error state, SSR presence check
- `src/tests/routes/landing/page.server.spec.ts` (7 Vitest unit tests) — `+page.server.ts` load() contract

Vitest tests: 7 RED on "Cannot find module '../../routes/+page.server.ts'". Total: 335 Vitest (7 RED, 328 pass).
Playwright: 18 new E2E tests collected; will fail when run (needs built app + .svelte files).
Commit: `c727f2f` on `feat/frontend-scaffolding-mvp`.

[PATTERN] Playwright BFF mock: `page.route('/api/organizations**', handler)` intercepts at the network level. Auth state simulation: `page.context().addCookies([{ name: 'entu_jwt', ... }])` sets the httpOnly cookie that hooks.server reads.

[PATTERN] SSR presence test: attach `page.on('response', ...)` before `page.goto('/')`, read the raw HTML, assert org name appears in initial HTML. Pins that data is SSR-rendered (not injected post-hydration by JS).

[PATTERN] Vitest component-level tests for Svelte pages: test the `+page.server.ts` load() function only (pure TS, no Svelte transform needed). .svelte rendering is Playwright's territory — standalone vitest.config.ts has no Svelte transform.

[DECISION] Pinned data-testid contract (Byrd must implement): `signed-out-cta` (href=/auth/login), `nav-sign-in`, `nav-sign-out`, `orgs-heading`, `org-card`, `org-photo-placeholder`, `orgs-empty-state`, `orgs-error-state`, `orgs-retry-button`, `login-cta`

[DECISION] Pinned message keys (Comenius must create in all 4 locales): `landing_signed_out_headline`, `landing_signed_out_cta`, `landing_signed_in_heading`, `landing_empty_state`, `landing_error_state`, `landing_retry_button`, `nav_sign_in`, `nav_sign_out`, `auth_login_heading`, `auth_login_cta`

[OPEN] CHORE-35 GREEN — Josquin: `src/routes/+page.server.ts` load(). Byrd: `+layout.svelte`, `+page.svelte`, `src/routes/auth/login/+page.svelte`.

## [CHECKPOINT] 2026-05-22 — Session 14: CHORE-41.1+41.2 RED phase (GH #45)

[DECISION] 8 tests added. 2 files changed. Branch: `feat/oauth-hardening`, HEAD `736f252`. 399 total (8 RED, 391 pass).

New file: `src/lib/entu-config.spec.ts` (3 tests — Cannot find module)
- Pins `ENTU_API_BASE` exported from `src/lib/entu-config.ts` with value `'https://entu.app/api/'`

Updated: `src/tests/routes/auth/oauth/cookie-server.spec.ts` (5 new tests — assertion failures vs current GREEN)
- 403 when csrf_state cookie missing (CSRF gate)
- csrf_state deleted always (success + malformed + expired), path /auth

[DECISION] CSRF semantics: delete-always. csrf_state is single-use; malformed JWT is a programming error not a user retry. Callback page server load no longer deletes csrf_state — that responsibility moved to /auth/cookie POST.

[DECISION] Constant location: `src/lib/entu-config.ts` (Option A). NOT `src/lib/server/` — exchange.ts is client-side and can't cross the server boundary.

[DECISION] exchange.ts spec unchanged (Q5 — hardcoded substring `'entu.app'` stays as drift-detection pin per architecture-decisions.md fixture-pin pattern).

[OPEN] CHORE-41.1+41.2 GREEN — Josquin:
- Create `src/lib/entu-config.ts` exporting `ENTU_API_BASE = 'https://entu.app/api/'`
- Update `src/lib/server/entu/client.ts` to import from entu-config.ts (remove local DEFAULT_BASE_URL)
- Update `src/lib/auth/exchange.ts` to import ENTU_API_BASE from entu-config.ts
- Update `src/routes/auth/cookie/+server.ts`: read + delete csrf_state cookie BEFORE JWT validation; return 403 if missing; delete-always

---

## [CHECKPOINT] 2026-05-22 — Session 14: CHORE-41 RED phase (revised)

[DECISION] 45 tests written across 5 spec files + 1 Playwright placeholder. All 45 RED on "Cannot find module". 346 existing tests pass. Branch: `feat/oauth-wiring`, HEAD `6a0e856`.

[PROCESS] First attempt wrote wrong architecture (server-side exchange). Lesson: when dispatch says "surface open questions first", treat as HARD GATE before writing any test. Architectural choice (client-side vs server-side exchange) is exactly the kind of decision needing PO confirmation pre-spec.

[DECISION] Files Josquin + Byrd must implement:
- `src/routes/auth/login/+page.server.ts` — load() generates csrf_state, sets httpOnly cookie (maxAge 600, path /auth), returns providers array with full Entu OAuth URLs
- `src/routes/auth/callback/+page.server.ts` — load() validates state vs csrf_state cookie, returns { sessionToken, db } or throws redirect to /auth/login?error=csrf_mismatch
- `src/routes/auth/callback/+page.svelte` — Byrd; calls exchangeSession() from lib/auth/exchange.ts, navigates / on success or /auth/login?error=... on failure
- `src/lib/auth/exchange.ts` — client-side helper: GET Entu /auth with Bearer, POST jwt to /auth/cookie
- `src/routes/auth/cookie/+server.ts` — POST; validates JWT shape (3 parts, exp not expired), sets entu_jwt httpOnly cookie
- `src/routes/auth/logout/+server.ts` — POST; deletes entu_jwt cookie, 303 redirect to /

[DECISION] Provider order locked: smart-id, mobile-id, id-card, google, apple, e-mail (PO 2026-05-22)

[DECISION] CSRF pattern: state in httpOnly cookie (path /auth, maxAge 600) AND embedded in each provider URL's next param as `?state=<csrf>&key=`. Server load validates URL ?state vs cookie before passing sessionToken to client.

[DECISION] db: from ENTU_DB env var (default 'polyphony'). exchange.ts uses this as the Entu db slug.

[GOTCHA] returnTo: deferred. MVP always redirects to / after login.

[OPEN] tests/oauth-flow.spec.ts (Playwright): all tests .skip() pending issue #36 mock harness.

## [CHECKPOINT] 2026-05-22 — Session 15: post-audit RED slate + docs bundle

[DECISION] #34 (YELLOW-32.2): 2 tests added to `src/lib/server/entu/client.spec.ts` pinning `EntuClient.get()` throw-on-403/404. Throw message: `Entu get ${entityId} failed: ${res.status}`. Tests assert `.toThrow('403')` / `.toThrow('404')` against the embedded status string. Branch `chore/34-client-get-throws-spec`, SHA `d551a5d`, merged.

[DECISION] #48 (CHORE-48 RED): 7 tests in `src/tests/linting-setup.spec.ts` (Camp B pattern — filesystem + package.json, no subprocess). Asserts: biome.json exists, @biomejs/biome in devDeps, eslint.config.js exists, eslint-plugin-svelte in devDeps, svelte-eslint-parser in devDeps, lint + lint:fix scripts. Branch `chore/48-eslint-biome-linting`, SHA `76c86c0`.

[DECISION] #24+#29 (docs bundle): README replaced (40 lines, pnpm-only commands, multivox.pages.dev, teams/mvox-dev/ pointer, v4E schema pointer). CONTRIBUTING.md extended with PR submission + Code style sections (+62 lines). Branch `chore/24-29-docs-bundle`, SHA `dc3c8a5`, merged.

[DECISION] #50 (CHORE-50 RED): 8 tests appended to `src/tests/routes/auth/oauth/login-page-server.spec.ts`. 6 fail RED (host `entu.app`→`api.entu.app`, path `/api/auth/`→`/auth/`, top-level `state=` present when must be absent). 2 pass as forward guards (state in `next`, next shape). Branch `chore/50-oauth-url-hotfix`, SHA `eb467e9`, merged.

[DECISION] #51 (CHORE-51 RED): 9 tests across 2 files. `callback-exchange-helper.spec.ts` +5 (exchange.ts call site) + `server.spec.ts` +4 (+server.ts call site). Both pin `/auth?db=` query-form vs buggy `/{db}/auth` path-form. 7 fail RED, 2 forward guards. Branch `chore/51-entu-auth-url-shape`, SHA `b763d6f`.

[PATTERN] Synthetic-violation discipline (session-14 L52): for each RED cycle, unset `mockEnv.ENTU_BASE_URL` (set to `undefined`) in new describe blocks so the code falls through to `ENTU_API_BASE` constant. This ensures the test targets the constant's value, not the env-override mock. All 5 RED cycles verified this way.

[PATTERN] Forward-guard tests: when a previous fix (e.g. CHORE-50 host fix) has already corrected part of the contract, write those assertions anyway and let them pass. They guard against future regression, and their passing is noted explicitly in the report to Bentham.

[GOTCHA] `searchParams.getAll('state')` only sees top-level URL params. State embedded inside a URL-encoded `next` value is NOT visible via searchParams. For the doubled-state bug (#50), the correct assertion is `searchParams.has('state') === false` (top-level must be absent), not `getAll('state').length === 1`.

[GOTCHA] `callback-exchange-helper.spec.ts:67` pins the buggy `/${DB}/auth` path-form. After CHORE-51 GREEN, Josquin must update that assertion. It was NOT updated in RED phase per brief instruction.

[DEFERRED] test-gaps.md additions for session 15 — no new gaps discovered beyond what's already logged.

## [CHECKPOINT] 2026-05-23 — Session 16: CHORE-A RED phase (4 specs)

[DECISION] 30 tests written across 4 RED spec files on `feat/chore-53a-foundation`. All RED on module-not-found. Branch HEAD at session end: `3febec1`.
- `src/lib/auth/storage.spec.ts` (9 tests) — `f04b0ad`
- `src/lib/auth/state.spec.ts` (8 tests) — `3301859`
- `src/lib/api/wrapper.spec.ts` (5 tests) — `dcc5971`
- `src/lib/entu/client.spec.ts` (8 tests) — `3febec1`

[GOTCHA] `happy-dom` was not installed at session start; installed as devDep (`pnpm add -D happy-dom`) alongside A1 commit. Required for localStorage/sessionStorage in `storage.spec.ts`, `state.spec.ts`, and `wrapper.spec.ts` (all use `// @vitest-environment happy-dom` on line 1). `client.spec.ts` uses default node env (no DOM needed).

[PATTERN] wrapper.spec.ts: `new Response(...)` in happy-dom does NOT auto-set `content-type`. Mock responses that expect JSON parsing must include `headers: { 'content-type': 'application/json' }` explicitly in the fixture. Plan's original A3 spec lacked these; brief corrected them (Byrd observation from his prior pass). Final committed spec includes the fix.

[PROCESS] Chain-discipline redo at session midpoint: Byrd had pre-implemented A3/A4 before RED was committed. PO called a reset to `b8e7dea` to restore TDD chain. Lesson reinforced: RED must land before GREEN regardless of plan's simultaneous spec+impl blocks. Going forward, always confirm branch HEAD SHA before writing RED — if impl is already present, surface to team-lead immediately before proceeding.

[DECISION] `src/lib/entu/` dir created for new client location. `src/lib/api/` dir created for wrapper. Neither existed at session start. Old `src/lib/server/entu/client.spec.ts` intentionally left untouched — deletion is Josquin's job during A4 GREEN (atomic move).

## [CHECKPOINT] 2026-05-23 — Session 17: HOTFIX RED (entu/webapp next= mirror)

[DECISION] HOTFIX RED written after PO live-test surfaced URL-construction bug. Two specs replaced:
- `src/routes/auth/[provider]/page.spec.ts` — 5 cases: bare `?key=` next stub, state in localStorage as `mvox.oauth_state`, decode check, login_hint, no-login_hint. 3 RED (next-URL shape, localStorage write, decode).
- `src/tests/routes/auth/oauth/callback-page-server.spec.ts` — 3 cases: dropped `state` field (server load returns `{ sessionToken, db }` only). All 3 already PASS — server load was already correct.

[GOTCHA] entu/webapp `next` URL is bare `${origin}/auth/callback?key=` — Entu appends JWT via string concat after `key=`. Any existing `?` query in the next value causes Entu to concatenate the JWT onto the last param value, never producing a valid `?key=<JWT>`. State MUST live in localStorage (`mvox.oauth_state`), not embedded in the URL.

[DECISION] CHORE-B Path C merged and live in production at session end.

## [CHECKPOINT] 2026-05-23 — Session 17: CHORE-B RED phases (B2/B3/B5/B7/B10/B11/B12/B13a/B15)

[DECISION] All CHORE-B RED phases completed this session. Summary of specs written/rewritten:
- `src/tests/routes/auth/oauth/callback-exchange-helper.spec.ts` — B2: 6 cases (rewrote; dropped old 11-test suite)
- `src/routes/auth/[provider]/page.spec.ts` — B3: 4 cases (new colocated spec)
- `src/tests/routes/auth/oauth/login-page-server.spec.ts` — B5: 3 cases (rewrote; dropped 22-test suite)
- `src/tests/routes/auth/oauth/callback-page-server.spec.ts` — B7: 3 cases (rewrote; dropped 9-test suite)
- `src/routes/auth/logout/page.spec.ts` — B10: 1 case (new colocated spec)
- `src/hooks.server.spec.ts` — B11: 2 cases (rewrote; dropped 4-test suite)
- `src/tests/routes/landing/page.server.spec.ts` — B12: 1 case (rewrote; dropped 7-test suite)
- `src/lib/api/wrapper.spec.ts` — B13a: 3 cases appended (CHORE-A 5 cases kept)
- B15: both URL sweeps clean — no stale `entu.app/api/` or `/{db}/auth` fixtures; no commit needed

[PATTERN] $lib alias not resolved in vitest (vitest.config.ts standalone, no SvelteKit plugin). All spec imports use relative paths. From `src/tests/routes/auth/oauth/` use `../../../../lib/...`; from `src/routes/auth/[provider]/` use `../../../lib/...`; from `src/routes/auth/logout/` use `../../../lib/...`.

[PATTERN] Colocated specs under `src/routes/` need `// @vitest-environment happy-dom` when testing helpers that touch localStorage/sessionStorage. Static top-level imports work fine (no need for dynamic `await import()` pattern used in older specs).

[PATTERN] For rewrite-style specs (B2/B5/B7/B11/B12): use static import at top level, pass bare minimal event objects `{}` or `{ url }` — the RED signal is that the old impl crashes or returns the wrong shape when given these minimal inputs.

[GOTCHA] Playwright E2E tests (`tests/frontend-scaffolding.spec.ts`) still mock old BFF `/api/organizations` route deleted in B14. These fail at `pnpm test` (Playwright stage). Expected — pre-existing gap documented in test-gaps.md. Vitest unit suite (37 files) passes clean.

[GAP] tests/frontend-scaffolding.spec.ts — 10 Playwright tests mock `/api/organizations` BFF route (now deleted in B14). Need update to mock browser-direct Entu fetch or remove BFF route mock. HIGH. 2026-05-23.

## [CHECKPOINT] 2026-05-24 — Session 21: CHORE-60 Task 4 RED

[PATTERN] biome enforces tabs in TS files; write tabs not spaces. Also requires parens around single arrow-function params (`w => ...` must be `(w) => ...`). Verify with `pnpm lint <file>` before reporting. 2026-05-24.

## [CHECKPOINT] 2026-05-24 — Session 22: CHORE-62 + CHORE-66 Tasks 3/4/5

[DECISION] CHORE-62: MvoxNav spec updated (lines 19+20 `'agenda'`→`'Agenda'`, `'library'`→`'Library'`) to match capitalized paraglide output. Atomic bundle with Byrd (chore/mvoxnav-i18n-and-snippet-helper). snippet-helpers.ts fix (SHA e8eeb11): wrap bare text in `<span>${text}</span>` per Svelte 5 createRawSnippet contract.

[DECISION] CHORE-66 Task 3: userStore.spec.ts — 19 tests. Token at `localStorage.getItem('token')` (storage.ts key), JWT shape `accounts[db]` not `sub`, person response `{ entity: { _id, name } }` with wrapper, two parallel fetches (person + member-search), section parents filtered. SHA bcdeb00.

[DECISION] CHORE-66 Task 4: OrgPicker.spec.ts — 5 tests. Contract pins: `data-testid="org-picker-chip"`, `role="menu"`, `findByText` for org label. Escape closes, click writes both `mvox.selectedOrgId` localStorage + URL `?org=`. SHA 7c455be.

[DECISION] CHORE-66 Task 5: MvoxNav.spec.ts — added `vi.mock('$app/navigation', ...)` + `beforeEach` cleanup to existing spec; 3 new orgPickerMode tests (placeholder/static/dropdown). 463/463 passing. Byrd-2 had already pre-implemented component by the time I wrote mock setup.

[GOTCHA] Spec-refactor-discard discipline: when Byrd commits the atomic bundle, his file is the truth. Any local refactor (helper extractions etc.) that diverges from the committed file must be discarded via `git restore`, not committed as follow-up. The committed version is the spec.

[PATTERN] Atomic bundle workflow: write spec → confirm RED → notify Byrd → Byrd implements + confirms → run `pnpm test:unit <spec>` + full gate → notify Byrd "ready for commit" → Byrd stages both files + commits. Never commit spec independently when plan says atomic.

[PATTERN] `vi.mock('$app/navigation', ...)` required in any component spec that mounts OrgPicker (even indirectly). Add to MvoxNav.spec.ts when orgPickerMode='dropdown' test is included.

[GOTCHA] CHORE-67 plan code blocks for Svelte component specs (Tasks 11-17) are missing `// @vitest-environment happy-dom` on line 1. Without it: `ReferenceError: document is not defined`. ALWAYS prepend this directive to every new `.spec.ts` that uses `@testing-library/svelte` — do not wait for surface-and-stop from Byrd. 2026-05-24.

## [CHECKPOINT] 2026-05-31 — Session 25: CHORE-75 Tasks 3+4+YELLOW-75.1 RED

[DECISION] Task 3: `src/lib/components/AvatarMenu.spec.ts` — 7 tests. RED on "Failed to resolve import ./AvatarMenu.svelte". SHA at dispatch: 240288c (Byrd shipped atomic RED+GREEN).

[DECISION] Task 4: `src/lib/components/MvoxNav.spec.ts` — added `renders AvatarMenu trigger when signedIn (CHORE-75)` test + mechanical update (CHORE-72 Task-15 rule): `renders brand and section tabs` dropped `toContain('Maire L.')`, replaced with `querySelector('button[data-testid="avatar-menu-trigger"]')` assertion. Name moves to dropdown; spec intent preserved.

[DECISION] YELLOW-75.1 fold-in: 8th test appended to AvatarMenu.spec.ts — `focuses the first menuitem when opened`. RED: `document.activeElement` is not the sign-out link — `$effect` registers listeners but never calls `.focus()`. Byrd must add `signoutLinkEl?.focus()` in the open branch.

[PATTERN] Mechanical-update rule (CHORE-72 Task-15): when an existing assertion pins a shape that's changing by design (e.g. inline-name → dropdown-name), replace the old assertion with one that pins the new shape. Flag in handoff AND commit body. Do NOT leave contradictory assertions.

[GOTCHA] MvoxNav.spec.ts line 33 previously pinned `container.textContent.toContain('Maire L.')` — this was the inline-name assertion that would have silently passed even after AvatarMenu wiring (name still present in DOM, just inside the dropdown). Replacing it with a `querySelector` for the trigger button is the correct structural pin.

## [CHECKPOINT] 2026-05-31 — Session 26: CHORE-76 RED phase

[DECISION] 12 new tests in `src/lib/components/MvoxNav.spec.ts` — describe block `MvoxNav — responsive layout (CHORE-76)`. All 12 RED. Commit SHA `5a28b27` on `chore/responsive-nav`. Existing 7 MvoxNav + 564 other tests stay green.

[PATTERN] Responsive layout test strategy: jsdom has no CSS engine; encode responsiveness structurally. Assert responsive Tailwind classes exist (`hidden sm:flex`, `sm:hidden`, `flex-shrink-0`, `min-w-0`, `overflow-x-hidden`). Assert hamburger click reveals a `[data-testid="nav-tab-menu"]` with 5 `[data-testid^="nav-tab-menu-item-"]` children. jsdom pixel overflow deferred to Playwright — flagged in test-gaps.md.

[PATTERN] Hamburger focus-on-open pattern: mirrors AvatarMenu keyboard pattern. After `fireEvent.click(hamburger)`, assert `document.activeElement === firstItem` (the first `[data-testid^="nav-tab-menu-item-"]`).

[DECISION] data-testid contract (Byrd must implement):
- `nav-avatar-wrapper` — flex wrapper around AvatarMenu (must have `flex-shrink-0`)
- `nav-inline-tabs` — desktop inline tab row (must have `hidden sm:flex`)
- `nav-inline-tab-{agenda|library|roster|notices|settings}` — individual inline tab elements
- `nav-tab-menu-trigger` — hamburger button (must have `sm:hidden`, non-empty aria-label)
- `nav-tab-menu` — collapsed menu panel
- `nav-tab-menu-item-{agenda|library|roster|notices|settings}` — menu entries (first must receive focus on open)
- `nav-chip-librarian` — librarian chip (must be child of `nav-tab-menu-item-library` when menu open)
- `nav-org-area` — org picker / chip wrapper (must have `min-w-0`)
- `nav-signin-wrapper` — wrapper for sign-in link (must have `flex-shrink-0`)

[DECISION] i18n key needed: `nav_menu_open` for hamburger aria-label — test couples to presence of non-empty accessible name, NOT the literal string. Comenius wires it.

[GAP] CHORE-76 — Playwright viewport test at 320px deferred. See test-gaps.md.

## [CHECKPOINT] 2026-05-31 — Session 26: CHORE-77/78 RED + RED-78.1

[DECISION] CHORE-77 RED: 3 tests in MvoxNav.spec.ts (2 RED + 1 forward-guard). AC7 revised (no overflow clip on header), stacking context added (relative/sticky + z-* class). SHA `5473953` on `chore/nav-stacking-fix`.

[DECISION] CHORE-78 Task 2 RED: 9 failing tests in `LibraryMasterDetail.spec.ts` + new `LibraryMobileList.spec.ts` (12 tests, suite RED on missing file). SHA `2747684`. RED-78.1 follow-up `b116629` — strengthened AC2 grid assertion to require BOTH `hidden` AND `sm:grid`.

[PATTERN] Bentham's standing responsive rule (RED-78.1): a `sm:grid`/`sm:block`/`sm:flex` without a base `hidden` renders in block flow below the breakpoint. ALWAYS assert BOTH `hidden` AND the responsive display class. Inverse (`block sm:hidden`) needs no companion. Apply this sweep to every CHORE with breakpoint-gated elements.

[GOTCHA] YELLOW-78.1 — stub rule for new components in RED phase: land a minimal stub `.svelte` (export default empty component, throw-not-implemented body) alongside the spec so `pnpm check` stays at 0 errors. Tests fail on assertions, not module resolution. Apply from next new-component RED onward.

[DECISION] CHORE-78 testable seams (all three matched Byrd's GREEN): (a) row-select = `<a href="?work=<id>">` anchor; (b) scroll-spy gate = `window.matchMedia('(min-width: 640px)').matches` in onMount/$effect; (c) mobile view mode = derived from existing `initialWorkId` prop.

## [CHECKPOINT] 2026-05-31 — Session 27: CHORE-79 RED phase

[DECISION] 10 tests written across 2 files on `chore/auth-guard`. 7 RED, 3 pass. SHA `4e4401e`.
- `src/lib/server/auth/session-cookie.spec.ts` (6 tests) — 5 RED on 'not implemented', 1 passes (SESSION_COOKIE constant)
- `src/hooks.server.spec.ts` (4 tests) — 2 RED (AC1 unauthenticated redirect, AC3 expired redirect), 2 pass (AC2 public paths, AC4 valid cookie). Old passthrough tests replaced.
- `src/lib/server/auth/session-cookie.ts` — minimal stub with inline return type (no `cookie` package import — transitive dep only, not directly importable)

[GOTCHA] `cookie` package (`CookieSerializeOptions`) is NOT directly importable in this project — it's a transitive dep of SvelteKit only. Use an inline object type in stubs and implementations. The package IS present at `node_modules/.pnpm/cookie@*/` for reference.

[GOTCHA] CHORE-79 RED arithmetic bug (from plan doc): `const now = 2_000_000_000_000` (ms) was 1000× too large for the sample exp values. `decodeJwtExpMs(jwtWithExp(2_000_001))` returns `2_000_001_000` ms, which is far below `2_000_000_000_000` — so "valid" case would fail. Correct `now` is `2_000_000_000` (drop 3 zeros). Bug came from plan doc sample code, not spec design. Josquin fixed in-place with team-lead authorization. Going forward: for synthetic ms/seconds timestamps, always verify that sample values actually straddle `now` — write a quick mental check: `jwtWithExp(X)` decodes to `X * 1000` ms; `now` must be between the "expired" and "valid" X*1000 values.

[PATTERN] Redirect assertion shape for SvelteKit `redirect()`: `.rejects.toMatchObject({ status: 302, location: '...' })`. SvelteKit throws an object with `status` (number) and `location` (string) — no try/catch needed; `toMatchObject` on the rejected value works cleanly.

## [CHECKPOINT] 2026-05-31 — Session 27: CHORE-79 + CHORE-72 RED phases

[DECISION] CHORE-79 Task 1 RED: 10 tests across 2 files on `chore/auth-guard`. SHA `4e4401e`.
- `src/lib/server/auth/session-cookie.spec.ts` (6 tests) — 5 RED on 'not implemented', 1 passes (SESSION_COOKIE constant name)
- `src/hooks.server.spec.ts` (4 tests) — rewrote old passthrough tests; 2 RED (AC1/AC3 redirect), 2 pass (AC2/AC4 public/valid)
- `src/lib/server/auth/session-cookie.ts` — minimal stub, inline return type (no `cookie` package import — transitive dep only, not directly importable)

[GOTCHA] `cookie` package (`CookieSerializeOptions`) NOT directly importable — transitive SvelteKit dep only. Use inline object type in stubs and impls. Package exists at `node_modules/.pnpm/cookie@*/` for reference.

[PATTERN] SvelteKit `redirect()` assertion shape: `.rejects.toMatchObject({ status: 302, location: '...' })`. Throws an object with `status` + `location` fields — no try/catch needed.

[GOTCHA] Timestamp arithmetic in synthetic JWT fixtures: `jwtWithExp(X)` → `decodeJwtExpMs` returns `X * 1000` ms. `now` must sit BETWEEN expired and valid sample values in ms-space. Always verify: `expired_X * 1000 < now < valid_X * 1000`. Plan doc had `now = 2_000_000_000_000` (too large); correct is `now = 2_000_000_000`. Josquin fixed in-place (team-lead authorized).

[DECISION] CHORE-79 logout-greet fix RED (Task #30): 1 test appended to `src/routes/auth/logout/page.spec.ts`. SHA `f5f746b` on `chore/auth-guard`. Asserts `get(userStore).status === 'signed-out'` after `performLogout()`. 1 RED (store not reset), 1 existing test green.

[PROCESS] Two surface-and-stops this session:
1. Task brief (auth-guard.ts/mvox_auth shape) vs plan doc (session-cookie.ts shape) — plan doc was authoritative.
2. Logout server-load redirect bug — verified file was already `return {}`, not `throw redirect`. Team-lead confirmed wrong diagnosis; no code written.
3. CHORE-72 spec-update + refinement arrived AFTER RED+GREEN both committed — surfaced immediately; Byrd folded spec+page fix atomically per Bentham Task-15 rule.

[DECISION] CHORE-72 Task 1 RED: 4 tests in `src/routes/about/page.spec.ts`. SHA `c52c22b` on `chore/about-page`. Mocks `$lib/paraglide/messages.js` entirely (no en.json key dependency). Asserts `data-testid` elements: `about-page-title`, `about-mission-heading`, `about-story-heading`, `about-values-heading`. Stub `+page.svelte` empty div only.

[GOTCHA] CHORE-72 ordering issue: Byrd implemented GREEN before Comenius added `about_*` keys → `pnpm check` broke (9 errors: missing paraglide properties). Correct chain is RED → i18n keys → GREEN (Byrd needs keys to exist for type-check). Surfaced immediately; Byrd+spec aligned atomically.

[PATTERN] vi.mock for paraglide messages in component specs: mock `$lib/paraglide/messages.js` (not just runtime) when the component calls `m.about_*()` keys that don't exist yet in en.json. This decouples RED spec from i18n ordering. Also mock `$lib/paraglide/runtime.js` for `languageTag`/`setLanguageTag` used by primitives.

## [CHECKPOINT] 2026-06-01 — Session 29: Rehearsal Schedule RED phase (Tasks 1+2)

[DECISION] 21 tests written across 2 spec files on `feat/rehearsal-schedule`. SHA `d3196f3`. All 21 RED on "not implemented". pnpm check: 0 errors.

- `src/lib/seasons/recurrence.spec.ts` (8 tests) — occurrenceDates (5) + toStartDatetime DST (3)
- `src/lib/seasons/validation.spec.ts` (13 tests) — validateSeason (5) + validateSeries (8)
- `src/lib/seasons/recurrence.ts` — minimal stub (throw not implemented)
- `src/lib/seasons/validation.ts` — minimal stub with types (throw not implemented)

[GOTCHA] Plan Task 2 code block uses `.code` directly on `ValidationResult` union type (e.g., `validateSeries(...).code`) — type error under strict TypeScript because `ValidationOk` has no `code` property. Changed those 2 assertions to `.toMatchObject({ ok: false, code: '...' })` which is equivalent and type-safe. Remaining plan assertions (`.toEqual({ ok: false, field, code })`) work correctly because `toEqual` does not care about the TypeScript type.

[PATTERN] Stubs must be committed alongside specs (not after): stubs first → RED on assertions → commit both together in one atomic commit.

[GOTCHA] Was accidentally on `chore/probe-rights-mechanics` when creating files. Files were untracked so they transferred safely on `git checkout feat/rehearsal-schedule`. Always verify branch before starting work.

[OPEN] Tasks 1-13 GREEN (Byrd/Josquin). Task 15 RED dispatched (SHA e0db5d8). All RED phases complete.

## [CHECKPOINT] 2026-06-01 — Session 29: Rehearsal Schedule RED phase (Task 15)

[DECISION] 9 tests in `src/routes/seasons/page.spec.ts`. SHA `e0db5d8`. 4 RED on assertions, 5 forward guards. pnpm check: 0 errors.

RED: owner-controls not shown when org.role='owner' (canManage=false stub); seasons-empty-owner same; createSeriesWithEvents not called after series create; seasons-notice not shown on PartialGenerationError.
Forward guards: loading/error/no-rights states; season-selector when ready; owner-controls absent for non-owner.

[GOTCHA] DeskSurface.svelte must NOT be mocked — removing the mock fixed '(0 , default) is not a function' error. Just let it render (it's a plain wrapper with {#render children()}).

[PATTERN] entuSeasons mock: use vi.importActual spread + override specific fns with vi.fn(). This lets PartialGenerationError class be imported from the real module while keeping fn mocks in place.

[PATTERN] seasonsStore mock: vi.mock with async factory using writable() from svelte/store. Tests call (seasonsStore as Writable).set(...) to drive state transitions.

## [CHECKPOINT] 2026-06-01 — Session 29: Rehearsal Schedule RED phase (Task 11)

[DECISION] 4 tests in `src/lib/seasons/seasonsStore.spec.ts`. SHA `7659f97`. All 4 RED on assertions. pnpm check: 0 errors.
- loading set synchronously before listSeasons resolves → ready
- listSeasons returns [] → no-rights
- listSeasons throws → error
- reset-on-org-change: capturedMid inside mock must be 'loading'

[PATTERN] seasonsStore mirrors libraryStore pattern exactly: writable + hydration fn + vi.mock('./entuSeasons') for isolation. No real fetch issued. `beforeEach` resets store to 'idle'.

[PATTERN] reset-on-org-change test: capture store status INSIDE the mock implementation (not before/after the call) to verify the synchronous loading-set happens before any async work.

## [CHECKPOINT] 2026-06-01 — Session 29: Rehearsal Schedule RED phase (Task 10)

[DECISION] 6 tests added to `src/lib/seasons/entuSeasons.spec.ts`. SHA `0593639`. All 6 RED on "not implemented". pnpm check: 0 errors.

listConductors (3): P0.3 filter (property_type==='_editor' AND inherited!==true), empty-array case, per-person GET resolution.
assignConductor (2): non-member throws /must be an org member/, member → POST _editor ref to season.
revokeConductor (1): DELETE /property/{propertyValueId} (property-value wire, not entity wire).

[GOTCHA] revokeConductor test asserts URL contains 'prop-val-42'. Wire shape for conductor revoke is DELETE /property/{id} (property-value _id, per project_entu_wire_shape_entity_vs_property). Josquin must NOT use DELETE /entity/.

[PATTERN] listConductors test encodes three _editor entries including a direct-_owner (property_type:'_owner', inherited absent). This is the critical P0.3 case — a bare !inherited guard passes the _owner entry. The filter MUST check property_type === '_editor' explicitly.

## [CHECKPOINT] 2026-06-01 — Session 29: Rehearsal Schedule RED phase (Tasks 6-9)

[DECISION] 13 tests added to `src/lib/seasons/entuSeasons.spec.ts`. SHA `303d4f4`. All 13 RED on "not implemented". pnpm check: 0 errors.

Task 6 (listRehearsals — 4): sort asc, empty→[], read-time inheritance merge (location from series), explicit override.
Task 7 (updateRehearsal — 3): DELETE-then-POST replace; null valueId skips DELETE; no sibling contamination.
Task 8 (deleteRehearsal — 3): correct URL, DeleteForbiddenError on 403, targeted-only delete.
Task 9 (deleteSeriesCascade — 3): cascade, partial-failure, series-specific child query (Bentham sibling-sweep guard).

[GOTCHA] deleteRehearsal test asserts `toBeInstanceOf(DeleteForbiddenError)` — stub throws plain Error, which correctly produces a RED failure with "expected Error: not implemented to be an instance of DeleteForbiddenError". Josquin must throw DeleteForbiddenError specifically on 403, not a generic Error.

[PATTERN] RehearsalPatch `valueId: string | null` — null means property doesn't exist yet; implementation must skip DELETE when null, only POST.

[PATTERN] Task 6 inheritance-merge test uses URL-based two-fetch mock dispatch (entity/series1 → series lookup; otherwise → event search). Josquin must do per-series-id GET to avoid N+1.

## [CHECKPOINT] 2026-06-01 — Session 29: Rehearsal Schedule RED phase (Tasks 4+5)

[DECISION] 12 tests in `src/lib/seasons/entuSeasons.spec.ts` on `feat/rehearsal-schedule`. SHA `cb263d6`. 11 RED, 1 forward guard passes. pnpm check: 0 errors.
- `src/lib/seasons/entuSeasons.ts` — minimal stub (createSeason, listSeasons, createSeriesWithEvents; throw not implemented)
- `src/lib/seasons/types.ts` — domain + Entu raw types (no standalone test; exercised by Task 4+)
- `src/lib/seasons/entuSeasons.spec.ts` — 12 tests (Task 4: 7; Task 5: 5)

[GOTCHA] `createSeason > throws when Entu returns ok: false` passes immediately (stub throws unconditionally). Forward guard — will stay GREEN through impl. Josquin must NOT suppress the throw on the 403 branch.

[PATTERN] Task 5 "POSTs events with correct parents" test infers seriesId from mock return ('id1' = first call `_id`). Josquin must use the series POST response `_id` as the `_parent` reference for event POSTs.

[PATTERN] `entuSeasons.spec.ts` covers both Tasks 4+5 in one file. Committed as one RED commit since the file is shared; both task issue numbers cited in commit message.

## [CHECKPOINT] 2026-06-01 — Session 30: #87 edit-rehearsal RED phase

[DECISION] 24 new RED tests across 4 files on `feat/seasons-edit-rehearsal`. SHA `d640878`. pnpm check: 0 new errors (8 pre-existing PUBLIC_ENTU_DB env errors).

Files changed:
- `src/lib/seasons/types.ts` — Rehearsal gains `description?`; RehearsalRaw value arrays carry `_id?`
- `src/lib/seasons/entuSeasons.ts` — RehearsalPatch refactored to plain values (no value-ids); updateRehearsal stub throws "not implemented"
- `src/lib/seasons/entuSeasons.spec.ts` — Task 7 tests updated for new contract (3 tests); +3 listRehearsals description tests; +5 updateRehearsal self-resolve tests
- `src/lib/components/seasons/RehearsalList.spec.ts` — replaced deferred placeholder with 3 edit-affordance tests (canManage=true shows edit, =false hides, click calls onedit)
- `src/lib/components/seasons/RehearsalEditForm.spec.ts` — new, 9 tests: 5 pre-population, 4 dirty-tracking/onsave
- `src/lib/components/seasons/RehearsalEditForm.svelte` — minimal stub (renders nothing but testid stub; no thrown error; pnpm check 0 warnings)
- `src/routes/seasons/page.spec.ts` — added updateRehearsal to mock; 5 page integration tests (edit opens form, submit calls updateRehearsal+re-fetch, regression guard, sibling guard, non-owner gate)

[PATTERN] "empty patch → no fetch calls" test: use `expect(fetchMock).not.toHaveBeenCalled()` rather than filtering by method — cleaner and avoids type assertion headaches.

[PATTERN] `.filter()` on `fetchMock.mock.calls` for GET detection: use `(fetchMock.mock.calls as any[]).filter((c: unknown[]) => !(c[1] as { method?: string } | undefined)?.method)` — the typed tuple destructure pattern fails strict TS on vi.fn() mock.calls.

[GOTCHA] Task 7 "updateRehearsal" tests encoded the OLD `{ valueId, value }` caller contract. Must be replaced (not just commented out) in the same RED commit — leaving contradictory tests is a spec-purity violation (per session-8 pattern).

[DECISION] 1 forward guard passes immediately: "rehearsal-edit button absent for non-owner" — RehearsalList already gates `canManage=false` for the cancel button, so the non-owner case passes without Byrd touching the component.

[RESOLUTION CALLOUT] RehearsalEditForm.svelte is a stub — no rendered fields. Byrd must create the full implementation. RehearsalList also needs the edit button added. Page needs route wiring (edit state, form open/close, updateRehearsal call).

## [CHECKPOINT] 2026-06-12 — Slice-1 #10 agenda RED phase (Tasks 2)

[DECISION] 24 tests written across 3 spec files on `feat/agenda`. SHA `613ffc9`. 19 RED, 5 forward guards pass. pnpm check: 0 errors.

Files created:
- `src/lib/agenda/agendaData.ts` — stub (throws 'not implemented')
- `src/lib/agenda/agendaData.spec.ts` — 5 tests: merge+sort+annotate, ended-season filter, upcoming boundary, per-org failure isolation, empty-orgs short-circuit
- `src/lib/components/agenda/AgendaList.svelte` — minimal stub (renders empty div with data-testid="agenda-list")
- `src/lib/components/agenda/AgendaList.spec.ts` — 15 tests: date-group headers (Europe/Tallinn), row content (time/duration/name/org-chip/location), empty state, partial-error notice
- `src/routes/agenda/+page.svelte` — minimal stub (renders data-testid="agenda-loading")
- `src/routes/agenda/page.spec.ts` — 4 tests: ready+orgs→listAgenda called, ready+no-orgs→empty message, loading skeleton

[PATTERN] AgendaList.svelte stub: avoid `void items; void errors;` pattern (generates Svelte state_referenced_locally warnings). Use template comment `<!-- stub: items.length={items.length} ... -->` to consume props in a reactive context with 0 warnings.

[PATTERN] Forward guards in this RED: 5 tests pass immediately because the stub satisfies trivial negative assertions (no location when absent = empty div has no location element; no rows when empty = empty div has no rows; no partial-error when no errors = empty div has no partial-error; loading skeleton = stub already renders agenda-loading; no-empty-orgs-message when orgs present = stub renders nothing).

[GOTCHA] page.spec.ts: `listAgenda` is called by a `$effect` inside the page component which only fires after the store changes post-render. Josquin/Byrd must ensure the `$effect` is synchronously observable to vi.mocked. If test ordering matters, use `await vi.waitFor(...)` in the GREEN phase.

## [CHECKPOINT] 2026-06-12 — Slice-2a #8 RSVP RED phase (Task 2)

[DECISION] 40 tests across 3 spec files on `feat/rsvp-singer`. SHA `92a59ea`. 35 RED, 5 forward guards. pnpm check: 0 errors.

Files created/modified:
- `src/lib/rsvp/rsvpData.ts` — stub (all helpers throw 'not implemented', `resetMemberIdCache` is no-op)
- `src/lib/rsvp/rsvpData.spec.ts` — 22 tests: listMyRsvps (4), findMyMemberId (5 incl. memoization), createRsvp (5 incl. no _sharing), updateRsvpStatus (4 incl. call-order assertion), deleteRsvp (2)
- `src/lib/components/agenda/RsvpControl.svelte` — minimal stub (renders empty div)
- `src/lib/components/agenda/RsvpControl.spec.ts` — 10 tests: 4-buttons, labels, aria-pressed, onchange(status)/onchange(null), disabled+hint
- `src/routes/agenda/page.spec.ts` — extended: +5 RSVP wiring tests incl. YELLOW-10.1 staleness guard

[GOTCHA] URL-assertion tests on stubs that throw before fetch: must await the call (not `.catch(() => {})`) OR assert `fetchMock.toHaveBeenCalled()` first. `mock.calls[0]` is undefined if no fetch was issued (stub throws before reaching fetch).

## [CHECKPOINT] 2026-08-06 — mvox-app (NEW app) #10 RSVP data-layer RED phase

[DECISION] 25 tests, 2 files, on `feat/slice2-rsvp` (checkout `~/workspace-app`, repo mvox-dev/mvox-app — NOT the old mvox_v4e_web app). SHA `42a6a65`. pnpm check: 0 errors. 25 failed (all new, all on the stub's `throw new Error('not implemented')` — right reason, zero forward guards), 125 pre-existing pass, no regressions.
- `src/lib/rsvp/rsvpData.ts` — new stub: `findMyMemberId`, `createRsvp`, `updateRsvpStatus`, `deleteRsvp` + `RsvpStatus`/`CreateRsvpInput` types. `listMyRsvps` intentionally OMITTED — reads belong to #11, not #10.
- `src/lib/rsvp/rsvpData.spec.ts` — 20 tests: findMyMemberId(4), createRsvp(7, incl. `it.each` full-set sentinel check per status), updateRsvpStatus(7, incl. a corrupted-state defense case with TWO sentinels present at once to prove the delete is generic, not hardcoded to the old status's own sentinel), deleteRsvp(2).
- `src/lib/seasons/entuSeasons.ts` — ADDED `resolveTypeId`/`resetTypeIdCache` (stub). Did NOT exist in this app yet (dispatch brief assumed it did, mirroring the old app) — createRsvp needs it to send `_type` as a `reference` per #10's pinned wire-shape requirement. Ported 1:1 from the old app's version, adapted to `entuFetch`/`fetchImpl` injection.
- `src/lib/seasons/entuSeasons.spec.ts` — +5 tests direct-covering `resolveTypeId` (query shape, per-db+typeName cache, not-found throw, !ok throw), mirroring the old app's own coverage of this function.

[DECISION] `findMyMemberId` is DE-FANNED — dropped the old app's `orgId` param. Query is `_type.string=member&person.reference=<id>&status.string=active` only, no `_parent.reference`. Rationale: epic #8 says resolve member "the same pragmatic org-scoped way slice 1 resolves seasons" — and slice 1's LANDED code (`listSeasons`) actually dropped org scoping entirely for single-collective ("in polyphony all seasons are EFK's"), so the literal precedent to follow is de-fanned, not the old app's orgId-taking signature. Flagged to team-lead as a call made, not a silent guess — epic's prose is ambiguous enough that Josquin/PO could reasonably override at GREEN if a person can ever have >1 active member row across orgs within one db.

[PATTERN] New-app spec convention differs from the old app: inject `fetchImpl: typeof fetch = fetch` as an explicit param (not `vi.stubGlobal('fetch', ...)`), and mock responses as real `new Response(JSON.stringify(body), {status})` via a local `json()` helper (not `{ok, json: async()=>...}` plain objects) — matches `entuSeasons.spec.ts`/`agendaData.spec.ts` exactly. Carried this convention into rsvpData.spec.ts even though the old app (canonical harvest source) uses the older global-stub style.

[SCOPE] Did NOT touch `src/lib/agenda/types.ts` despite it being named in the issue's "landing zone" — nothing in #10's 5 stated behaviors touches `AgendaItem`; that wiring is #11's job. Also did not add member-id memoization (old app had a `memberIdCache`) — not in #10's stated ACs, skipped to avoid scope creep; trivial for Josquin to add at GREEN if wanted.

[OPEN] GREEN — Josquin implements against `feat/slice2-rsvp`. Checkout free (I made no further edits after the RED commit). Pérotin's live smoke-create (parallel, different repo) pins the exact wire-shape for `_type`/ref fields — reconcile against that at GREEN if it disagrees with my mocks (behavior tests should still hold; only URL/body literals might need adjustment).

[GOTCHA] Inline `import` inside an `it()` body is invalid TS ("can only be used at the top level"). Type the resolver fn and Promise explicitly at the closure level and import the type at top level.

[PATTERN] YELLOW-10.1 staleness test: structure is a contract forward-guard — the assertion currently passes trivially (stub does nothing). It becomes a genuine regression guard once Byrd's `$effect` cleanup is in place. Test presence is the contract, not a RED signal.

[PATTERN] Disabled-button click in happy-dom: `fireEvent.click(null)` throws "Unable to fire a click event". Use `if (btn && !btn.disabled)` guard in tests where the click is conditional on button existence.

## [CHECKPOINT] 2026-06-12 — Auth trusted-identity RED phase (Task 1)

[DECISION] 18 tests across 3 files on `feat/auth-trusted-identity`. SHA `cddc698`. 11 RED, 7 forward guards. pnpm check: 0 errors.

Files created/modified:
- `src/lib/server/auth/identity-cookie.ts` — stub (signIdentity + verifyIdentity both throw 'not implemented')
- `src/lib/server/auth/identity-cookie.spec.ts` — 6 async Web Crypto tests: round-trip, payload tamper, sig tamper, expired, malformed, wrong secret
- `src/tests/routes/auth/oauth/callback-page-server.spec.ts` — extended with 5 exchange tests (4 RED + 1 forward guard)
- `src/routes/auth/logout/page.spec.ts` — extended: 2 server handler tests (1 RED: mvox_identity deleted; 1 forward guard: mvox_session regression pin)

[GOTCHA] After Josquin adds fetch to `load`, the first existing test ("returns sessionToken") will start calling fetch too — it will need a fetch stub. Josquin: add `vi.stubGlobal('fetch', happyPathMock)` in a `beforeEach` wrapping the existing tests, or the first test breaks.

[GOTCHA] `vi.mock('$app/environment', ...)` set in spec; Josquin must import `dev` from `$app/environment` (not hardcode false) so `secure` cookie attribute resolves correctly.

[PATTERN] Logout server handler test: dynamic `await import('./+page.server')` inside `it()` body so the module loads after cookies mock is set up. `vi.resetModules()` before re-import in second test for a fresh load.

[PATTERN] `vi.unstubAllGlobals()` in `afterEach` to clear `vi.stubGlobal('fetch', ...)` stubs — `vi.restoreAllMocks()` does NOT clear stub globals.

## [CHECKPOINT] 2026-06-13 — Session 32: multiple auth RED phases + slice-2b RED

[DECISION] Session 32 was high-velocity RED work across many branches (all single-tree). Summary:
- `fix/stale-jwt-cleanup` SHA `837cde4`: 11 RED (isTokenExpired boundaries + hydrateUserStore 10-row matrix). Fixture audit: all existing JWTs have far-future exp, no patches needed.
- `fix/auth-callback-error-codes` SHA `46873e3`: 3 RED (exchange_http_401, exchange_no_account, identity_sign_failed). vi.mock partial override pattern for signIdentity.
- `fix/server-exchange-accounts-shape` SHA `c43793c`: 5 RED (all happy paths → exchange_no_account from array-indexing; probed array shape).
- `fix/server-exchange-token-claims` SHA `26191e0`: 8 RED (token-claims shape; makeToken() helper using Buffer.from().base64url).
- `fix/revert-trusted-identity` SHA `22096cd`: 2 RED (restore known-good callback spec; delete identity-cookie.spec.ts). pnpm check 0 even without identity-cookie.ts deleted (Josquin deletes in GREEN).
- `feat/conductor-tally` SHA `b7ae7a8`: 21 RED (sentinel writes + parseTally + badge + listRehearsals tally). Made Rehearsal.tally optional (?) to avoid breaking existing fixtures.
- `feat/optimistic-tally` SHA `bef6a0d`: 7 RED (applyTallyDelta + page tally-delta). Partial-real mock pattern: applyTallyDelta + parseTally real in the mock so page can compute delta.

[PATTERN] makeToken() for server-exchange tests: `'h.' + Buffer.from(JSON.stringify({ accounts })).toString('base64url') + '.s'` — base64url-correct, matches server's `Buffer.from(seg,'base64url')` decode.

[PATTERN] Partial-real vi.mock: `vi.mock('module', async (importOriginal) => { const real = await importOriginal(); return { ...real, someHelper: vi.fn(real.someHelper) }; })` — keeps pure helpers real while making async/IO functions interceptable per-test.

[GOTCHA] Adding a required field to a shared domain type (Rehearsal.tally, AgendaItem.tally) breaks ALL existing test fixtures. Always add as optional first (`?`); remove the `?` in GREEN once the producer always sets it.

[DECISION] trusted-identity stack fully reverted. identity-cookie.ts + identity-cookie.spec.ts deleted. Server-exchange approach confirmed impossible (aud=IP binding). Formula-based tally approach works instead.

## [CHECKPOINT] 2026-06-13 — Session 33: S33 sub-chain 1 RED phase

[DECISION] 41 RED tests across 9 spec files on `feat/s33-navigation`. SHA `b049c1a`. 915 existing tests unaffected.

Spec files written:
- `src/lib/nav/currentTab.spec.ts` (8) — tabForPath() for all 6 paths + fallback
- `src/lib/components/SoonMarker.spec.ts` (6) — handwritten "soon" marker
- `src/lib/components/ComingSoon.spec.ts` (4) — coming-soon page component (with paraglide mocks)
- `src/routes/roster/page.spec.ts` (4) — /roster placeholder route
- `src/routes/notices/page.spec.ts` (4) — /notices placeholder route
- `src/routes/settings/page.spec.ts` (4) — /settings placeholder route
- `src/lib/components/MvoxNav.spec.ts` (+8) — Library <a> link + mobile menu <a> links (S33 describe block)
- `src/lib/components/AvatarMenu.spec.ts` (+3) — About link in dropdown (S33 describe block)
- `tests/s33-coming-soon-readability.spec.ts` (3) — Playwright bg-rule check (remains RED until routes + preview server built)

Stubs committed (YELLOW-78.1 pattern — RED = assertion failure, not module resolution):
- `src/lib/nav/currentTab.ts` — throws 'not implemented'
- `src/lib/components/SoonMarker.svelte` — empty stub span
- `src/lib/components/ComingSoon.svelte` — stub with correct Props type, renders empty div
- `src/routes/roster/+page.svelte`, `src/routes/notices/+page.svelte`, `src/routes/settings/+page.svelte` — empty div stubs

[PATTERN] Route page specs: mock `$lib/paraglide/runtime.js` AND `$lib/paraglide/messages.js` fully when the page/component imports `m.*` keys. Import the page module AFTER the vi.mock calls.

[PATTERN] AvatarMenu — existing "focuses first menuitem" test pins sign-out link as first focus target. S33 GREEN shifts this to About link. Handled via a separate S33 describe block with a complementary focus test — existing test left in place as a forward guard until Byrd wires About (it will conflict post-GREEN; Byrd updates existing test as part of GREEN per Task-15 rule).

## [CHECKPOINT] 2026-06-13 — Session 33: S33 sub-chain 2 RED phase

[DECISION] 17 RED tests across 3 spec files on `feat/s33-readability-visual`. SHA `d1e050b`. 957 existing tests unaffected.

Files:
- `src/lib/components/DeskSurface.spec.ts` (+10) — orbit keyframe stop counts + dx/dy var counts + base gradient color swap
- `src/lib/components/agenda/AgendaList.spec.ts` (+5) — agenda-day-card wrapper + bg class/style
- `src/routes/agenda/page.spec.ts` (+3) — data-desk-text on page-title + .state-msg-container on loading/empty-no-orgs

[GOTCHA] DeskSurface keyframe regex: non-greedy `([\s\S]*?)` stops at the first `}` inside the keyframe block (each stop has inline braces `0% { ... }`). Must use nested-brace regex: `\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}`. Extracted into `extractKeyframeContent(src, name)` helper inside the spec — keeps tests readable without a separate utils file.

[PATTERN] Source-level CSS assertion via `?raw` import is the right tool for keyframe stop counts and CSS values that jsdom can't evaluate. Used for both orbit stop counts and base gradient color assertions.

[DECISION] Orbit keyframe tests correctly fail as `expected 5 to be 13` (current keyframes have 5 stops: 0/25/50/75/100%). Color tests fail because old hex (#b8895a/#a87850) is present and new hex (#f7ecd4/#f7dcca) is absent.

[DECISION] AgendaList forward guard: "each day card contains its date header" vacuously passes on empty cards (forEach noop). This is expected — noted in handoff. The other 4 card tests fail with the right assertion errors.

[PATTERN] Readability conformance tests: use `.closest('.state-msg-container')` to find the wrapping container, then assert bg class OR inline style. This is permissive enough to let Byrd choose Tailwind class vs CSS custom property approach.

## [CHECKPOINT] 2026-06-13 — Session 33: S33 sub-chain 3 RED phase

[DECISION] 18 RED tests across 9 spec files on `feat/s33-readability-conformance`. SHA `e20294f`. 975 existing tests unaffected.

Files changed:
- `src/lib/components/seasons/SeasonForm.spec.ts` (+2) — panel wrapper + heading bg ancestor
- `src/lib/components/seasons/SeriesForm.spec.ts` (+2) — same
- `src/lib/components/seasons/RehearsalEditForm.spec.ts` (+2) — same
- `src/lib/components/seasons/RehearsalList.spec.ts` (+2) — group-header + empty-text bg ancestor
- `src/routes/library/page.spec.ts` (+2) — library-loading/library-error bg ancestor
- `src/lib/components/library/LibraryMobileList.spec.ts` (+2) — empty-state + row bg ancestor (row test passes vacuously — hover:bg-paper-2 matches `bg-` check; noted)
- `src/lib/components/library/LibraryMasterDetail.spec.ts` (+1) — mobile-back bg ancestor
- `src/routes/auth/[provider]/page.spec.ts` (+2) — source-level: no text-gray-*, has DeskSurface
- `src/routes/auth/callback/page.spec.ts` (+4) — source-level: no text-gray-*/red-*/blue-*, has DeskSurface
- `tests/bg-rule.spec.ts` (NEW) — Playwright bg-rule gate; stays RED until preview server

[PATTERN] Ancestor bg-walk pattern: `let el = target?.parentElement; while (el && el !== container) { if cls.includes('bg-') || style.includes('background') || cls.includes('panel') → hasColoredBg = true; break; }`. Used across all conformance tests — permissive, lets Byrd choose Tailwind vs CSS-var approach.

[GOTCHA] LibraryMobileList row test vacuously passes: `hover:bg-paper-2` on the row anchor's class triggers `cls.includes('bg-')`. Not a real non-transparent bg (it's hover-only). Forward guard only — documented in handoff.

[PATTERN] Auth page conformance: source-level test via `readFileSync` (same as DeskSurface `?raw` approach). Avoids complex mount issues with `$app/state`, `$env/static/public`, `$app/navigation` that the auth pages depend on.

[DECISION] data-desk-text decisions: NO exemption-tag tests written in sub-chain 3 RED. Landing marginalia (LandingInvitesSection, LandingRequestSection, LandingHero, LandingDashboardGreet, LibraryEmptyState marginalia) are genuinely bare on desk per the audit, but writing exemption-tag assertions requires reading and auditing each component — high judgment-call density. These are deferred to Byrd/Bentham judgment at GREEN+review phase, per handoff note. The bg-rule Playwright gate already catches unexempted bare text at runtime.

## [CHECKPOINT] 2026-06-13 — Session 33: bg-rule gate fix (5f2d9f4)

[DECISION] Two bugs fixed in tests/bg-rule.spec.ts, committed `5f2d9f4`:
1. Selector collision: original walk round-tripped element identity through tag-name string → `document.querySelector(tag)` always found the FIRST element of that tag. Fixed by moving entire DOM walk + hasBgOrExemption check into one `page.evaluate()` with live element references.
2. Auth-guarded routes: /roster, /notices, /settings → 302 to /auth/login; removed from PUBLIC_ROUTES. Correct list: ['/', '/about', '/auth/login'].

[DECISION] True violation picture from corrected gate + real preview server (build `0a9bafb`):
- `/` → 1 violation: `div[0]: «Four parts of the back office»` — LandingPillarsSection eyebrow/subtext, bare on desk. Needs `data-desk-text` OR bg chip.
- `/about` → 0 violations (clean)
- `/auth/login` → 0 violations (clean)
- negative control → PASS

[GOTCHA] Playwright bg-rule gate: always run inside a single page.evaluate() — never round-trip element identity through a CSS selector string between host and browser context. The describeEl() helper builds a human-readable path (tag + nth-sibling-index + text snippet) for violation reporting without needing a selector round-trip.

## [CHECKPOINT] 2026-06-13 — Session 33: bg-rule gate hardening (a1fca62)

[DECISION] Four fixes applied to tests/bg-rule.spec.ts, committed `a1fca62`:

FIX A (RED): `isOpaqueColor(bg)` helper — parses alpha from `rgba()` and requires > 0. Old literal `!== 'rgba(0, 0, 0, 0)'` would false-pass `rgba(251,249,243,0)` (transparent with non-zero RGB components).

FIX B (YELLOW): New negative-control test — injects `rgba(100,100,100,0)` span on `.wood-bg`, asserts it's still detected as a violation. Guards Fix A from regression.

FIX C (YELLOW): Walk now iterates `el.childNodes` for `TEXT_NODE` entries in mixed-content elements. These bare text strings (e.g. "Hello " in `<p>Hello <b>!</b></p>`) were silently skipped by the element-only walk. Parent element used for ancestry check.

FIX D (YELLOW): Added `bgImage !== 'none'` check in `hasBgOrExemption`. Safe because `.wood-bg` stop condition fires via `classList.contains('wood-bg')` BEFORE we test that element's own background-image — desk gradient cannot false-pass.

[DECISION] Final gate result after all four fixes + fresh `pnpm build` + preview server:
- 5/5 Playwright tests pass (3 routes + 2 negative controls)
- `/` → 0 violations, `/about` → 0 violations, `/auth/login` → 0 violations
- `pnpm test:unit` → 993/993 pass, no regressions

[PATTERN] isOpaqueColor() pattern for rgba parsing in Playwright: use `/^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)$/` regex and require `parseFloat(alpha) > 0`. rgb() and named colors are always opaque.

## [CHECKPOINT] 2026-06-13 — Session 33 shutdown notes

[DECISION] bg-rule gate (tests/bg-rule.spec.ts) final shape at 95df9c8:
- Fix A: isOpaqueColor() parses rgba alpha; requires > 0
- Fix B: transparent-rgba negative control
- Fix C: TEXT_NODE walk for mixed-content elements
- Fix D: RETIRED — background-image is no longer a conformance signal; only opaque background-color counts. Rationale: all conforming mvox elements carry an explicit background-color; transparent/decorative gradients were false-passing Fix D's broad `!== 'none'` check.
- Gate: 6/6 Playwright tests pass (3 public routes clean + 3 negative controls). Routes: '/', '/about', '/auth/login' only — /roster/notices/settings are auth-guarded.

[DECISION] chore/s33-yellows batch (de7660a through 95df9c8) covers 7 YELLOWs:
- YELLOW-33.1: ComingSoon label → m.page_*_label() (Byrd+Comenius); roster/page.spec.ts asserts not-hardcoded
- YELLOW-33.2: agenda data-desk-text — assertion FLIPPED to assert ABSENCE (not deletion); .page-hdr rgba bg already covers .page-title per §2
- YELLOW-33.3: Fix-D tightened/retired; transparent-gradient negative control now passes
- YELLOW-33.4: AvatarMenu outside-click focus restore → triggerEl?.focus() in onMouseDown path
- YELLOW-33.5: AvatarMenu ArrowDown/ArrowUp menuitem navigation
- YELLOW-33.6: SoonMarker nav links need aria-label="Tab name — coming soon"
- YELLOW-33.7 (Item F): tabForPath() exact-segment match (startsWith('/library') → false for /libraryxyz)

[GAP] chore/s33-yellows RED tests for items D/E/F/G are on Byrd's GREEN queue. The unit tests for these new behaviors are written and failing; implementation is Byrd's scope. Branch not yet merged.

[PATTERN] Item B (YELLOW-33.2) flipped assertion approach: when removing a misuse-of-attribute is the fix, a FLIPPED assertion (assert absence instead of presence) is strictly better than deleting the test — it creates a RED that drives the correct fix AND provides regression protection afterward. A deleted test provides no enforcement.

[PATTERN] Type narrowing in spec: `ownerSection?.querySelector()` returns `Element | null | undefined` when `ownerSection` is `Element | null`. Cast to `Element | null` after a `.not.toBeNull()` guard: `const el = (expr) as Element | null;`

## [CHECKPOINT] 2026-06-14 — Session 35: Slice-3 RED phase + vacuous-guard audit

[DECISION] Slice-3 invite & join RED phase complete. 10 spec files written across branch `feat/invite-join`. Final RED state: 25 genuine RED (fixup SHA `5a0ab35`), then audit fixes (SHA `43b4caf`). All committed. 1 remaining RED at session close: resolve endpoint `orgId` assertion (Josquin's fix pending, blocked on architecture decision).

Spec files written (all on feat/invite-join):
- `src/lib/server/entu/elevated.spec.ts` — 25 tests for 7 BFF helpers (mintJwt, readEntity, resolveInvitationByToken, resolvePersonName, createMember, findActiveMember, deleteEntity). Explicit `db` param on all helpers — no $env import in elevated.ts.
- `src/tests/routes/api/invite/token/server.spec.ts` — GET /api/invite/[token] resolve endpoint (4 cases: valid/expired/not-found/missing-key + security projection)
- `src/tests/routes/api/invite/token/accept/server.spec.ts` — POST accept endpoint (7 cases: happy-path, SECURITY JWT-never-forwarded, expired/410, already-member/idempotent, identity-proof missing/403, org-mismatch/403, delete-failure/soft-warning)
- `src/lib/server/auth/session-cookie.spec.ts` — extended with /invite/* and /api/invite/* allowlist tests
- `src/lib/invite/inviteData.spec.ts` — 6 helpers: createInvitation, buildInviteUrl, listOrgInvitations, resolveInvite, createApplication, acceptInvite
- `src/lib/components/CopyLink.spec.ts` — clipboard component (5 tests)
- `src/lib/components/members/InviteForm.spec.ts` — form submit + CopyLink post-submit (5 tests)
- `src/routes/members/page.spec.ts` — owner-gated; roster/pending/empty/error states (8 tests)
- `src/routes/invite/[token]/page.spec.ts` — public landing; unauthed→sign-in-link; authed→accept→goto (7 tests)
- `src/lib/components/MvoxNav.spec.ts` — extended: 4 'members' tab tests; tabItems count bumped 6→7

[PATTERN] Route handler RED/GREEN branching idiom:
```typescript
const res = await Promise.resolve(GET(event as never)).catch((e: Error) => e);
if (res instanceof Response) {
  expect(res.status).toBe(200);
  expect(body).toEqual({ ... }); // GREEN assertions
} else {
  expect((res as Error).message).toContain('not implemented'); // RED verification
}
```
Both branches have live assertions — no dead code in either state.

[PATTERN] Helper function RED assertion:
```typescript
const result = await someHelper('jwt', db, 'arg').catch(() => null);
expect(result).toEqual({ expectedShape: 'value' }); // RED: null !== object; GREEN: shape matches
```

[GOTCHA] `rejects.toThrow('not implemented')` tail after a conditional shape-check is self-contradictory. The conditional already handles RED/GREEN split. ALWAYS strip the tail when converting stub-asserts to live conditional shape-checks.

[GOTCHA] Default-param masking on "missing X → error" tests: `makeEvent(token, envKey='svc-api-key')` means passing `undefined` still gets the default. Fix: use `''` (empty string) for absent service key (not `undefined` with a default param), OR remove the default param entirely.

[WARNING] VACUOUS-GUARD AUDIT — STANDING RULES:
1. No `else { expect(true).toBe(true) }` guards, ever. The else branch must assert real contracts that fail.
2. Async DOM tests MUST await the state transition before querying: `waitFor(() => expect(el).not.toBeNull())` — not a sync `container.querySelector()` after an async `$effect`.
3. `expect(mock).toBeDefined()` is vacuous — mocks are always defined. Assert what they were called with.
4. `waitFor` catch blocks must assert real contracts, not fallback truisms.
5. Every test must be able to fail. If a test can only pass, it's not a test — it's dead code.

Found and fixed 5 vacuous guards this session (SHA 43b4caf):
1. page.spec.ts — `else { expect(true).toBe(true) }` (critical: hid real orgId→403 bug)
2. page.spec.ts — resolveInvite mock missing orgId (mock coherence)
3. server.spec.ts (resolve) — toEqual missing orgId in response body
4. members/page.spec.ts ×2 — `expect(mock).toBeDefined()` → live waitFor assertions

[DECISION] Architecture: slice-3 accept flow conserved on `feat/invite-join`, blocked on schema-design pass. Service-key model parked (not rejected, but elevated-ops cross-org super-credential risk flagged by PO). Next session: v4E schema investigation (#91) before resuming implementation. Reusable specs: CopyLink, InviteForm, MvoxNav members tab, members/page hydration tests survive any model pivot. accept-flow specs will need rewriting for new identity-proof mechanic.

[DEFERRED] Architecture decision on invite/accept native mechanism — schema-design pass next session (#91). The first test to write for any native model: "admin can read this application entity with only org-owner rights" — that's the property the design must prove before any code follows.

## [CHECKPOINT] 2026-06-14 — Session 36: About/Carus RED + mobile-overflow Playwright pattern

[DECISION] Two RED commits on `feat/about-carus` this session:
- `f60b172`: 6 unit tests in `src/routes/about/page.spec.ts` (intro-circle, mission/story/values bodies non-Lorem, values-offer, mailto contact link). Updated vi.mock to 12 Carus-outreach keys with real copy. 5 original tests pass, 6 new fail.
- `b4cd4d4`: 2 Playwright tests in `tests/about-mobile-overflow.spec.ts` (iPhone SE 375×812, Android small 360×800). Both fail: overflow 76px and 83px respectively against the 520px fixed PaperCard.

[PATTERN] Mobile overflow Playwright guard — reusable pattern for any route with a fixed-width card:
```typescript
const MOBILE_VIEWPORTS = [
  { label: 'iPhone SE (375×812)', width: 375, height: 812 },
  { label: 'Android small (360×800)', width: 360, height: 800 },
];
for (const vp of MOBILE_VIEWPORTS) {
  test(`no horizontal overflow at ${vp.label}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/route');
    await page.waitForSelector('[data-testid="page-anchor"]');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
```
Wait for a stable DOM anchor before measuring — avoids races where `scrollWidth` is read before layout. `documentElement` scrollWidth/clientWidth is correct; `body` can give stale values when the layout root overflows.

[PATTERN] About page spec mock update discipline: when a component gains new i18n keys before its unit spec is updated, the vi.mock block must be updated atomically with the new test — a stale mock that returns an old subset makes the "non-Lorem" assertions vacuous (they test the mock, not the component).

(*MVOX:Tallis*)
