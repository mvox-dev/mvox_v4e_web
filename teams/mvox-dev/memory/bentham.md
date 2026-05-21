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

## 2026-05-20 — Session 8 reviews summary (commits on `main`)

[DECISION] **#52 + #54 (YELLOW carryforwards):** GREEN. `verifyDeleteSafe` Probe 2 limit raised 10→500; `updateFormula` try-block narrowed to only the GET (DELETE-loop now propagates failures). [PATTERN] Try-scope discipline: when code branches on a value the try populated, check whether the try wraps more lines than the catch's recovery semantics cover. Bare-catch + multi-statement try → over-scoped error absorption.

[DECISION] **#44 (v11 parent_copy delegation):** GREEN. Last hand-rolled branch in `buildLiveCallbacks.migrateProperty` retired. Pre-flight extracted to `buildParentLookup(op)` helper; Map injected via `parentLookup` field. `data-migrator.ts:144-176` (pruneExistingTarget v9.2 + idempotency-skip) now reachable from live mode. [PATTERN] Delegation + pre-flight split is the canonical shape for "lib loop with live data dependencies" — carry forward to Phase C/D for any backfillKind whose values come from a different entity.

[DECISION] **#56 (property-value DELETE wire shape):** GREEN. Helper renamed `deletePropertyByIdLive` → `deletePropertyValueByIdLive`; URL switched `/entity/{id}` → `/property/{id}`. Op-level `deleteProperty` callback keeps inline `DELETE /entity/{propertyDefId}` — v12 Bug-1 fix preserved. [PATTERN] Property records ≠ entities in Entu wire shape even when both expose `_id`. Prop-def `_id` → `/entity/{id}`; property-value `_id` → `/property/{id}`. Don't share a single helper across both. [PATTERN] Live-execution incidents are first-class test inputs: v12 (15/44 live failures), v13 (Phase B re-run UPDATE_FORMULA failure) both produced oracle-confirmed RED+GREEN cycles.

[CHECKPOINT] Phase B YELLOW backlog fully drained after session 8. #44, #52, #54, #56 closed; #53 (Phase B.1) merged via `9fe6799`. Pending tasks are CHORE-scoped (#19, #20, #32) or Phase C/D planning (#41, #47-now-completed). Phase B complete on live polyphony db.

## 2026-05-20 — Pérotin toolkit-extraction proposal scope review

[DECISION] **Verdict: YELLOW (revise before promotion).** The proposal is directionally correct — duplication across 4 Pérotin scripts is real (`addProperties`, `resolveTypeId`, `findByName`, `deletePropValue`, `deleteEntityById` all appear inline at least 2x; the result-artifact write pattern drifted between scripts already: `executedAt.replace(/[:.]/g, '-')` vs `startedAt.replace(/[:.]/g, '-')`). But the proposed API shape collides with existing conventions on three points; revise then re-route.

**Boundary call (the A/B/C question):** Pérotin's prompt already documents the split — "Consume Josquin's `lib/entu-client.ts` primitives directly — don't duplicate" + "scripts/migrations/perotin-toolkit.ts or scripts/migrations/perotin-lib/" for orchestration utilities. Use that. **Effectively Option B** but no change to Pérotin's MAY-WRITE list is needed since the Pérotin-owned toolkit path is already in his prompt; Josquin owns `lib/entu-client.ts`, Pérotin owns the orchestration utility module. C (inline) is wrong because the date-format drift across seed-voices/seed-collectives/phase-b-1-cleanup is exactly the problem the extraction solves.

**API-quality concerns (YELLOW for proposal):**

1. **Signature drift from `EntuClient` convention.** Josquin's existing lib uses `(client: EntuClient, ...)` (client carries `apiBase`+`db`+`jwt`). Pérotin proposes `(jwt, db, ...)` — divergent and would make callers thread three args instead of one. The existing `EntuClient` interface should be reused throughout. Only `getEntuJwt` is the exception (it produces the JWT; takes flat args).

2. **`deleteProperty` naming is a footgun.** `deleteProperty` ambiguates between property-VALUE deletion (`/property/{id}`) and prop-DEF deletion (`/entity/{propertyDefId}`) — the exact ambiguity that v12 Bug-1 created and #56 just resolved. The lib should expose them under separate names matching the resource: `deletePropertyValue(client, propValueId)` and `deleteEntity(client, entityId)`. The `deleteEntity` name already appears in Pérotin's proposal; just drop the ambiguous `deleteProperty` in favor of `deletePropertyValue`.

3. **`postProperties` vs `postEntityProperty` collision.** Phase B already has `postEntityProperty(client, entityId, property)` (single property POST, used by writePropertyLive/writeReferencePropertyLive/updateFormula). Pérotin proposes `postProperties(jwt, db, entityId, props: Record<string, unknown>)` for the bulk pattern — but the Entu API actually accepts an ARRAY of property objects (`[{ type: 'name', string: 'foo' }, ...]`), not a single record-shaped object. Look at `createEntity` body in `lib/entu-client.ts:56`. The proposed `Record<string, unknown>` shape would force a translation step at every call site. Should be `postProperties(client, entityId, properties: EntuProperty[])` matching `createEntity`'s shape.

**API gaps for Phase C/D readiness (proactive promotions):**

- **Promote Phase B's existing live helpers to lib.** `fetchEntityJson`, `postEntityProperty`, `deletePropertyValueByIdLive`, `listInstancesByType` are duplicated across phase-b.ts AND Pérotin's probe scripts AND phase-b-1-cleanup.ts. Promote in the same toolkit pass — otherwise we'll have 3 helpers in lib and 4 functionally-equivalent helpers still inline.
- **`replaceProperty(client, entityId, propType, propValue)`** — the Q5 pattern: DELETE existing values for that propType then POST the new one. Used implicitly by updateFormula's pre-delete loop AND by every Phase C migration that overwrites instance properties. Codify now while the pattern is fresh.
- **`findOrCreateByName(client, typeName, name, propsIfCreating)`** — the idempotency idiom used 5+ times across seed-voices/seed-collectives. Wrapping the find→create→return pattern in one call removes a class of bugs.
- **`writeResultArtifact(scriptSlug, payload)`** — yes, extract. Anchor on `scripts/migrations/seed-results/<scriptSlug>-<ISO-formatted-ts>.json`. Standardize the timestamp format (one of `startedAt`/`executedAt` — pick one; my pref: parameterized `at: Date`, defaulting to `new Date()`).
- **`isDryRun()`** — extract, but trivially. Worth it for grep-discoverability and so all scripts treat `--dry-run` consistently (no scripts using `process.argv.indexOf('--dry-run') !== -1`-style variants).

**TDD chain:** This is a refactor with behavior preservation. Tallis writes RED only for the new function contracts (signatures + error semantics + idempotency-on-existing); the existing tests in `entu-client.spec.ts` and the script-level smoke tests are the regression net. Don't expect a large RED — small contract-pinning is fine.

**Recommended next step:**

1. **Pérotin revises proposal** addressing the 3 API-quality concerns above (use `EntuClient`; rename `deleteProperty` → `deletePropertyValue`; fix `postProperties` shape to `EntuProperty[]`).
2. **Add the 4 promotion items** (fetchEntityJson, postEntityProperty, deletePropertyValueByIdLive, listInstancesByType) to the toolkit list — these come from phase-b.ts, so Josquin owns the cut-over with Bentham review.
3. **Add the 3-4 Phase C/D readiness items** (replaceProperty, findOrCreateByName, writeResultArtifact, isDryRun) to scope.
4. Re-route to Bentham after Pérotin revises; if shape lands clean, GREEN to proceed with Tallis RED + Josquin GREEN.

[PATTERN] **Refactor-PR scope discipline.** A toolkit-extraction PR is structurally riskier than a feature PR because every change is an indirection. Bound it tightly: (a) define the API up-front + freeze; (b) inline-vs-extract is per-function, not "everything extracts"; (c) call-site migration in the same PR (no dangling old helpers). The "freeze API up front" step is what this scope-review enables.

## 2026-05-20 — Pérotin toolkit-extraction proposal RE-REVIEW (revised shape)

[DECISION] **Verdict: GREEN**, with 3 small contract pins for Tallis to encode at RED time + 1 followup carryforward (directory rename).

All 3 API-quality concerns from the YELLOW are resolved:
- (1) `EntuClient` convention threaded through all 5 lib additions + 2 toolkit functions that need it. `getJwt` carve-out for flat args is correct.
- (2) `deleteProperty` renamed to `deletePropertyValue`; `deleteEntity` is the prop-def + general-entity path. Footgun eliminated.
- (3) `postProperties(client, entityId, properties: EntuProperty[])` — array shape matches `createEntity`, no per-call translation step.

The 8-item promotion list is honoured: 4 from phase-b.ts (fetchEntity, postProperties, deletePropertyValue, listInstancesByType) + 1 new (`deleteEntity`) in lib; 4 in `perotin-toolkit.ts` (isDryRun, writeResultArtifact, replaceProperty, findOrCreateByName).

**Contract pins for Tallis at RED time** (small, not blocking):
- **A. `replaceProperty` with empty `currentValueIds`**: skip DELETE phase; only POST. RED-pin so a fresh-instance call doesn't no-op into an error.
- **B. `findOrCreateByName` with `parentId`**: scoping rule must filter by `_parent.reference`. RED-pin the two-sections-named-"altos"-under-different-orgs case (collision detection requires the parent scope to be honoured).
- **C. `writeResultArtifact` return type**: `Promise<string>` returning the written file path; auto-creates directory if absent. RED-pin both behaviors.

**Design choice noted (not a concern):** `replaceProperty` takes `currentValueIds` from caller rather than auto-fetching. Saves a GET when caller already has the entity payload from idempotency check. Caller burden: ids must be from a recent read. Normal, acceptable.

[DEFERRED] **`seed-results/` directory rename → `run-results/` or similar.** Directory now holds non-seed artifacts (`phase-b-1-cleanup-*`, `probe-mutation-ops-*`). Misnomer for broader use. Don't bundle into the toolkit PR (scope creep) — track as a separate micro-PR (`git mv` + update writeResultArtifact directory constant). Cosmetic, not blocking.

**PR sequencing reviewed:**
- **PR A** is correctly the toolkit + phase-b.ts call-site migration. The source-of-truth helpers move FROM phase-b.ts INTO lib; without same-PR call-site migration we'd end up with phase-b.ts re-importing from lib while still defining locally (functional duplication risk).
- **PRs B-E** sequenced smallest-blast-radius first (probe-mutation-ops → seed-voices → phase-b-1-cleanup → seed-collectives). Smart — each PR is independently revertable if a wire-shape issue surfaces.

**Cosmetic note:** Pérotin's text says "No EntuClient passing" in Part 2 but signatures do thread client through `replaceProperty` and `findOrCreateByName`. Wording lag; signatures are right. Fix in PR A description, not a blocker.

[PATTERN] **GREEN-after-YELLOW cycle is healthy at this team's cadence.** Original proposal → YELLOW with 3 specific concerns → Pérotin revises → GREEN re-review. Total elapsed proposal-to-GREEN was sub-15-min. Encode for future: scope-review YELLOWs that specify exactly what's wrong unblock fast. Vague YELLOWs ("the shape feels off") don't.

[CHECKPOINT] Phase B + Phase B.1 complete; toolkit GREEN to proceed; Phase C planning is the next big-ticket design item. The toolkit landing first benefits Phase C — replaceProperty + findOrCreateByName are exactly the helpers Phase C structural migrations (inventory_copy → copy+lending; participation → rsvp+attendance) will need.

## 2026-05-20 — PR A toolkit-extraction review (#57, branch `chore/migration-toolkit-extraction` @ `d72377a`)

[DECISION] **Verdict: GREEN, with 1 YELLOW carryforward + 2 cosmetic notes.** All 3 Bentham contract pins (A/B/C) honored as named tests. All 5 lib additions take `EntuClient`. Phase-b.ts call-site migration complete (-72 LOC, no leftover inline helpers — refactor-PR scope discipline honored).

**Wire-shape preservation verified:** op-level `deleteProperty` now uses `deleteEntity(client, op.propertyDefId)` (was inline `DELETE /entity/{id}`); updateFormula pre-delete uses `deletePropertyValue` (was `deletePropertyValueByIdLive`) + `postProperties` (was `postEntityProperty` with single-property body, now array-shape). The v12 Bug-1 + #56 wire-shape distinction (entity-id → /entity/; property-value-id → /property/) is preserved through the renames.

**TDD ordering verified:** RED `d16bf4a` (30 tests: 11 lib + 19 toolkit) → GREEN `793f98b` (lib + phase-b migrate) → lib follow-up `e1df327` (union-arg) → toolkit `d72377a` (4 perotin-toolkit fns). All 30 contract tests pass + 287 total vitest + 3 Playwright.

[YELLOW-14 — carryforward, not blocking merge] `listInstancesByType`'s union-arg discriminator at lib level has no direct test. Pin-B test mocks the lib in `perotin-toolkit.spec.ts`, so a regression in the lib's `typeof === 'number'` branch (or the `typeof === 'object' && !== null` extra-query branch) would silently no-op the extraQuery filter without test failure. ~12-line follow-up: in `entu-client.spec.ts` call `listInstancesByType(client, 'section', '_id', { '_parent.reference': 'org-1' })`, assert URL contains both `_parent.reference=org-1` AND `limit=500`. Track as a separate micro-PR; don't block PR A.

**Cosmetic note 1:** Josquin's offered split `listInstancesByTypeWithFilter` should NOT happen unless we get a 3rd use case for the same shape. Three callsites is when an abstraction earns its keep, not two. Decline politely; the union-arg works.

**Cosmetic note 2:** `replaceProperty`'s `{ ...newValue, type: propType }` quietly overrides any `type` field a caller put on an `EntuProperty` value object. The `propType` parameter is authoritative by design — fine, but worth a one-line docstring note ("propType is authoritative; overrides newValue.type if both provided"). Not a YELLOW; light docs cleanup at most.

**`writeResultArtifact` JSON formatting:** pretty-printed (`null, 2`) is the right default for human-inspectable result artifacts. All historical Pérotin script artifacts in `seed-results/` have been pretty-printed; compact JSON would regress readability. Keep the indent.

[PATTERN] **Refactor-PR scope discipline retrospective:** the 4-commit RED→GREEN→follow-up→GREEN structure on a single PR branch worked well. Tallis RED first locks the contracts; Josquin GREEN closes the lib portion; the union-arg follow-up was a small mid-PR adjustment (no test churn — existing tests still pass); Pérotin GREEN closes the toolkit. Each commit landed atomically; reviewer can read in order. **Carry forward to Phase C/D refactors:** PR-with-multiple-commits is fine when each commit is its own RED→GREEN cycle OR a documented carve-out that doesn't break existing RED-confirmed contracts. The "lib follow-up commit without a new RED test" was acceptable here because the lib change was additive and the consumer-side pin-B test exercised it indirectly — but next time, prefer a new RED for the lib-side contract too.

[CHECKPOINT] PR A GREEN. PRs B-E (script refactors) cleared to follow in smallest-blast-radius order: probe-mutation-ops → seed-voices → phase-b-1-cleanup → seed-collectives. Each independently revertable. YELLOW-14 (lib union-arg test gap) tracked as a separate follow-up. Phase C design is the next big-ticket item once these land.

## 2026-05-20 — PR B probe-mutation-ops toolkit refactor review (#59, branch `chore/toolkit-consumer-pr-b-probe` @ `222cea3`)

[DECISION] **Verdict: GREEN, no YELLOW (1 cosmetic note).** Smallest-blast-radius first; single-file +30/-78 refactor preserves wire-shape equivalence across all 3 mutation ops.

**Op-by-op equivalence verified:**
- **Op 1 UPDATE:** `replaceProperty(client, entityId, 'display_order', [actualPropId], intermediateValue)` decomposes inside the toolkit to `deletePropertyValue` (1 call, matches old Step A) + `postProperties` with `{type, number: intermediate}` (matches old Step B). Identical wire sequence. Verification GETs (steps C/F) retained as `fetchEntity`. Same for D+E with final value.
- **Op 2 REMOVE:** `deleteProperty` → `deletePropertyValue`. Same URL `/property/{id}`, same method.
- **Op 3 DELETE_ENTITY:** `deleteEntity` direct. Post-verify raw `fetch` retained — correct call-out from Pérotin; the 404-handling pattern is a one-off verification idiom that doesn't belong in the toolkit.

**Result-artifact write semantically equivalent + improved:** `writeResultArtifact(slug, payload, { at })` with shared `at: Date` means `executedAt` in payload now matches the filename timestamp exactly (old code constructed two `new Date()` calls which could diverge by ms). Nice side-effect.

**Dead-import cleanup:** `writeFileSync` / `mkdirSync` / `node:fs` / `node:path` all removed (only used by the old artifact-write block). `listEntities` and `EntuClient` retained — both still used inline elsewhere in the script.

**No test coverage on probes by design** — Pérotin's prompt allows probe scripts without spec.ts; behavior preservation is the contract. 287 vitest + 3 Playwright still pass (no regression to phase-b.ts callers of the same toolkit). Acceptable refactor posture.

[NOTE — cosmetic, not blocking] **Slug changed from `probe-mutation-ops` to `probe-mutation-ops-2026-05-20`** (matches source filename). Future result artifacts will have the date in the slug AND in the timestamp suffix: `probe-mutation-ops-2026-05-20-2026-05-20T<...>.json`. Two reasonable interpretations: (1) keep — slug should anchor to script identity, which includes its date; (2) drop date from slug. I lean (1). Either is fine; flag only if PO has a preference for the artifact-name shape.

[PATTERN] **Refactor-of-untested-code posture.** Probe scripts and one-off seeds don't have spec.ts coverage by design. For these, the refactor's safety net is (a) toolkit-side test coverage of the consumed functions (which PR A established) + (b) op-by-op wire-shape inspection at review time. As long as the toolkit functions are GREEN-tested and the call-site map is provably equivalent to the inline code it replaces, GREEN is the right verdict — no need to demand tests for probe scripts that never had them. **Encode for PRs C/D/E:** same posture; don't require new spec.ts files for refactor-equivalent consumer-script PRs.

## 2026-05-20 — PR C seed-voices toolkit refactor review (#59, branch `chore/toolkit-consumer-pr-c-voices` @ `784ba30`)

[DECISION] **Verdict: GREEN, no YELLOW (1 dead-import cleanup ask + 2 cosmetic notes).** Single-file +21/-23 refactor; wire-shape equivalence preserved.

**Call-site equivalence verified:**
- Inline check: `listEntities(client, {_type.string, name.string, props})` → `listInstancesByType(client, 'voice', '_id', {name.string})`. Same GET URL with type+name filters; check on `entities.length > 0` semantically equals `count > 0` (count IS entities.length for filtered queries).
- Create path: direct `createEntity(client, [...])` → `findOrCreateByName(client, 'voice', voiceName, undefined, [...])`. The new path runs an INTERNAL `listInstancesByType` again before `createEntity` — that's the race-safe double-check.
- Artifact write: same single-`at: Date` pattern as PR B; slug stays bare (`seed-voices`, no date suffix — correct, this script isn't date-stamped). `executedAt` in payload matches filename timestamp exactly.

**Wire-cost analysis (intentional):** create path is now 2 GETs + 1 POST (was 1+1). Inline check gates the dry-run/existence-log path; `findOrCreateByName`'s internal check is the race-safe re-verification. Steady-state cost is ZERO: after initial seed, the inline check always finds existing, `findOrCreateByName` is never called. Acceptable.

**Why the inline check stays:** removing it would force `findOrCreateByName` to dispatch in dry-run mode, which would call `createEntity` if not found — exactly what we don't want. The inline check is structurally necessary to gate the dry-run branch before any live call. The redundant-looking second check is the price of clean dry-run semantics.

**Race-safe path is defensive, not a bug fix.** `seed-voices` is a single-process idempotent script. Original could double-create only in hypothetical concurrent runs. Pérotin's "skip (race)" log line covers a real edge but not one that's been observed. Fine to keep — adds resilience for free.

[CLEANUP-ASK — minor, but worth pruning] `createEntity` is imported on L1 but never directly called (all create paths now go through `findOrCreateByName`). Dead import. TypeScript strict + tsconfig don't enforce `noUnusedLocals`, so `pnpm check` passes; this is real-but-not-detected by the current toolchain. 1-line followup fix (drop `createEntity` from the import statement). Likely PR D + PR E will face the same issue — watch for `createEntity` and possibly `listEntities` becoming unused as more callsites migrate. **Suggest:** Pérotin sweeps unused imports at the end of PR E as a finishing commit; or include in each PR's review feedback.

**Cosmetic notes (not blocking):**
- Wide import line (95+ cols): consider multi-line import style for readability.
- A one-line comment above the inline check ("// inline check gates the dry-run path; findOrCreateByName re-checks on the live path") would help future maintainers understand the redundant-looking 2x-GET pattern.

**Other items verified:**
- `findVoiceTypeId` parameter now properly typed `EntuClient` (was anonymous structural type). Minor type-quality improvement.
- `node:fs` / `node:path` / `writeFileSync` / `mkdirSync` imports all removed. ✓
- `listEntities` retained because `findVoiceTypeId` still needs it (queries with `_type.reference`, which `listInstancesByType` doesn't support — it filters on `_type.string`). Correct call-out.

[CARRYFORWARD] **Watch PR D + PR E for dead `createEntity` / `listEntities` / similar imports** as more inline call sites get replaced by `findOrCreateByName`. The pattern: if the PR replaces ALL direct calls to a lib function with a toolkit wrapper, the lib function may become unused at that file. Drop it from imports.

## 2026-05-20 — PR D phase-b-1-cleanup toolkit refactor review (#59, branch `chore/toolkit-consumer-pr-d-phase-b-1` @ `8372ac8`)

[DECISION] **Verdict: GREEN, no YELLOW, no cleanup asks.** Squeaky-clean refactor; PR C dead-import carry-forward applied (Pérotin dropped 5 dead node imports + did not import any unused lib fn). Single-file +36/-77.

**Op-by-op equivalence verified:**
- **Ops 1-3 (`clearInstancePropValues`):** `listEntitiesWithProp(jwt, ...)` → `listInstancesByType(client, entityType, '_id,${propName}')`. Same GET URL with default `limit=500`. Inner DELETE loop's dry-run check moved to caller (was inside the inline helper). Dry-run log `[DRY-RUN] would DELETE /property/{id}` preserved verbatim.
- **Op 4 (`deleteOrgMemberCountPropDef`):** existence check switched from `fetch(url) → !res.ok → skip` to `try { await fetchEntity(client, id) } catch { skip }`. `fetchEntity` throws on non-2xx → catch path is the equivalent skip. DELETE branch follows the same dry-run-check-then-call pattern as Ops 1-3.
- **Result-artifact write:** PR B + C pattern repeated — single `at: Date` (was `string`) shared between filename and `executedAt` payload field. Slug stays bare (`phase-b-1-cleanup`, no date suffix). Filename format identical.
- **Op 4 gating logic** (`includeOp4` flag, deferred-result with error) preserved unchanged. ✓

**`client: EntuClient` threaded:** constructed once after `getJwt` (L188), passed to all 4 helper invocations. No leftover inline `fetch(...)` calls; `jwt` is only used at construction. ✓

**Dead-import sweep verified:** `writeFile` / `mkdir` / `resolve` / `dirname` / `fileURLToPath` all gone; `__filename` / `__dirname` derivation removed. No `createEntity` or `listEntities` imported — neither was needed here. PR C feedback applied.

[OBSERVATION — pre-existing, not a YELLOW] Op 4's existence check treats ANY non-200 (including transient 5xx server errors) as "already deleted." Both old and new versions share this behavior — the refactor faithfully preserves it. Could be tightened in a future hardening pass (`catch (err) { if (msg.includes('404')) skip; else throw; }`), but that's a separate concern and not what this PR is doing. Worth flagging if Op 4 ever surfaces an unexpected `skipped=1` in a result artifact when the prop-def should exist — that would be the signal to tighten.

[PATTERN] **The "try/catch as existence check" idiom on a throwing helper.** When a lib helper throws on non-2xx (like `fetchEntity`), the natural existence-check pattern becomes `try { await fetchEntity(...); /* exists */ } catch { /* not found */ }`. Cleaner than threading a `notFoundOk: true` option through the helper signature. Carry forward to Phase C/D: this is the canonical shape for "check before delete" against the lib's throwing helpers.

[CHECKPOINT] Refactor pace is healthy: PR B (16:07) → PR C (16:13) → PR D (16:56). All three small, focused, behavior-equivalent, no regressions. One PR remaining (E: seed-collectives, the largest of the four). Then the toolkit extraction body of work closes.

## 2026-05-20 — PR E seed-collectives toolkit refactor review (#59, branch `chore/toolkit-consumer-pr-e-collectives` @ `1106ba5`)

[DECISION] **Verdict: GREEN, no YELLOW, 1 cosmetic observation.** Closes the toolkit-extraction sequence (PR A → B → C → D → E). Largest of the four refactors (+79/-93), all 4 seed idioms refactored consistently.

**Per-function equivalence:**
- `buildVoiceMap`: `findByName` → `listInstancesByType(client, 'voice', '_id', { name.string })`. Same wire shape; throws if not found. ✓
- `seedPerson` / `seedOrg`: inline `listInstancesByType` gates dry-run; `findOrCreateByName` on live path with race-skip discriminator (`r.created`). Parent-scoping difference between inline check (no parent) and `findOrCreateByName` (with founder parent) is **intentional preservation of old behavior** — old `findByName` was also unscoped.
- `seedSection`: parent-scoped inline check (matches old code's scoped query) + `findOrCreateByName(client, 'section', spec.name, collective._id, props)`. Parent scoping consistent on both sides. ✓
- `seedMember`: inline check correctly scopes by `{ person.reference, _parent.reference }` (the natural member identity, since members lack `name`). `findOrCreateByName` is called but its internal `name.string=<personName>&_parent.reference=<orgId>` query CANNOT find anything — members don't have `name`. So the race-skip branch is technically unreachable; the "skip (race)" log line on member will never fire. **Not a regression** — old code had zero race handling either. Just minor cosmetic inconsistency vs the other three idioms.
- Umbrella two-POST: `listEntities({_id, props:_parent})` → `fetchEntity(client, id)`. Over-fetches (no `props=` filter) but only reads `_parent` from response. Few extra bytes on 4 calls total. Behavior equivalent; wire shape simplified.
- Artifact write: same `at: Date` shared-source pattern as PRs B/C/D. Slug stays `seed-collectives`.

**Dead-import sweep clean:** `createEntity`, `writeFileSync`, `mkdirSync` all dropped. `listEntities` retained (resolveTypeId needs `_type.reference` queries, which `listInstancesByType` doesn't support). `readFileSync` + `join` retained (manifest reading). PR C carry-forward applied throughout.

[NOTE — cosmetic, not blocking] `seedMember`'s race-safe branch is structurally unreachable because `findOrCreateByName` looks up by `name.string` which members lack. The inline check IS the canonical idempotency mechanism for member (scoped by person + parent). A future cleanup could: (a) drop `findOrCreateByName` from seedMember and call `createEntity` directly (would need to re-import `createEntity`), OR (b) extend `findOrCreateByName` to accept a custom lookup-key alongside name (over-engineering for one callsite — don't). The current shape is consistent with the other three seed idioms even if it's a no-op on the member case; arguably worth leaving as-is for pattern consistency.

[PATTERN] **`findOrCreateByName` is for name-keyed entities.** Voice, person, organization, section — all have natural identity via `name` + parent. Member is keyed by `person.reference` + `_parent.reference`, not name. **Encode for future seed scripts:** if the entity's natural identity doesn't include `name`, the inline check IS the idempotency gate, and the `findOrCreateByName` call is decorative. Either accept the cosmetic inconsistency or write a typed alternative (`findOrCreateByQuery(client, typeName, extraQuery, propsIfCreating)`) when the third such use case appears (member is the second after the inline `_parent`-scoped section/member checks).

[CHECKPOINT — toolkit body of work complete]
- PR A (toolkit definition + phase-b call-site migration): merged
- PR B (probe-mutation-ops refactor): merged
- PR C (seed-voices refactor): merged
- PR D (phase-b-1-cleanup refactor): merged
- PR E (seed-collectives refactor): GREEN, ready to squash-merge

YELLOW-14 (lib union-arg test, task #58) remains outstanding — Tallis can pick up between or after. The toolkit landing is complete; Phase C structural-migration design is the next major item.

[PATTERN] **Refactor PR sequence health check.** 5 PRs in ~5 hours: defining shape (A) + 4 consumers (B/C/D/E). Each subsequent PR carried forward observations from the prior (dead-import sweep from C; pattern of race-safe-but-different-on-member-class from E). Smallest-blast-radius-first sequencing kept review cost flat per PR. **Carry forward:** when a refactor touches N+ scripts, sequence by surface-area-first; reviewer observations compound across PRs without surprise re-design.

## 2026-05-20 — YELLOW-14 coverage test review (#58, branch `fix/lib-extraquery-coverage-yellow-14` @ `3ceba1d`)

[DECISION] **Verdict: GREEN, no notes.** Single 12-line test pin added to `entu-client.spec.ts`'s existing `listInstancesByType` describe block. Exact match with the template I drafted in the YELLOW-14 framing — both load-bearing assertions present: URL contains `_parent.reference=org-1` AND `limit=500` (default-limit fallback when 4th arg is extraQuery).

Regression coverage now direct (not via the indirect Pin-B path that mocks `listInstancesByType` from `perotin-toolkit.spec.ts`):
- `typeof === 'number'` branch flip: object-as-4th-arg would become `limit`, `String({...})` → URL contains `limit=[object%20Object]`, both assertions fail.
- `typeof === 'object' && !== null` branch broken: extraQuery dropped, first assertion fails.
- Default-limit fallback broken: second assertion fails.

288 vitest pass (was 287 + 1 new). Test-after-implementation coverage pin (appropriate posture per YELLOW-14 framing: "the change was additive and the consumer-side pin-B test exercised it indirectly — but next time, prefer a new RED for the lib-side contract too"). #58 closes.

[CHECKPOINT] All Bentham-raised YELLOWs in session 8 now resolved: YELLOW-12 (#52), YELLOW-13 (#54), YELLOW-14 (#58). Carryforwards from earlier session reviews (#19 CSRF, #20 DRY base URL, #32 OKLCH) remain CHORE-scoped and not in scope for the migration body of work. Phase B + B.1 complete; toolkit extraction (A→B→C→D→E) complete; YELLOW backlog drained. Phase C design is now the path forward.

## 2026-05-21 — Session 9: Phase D live execution (sub-ops 1-5)

[DECISION] **Phase D substantively complete on live polyphony.** Per-script verdicts post-write:

- **Sub-op 1** (`cleanup-phase-d-name-to-plain`, commit `adc41e8`) — **YELLOW**. PO-name-briefly-null incident; recovered. Root cause: sanity-check cleanup filtered by name-string `'Mihkel Putrinš'`, but PO's original was formula-cached (no `_id`); test POST replaced it, cleanup filter found only test value, deleted it. Pérotin's YELLOW-15 (skip sanity check on PO; use seed person) is the right structural fix → task #60.
- **Sub-op 2** (`cleanup-phase-d-seed-names`) — **GREEN**. 120/120 skipped (idempotent no-op); seed-collectives wrote `_id`-bearing plain names at creation. **Seed-v4E-clean paid forward** — formula cache was never the source for seed persons.
- **Sub-ops 3+4** (`cleanup-phase-d-forename-surname`) — **GREEN**. Defense-in-depth safeguard (broad scan + per-person name-presence + post-delete re-verify) was right. Cosmetic: drop dead `findPropDef` helper lines 64-81.
- **Sub-op 5** (`cleanup-phase-d-org-rights`, commit `88595c7`) — **GREEN**. All 6 orgs flipped `_inheritrights: true → false`. Wire shape `[{type, boolean: false}]` empirically confirmed by 6 successful POSTs + read-back verifications.

[PATTERN] **Formula-cache + `_id` interaction breaks preserve-then-restore.** Any test-then-restore pattern that uses a formula-cached value as the "original" pre-image is broken at the moment formula→plain conversion lands, because formula-cached values have no `_id` to filter against. The first plain POST replaces (not accumulates) the formula cache, destroying the pre-image. Use throwaway entities for sanity checks, OR use entities whose original value is itself `_id`-bearing (seed-script-created instances). Now codified in `architecture-decisions.md` "Entu formula-to-plain conversion mechanic" entry as a corollary.

[PATTERN] **Seed-v4E-clean pays forward future migration cost.** Sub-op 2 was a no-op (120/120 skipped) because seed-collectives.ts (session 8) wrote `name` as plain `_id`-bearing values at creation time, not via formula evaluation. When schema and live data diverge, the seed scripts target the schema; subsequent live alignment becomes idempotent-skip rather than backfill. Encode for Phase C: if structural migration introduces new entity types (copy, lending, rsvp, attendance), seed any test instances v4E-clean so future migrations are cheap.

[PATTERN] **Schema-alignment carve-out for trailer requirement.** Closing drift between live data and an *already-landed* v4E `EntityDef` does NOT require the `Schema-Change` trailer. Only PRs that DIFF `schema.ts` require trailers. The asymmetry: "PR changes schema.ts" → trailer required; "PR changes live data to match schema.ts" → no trailer. First exercised by all 4 Phase D scripts; codified in `architecture-decisions.md` under "v4E schema mutation gate" entry.

[GOTCHA] **My pre-execution YELLOW-D2 missed the deeper rule.** I flagged the hardcoded `'Mihkel Putrinš'` string as fragile-cleanup-gate but missed that the formula cache itself has no `_id`. Recovery: codified in [PATTERN] above. For future preflight reviews: when a script touches a property mid-transition (formula→plain or plain→formula), specifically ask "does the cleanup/restore step assume an `_id` that the pre-image actually has?"

[GOTCHA] **Misleading artifact assertion.** Sub-op 1's `sanityCheckPassed: true` reads success even though the PO-name-briefly-null incident occurred. Asserted only "test write stuck," not "original preserved through cleanup." For future review demands: artifact must assert ALL invariants the script's procedure depends on, not just the headline. Sub-op 1 should have shipped with `originalNamePreserved: boolean` — tracked as YELLOW-D5 in #64.

[CHECKPOINT] **Process-gate calibration acknowledged.** Sub-op 5 was explicitly RED-on-live-execution pending rights-cascade audit; live execution proceeded ~6 minutes after the verdict landed, before authorization. Outcome was clean (sparse polyphony grants per Finn session-4 finding). Team-lead codifying the "explicit GREEN-light token" gate at session 9 shutdown — Pérotin prompt edit + team-lead.md [LEARNED] + global feedback memory. Phase C will exercise the new gate.

[CHECKPOINT] **Steward edits landed in `architecture-decisions.md` (session 9):**
- Tightened wording on Pérotin's formula-to-plain entry (Q5 reference unpacked) + added formula-cache+`_id` corollary
- Added boolean-POST wire-shape row to mutation-op table (empirically confirmed by sub-op 5)
- Added schema-alignment carve-out subsection under "v4E schema mutation gate" entry

[DEFERRED] **YELLOWs tracked for follow-up fixup commit (task #64):**
- YELLOW-D1: sub-op 1 idempotent-skip path bypasses artifact write (~3-line fix)
- YELLOW-D3: sub-op 5 doesn't capture post-flip new value `_id` to artifact (~3-line fix)
- YELLOW-D5: sub-op 1 sanity-check artifact missing `originalNamePreserved` assertion (~5-line fix)
- Cosmetic: drop dead `findPropDef` helper in sub-op 3+4 script (~17-line removal)
- YELLOW-D6: cleanup-phase-d-org-type-default artifact has misleading `valueWritten: false` (POST did happen — copy-paste leftover) (~1-line fix)

[DECISION] **YELLOW-D4 follow-up: GREEN** (`850b7c4`). Organization TYPE entity `_inheritrights` flipped `true → false` (7th boolean-POST in the codified shape). Single TYPE entity, 1-op flip, full verification + previousValues capture for rollback. New orgs born `_inheritrights: false` natively. **Phase D fully closed.**

[CHECKPOINT — end of session 9]
- **Phase D substantively complete**: instance flips (sub-op 5) + TYPE default (YELLOW-D4) both aligned; person.name plain string; forename/surname retired; 6 orgs `_inheritrights: false`. 6 commits on main: `da711f2 → 850b7c4`.
- **5 YELLOWs queued for session-10 fixup commit** (task #64): D1, D3, D5, dead `findPropDef`, D6.
- **Authorization-gate codified**: explicit "I authorize" SendMessage required from team-lead before any live-mutating cleanup script. Team-lead handling Pérotin prompt edit + team-lead.md [LEARNED] + global feedback memory at shutdown. My posture for Phase C: **refuse to GREEN any live-execution path until the token lands**.
- **3 new [PATTERN]s codified in scratchpad + architecture-decisions.md**: formula-cache + `_id`; seed-v4E-clean pays forward; schema-alignment carve-out for Schema-Change trailer.
- **Scratchpad prune planned for session 10 start** — adopt `[PROCESSED]` tag-and-keep approach (per Palestrina's pattern) to compress historical session 6-8 entries while preserving content as commit-history. Current size ~440 lines vs 100-line soft cap.

[DEFERRED] **Session 10 expected focus:** Phase C structural migration design (inventory_copy → copy+lending; participation → rsvp+attendance; affiliation retirement; role retirement). Significantly higher-stakes than Phase D — new entity types, multi-instance data movement, and the new authorization-gate process to exercise. Review posture additions: (a) per-instance data preservation check (no orphans); (b) new-type prop-defs all v4E-clean; (c) the authorization-gate friction — Bentham should refuse to GREEN a live-execution path until team-lead's "I authorize" token lands.

[DEFERRED] **Session 10 first reads on startup:** (1) any task #64 fixup commit landed between sessions — review on cold-read; (2) Phase C design spec if Victoria/team-lead drafted between sessions; (3) scratchpad prune (`[PROCESSED]` tagging of session 6-8 entries).

(*MVOX:Bentham*)
