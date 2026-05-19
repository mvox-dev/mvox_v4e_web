---
name: bentham-scratchpad
description: Bentham's personal notes — review calibration and open items for mvox-dev
metadata:
  type: project
---

# Bentham scratchpad

## 2026-05-18 — Session 2: stack landed, calibration reset

[DECISION] Stack confirmed (see `common-prompt.md` Stack table and `architecture-decisions.md` "Stack" entry): SvelteKit 2 + Svelte 5 Runes + Tailwind v4 + Paraglide (en/et/lv/uk) + Cloudflare Pages/Workers via `@sveltejs/adapter-cloudflare`, Entu API backend (no own DB), Entu OAuth + httpOnly JWT cookie BFF, pnpm (no workspaces), flat single-app layout. Every row in the table is now an enforceable RED trigger when violated.

[DECISION] **Repo layout is flat single-app**, NOT monorepo. `src/lib/`, `src/routes/`, `src/lib/server/`. No `apps/` or `packages/`.

[DECISION] **Flag #4 CLOSED.** v4E schema-mutation gate adopted as Option A (trailers on the mvox PR). PO confirmed verbal-in-session approval is acceptable evidence as long as team-lead logs it with timestamp. Rule lives in `common-prompt.md` (Known Pitfalls / v4E Schema Mutations) and `architecture-decisions.md`. My job: RED any mvox PR that touches v4E entity types/properties/formulas/rights defaults without both trailers.

[PATTERN] **Security-critical paths now concrete** (per updated prompt): `src/lib/server/entu/`, `src/lib/server/auth/`, `src/hooks.server.ts`, `src/routes/api/**`, `src/routes/**/+server.ts`, `src/routes/**/+page.server.ts`. Old polyphony shapes (`apps/vault/`, `apps/registry/`, `packages/shared/crypto/`) are dead — purge from mind.

[PATTERN] **v4E RED triggers** distilled from case study (Sections B, D) — encoded in my prompt "What to Watch For / v4E / Entu":
  1. Multi-hop formulas (anything beyond single hop or `_parent`) — silently absent → RED
  2. `type: reference` on formula property — silently coerces to string → RED (declare as `type: string`)
  3. Formula projecting raw values across rights boundaries (CONCAT names, descriptions) — leak; only aggregates (COUNT/SUM/AVG/MIN/MAX) are safe across boundaries → RED
  4. New BFF route running in elevated mode without entry on the enumerated elevated-ops list → RED
  5. Granting `_owner`/`_editor`/`_viewer` on org-subtree entity without active `member` for that person in that org → RED
  6. Direct calls to `https://entu.app` from client code → RED (all calls go through BFF)
  7. Splitting/flipping a `_inheritrights: false` boundary without a v4E schema change → RED (rights islands are load-bearing)

[PATTERN] **Per-value `_sharing` warning DROPPED** per PO calibration. Don't add it to the checklist; PO judged it not worth the context space. Single-hop formula rule + the seven above stay.

[PATTERN] Elevated-ops list in `architecture-decisions.md` is seeded EMPTY. Don't auto-inherit polyphony's list (cron cleanup, federation reports, email self-link); evaluate per op as they emerge. New entries require team-lead approval.

## Open items I'm watching

[DEFERRED] First BFF-touching PR (CHORE-5 Entu skeleton) is the next real calibration test for the security-critical-paths rules. Watch for: missing `httpOnly`/`Secure`/`SameSite` on the JWT cookie, missing CSRF protection on POST endpoints, client-side env vars leaking secrets via `$env/dynamic/public`, and unsafe URL composition in BFF passthrough.

## 2026-05-19 — CHORE-1 review (issue #1, branch `feat/1-bootstrap`)

[DECISION] **Verdict: GREEN** (after hook commit `4489d83` landed; corrected from initial YELLOW). Stack-table conformance clean: SvelteKit 2 + Svelte 5 runes forced on, `@sveltejs/adapter-cloudflare`, TS strict, pnpm, flat layout (`src/lib/`, `src/routes/`, no `apps/`/`packages/`), no D1/R2/KV/DO bindings, wrangler names `multivox`. TDD ordering verified: RED `bc2a44a` (23:54) < GREEN `db3c224` (00:04). No legacy `export let` / `$:` anywhere. No security boundary touched (correct — that's CHORE-5 scope). Hook commit `4489d83` adds `.githooks/prepare-commit-msg` + `scripts/install-hooks.sh` + `prepare`-script reference ATOMICALLY (3-file diff). Trailer self-applied on its own message.

[GOTCHA-CORRECTION] My first-pass review flagged the `prepare` script as referencing the uncommitted `scripts/install-hooks.sh` in `db3c224`. **That was wrong.** I read `package.json` from the working tree (post-WIP untracked state) instead of from the actual commit. `db3c224`'s `prepare` was `"svelte-kit sync || echo ''"` — self-contained, no broken reference. `4489d83` added the script AND the script reference atomically. **Pattern for future per-commit reviews: never trust the worktree state; always read source via `git show <sha>:<path>`.** Untracked WIP shadows the commit content invisibly.

[PATTERN] **Test-flake hygiene** — Tallis correctly moved the build-output assertion out of Playwright into Vitest (`0844aa2`) to avoid racing the preview server. Encode for future: build-output / static-config assertions belong in Vitest; only assertions requiring a live SvelteKit server belong in Playwright. (Sidenote: `webServer.command` is now in `playwright.config.ts`, so the Playwright suite self-hosts — Tallis's scratchpad still says "intentionally omits webServer". Flag next session, not a blocker.)

[PATTERN] **First-PR calibration precedent set:** GREEN end-state. Small precedent-setting non-blockers raised once so they don't recur: README still SvelteKit template (followup), no `packageManager` field pinning pnpm version (followup), author identity carryover (accepted). None RED-worthy.

[PATTERN] **Author identity / co-author trailer carryover** flagged by team-lead and accepted as cosmetic. Logging here so I don't re-flag: pre-`db3c224` commits won't carry `Co-authored-by: Mihkel Putrinš <mihkel.putrinsh@gmail.com>` — accepted state, don't RED. Post-hook-install: missing trailer on a new commit is YELLOW (mechanical) unless deliberate, then RED.

[DEFERRED] Stack-table column "Testing: Vitest + Playwright" is enforced from this PR forward. Any future PR that bypasses Vitest for static config assertions (e.g., shell scripts in CI doing JSON parsing) → YELLOW with note to colocate as `*.spec.ts`.

(*MVOX:Bentham*)
