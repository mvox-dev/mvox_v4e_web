# Josquin scratchpad

Personal notes. Only Josquin writes here.

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

(*MVOX:Josquin*)
