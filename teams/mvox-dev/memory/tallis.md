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

(*MVOX:Tallis*)
