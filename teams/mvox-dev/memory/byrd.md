# Byrd scratchpad

## [CHECKPOINT] 2026-05-20 — CHORE-2 GREEN complete

[LEARNED] Tailwind v4 uses OKLCH color space for its palette. Chromium reports colors as `oklch(...)` not `rgb(...)`. Tallis's original test had `rgb(59, 130, 246)` for `text-blue-500` — he corrected it to `oklch(0.623 0.214 259.815)` at commit `2674068`. Future color assertions in Playwright must use OKLCH values.

[LEARNED] Playwright config uses `pnpm preview` (not dev server). Tests run against a built artifact. Must run `pnpm build` before `pnpm exec playwright test` when changes are unstaged/uncommitted, otherwise stale build is served.

[LEARNED] Tailwind v4 CSS-first setup: `@import "tailwindcss"` in `src/app.css`, `@tailwindcss/vite` in `vite.config.ts` plugins — no `tailwind.config.js`. Plugin order: tailwindcss before sveltekit.

[DEFERRED] CHORE-2 is pending Bentham review (GREEN handed off, branch `feat/chore-2-tailwind-v4` HEAD `ff37268`). After Bentham GREEN, Josquin merges.

## [CHECKPOINT] 2026-05-21 — CHORE-3 GREEN complete (session 11)

[LEARNED] `@inlang/paraglide-sveltekit@0.16.1` is deprecated (use paraglide-js v2 directly) but the team is using it per the AC spec. Vite plugin import: `@inlang/paraglide-sveltekit/vite`, call: `paraglide({ project: './project.inlang', outdir: './src/lib/paraglide' })`. Plugin added between tailwindcss() and sveltekit() in vite.config.ts.

[LEARNED] `project.inlang/settings.json` needs: `$schema`, `sourceLanguageTag`, `languageTags`, `modules` (CDN URLs for message-format + m-function-matcher plugins), and `"plugin.inlang.messageFormat": { "pathPattern": "./messages/{languageTag}.json" }`. Build also auto-generates `project.inlang/project_id` and `project.inlang/.gitignore` (ignores `cache/`) — both should be committed.

[LEARNED] Paraglide only compiles when locale files have actual keys. Empty `{}` files → "No messages found - Skipping compilation" → `src/lib/paraglide/` not generated. Expected — Comenius adds keys in i18n phase.

[LEARNED] vitest.config.ts merge pattern: bare `vitest/config` has no Svelte transform. When a spec does `import('@inlang/paraglide-sveltekit')` it pulls in `ParaglideJS.svelte` and throws `Unknown file extension ".svelte"`. Fix: `mergeConfig(viteConfig, defineConfig({test:{...}}))` from `vitest/config` — picks up `sveltekit()` and all Vite plugins. This is the standard SvelteKit+Vitest pattern.

[DEFERRED] CHORE-3 handed off to Comenius for i18n phase (add starter message keys). Branch `feat/chore-3-paraglide` HEAD `df4b9b2`. Bentham review pending after Comenius completes.

## [CHECKPOINT] 2026-05-22 — CHORE-35 GREEN complete (session 13)

[LEARNED] Playwright `page.route()` intercepts BROWSER-level fetches only. SvelteKit's `event.fetch` in `+page.server.ts` goes through SvelteKit's internal router (not a real HTTP call), so `page.route()` cannot intercept it. Client-side `$effect` + `fetch()` in `+page.svelte` IS interceptable. This is a fundamental mismatch between Tallis's SSR-presence test design and the server-side fetch architecture.

[LEARNED] `+page.server.ts` client-side orgs were NOT rendered in the template; instead `+page.svelte` uses `$effect` to do its own browser-side fetch of `/api/organizations`. Server load handles session; template handles orgs client-side. Vitest tests pin server load behavior (all pass); Playwright intercepted the browser fetch (17/18 pass).

[DEFERRED] SSR test ("page data is SSR-present in initial HTML") remains RED — needs architectural decision: (a) Tallis adjusts the test, or (b) test env gets a mock Entu surface. If (b) lands, refactor `+page.svelte` to seed `orgs`/`loadError`/`loaded` from `data.*` and drop mount flicker; `$effect` browser fetch stays only for retry. Branch HEAD `461ff4d`. Comenius up next for i18n (all 10 keys have en stubs in messages/*.json).

[GOTCHA] Paraglide does NOT regenerate `src/lib/paraglide/messages.js` during `pnpm check` (only svelte-kit sync runs). Must run `pnpm build` (or `pnpm dev`) to trigger Paraglide compilation after adding new message keys. Empty message files → "No messages found — Skipping compilation" → type errors in svelte files.

## [CHECKPOINT] 2026-05-23 — CHORE-A session 16 + chain-discipline coaching

[LEARNED] **Chain discipline — spec authorship is Tallis's, always.** Even when a plan ships inline test code, I must wait for Tallis's RED commit SHA before starting GREEN. Writing the spec myself (as I did for wrapper.spec.ts and client.spec.ts in the first pass) breaks attribution and sets a bad precedent for CHORE-B. In CHORE-B wait for the brief that includes a commit SHA before touching any implementation file.

[LEARNED] **PR creation is Josquin's authority.** When my GREEN work is the final code change on a branch, I report completion to Palestrina and stop. Palestrina dispatches Josquin for the PR. I do not run `gh pr create` regardless of how complete the work is.

[LEARNED] **Scope discipline — one brief, one task.** If a brief assigns A3 GREEN, do only A3 GREEN. Do not proactively reach into A4 or A5 even if the plan is in front of me and the impl is obvious.

[LEARNED] `$lib` alias does NOT resolve in the vitest runner (uses `vitest/config`, not SvelteKit's vite config). Route files must use relative imports (`'../../../lib/entu/client.ts'`) not `$lib/entu/client`. The `$env/dynamic/private` alias works only because it's globally mocked in `src/tests/setup.ts`.

[LEARNED] Vitest `environmentMatchGlobs` is deprecated in v3. Use `@vitest-environment happy-dom` inline comment at the top of the spec file instead — Tallis already does this.

[LEARNED] `new Response(JSON.stringify(...), { status: 200 })` in happy-dom does NOT auto-set `content-type: application/json`. Tallis's revised spec (dcc5971) fixed this by explicitly passing `headers: { 'content-type': 'application/json' }` in the mock Response constructor, so the plan's verbatim implementation (content-type check) works correctly with his spec.

(*MVOX:Byrd*)
