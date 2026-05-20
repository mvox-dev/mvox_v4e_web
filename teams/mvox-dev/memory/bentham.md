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

## 2026-05-20 — CHORE-5 review (issue #5, branch `feat/chore-5-bff-skeleton`)

[DECISION] **Verdict: YELLOW** — two YELLOW items, neither blocking. Implementation is functionally correct; TDD ordering clean. RED commits `ce96e33`/`f13cf28`/`535c24c` (04:08 UTC) all precede GREEN commits `cce3703`/`1931c2c`/`0f34db8`/`d6663df` (04:11 UTC). No legacy `export let` / `$:`. Server-only code correctly under `src/lib/server/`. No client-side `entu.app` calls or `$env/dynamic/public` leakage. Cookie attributes correct: `httpOnly: true`, `secure: true`, `sameSite: 'lax'`, `maxAge: 48*3600`, `path: '/'`. 401 short-circuit on missing Authorization header. No v4E schema mutation in diff — Schema-Change trailer correctly not required. No elevated-ops introduced (BFF correctly forwards user JWT — matches `architecture-decisions.md` "BFF user-rights default").

[YELLOW-1] **CSRF posture on `POST /auth` is "implicit-by-api-key".** The handler requires `Authorization: Bearer <api-key>` and returns 401 otherwise. That's effectively CSRF-safe today because a same-origin malicious page can't read the user's API key out of nothing (no cookie holds it). However: once cookie-authed endpoints exist, `POST` with JSON body bypasses SvelteKit's default form-CSRF check. Flag for next-PR review: when the first cookie-authed POST/PUT/DELETE lands, demand explicit Origin check or token-pair CSRF.

[YELLOW-2] **`DEFAULT_BASE_URL = 'https://entu.app/api/'` duplicated** in `client.ts:1` and `+server.ts:4`. Two sources of truth; drift risk later. Lift to `src/lib/server/entu/config.ts` (or similar). Cosmetic 4-line followup — does not block merge.

[NOTE-on-Josquin's-notes] Josquin flagged that `setProperty` (POST /property with `{ entity, type, string }`) and `GET /auth` with Bearer may need adjustment when we have a live integration test. Both shapes align with the polyphony migration script (`scripts/migrations/lib/entu-client.ts`) — so not blind guesses, but unverified by integration test in this PR. Acceptable as scaffolding; first BFF route that exercises EntuClient against live db is the real calibration moment.

[PATTERN] **`process.env` direct read in server-only modules** is the chosen convention here (not `$env/dynamic/private`). Works in Node and CF Workers (where bindings are injected as env). Encode for future: server modules under `src/lib/server/` may use `process.env` directly. Client-side modules must NOT — but the file-location boundary makes this a soft RED only if it ever leaks.

[CHECKPOINT] Reviewed scope of CHORE-5: 4 production files (~110 lines net), 3 test files (~377 lines), 19 tests passing. `pnpm check` clean (per Josquin). Author identity carryover (Palestrina commits) — accepted per `2026-05-19 — CHORE-1 review` policy.

## 2026-05-20 — Phase B v1 review (branch `feat/phase-b-migration`)

[DECISION] **Verdict: RED — 4 blockers.** Phase B v1 (Josquin's `67e4b92`) had 4 RED items: (1) `runPhaseB` never called `executePhaseBOps` in live mode — dispatcher was dead code from CLI; (2) `fetchTypesOnly` returned empty `propertyNames: []`, causing all §1 source-prop checks and §3/§4/§5 ops to short-circuit; (3) integration spec asserted against static `PHASE_B_*` constants instead of computed diff (vacuous tests); (4) snapshotter returned list-endpoint stubs, not full per-entity payloads — backup unrecoverable. Plus YELLOW-1: `parent_copy` read from same instance, not parent.

[PATTERN] **Worktree-contamination self-incident** (logged here as [GOTCHA-CORRECTION-2]): During this review, ran `git checkout f19f798 -- scripts/migrations/ docs/` while cwd was `feat/chore-2-tailwind-v4` (Byrd's WIP). Materialized Phase B v2 files onto Byrd's branch index. Cleanup: `git checkout HEAD --` on 4 tracked files + `rm` of 11 untracked files I introduced. **Rule for future cross-branch reviews:** never `git checkout <sha> -- <paths>` for a review on a non-target branch; always use `git show <sha>:<path>` for read-only inspection. Same rule as session-1 [GOTCHA] — "never trust the worktree state; always read via `git show`" — extended to never CREATE worktree state via foreign-sha checkout.

## 2026-05-20 — Phase B v3 re-review (branch `feat/phase-b-migration` @ `30e20fc`)

[DECISION] **Verdict: GREEN.** All 4 v1 RED items + v2's RED-5 (`executePhaseBOps` missing ADD_PROPERTY handler — silently dropped §1 rename targets) closed cleanly. v3 added `addProperty?` injectable + dispatch branch in `executePhaseBOps`; snapshotter switched to unconditional per-entity `fetchEntity` (removed `isStubEntity` heuristic per my v2 YELLOW); orchestrator wires real implementations. 194/194 tests, pnpm check clean.

[PATTERN] **The `executePhaseBOps` op switch must handle every op kind the diff emits.** v2 missed ADD_PROPERTY because the diff emitted it for §1 renames but the executor only handled BACKFILL/DELETE/UPDATE/TOUCH. Integration test asserted callbacks-were-called but not which-ops-were-handled. Encode for Phase C/D: any new DiffOp kind needs an explicit dispatch branch + an "every op kind reaches a handler" assertion in the integration spec.

## 2026-05-20 — Phase B v5 + dry-run review (branch `feat/phase-b-migration` @ `cc1b116`)

[DECISION] **v5 GREEN + dry-run RED.** v5 closed my v4 dry-run RED-A1-A4 + RED-B: `PHASE_B_MIGRATIONS` now iterated (§2 work.arranger + verify_then_delete forename/surname); work.edition_count and organization.member_count added to scope; `buildLiveCallbacks` exported; `main()` pre-auths and passes injectables. Regen dry-run produced 46 ops correctly. Then RED on YELLOW-A1-followup: `parent_copy` diff op shape didn't encode target type — `parentType: 'work'` would make migrator iterate works not editions. Latent bug hidden by stub callbacks; called out for v6.

[PATTERN] **Diff op shape must encode iteration target when it differs from source.** For `parent_copy` (work.arranger → edition.arranger), the executor needs to know to iterate editions, not works. Added `targetParentType?: string` field on `BackfillDataOp` in v6/v10. Carry forward to any future cross-type migration.

## 2026-05-20 — Phase B v6 live-wiring review (RETRACTED — v12 found wire-shape bug)

[GOTCHA-CORRECTION] **v6 false-GREEN on `deleteProperty` wire shape.** I approved `DELETE /[db]/property/{propertyDefId}` based on Tallis's RED-2 test asserting the URL substring matched `/property/`. That URL returns 404 universally on real Entu — property-def entities ARE entities; the correct shape is `DELETE /[db]/entity/{id}`. Discovered during v12 diagnostics: 18/19 §1+§3+§4 deletes failed silently on the first live execution.

**Pattern for future reviews**: for any callback that hits Entu with a verb+path not already exercised against live Entu, demand either (a) an empirical probe documented in `findings/`, or (b) explicit YELLOW with "unverified wire shape; needs probe before merge". Test-passing-only is not GREEN-worthy for new wire shapes. Logged in MEMORY.md as a candidate review-pattern memory.

## 2026-05-20 — Phase B v7 verifyDeleteSafe review (branch `feat/phase-b-live-wiring` @ `a766abd`)

[DECISION] **GREEN.** Probe 1 switched from `formula.string=<name>` (exact-equal per Q3, returns 0 because no formula's full text equals just the prop name) to `q=<name>` (substring) + JS-side word-boundary regex post-filter with proper metachar escaping. Discriminating mock at Tallis's RED v7 Test 1 returns count=0 for the wrong query and count=2 for the right query — any impl using the wrong mechanism fails. Test 2 validates the post-filter excludes `member_email_legacy` substring while accepting `person.email` word-bound. ~2-minute RED-then-GREEN cycle.

[PATTERN] **Word-boundary regex is type-blind.** Probe 1 matches `\b<propName>\b` against any formula's text — doesn't distinguish "member_count on section" from "member_count on organization". This produced a false positive on org.member_count delete in post-execution (matched section.member_count's formula expression). Conservative behavior (false positive blocks delete; manual override required) is the right safety posture. Type-aware refinement deferred to a future hardening PR.

## 2026-05-20 — Phase B v9 review (branch `feat/phase-b-live-wiring` @ `9b352c2`)

[DECISION] **YELLOW (conditional GREEN).** v9.1 deferred §2.8 person.forename/surname to Phase D per Q4/Q5 findings (Q4: Entu RETAINS materialized formula values post-source-delete; Q5: formula prop is not directly writable — POST-to-name is dropped). Right call. v9.2 added `pruneExistingTarget` helper to data-migrator for the Q5 multi-value-append gotcha. **Structural gap:** `buildLiveCallbacks.migrateProperty` was hand-rolled, didn't delegate to `data-migrator.migrateProperty` — the helper was unreachable from live mode. First-run safe (§1 targets empty); re-run after partial failure NOT safe (multi-value append on already-set targets).

## 2026-05-20 — Phase B v10 review (branch `feat/phase-b-live-wiring` @ `a8527f5`)

[DECISION] **GREEN.** v10 closed v9 YELLOW for 5/6 backfillKinds via proper delegation. Data-migrator gained dual-signature `(client, op, injectables)`; voiceLookup widened to `Map | (sourceValue) => Promise<string | undefined>`; injectables wire concrete `deletePropertyByIdLive` (DELETE /property/{id} — at this point still pre-Bug-1-discovery wire). `parent_copy` retained inline impl with documented justification: the RED-1 parent_copy test mocks an exact 4-fetch sequence that pre-flighting parentLookup would break. Acceptable carve-out — Phase B has exactly 1 parent_copy op (work.arranger → edition.arranger) with target empty per dry-run. v11 hardening (task #44) deferred to before Phase C.

## 2026-05-20 — Phase B dry-run reviews (RED → GREEN cycle)

[DECISION] **First dry-run regen (44 ops): RED** — voice-instance seeding missing. Design spec §1.3 calls for creating 5 voice instances (alto/baritone/bass/soprano/tenor) before the `string_to_reference` backfill, but the diff had no CREATE_INSTANCE op kind. Live execution would have produced 16 sections losing voice association (DELETE_PROPERTY(voice_type) runs without verifyPreconditions; backfill fails as unmatchedVoiceTypes; source data destroyed).

**Resolution: out-of-band Pérotin script** (`chore/seed-voices`) — idempotent check-then-create per voice; `_sharing: 'public'` per architecture decisions memory; getJwt + JWT-only ops; commits result artifact; no credential leaks. Ran live, 5 instances created. **GREEN on the script.**

[DECISION] **Second dry-run regen (44 ops + 5 new voice instances in snapshot): GREEN.** Same op composition, entityCount 452→457, sha256 `883c3a9e…→ba7b12cd…`. Cleared for live execution.

## 2026-05-20 — Phase B v12 review (branch `feat/phase-b-live-wiring` @ `2f1e33c`)

[DECISION] **GREEN with 1 carryforward YELLOW.** v12 fixed 3 bugs from the partial-failure incident (15/44 ops failed on first live execution):

- **Bug 1 (CRITICAL):** `deleteProperty` URL switched to `/entity/{id}` from `/property/{id}` (the source of all 15 DELETE failures). Empirically verified by Josquin's probe — oracle-confirmed, not a guess.
- **Bug 2 (HIGH):** `updateFormula` now pre-deletes existing formula `_id`s before POST (Q5 multi-value gotcha that polluted section.member_count's formula expression).
- **Bug 3 (HIGH):** `buildJsonReport` now serializes full `executionResult` (addedProperties, backfilled, deleted, blockedDeletes, formulaUpdates, touchSaves, skipped, failed). Markdown gains `## Failures` section.

[YELLOW-12] **Bare `catch {}` in updateFormula pre-delete** swallows DELETE-mid-loop failures, leaving stale formula values silent. Probability low; mitigation present (next run's Probe 1 would catch); but worth refactoring to split-catch (catch only GET failure; let DELETE failures bubble to executor.failed[]). Track for v13/follow-up. ~5-line change.

## 2026-05-20 — Phase B post-execution review (branch `feat/phase-b-live-wiring` @ `e8002e5`)

[DECISION] **GREEN to squash-merge Phase B as complete-at-substantial-scope.** Re-execution: exit 0, failed[] empty, no `## Failures` markdown. 14 fresh deletes + 4 blockedDeletes + 1 probe-deleted = 19 planned ops accounted for. 1 formula update freshly cleaned (section.member_count: 2 polluted values → 1 canonical); 2 idempotent-skip. 3 touch-saves dispatched (6 orgs touched).

**4 blockedDeletes — all SAFE halts, all carryforward to Phase B.1:**
- `organization.contact_email` (Probe 2: 6 orgs still hold value) — needs Pérotin instance-clear, then re-run
- `organization.org_type` (Probe 2: 6/6) — same pattern
- `organization.member_count` (Probe 1: 2 prop-defs) — **confirmed false positive** (Probe 1 type-blind; matched `section.member_count` formulas not `organization.member_count`). Manual override DELETE on prop-def `_id` `69c7ea498489bfcb0e819e96`.
- `member.joined_at` (Probe 2: 10 instances per response — but Probe 2 has `limit=10`, true count likely higher). Pérotin instance-clear.

[YELLOW-13] **Probe 2 limit=10 undercounts.** If used to drive cleanup script ("just clear these 10"), instances beyond the cap stay. Raise to 500 (matches `listInstancesByType` limit elsewhere). ~1-line change.

[LEARNED] **`verifyDeleteSafe` Probe 1 type-blindness is acceptable safety posture, not a bug.** False positives block legitimate deletes (recoverable: manual override) — far better than false negatives that destroy formula dependencies (unrecoverable without snapshot restore). Type-aware refinement is non-trivial (~50 lines + formula parser); accept the limitation; document the manual-override pattern.

[CHECKPOINT] **End of session 7. Phase B substantially complete on live polyphony db:**
- 6 v4E rename targets added; 34 instance-level backfills complete; 14 obsolete/source prop-def deletes; 1 fresh formula update; 6 organizations touch-saved; 5 voice instances seeded (out-of-band)
- 4 deletes carry forward to Phase B.1 (Pérotin instance-cleanup + 1 manual override)
- §2.8 (forename/surname) deferred to Phase D
- 3 hardening items: v11 parent_copy delegation; YELLOW-12 updateFormula split-catch; YELLOW-13 Probe 2 limit raise

[DEFERRED] **Session 8 focus expected:** Phase B.1 follow-up (Pérotin scripts for instance cleanup), v11 parent_copy hardening, then Phase C planning (structural restructuring: inventory_copy → copy+lending; participation → rsvp+attendance; affiliation retirement; role retirement). Phase D after C (rights flips + sharing alignment + DEPRECATED cleanup).

(*MVOX:Bentham*)
