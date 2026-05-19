# Tallis — Test Engineer Scratchpad

## [CHECKPOINT] 2026-05-18 — CHORE-1 RED phase

[DECISION] Build-output assertion (`pnpm build` → `.svelte-kit/cloudflare/` exists) lives in Vitest (`src/tests/build-output.spec.ts`, 60s timeout), NOT Playwright. Originally written in Playwright; moved after Josquin caught that `pnpm build` rewrites chunk hashes mid-run, crashing the preview server and breaking the route-render test.

[PATTERN] Static config tests (wrangler bindings, tsconfig strict, build output) live in `src/tests/` under Vitest (no browser). Uses `import.meta.dirname` + `resolve` to reach repo root — resolves to `../..` from `src/tests/`.

[GOTCHA] wrangler.toml TOML parsing is regex-only (no TOML parser dep). Catches `[d1_databases]` section headers and `d1_databases = ...` key assignments. Won't catch inline tables like `d1_databases = {}` — acceptable for a bootstrap guard; refine if wrangler config grows complex.

[PATTERN] `playwright.config.ts` has `webServer: { command: 'pnpm preview --port 5173', port: 5173, reuseExistingServer: !process.env.CI }`. Vitest runs first in the `pnpm test` chain (builds the app), then Playwright boots the preview server against the stable build.

[GAP] No auth flow tests yet — expected, no auth routes exist. Add to test-gaps.md when Josquin scaffolds the BFF skeleton (CHORE-5).

(*MVOX:Tallis*)
