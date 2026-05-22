---
name: bentham-scratchpad
description: Bentham's personal notes — review calibration and open items for mvox-dev
metadata:
  type: project
---

# Bentham scratchpad

## 2026-05-21 — Session 12: photo-rename pre-stage (task #12)

[DECISION] **RED on `chore/perotin-rename-photo-prestage-2026-05-21` (`05eb5df`).** Single blocker: `executeMigration` (lines 220-239 of `cleanup-rename-avatar-logo-to-photo-2026-05-21.ts`) destroys file linkage. Today dead code (0 instances per probe), but the runtime manifest enumeration in `buildInstanceEntries` is the explicit safety net for "value uploaded between dry-run and live-run." If that net catches a real value at live execution, the DELETE+POST pattern as coded silently drops the S3 file binding. Fix BEFORE upstream PR merges + auth gate clears, because the auth gate is the LAST gate — Bentham GREEN is intentionally not it.

[PATTERN] **File-property DELETE-then-POST needs full file payload preserved.** `[{type: 'photo'}]` posts an EMPTY photo property; the file metadata (`filename`, `md5`, S3 key, `filesize`, content-type) must round-trip from the DELETEd value to the POST body. The findings doc `docs/migration/findings/v4e-rename-avatar-logo-to-photo-2026-05-21.md:85` prescribes the right shape: `[{type: 'photo', filename: ..., md5: ..., ...}]`. The probe captures only `filename` and `filesize`; need to also capture `md5`, S3 key, content-type, plus whatever Entu's POST handler needs to attach to an existing S3 object. **Open question** — does Entu's POST-with-file-fields actually re-link to a pre-existing S3 object, or does it always require a fresh upload? Verify with a `_probe_` against a throwaway entity with a real file value before trusting this migration path on live data. If Entu requires fresh upload, the rename CAN'T be done as a DELETE-then-POST on file properties at all — would need an Entu-side property-rename API, or accept-data-loss. This open question alone may force a redesign of Layer 2 distinct from Layer 1.

[PATTERN] **Empty-probe-today ≠ safe-to-defer for runtime-enumerating scripts.** The "0 instances today" probe result is a snapshot, not a guarantee. Any script whose manifest is built at runtime from a live `listEntities` call must have its dead-code paths correct, because the gap between dry-run and live-run is exactly when uploads can land. Reviewer posture: code-review the dead path AS IF it will fire; don't carry it forward as YELLOW just because the count is zero today.

[PATTERN] **`EntuProperty` type interface is incomplete for file values.** `lib/entu-client.ts:32-38` declares only `string`, `number`, `boolean`, `reference` — no `filename`, `md5`, content-type, S3 key. Any future file-property mutation script will need either an extended `EntuProperty` shape or a separate `EntuFileProperty` interface. Right now there's no type-safe way to write the migration POST even after the data is captured. Tangential to the RED but worth flagging.

[GOTCHA] **Probe's `enumerateInstanceValues` undersamples file-value fields.** `probe-rename-photo-impact-2026-05-21.ts:169-176` captures `filename`, `filesize`, `string` but no `md5`, no S3 key, no content-type. Even if the migration script's POST shape gets fixed, the probe's captured-data shape is the upper bound on what the live-run can reconstitute. Probe needs widening before the migration script can correctly handle non-zero instances. Today this is moot (probe found 0 values), but the gap exists.

[CHECKPOINT] Verdict sent to team-lead. Open follow-ups: (a) Pérotin fixes Layer 2 to round-trip full file payload OR documents Layer 2 as a separate live-run gate (one for prop-def, one for instances); (b) probe widening to capture all file-value fields; (c) `_probe_` against Entu to verify whether POST-with-file-fields re-links existing S3 object or requires fresh upload. Migration timeline likely shifts: rename prop-def safely today (Layer 1 only); instance migration deferred until Layer 2 wire shape is empirically confirmed. The "prop-def rename only" Layer 1 path is GREEN-equivalent in isolation — it's the bundle that's RED.

[DECISION] **Re-review (task #15) on `ea1a2b1`: GREEN.** Pérotin took Option A (split). RED-1 fully resolved: original 466-line combined script DELETED; replaced by 329-line `cleanup-rename-photo-prop-def-only-2026-05-21.ts` with no `executeMigration`, no `buildInstanceEntries`, no `migrate_instance_value` manifest kind. Manifest type narrowed to `'rename_prop_def' | 'skip'`. YELLOW-12.3 (dead `_type.string` query in probe `findPropDef`) closed (~13-line cleanup). YELLOW-12.1 + YELLOW-12.2 + Layer 2 empirical probe deferred to task #14, acknowledged in header comment. Layer 1 wire shape, idempotency, manifest discipline, `--live` gate, halt-on-surprise, post-verify, `_thumbnail` smoke — all preserved from prior Layer 1 path, verified line-by-line. Skip path now materializes as `'skipped'` outcome in artifact (improvement over prior shape where skipped entries silently dropped from manifest). Branch ready to merge once entu/research PR lands + PO authorizes.

[PATTERN] **Split-the-script-by-blast-radius is the cheap unblock when one layer is RED.** When a bundled migration has a clean Layer N and a problematic Layer N+1, splitting into two scripts (one ships now, one deferred-with-task) is consistently faster than fix-in-place. Three forces work in its favor: (a) the clean layer unblocks downstream consumers immediately; (b) the deferred layer's open questions get their own probe/empirical-verification budget without timeline pressure; (c) the audit trail is cleaner — one PR = one clearly-bounded migration outcome. First exercised on RED-1 (photo-rename, task #12 → #15). Carry forward to future bundled-migration RED-1-style verdicts: lead with "split here" as the recommended fix path before "fix in place."

[CHECKPOINT — session 12 close] Two reviews delivered: task #12 RED (photo-rename Layer 2 file-payload bug, `05eb5df`) → task #15 GREEN (Option A split, `ea1a2b1`). Branch `chore/perotin-rename-photo-prestage-2026-05-21` parks ready-to-merge pending entu/research PR upstream + PO "I authorize." Task #14 (Layer 2 instance-value migration with empirical probe of Entu file-POST semantics) created and deferred. **Carryforward YELLOWs into session 13**: #19 CSRF gate (still pending first cookie-authed BFF mutation route), #32 Tailwind OKLCH (next upgrade), task #14 file-value plumbing (when avatars start landing or BFF needs `_thumbnail` on real data). Review surface unchanged from session-11 close: BFF/auth (Josquin) + frontend (Byrd) work consuming v4E shape — first security-critical-path reviews of the migration era. New RED triggers encoded this session: (a) any `await import(<pkg>)` purely as installed-check (session-11 carryforward, fixed by `existsSync` probe shape); (b) any DELETE-then-POST migration script touching file properties without round-tripping full file payload (md5/S3 key/content-type); (c) any runtime-enumerating migration with incorrect dead-path code — empty-probe-today is not safe-to-defer.

---

## 2026-05-21 — Session 11: CHORE-3 + YELLOW-3.1 post-write

[DECISION] **CHORE-3 (#3) verdict: GREEN with 2 carryforward YELLOWs.** Squash-merged as `7bf0d8f`. All 5 AC verified; 301/301 tests; `pnpm check` 0 errors; TDD chain strictly monotonic (Tallis 19:37 → Byrd 19:44 → Comenius 19:48); zero security-critical surface changes; 4-locale parity + alphabetical sort verified. `vitest.config.ts` scope-drift from Byrd authorized retroactively by team-lead — `mergeConfig(viteConfig, ...)` is the standard SvelteKit+Vitest pattern.

[DECISION] **YELLOW-3.1 fix (`6e8c0f4`) post-write verdict: GREEN.** 13-line refactor — spec replaces `await import('@inlang/paraglide-sveltekit')` with `existsSync(node_modules/@inlang/paraglide-sveltekit/package.json)`; `vitest.config.ts` reverts to standalone `defineConfig` shape (byte-identical to pre-CHORE-3). Substantively the minimum-diff fix I'd have specified myself.

[PATTERN] **Spec-probe shape: filesystem check, not runtime import.** When a test's intent is "is package X installed?", use a `node:fs` filesystem probe against `node_modules/<package>/package.json`, NOT `await import('<package>')`. Dynamic-import probes drag in the package's runtime entry, which can require build-time transforms (Svelte, JSX, TypeScript decorators, etc.) that force the test-harness config to merge with the production Vite config. Filesystem probes stay node-only and let `vitest.config.ts` stay decoupled. **RED trigger going forward**: any new spec that uses `await import(<package>)` purely as an installed-check (i.e., the imported module value is never asserted against meaningfully — just `expect(mod).toBeDefined()` or similar). The shape signals an intent that filesystem probes serve better. Origin: YELLOW-3.1 (CHORE-3 follow-up).

[PATTERN] **Process-deviation calibration — branch-discipline scope.** Branch-discipline (chore branch + formal Josquin merge for follow-ups) is **load-bearing** for: (a) multi-author handoffs, where the branch IS the unit of ownership transfer, and (b) risky changes, where the PR review surface is the gate. It is **ceremony** for: single-author cosmetic refactors with a pre-existing reviewer-spec'd YELLOW and a clean minimum-diff implementation. When a YELLOW-carryforward fix lands direct-to-main and is substantively clean, lean "accept-as-is + coach the path" over "reset + redo." Punishing correct work because the routing skipped a step trades substance for procedure. First exercised on `6e8c0f4` (YELLOW-3.1) — recommended A (push as-is) to team-lead. Carry forward: when reviewing future process-deviation incidents, weigh (a) blast radius, (b) single- vs multi-author, (c) whether the deviation negated any review surface that actually catches bugs.

[GOTCHA] **Squash-merge file-count shift can look like a regression.** Pre-merge `pnpm check` reported 488 files; post-merge (at `6e8c0f4`) it reports 473. Not a regression — squash-merging paraglide artifacts changed what `svelte-check` enumerates (generated `src/lib/paraglide/` files shifted from staged-untracked to gitignored). Watch for this pattern: file-count changes around major scaffolding merges are often artifact-of-gitignore-resolution, not real coverage loss. Spot-check by re-running pre and post to confirm direction; only escalate if errors/warnings change.

[CHECKPOINT — session 11 close]
- CHORE-3 closed (`7bf0d8f`) + YELLOW-3.1 closed (`6e8c0f4` pending push or pushed depending on team-lead choice between A/B).
- **Open YELLOWs carried forward**: #19 CSRF gate (fires on first cookie-authed BFF mutation route); #32 Tailwind OKLCH (fires on next Tailwind upgrade); YELLOW-3.2 commit-body process note for paraglide CLI artifacts (cosmetic, owner Byrd).
- Review surface going into session 12: BFF/auth (Josquin) + frontend (Byrd) work consuming the v4E shape; first security-critical-path reviews of the migration era. YELLOW-1 (#19 CSRF) becomes active the moment the first cookie-authed mutation route lands.

---

## 2026-05-21 — Session 10 start: scratchpad prune

[CHECKPOINT] Pruned sessions 2-8 narrative entries into the `[PROCESSED]` block at the bottom. Full prior content reachable via `git log --follow teams/mvox-dev/memory/bentham.md`. Session 9 retained verbatim because Phase D patterns/YELLOWs are still active for follow-up task #64.

## 2026-05-21 — Session 10: Phase C live execution complete

[DECISION] **Phase C bundle GREEN post-execution.** All 5 sub-ops on live polyphony exit 0, errors=[]. 17 instance/value DELETEs + 23 prop-def DELETEs + 4 type-def DELETEs = 44 total ops (within spec 35-50 estimate, matches preflight). C.3/C.4/C.5 `postDeleteVerified: true`. C.5 `crossScriptGatePassed: true`. Per-script verdicts:
- **C.1 inventory_copy** (`b01b940` + live `3a4838b`) — GREEN
- **C.2 participation** (`37097c3` + live `3a4838b`) — GREEN
- **C.3 affiliation** (`08e60dd` + live `3a4838b`) — GREEN; 4 instances + 5 prop-defs + 1 type-def deleted; preservation captured 19 property keys per instance including all rights triples
- **C.4 member.role** (`c90da6e` + fix `9059e78` + live `3a4838b`) — GREEN; 8 property-values + 1 prop-def deleted; `deletePropertyValue` (→ `/property/{id}`) used correctly for the 8 values, `deleteEntity` (→ `/entity/{id}`) for the prop-def — wire-shape split honored
- **C.5 role-type** (`c09bebb` + fix `9059e78` + live `3a4838b`) — GREEN; 5 instances (Owner/Admin/Librarian/Conductor/Section Leader) + 5 prop-defs + 1 type-def deleted

[PATTERN] **Pre-flight YELLOW close-before-gate threshold revision (calibration update).** During Phase C pre-execution review I rendered "bundle GREEN with 2 YELLOWs, do NOT block auth-gate" (`c90da6e` C4-1: hardcoded-vs-live-IDs preservation; `c09bebb` C5-1: hardcoded list iterated despite preflight doc explicitly recommending dynamic enumeration). My framing: "post-delete verifies are sufficient safety net; carryforward-acceptable." PO override → fix-before-gate. Pérotin's `9059e78` added 5 lines to C.4 (per-member missing-IDs check) and 31 ins/10 del to C.5 (live-iterate primary + hardcoded-as-sanity-check + `displayNameMap` for logging). Total fix cost: ~5 minutes Pérotin + one re-review cycle. **Revised heuristic for live-data-mutation scripts: when (a) the fix is small AND (b) the gain is a new drift class detected at pre-flight (not post-execution), fix-before-gate is cheap and PO-aligned.** My carryforward-default underweighted "catching surprises before any irreversible op runs vs at the halfway point." Not a new architectural pattern; review-style calibration on YELLOW-blocks-gate vs carryforward threshold.

[PATTERN] **`displayNameMap.get(_id) ?? _id` is the right shape for hardcoded-name resolution when live iteration is primary.** When iterating live results but wanting to log human-readable names, build a Map from the hardcoded preflight list (with `_id → displayName`); resolve with fallback `?? inst._id`. The fallback is belt-and-suspenders (the sanity-check ensures every live `_id` IS in the hardcoded set before reaching the loops), but harmless and self-documenting. Pérotin's `9059e78` C.5 fix is the reference shape.

[PATTERN] **C.5-style sanity-check layer ordering**: count check → ID-membership sanity-check → cross-script gate → display-resolution → preservation → deletion. Each gate halts before any modification or capture. The sanity-check goes AFTER the count check (cheap fail-fast) and BEFORE any work that depends on iteration over `liveInstances`. Carry forward to future Phase X+ scripts that mix live enumeration with hardcoded preflight references.

[GOTCHA] **Preservation source mismatch is acceptable when pre-flight guards match it.** C.4 preservation block writes the hardcoded `MEMBER_ROLE_VALUES` (memberId + roleValues with _id + reference + displayName), NOT a fresh live fetch. This is acceptable AFTER `9059e78` because the C4-1 pre-flight check now asserts the hardcoded `_id`s ARE present live before any deletion — so by definition the preservation data is consistent with what was actually deleted. If the pre-flight check ever gets removed or weakened, the preservation block becomes potentially stale and the audit-trail rollback recipe potentially incorrect. Watch for this if future scripts add similar hardcoded-preservation shapes; the dependency on the pre-flight check is implicit but load-bearing.

[CHECKPOINT] **Polyphony db → v4E migration (task #6) substantively complete.** Phases A, B, B.1, C, D all done. Live polyphony aligns with v4E `schema.ts` across all migration surfaces. Forward-looking work (seeds, BFF contracts, frontend) consumes the v4E-clean shape. Task #6 closeable by team-lead pending AC bullet verification (Step 9.4 of plan).

[CHECKPOINT] Reviewing posture going forward: no live-data-migration in active queue. Next active items likely Josquin/Byrd BFF + frontend work consuming the v4E shape. Reset of review surface — security-critical-paths reviews (`src/lib/server/entu/`, `src/lib/server/auth/`, `src/hooks.server.ts`, `src/routes/api/**`, `src/routes/**/+server.ts`, `src/routes/**/+page.server.ts`) become the primary territory. YELLOW-1 carryforward (#19 — CSRF gate at first cookie-authed mutation route) is now relevant whenever the first such route lands.

[CHECKPOINT — terminal state, session 10 close] **Phase C closed on `f3529b7`** (team-lead Step 9.4: 9/9 AC PASS, task #6 marked completed). Migration body of work substantively done. Post-execution review delivered zero new YELLOWs — every load-bearing assertion in the 5 live artifacts matched plan Step 9.2 exactly. Carryforward YELLOWs at session-10 close: **#19 (CSRF gate, fires on next BFF cookie-authed mutation route PR)** and **#32 (Tailwind OKLCH, fires on next Tailwind upgrade)**. No other open items in my queue. Session 11 should expect review surface to be BFF/auth (Josquin) and frontend (Byrd) work, not migration scripts.

---

## 2026-05-21 — Session 10: #60 closeout + #64 GREEN

[DECISION] **#60 (YELLOW-15) closed without addition.** YELLOW-15 pattern (formula-cache + `_id` interaction for preserve-then-restore sanity checks) is fully captured by the Corollary paragraph in `architecture-decisions.md:17` ("Entu formula-to-plain conversion mechanic" entry). All 4 elements of team-lead's framing (mechanism + 2 mitigations + "skip on entities without `_id`-bearing value" as positive inverse) explicitly present. Lifting to standalone `[PATTERN]` entry would duplicate, not steward. Forward-looking application of the pattern is enforced at review-time (RED-trigger when a `cleanup-*.ts` touches a formula-cached value without using either mitigation).

[DECISION] **#64 (commit `10e1c2c`) verdict: GREEN on code, 1 YELLOW on commit-message typo.** All 5 fixup items verified:
- **D1**: Skip path writes artifact + Pérotin chose `sanityCheckPassed = null` (not `true`) on skip — more honest than my framing demanded.
- **D3**: `newValueId` captured in all 4 result-push branches from GET-after-POST response. Semantically clean (SET_FALSE=new id; ALREADY_FALSE=existing id; DRY-RUN/FAILED=null).
- **D5**: `originalNamePreserved` computed by Set-comparison (pre-cleanup vs post-cleanup) using `every().has()`. Would have caught session-9 PO-name-briefly-null incident. `sanityCheckPassed` semantics stay narrow.
- **D6**: Code `valueWritten: DRY_RUN ? false : true` is correct. **Commit body L20-21 has a typo** ("false on live run, false on dry run" — should be "**true** on live run, false on dry run"). Code GREEN; recommended accept-as-is over force-push-amend.
- **Dead-helper drop**: `findPropDef` + `PERSON_TYPE_ENTITY_ID` + `listInstancesByType` import all removed. Zero stray references. `tsc --noEmit --skipLibCheck` exits 0.

[PATTERN] **Post-task report vs commit message body — cross-check.** Pérotin's task report described the D6 fix as "`valueWritten: DRY_RUN ? false : true`" (the code shape that landed). The commit message body described it as "false on live run, false on dry run" — opposite of what the code says. I would have missed the typo if team-lead hadn't flagged it on hand-off, because my default scan path was: read code → match against task description. The commit message body is its own surface that can drift from both the code AND the task report. **Encode for future post-write reviews:** read the diff first, then read the commit message body, then read the task report; flag any disagreement among the three even when only one is the load-bearing source of truth (the code). The reviewer's role is to spot ALL discrepancies, including those in committed text.

[LEARNED] **Pérotin's null-on-skip pattern is better than my framing.** I asked for `originalNamePreserved` as a separate assertion. Pérotin went further: on the skip path, BOTH `sanityCheckPassed` AND `originalNamePreserved` are set to `null`, signalling "no operation performed → no assertion applicable." Setting either to `true` on skip would re-introduce the D5-class confusion (asserting success without performing the test). Carry forward: when adding new assertion fields to result artifacts, default to `null` on paths where the assertion would be meaningless. `true`/`false` should reserve themselves for paths where the assertion was actually computed.

[CHECKPOINT] Phase D YELLOW backlog fully drained. No outstanding Phase D items. Active Phase items now: Phase C structural-migration design (not started). My scratchpad open-watch list:
- **Phase C readiness review** when team-lead/Victoria drafts a design spec.
- **Authorization-gate first exercise** — Phase C will be the first phase to actually use the explicit "I authorize" token. Watch for the friction point + log it.
- **`cleanup-*.ts` future RED triggers** (per #60 forward application): any script touching formula-cached values must use either mitigation (throwaway entity OR `_id`-bearing seed instance) — RED otherwise.

---

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

[DEFERRED] **Session 10 expected focus:** Phase C structural migration design (inventory_copy → copy+lending; participation → rsvp+attendance; affiliation retirement; role retirement). Significantly higher-stakes than Phase D — new entity types, multi-instance data movement, and the new authorization-gate process to exercise. Review posture additions: (a) per-instance data preservation check (no orphans); (b) new-type prop-defs all v4E-clean; (c) the authorization-gate friction — Bentham should refuse to GREEN a live-execution path until team-lead's "I authorize" token lands.

[DEFERRED] **Session 10 first reads on startup:** (1) any task #64 fixup commit landed between sessions — review on cold-read; (2) Phase C design spec if Victoria/team-lead drafted between sessions; (3) ~~scratchpad prune (`[PROCESSED]` tagging of session 6-8 entries)~~ — done at session-10 start, see top.

---

## [PROCESSED] Sessions 2-8 — pattern catalogue + pointers

Full narrative for sessions 2-8 reachable via `git log --follow teams/mvox-dev/memory/bentham.md` (pre-2026-05-21 prune). This block keeps only the load-bearing review patterns and decisions that future-Bentham needs for fresh reviews; per-PR narratives, GOTCHA-CORRECTIONs, and decision logs are in commit history.

### Calibration baselines (Session 2, 2026-05-18)

- **Stack-table conformance** is enforceable. Every row in `common-prompt.md` Stack table → RED on violation.
- **Repo layout is flat single-app** (no `apps/` or `packages/`). Old polyphony paths (`apps/vault/`, `apps/registry/`, `packages/shared/crypto/`) are dead.
- **Security-critical paths**: `src/lib/server/entu/`, `src/lib/server/auth/`, `src/hooks.server.ts`, `src/routes/api/**`, `src/routes/**/+server.ts`, `src/routes/**/+page.server.ts`.
- **v4E RED triggers** (7): multi-hop formulas; `type: reference` on formula property; formula projecting raw values across rights boundaries; new BFF route in elevated mode without entry on the empty-seeded enumerated list; `_owner`/`_editor`/`_viewer` grant on org-subtree without active `member`; client code calling `https://entu.app` directly; flipping `_inheritrights: false` boundary without a v4E schema change.
- **Schema-mutation gate**: PR touching v4E entity types/properties/formulas/rights defaults must carry `Schema-Change: entu/research@<sha>` + `PO-Approved: ...` trailers — UNLESS it's schema-alignment (live data → already-landed schema), see session-9 carve-out above.
- **Per-value `_sharing` warning DROPPED** per PO calibration. Don't add to checklist.

### Review-method patterns (sessions 2-8)

- **Worktree-trust rule**: never read source via worktree state; always `git show <sha>:<path>`. Untracked WIP shadows commit content invisibly. (Origin: session-2 [GOTCHA-CORRECTION] CHORE-1 PR.)
- **Worktree-create rule** (extension): never `git checkout <sha> -- <paths>` for a review on a non-target branch — materializes review files onto the wrong branch index. Use `git show` only. (Origin: session-7 [GOTCHA-CORRECTION-2] Phase B v1.)
- **Test-flake hygiene**: build-output / static-config assertions belong in Vitest; only assertions requiring a live SvelteKit server belong in Playwright.
- **Test-after-implementation pin posture (additive lib changes)**: when consumer-side test already exercises new behavior indirectly, a direct lib-side test is allowed as a follow-up YELLOW pin, not RED. (Origin: PR #58 / YELLOW-14.)
- **Wire-shape novelty rule**: any callback hitting Entu with a verb+path not already exercised against live Entu requires either (a) an empirical probe in `docs/migration/findings/`, or (b) explicit YELLOW with "unverified wire shape; needs probe before merge". Test-passing-only is NOT GREEN-worthy for new wire shapes. (Origin: v6 false-GREEN on deleteProperty → v12 wire-shape bug.)
- **Live-execution incidents are first-class test inputs**: v12 (15/44 live failures) and v13 (Phase B re-run UPDATE_FORMULA failure) both produced oracle-confirmed RED+GREEN cycles. Demand this for any partial-failure rerun.
- **Refactor-PR scope discipline**: define API up-front + freeze; inline-vs-extract is per-function; call-site migration in the same PR (no dangling old helpers). (Origin: Pérotin toolkit-extraction proposal.)
- **Refactor-PR sequencing**: smallest-blast-radius first; observations carry forward across PRs (e.g., dead-import sweep). (Origin: PRs B-E toolkit consumer refactors.)
- **GREEN-after-YELLOW cycle**: YELLOWs that specify exactly what's wrong unblock fast (~15-min proposal-to-GREEN); vague YELLOWs ("the shape feels off") don't.

### Migration script anti-patterns (sessions 5-8)

- **Scope-filter blind spot on partial new-type creation**: any phase script with hardcoded scope map must include `PHASE_X_NEW_TYPES` set + `bypassScope` guard before scope check, or accept manual recovery with PO sign-off. (Origin: PR #26 YELLOW → PR #27 GREEN.)
- **Op-switch completeness**: every DiffOp kind the diff emits needs an explicit dispatch branch + an "every op kind reaches a handler" assertion in the integration spec. (Origin: Phase B v2 missing ADD_PROPERTY handler.)
- **Diff op shape must encode iteration target when it differs from source**: e.g., `parent_copy` (work.arranger → edition.arranger) needs `targetParentType` to iterate editions, not works. (Origin: Phase B v5 RED → v6.)
- **Try-scope discipline**: bare-catch wrapping multi-statement try → over-scoped error absorption. Narrow the try to only the call whose failure mode the catch can recover. (Origin: YELLOW-12 updateFormula bare-catch.)
- **Property records ≠ entities even when both expose `_id`**: prop-def `_id` → `DELETE /entity/{id}`; property-value `_id` → `DELETE /property/{id}`. Don't share a single helper across both. (Origin: v12 Bug-1 + PR #56.)
- **Empirical wire-shape table** for Entu mutations (UPDATE/REMOVE/DELETE_ENTITY/POST-boolean) is in `architecture-decisions.md` "Entu mutation-op wire shapes" entry. Reference rather than re-derive.
- **`verifyDeleteSafe` Probe 1 type-blindness is acceptable safety posture**: false positives block legitimate deletes (recoverable: manual override); false negatives destroy formula dependencies (unrecoverable without snapshot restore). Conservative posture wins. (Origin: org.member_count false positive Phase B post-execution.)
- **Probe limits**: list-endpoint probes used as "are there instances?" checks need `limit=500`, not 10. Undercounts drive cleanup-script blind spots. (Origin: YELLOW-13 Probe 2.)
- **Error-message info-leak surface**: any migration script capturing Entu error bodies into persisted reports should sanitize JWT-bearing substrings. Not actionable yet; watch if Entu echoes auth context. (Origin: PR #26 review.)

### Toolkit conventions (sessions 8)

- All lib functions take `EntuClient` (carries apiBase + db + jwt). `getJwt` is the only flat-args carve-out.
- `deletePropertyValue(client, propValueId)` — `/property/{id}`. `deleteEntity(client, entityId)` — `/entity/{id}` (covers prop-defs too). Never share a helper across both.
- `postProperties(client, entityId, properties: EntuProperty[])` — array shape, matches `createEntity`.
- `replaceProperty(client, entityId, propType, currentValueIds, newValue)`: skip DELETE phase when `currentValueIds` empty; `{ ...newValue, type: propType }` shape (propType authoritative).
- `findOrCreateByName(client, typeName, name, parentId?, propsIfCreating)`: scopes by `_parent.reference` when `parentId` provided. Internal race-safe double-check.
- `writeResultArtifact(slug, payload, { at: Date })`: shared `at` between filename + payload `executedAt`. Anchors at `scripts/migrations/seed-results/<slug>-<ISO-ts>.json`. Pretty-printed JSON (`null, 2`).
- `findOrCreateByName` is for name-keyed entities only. Member is keyed by `person.reference` + `_parent.reference`, not name — inline check IS the idempotency gate; the `findOrCreateByName` race-skip branch is decorative on member.
- "Try/catch as existence check" idiom on a throwing helper (e.g., `fetchEntity`) is canonical: `try { await fetchEntity(...); /* exists */ } catch { /* not found */ }`. Cleaner than threading `notFoundOk: true`.

### YELLOWs from BFF skeleton (CHORE-5, still open)

- **YELLOW-1 (#19)**: CSRF posture on `POST /auth` is implicit-by-api-key. Demand explicit Origin check or token-pair CSRF on the first cookie-authed POST/PUT/DELETE that lands.
- **YELLOW-2 (#20)**: `DEFAULT_BASE_URL` duplicated in `client.ts:1` + `+server.ts:4`. Lift to `src/lib/server/entu/config.ts`. Cosmetic 4-line followup.
- **`process.env` direct read in server-only modules** is the chosen convention (not `$env/dynamic/private`). Works in Node + CF Workers.

### Open YELLOWs not yet addressed

- **YELLOW-D1/D3/D5/D6 + cosmetic `findPropDef` cleanup** — queued in task #64 (Phase D fixup commit). See session-9 [DEFERRED] above.
- **#32 (Tailwind OKLCH)**: relax assertion on next Tailwind upgrade. CHORE-scoped, not blocking.

### Phase A → B → D timeline anchors

- **Phase A** (renames + new types, no instance data): PRs #26 + #27 merged 2026-05-19/20.
- **Phase B** (data backfill + instance migration): live-executed 2026-05-20; 4 blockedDeletes carried to Phase B.1 (`9fe6799`). Toolkit extraction PRs A-E merged 2026-05-20.
- **Phase B.1** (instance cleanup of blocked deletes): merged.
- **Phase C** (structural migration: inventory_copy → copy+lending; participation → rsvp+attendance; affiliation/role retirement): NOT STARTED. Session 10 expected design start.
- **Phase D** (rights flips + sharing alignment + DEPRECATED cleanup): substantively complete session 9 (commits `da711f2 → 850b7c4`). 5 YELLOWs in task #64.

### Author identity carryover

Pre-`db3c224` commits don't carry `Co-authored-by: Mihkel Putrinš <mihkel.putrinsh@gmail.com>` — accepted state, don't RED. Post-hook-install: missing trailer on a new commit is YELLOW (mechanical) unless deliberate, then RED.

(*MVOX:Bentham*)
