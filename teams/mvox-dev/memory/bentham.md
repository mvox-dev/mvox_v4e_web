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

## 2026-05-19 — PR #26 review (Phase A migration, branch `feat/phase-a-migration`)

[DECISION] **Verdict: GREEN with 1 YELLOW** for partial-failure recovery on new-type creation. All scope/translation cross-checks against divergence doc §4.1, §4.2, §5 passed verbatim (9 new types with 44 inline props + 35 §4.2 adds = 79 wouldAdds). TDD ordering verified for every test'd module. Schema-Change trailer correctly not required (script consumes v4E + writes to polyphony db; no schema mutation in entu/research). Dry-run safety solid (executor early-returns before any mutation when `dryRun: true`).

[PATTERN] **Migration script anti-pattern: scope-filter blind spot on partial new-type creation.** In `diff.ts:53`, `isInPhaseAScope(typeName, propName)` is applied unconditionally to all props on existing types. The §4.2 scope map only covers existing-types' incremental adds — it does NOT include the inline props of §4.1 new types. **Failure mode:** if execution interrupts after `createEntity` for a new type succeeds but before all its inline props complete, re-run sees that type as "existing," applies scope filter, returns `false` for the missing inline props → silently skips them. Type is left half-populated; no auto-heal.

**Why this matters for Phases B/C/D:** Same pattern will recur. Every phase has a "new entities + new properties on existing entities" duality. Any future phase script that uses a hardcoded scope map (like `PHASE_A_PROPERTY_ADDITIONS`) must either (a) bypass the scope filter for partially-created new-type instances, or (b) treat new-type inline props as separate ops with their own scope entries. Defensive fix is small (~3 lines: a `PHASE_X_NEW_TYPES` set + a `!isPhaseXNewType` guard before the scope check in the existing-types branch).

**Future review check:** for any Phase B/C/D migration PR, verify the scope filter handles partial-new-type-creation OR that the spec explicitly says "abort-and-manually-recover is acceptable" with PO sign-off.

[PATTERN] **GREEN-without-RED for runtime-only fixes is acceptable when the fix is observably-correct against the live oracle.** The final `a73f273` commit (fetchDbState filter drop + ESM __dirname) had no preceding Tallis RED because the existing test suite mocks fetch and never invokes `main()`. The fix was validated against the live polyphony db (the dry-run output now matches divergence §4.1+§4.2 exactly). I accepted this — but flagged a test-gap for Tallis to colocate a `fetchDbState` query-shape assertion (mocked listEntities + assert no `_parent.reference` in the query). Encode for future: runtime-only mock-bypassing fixes are OK to land on the live oracle's testimony, but they generate a test-gap entry not a RED.

[PATTERN] **Error-message info-leak surface in migration scripts.** `entu-client.ts` throws `Error(\`{verb} failed: ${status} ${await res.text()}\`)` and `executor.ts` captures `err.message` into `result.failed[].error`, which then lands in the committed report files. Not actionable now (no evidence Entu echoes JWTs in error bodies), but if a future Entu API version starts including auth context in error responses, this would leak into git history. For future review: any migration script that captures Entu error bodies into persisted reports should sanitize JWT-bearing substrings.

## 2026-05-20 — PR #27 review (Phase A partial-failure recovery, branch `fix/phase-a-partial-failure-recovery`)

[DECISION] **Verdict: GREEN, no YELLOW.** YELLOW #1 from PR #26 closed exactly as proposed: `PHASE_A_NEW_TYPES` Set + `isPhaseANewType` helper in `phase-a-scope.ts`; `bypassScope = isPhaseANewType(v4eType.name)` evaluated once per existing type in `diff.ts:48-52`, then `if (!bypassScope && !isInPhaseAScope(...)) continue`. Atomic per-type, evaluated AFTER the `existingProps.has` short-circuit. §4.1 and §4.2 name sets are disjoint — no interaction risk. Steady-state behavior on clean db unchanged (Josquin confirmed by live dry-run). TDD ordering: Tallis RED `e4d70a4` → Josquin GREEN `021f1f5`. PR comment: https://github.com/mvox-dev/mvox_v4e_web/pull/27#issuecomment-4494285324

[PATTERN] **Pattern carrying forward to Phases B/C/D:** the `PHASE_X_NEW_TYPES + bypassScope` shape is now the precedent for any phase that mixes new-type creation with hardcoded scope filtering. When reviewing Phase B/C/D migration PRs, check that the same recovery path is implemented (or that the spec explicitly accepts manual recovery with PO sign-off). The 4-line cost of the fix is tiny relative to the operational confidence gained.

[LEARNED] **YELLOW-to-followup-PR cycle works well at this team's cadence.** Bentham raises YELLOW on PR #26 → Tallis writes RED on follow-up branch → Josquin implements GREEN → Bentham reviews follow-up PR. Total elapsed time PR-#26-merge to PR-#27-GREEN: ~5 hours. The pattern keeps individual PRs scoped tight (each one ≤4 files / ≤80 line diff) and gives PO a clear gate per defensive enhancement. Encourage this rather than batching defensive fixes into a single large PR.

[CHECKPOINT] **End of session 6.** Phase A migration is complete:
- PR #26 (migration script) — merged 2026-05-19
- PR #27 (partial-failure recovery) — GREEN as of 2026-05-20 03:40, pending squash-merge by Josquin
- Phase A live execution (Task 10) — pending PO greenlight, blocked behind PR #27 merge
- Three carryforward YELLOWs from PR #26 still open: (a) fetchDbState query-shape unit test (test-gap for Tallis); (b) schema-loader.spec.ts tmp-file hygiene in fixturesDir (write to `os.tmpdir()` if touched); (c) error-message info-leak via Entu error bodies in committed reports (no action needed unless Entu starts echoing auth context). None blocking Phase A live execution.

[DEFERRED] **Session 7 focus expected:** Phase B (renames + data backfill) design. Phase B is significantly higher-risk than Phase A — first phase touching live data instances, first phase needing backup strategy (per design spec §"Out of scope"). My review posture for Phase B will need to add: (i) data-loss risk checklist (backup taken before run; instances of renamed-type-prop properly migrated; old prop deleted only after migration verified); (ii) re-affirm the `PHASE_X_NEW_TYPES + bypassScope` precedent from PR #27 if any new types are introduced; (iii) per-instance idempotency story (Phase A idempotency was at the type/prop-definition level; Phase B will need per-instance idempotency because renames touch data).

(*MVOX:Bentham*)
