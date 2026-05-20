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

(*MVOX:Tallis*)
