# Palestrina — Team Lead Scratchpad

### [NEXT SESSION] 2026-05-21 — session-8 → session-9

**Session 8 outcome:** Phase B + B.1 fully complete on polyphony; toolkit extracted + applied across 4 scripts; all 3 session-8 Bentham YELLOWs (12/13/14) resolved. main HEAD: `6260ee7`. Working tree clean.

**Session 8 commit chain (17 commits, all on main):**
1. `612d3eb` FR audit cleanup (#55) — paths + drift + polyphony-isms
2. `4bc1831` Phase A final dry-run report committed; 5 stale iterations dropped
3. `c88487a` (#52 + #54) Phase B YELLOW carryforwards — bare-catch + limit undercount
4. `296278e` (#44) v11 parent_copy delegation
5. `d0ab9da` Pérotin toolkit-extraction standing concern (7th in his "Between dispatched work")
6. `9fe6799` (#53) Phase B.1 — 4 blocked deletes cleared
7. `a7b4774` (#56) wire-shape fix — `/property/{id}` vs `/entity/{id}` split
8. `b7aad90` Phase B final re-run report — exit 0, `section.member_count` self-cleaned
9. `a6ed6bb` (#47) seed-collectives + mutation-ops probe
10. `43517ac` architecture-decisions session-8 entries (seed-data shape + Entu mutation wire shapes)
11. `30a8847` wire-shapes findings doc
12. `0cda89f` PR A — toolkit extraction (5 lib + 4 toolkit helpers)
13. `db19ecf` PR B — probe-mutation-ops uses toolkit
14. `8495883` PR C — seed-voices uses toolkit
15. `9565363` PR D — phase-b-1-cleanup uses toolkit
16. `1d8b562` PR E — seed-collectives uses toolkit (toolkit workstream complete)
17. `6260ee7` (#58 YELLOW-14) lib extraQuery test pin

**Live polyphony state at end of session 8:**
- 6 orgs + 16 sections + 5 voices (unchanged from session 7)
- 115 pre-v4E real members (was 116; Mait Vaher deleted as practice op)
- 120 v4E-clean seed persons + 120 v4E-clean seed members (new, alongside the 115 real)
- 0 obsolete prop values remaining for the 4 Phase B.1 blocked deletes
- EFK Soprano section's residual `ordinal` value removed (practice REMOVE op)
- `organization.member_count` prop-def deleted (practice + Phase B.1 op #4)
- `section.member_count` formula clean (1 value: `(_child.member COUNT) (_child.section.member_count SUM) +`)

**Carry-forward queue for session 9 (priority order):**

1. **Phase C design** — biggest item, brainstorming session with PO. Structural migrations: inventory_copy → copy+lending (data migrate + retire inventory_copy); participation → rsvp+attendance split; affiliation → _parent links + retire affiliation; member.role → rights grants + retire role. **Probably a full session of work alone.**

2. **Independent chores (unblocked):**
   - CHORE-3 (#3) Paraglide i18n — open AC question: gitignore vs commit `src/lib/paraglide/`. Comenius will recommend on spawn.
   - CHORE-4 (#4) Vitest + Playwright docs — ~90% done; needs CONTRIBUTING.md co-location section. Fast close.
   - CHORE-6 (#6) Email Resend — blocked on PO SPF+DKIM DNS records.

3. **Loose YELLOWs to fold into future PRs:**
   - #19 CSRF gate — review-gate for next BFF cookie-authed mutation route PR
   - #20 DRY DEFAULT_BASE_URL — 4-line cosmetic; fold into next `src/lib/server/entu/` PR
   - #32 Tailwind OKLCH regex — relax on next Tailwind minor upgrade

4. **Phase D — task #41 scope narrowed**: per Pérotin's session-8 schema read, v4E `person` ALREADY declares plain `name: string` (no forename/surname). Phase D scope is just: backfill `person.name` from polyphony's live `forename` + `surname`, delete those two props on instances + retire prop-defs. No `Schema-Change` trailer needed (no v4E modification). Also `_inheritrights: false` flip on 6 org instances + retire `_DEPRECATED_*` types.

5. **Pérotin standing-concern follow-ups (low priority):**
   - Result-artifact directory naming question (`seed-results/` vs `run-results/`) — deferred to a separate cosmetic PR per Bentham
   - `findOrCreateByQuery` (custom lookup-key) — only if a third non-name-keyed seed entity surfaces

**Expected first action session 9:**
1. Verify statusline on launch (`cd ~/workspace && claude`).
2. Read this seed + recent commits since `6260ee7`.
3. Spawn finn + bentham + Pérotin per Phase 5.
4. Confirm with PO: Phase C design? Or different starter?

**Brilliant KB updates (deferred):**
- Update `Projects/polyphony` body: Phase B + B.1 + toolkit complete; Phase C unstarted.
- New: `Patterns/migration-toolkit-extraction` documenting PR A-E sequence (smallest-blast-radius-first; observations carry across PRs).
- New: `Patterns/seed-data-v4e-clean` — schema-wins-when-conflicts-with-live rule.

**Process lessons from session 8 (worth carrying forward):**
- **L12 — Cross-fire on multi-agent handoffs (re-occurrence).** When Pérotin's revised proposal crossed my forwarding-to-Bentham message in flight, the workflow recovered cleanly because both messages were content-rich. Pattern: if both messages include their own context, order doesn't matter.
- **L13 — Branch-checkout bug, team-lead variant.** I committed Pérotin's toolkit-extraction standing concern on his `chore/phase-b-1-cleanup` branch instead of main. Recovered via `git reset --soft HEAD~1` + stash + checkout main + commit. ~30 seconds; no work lost. **Rule:** verify `git branch --show-current` BEFORE every commit, not just before Bash writes generally.
- **L14 — Notification pipeline gaps.** Two Pérotin handoffs + one Bentham verdict didn't surface to me during the session. Worked around by inspecting inbox JSONs directly. Build muscle memory: if an agent seems "idle" longer than expected, check their outbound queue manually.
- **L15 — Agent context/token limits.** Bentham went silent ~16:57 (PR D review). PO suspected limit-hit; I poked at 17:02; Bentham came back at 19:12 with a full verdict 2h later. **Rule:** don't despair on silent agents. Poke after ~20-min idle window; expect possible long delays on long-context agents.
- **L16 — Refactor-PR scope discipline + smallest-blast-radius sequencing works.** 5 toolkit PRs in ~5 hours total. Each successive PR carried forward observations from the prior (dead-import sweep from C; race-safety-on-non-name-keyed-entity from E). Reviewer observations compound across PRs without surprise re-design. Carry this pattern forward to Phase C/D structural migrations.

(*MVOX:Palestrina*)

---

### [PROCESSED 2026-05-20 end-of-session-8] session-7 → session-8

**Phase B landed substantially complete.** Polyphony Entu db is now v4E-aligned for additive + rename + most-obsolete-delete + formula-update + touch-save concerns. Live execution succeeded on the 2nd attempt (1st was 15/44 failures from 3 wire-shape bugs; v12 fixed all three; re-execution exit 0 + zero failures). Merge SHA on main: `e155cc9`.

**Session-7 merge train (origin/main HEAD = `e155cc9`):**
- `87191de` chore(tallis): CHORE-5 RED checkpoint
- `a08f15b` feat(#5): Entu BFF skeleton (CHORE-5 merge)
- `6a7964c` feat(#2): Tailwind CSS v4 setup (CHORE-2 merge)
- `963bbfa` feat(migration): Phase B scaffolding + dry-run plan + 214 tests
- `e5e84a0` docs(migration): land Entu API key expiry findings
- `91c890a` docs(migration): update API key findings with Argo's authoritative answer
- `b76f9de` chore(seed): seed 5 voice instances on polyphony
- `e155cc9` **feat(migration): Phase B complete — renames + backfills + obsolete deletes + formula cleanup + touch-saves**

**Carry-forward task queue for session 8 (in priority order):**

1. **Phase B.1 — 4 blocked deletes** (task #53). Pérotin scripts to clear instance data for `organization.contact_email`, `organization.org_type`, `member.joined_at`; manual targeted DELETE on `organization.member_count` prop-def (Probe 1 false positive — prop-def `_id` is `69c7ea498489bfcb0e819e96` per pre-execution snapshot). Then re-run Phase B; the 4 ops succeed. **Phase B becomes 100% complete.** ETA ~30-60 min.

2. **Pre-Phase-C hardening:**
   - **v11 parent_copy delegation** (task #44) — refactor `buildLiveCallbacks.migrateProperty` parent_copy branch to delegate to `data-migrator.migrateProperty` (last remaining hand-rolled branch from v10 carve-out). Needs `parent_copy_lookup` pre-flight pattern. ~30 min.
   - **YELLOW-12 updateFormula bare-catch** (task #52) — split try/catch in updateFormula pre-delete loop; ~5 lines.
   - **YELLOW-13 Probe 2 limit=10 undercount** (task #54) — raise to 500; ~1 line.

3. **Pérotin's collectives manifest** — on `chore/seeding-source-plan` branch (HEAD `c15df7a`); 4 collectives, 120 members, 38% with `@example.ee`, all orphan. PO reviewed approach + answered 5 questions but final review of the JSON manifest pending. May need `seed-collectives.ts` script written before merge (or merge as proposal artifact only and write script later).

4. **Phase C design** — structural migrations: `inventory_copy → copy+lending` (data migrate; retire inventory_copy), `participation → rsvp+attendance` split, `affiliation → _parent links` (retire affiliation), `member.role → rights grants` (retire role). Riskier than B — touches existing instance data + rights model. **Recommend brainstorming skill** with PO to design spec; then RED/GREEN/REVIEW cycle. Probably a full session of work alone.

5. **Phase D design** — rights/sharing flips: `organization._inheritrights: false` on type + 6 org instances + retire `_DEPRECATED_*` types + §2.8 person.forename/surname deletion (task #41 from session 7). PO-decision-heavy.

6. **CHORE-3 Paraglide i18n, CHORE-4 Vitest+Playwright docs, CHORE-6 Email Resend** — still pending. #6 awaits PO's SPF/DKIM DNS action. #3 and #4 are unblocked.

7. **Session-7 deferrals to track:**
   - `bentham.md` scratchpad has 11+ unwritten review entries (v2/v3/v5/v6/v7/v9/v10/dry-run-RED/dry-run-GREEN/v12/post-exec). Bentham deferred per his [GOTCHA-CORRECTION-2] cross-branch checkout concern. Team-lead can write them via Edit at any convenient session-8 start — or leave for Bentham to handle now that branches are no longer in flight.
   - Task #19 (CSRF gate at first cookie-authed mutation route) — review-gate for next BFF PR
   - Task #20 (DRY DEFAULT_BASE_URL in BFF) — 4-line cosmetic; fold into next `src/lib/server/entu/` PR
   - Task #32 (CHORE-2 OKLCH brittleness) — relax regex on next Tailwind upgrade

8. **[FROM FR-Aen, 2026-05-20]** — three structural decisions surfaced during FR-side audit (Medici + Celes) of mvox-dev, deferred to your judgment for session 8:

   - **Path convention drift (substrate-invariant-mismatch shape).** `~/projects/entu-research/...` appears across 4 prompts (byrd L58, josquin L104-105, tallis L65, perotin L77) + memory files (finn L11-12, architecture-decisions L15+L71+L105). `~/workspace/...` appears in perotin's STARTUP + memory/team-lead L43+L213+L221. Neither resolves on Windows-dev. Both auditors recommend Option 3 (hybrid): declare `~/workspace` as substrate-convention (Linux container) in common-prompt or startup.md header; convert `~/projects/entu-research/...` to env-var or repo-relative form. Multi-file rolling change; pick the resolution at session-8 start.

   - **CLAUDE.md drift (repo-root, neither prompts/ nor memory/ scope).** L25-26 still says "**8 members**" — factually wrong post-Pérotin promotion (9 in roster, all now permanent). L26 also says "still being adapted — see FIXME markers" — most FIXMEs are resolved (only palestrina.md L76 remains, see next bullet). L27 says "stack table marked TBD" — stack landed session 2. Likely a 5-minute direct edit by you or PO.

   - **Polyphony-isms in 3 prompts (PO decision: scrub vs reframe vs keep).** `palestrina.md` L76 — FIXME on polyphony D1 remote-migration protocol (common-prompt's "v4E Schema Mutations" section at L181-192 supersedes it). `victoria.md` L46 — "Private Circle defense" in MUST Escalate (polyphony-specific copyright strategy; mvox legal stance is TBD per PO). `bentham.md` L123 — "legal framework" in MAY READ docs/ list (same polyphony-ism). All three are prompt-side surface; Medici cross-confirmed that `architecture-decisions.md` has 3 polyphony references which are correctly historical and were left alone in his audit. The prompt-side echoes are less defensible (imply ongoing concern for non-mvox concept). PO ruling needed before any edits land.

   These are non-blocking for session 8 day-of-work, but worth surfacing to PO early so they don't fall off. (*FR:Aen*)

**Pérotin promoted to permanent member (this session).** Roster entry added: `name: perotin, model: claude-sonnet-4-6, color: orange, prompt: prompts/perotin.md, spawn: on-demand`. Full prompt lives at `teams/mvox-dev/prompts/perotin.md`. Lore: Pérotin of Notre Dame (c.1160-c.1225, expanded organum from 2-voice to 3-4 voice). Role: data manager — seed scripts, migration-time write probes, dev/staging refreshes, anonymization, data quality reports. Operates out-of-band from the TDD chain. Common-prompt + startup.md updated to reflect.

**Expected first action session 8:**
1. Verify statusline on launch (`cd ~/workspace && claude` is the convention)
2. Read this seed + the carry-forward task queue
3. Check the chore/seeding-source-plan branch (Pérotin's manifest) — decide merge vs continue
4. Spawn finn + bentham per Phase 5 (always-on)
5. Make a call with PO: Phase B.1 → v11 hardening → Phase C? Or different priority?

**Brilliant KB updates needed (deferred):**
- Update `Projects/polyphony` body: "v4E migration Phase B complete at scaffolding + live execution; Phase B.1 cleanup pending; Phase C/D unstarted"
- Update `Decisions/mvox/polyphony-v4e-divergence` with Phase B executed outcome
- Possibly: new entry `Patterns/entu-data-migration` consolidating Phase A + B learnings
- New entry `Patterns/seeder-role-out-of-band` documenting Pérotin pattern

(*MVOX:Palestrina*)

---

### [PROCESSED 2026-05-20 end-of-session-7] session-6 → session-7 seed

Session 7 executed against the prior seed. Headline outcomes:
- Phase B design spec landed ✓
- Phase B scaffolding merged ✓
- Phase B live executed (with mid-session partial-failure recovery) ✓
- Pérotin permanent role landed ✓
- 13 RED/GREEN cycles on Phase B (more than 2x estimate)
- 8+ new memory entries (entu mechanics: api-key, formula-mechanics, post-appends-multi-value)

Old seed text follows for archival reference, downgraded tag.

---

### [CHECKPOINT] 2026-05-20 — session-7 lessons

Captured at session end so future-Palestrina doesn't re-discover the same things.

**L1 — Shared working-tree coordination.** Local-mode teams share ONE git working tree. When team-lead `git checkout main`s to commit a docs/finding while an implementer agent is mid-edit on a feat branch, the implementer's branch context switches under them. First time I bit on this (2026-05-20 04:25 — committing voice_type findings to main during Tallis's RED): saved by stash + switch-back, but caused needless confusion. Second time (committing Finn's Q1+Q3 findings 04:48): chose to commit on feat branch instead, deferring main landing until squash-merge. **Rule:** mid-session doc commits go on whichever feat branch is active, OR wait for "team idle" to switch. Don't `git checkout main` while an implementer's working files are uncommitted — period.

**L2 — Message cross-fire (sub-genre of session-6 lesson 1).** Two patterns observed in session 7:
- Tallis 04:32 "3 questions" message went out BEFORE my 04:26 answers landed in his inbox — he resolved them by reading the messages on next wake; no harm. But his summary read stale.
- Josquin 04:55 "two issues blocking" message crossed with my 04:59 GREEN v2 dispatch. Each was operating on the other's pre-message state. Net: I had to send a 05:00 "to synchronize" message clarifying the message ordering.
- **Mitigation:** When briefing an agent that's in flight, lead with one line: "this updates / supersedes message X from time Y". Saves the agent a state-reconciliation step. Also: be explicit about what's superseded vs. what's additive.

**L3 — Verify-before-rotate (auth-investigation pattern).** When an agent reports an external system anomaly (e.g., "key returns anonymous"), my instinct was to ask PO to rotate. PO pushed back: "you trying the same key Phase A used?". Forced a 30-sec investigation: same file, same mtime, same key. The bug was almost certainly in the agent's probe flow (raw API key as Bearer vs. JWT exchange). Then PO added "Entu might have some troubles with auth ATM" — third possibility I hadn't considered. **Rule:** before recommending external-system mitigation (key rotation, retries, escalations), verify locally first. The cheap investigation often resolves it; the expensive mitigation rarely needs to fire.

**L4 — Bentham proposing the GREEN spec mid-RED is a smell.** When I sent Josquin "Step 1: Richer fetchDbState" at 04:50 — that's TEAM-LEAD proposing the implementation shape, which is Tallis's territory (he writes the RED contract that specifies what GREEN must do). I should have written "Tallis: write RED for richer fetchDbState contract" and let Tallis specify the shape. Bentham later RED'd the orchestrator's `fetchTypesOnly` for the exact same reason — and his recommendation was the same (have Tallis write RED). Net effect: zero (Tallis ended up writing the RED), but the process bypass was telegraphed.

**L5 — Implementer agents pre-ship between checkpoints.** Tallis's RED v1 at 04:28 included full impls of phase-b-scope.ts, snapshotter.ts, data-migrator.ts, diff.ts. Josquin came online expecting stubs, found working impls, re-implemented them anyway to verify (the Write calls produced byte-identical content). **Rule:** when spec-driven impls land in a RED commit, the commit message MUST flag them ("stub impls" vs "full impls"). Otherwise the receiving agent burns cycles. Add to Tallis's prompt: if you write impl alongside the test, label it as such in the commit.

**L6 — Phase B is bigger than estimated.** Spec said "~14 operations, ~43-87 API writes." Reality: 13 RED/GREEN cycles + a partial-failure recovery cycle + 4 empirical probes (Q1+Q2+Q3+Q4+Q5) + ~2.7k lines test+impl change. Phase B alone consumed ~80% of session 7 (~4 hours of 5+). **Estimate revision for Phase C/D:** assume each phase is similar (3-5 hours of session time minimum). They probably can't both fit in one session alongside any other work. Plan accordingly.

**L7 — Reporter detail must persist failure records (or diagnostics cost 10x).** Phase B's first live execution at 08:27 had 15/44 ops fail. The reporter wrote `summary.failed: 15` but NOT the per-op `failed[].error` records. Net: ~40 min of diagnostics needed (snapshot+live diff) to identify the 3 root-cause bugs. If the reporter had serialized `executionResult.failed[]`, diagnostics would have been ~5 min (read the report). Bug 3 in v12 fixed this. **Rule for migration scripts (or any orchestration with continue-on-failure):** reporter MUST persist per-op detail, not just summary counts. Otherwise post-incident diagnostics turns into archaeology. Bake this into the design spec template for Phase C/D.

**L8 — Wire-shape tests can verify request, not response acceptance.** Bentham v6 false-GREEN on `deletePropertyByIdLive` (approved `/property/{id}` because the mock test verified the URL substring matched). Reality: live Entu returns 404 for that endpoint; correct shape is `/entity/{id}`. **Bentham's calibration lesson** (logged in his post-execution review): for any callback that hits Entu with a verb+path not already exercised against live Entu, demand either (a) an empirical probe documented in findings, or (b) explicit "wire shape unverified — will surface at first live execution" YELLOW. Don't approve GREEN on test-passing alone for unverified wire shapes. Applies to Phase C/D where new write paths land.

**L9 — Three+ agent shared-working-tree problem recurs.** Beyond L1, with Pérotin added (now 4+ active agents including team-lead), the harness's branch-auto-switch behavior bit Josquin specifically: he committed Phase B execution artifacts to `chore/seeding-source-plan` (Pérotin's branch) instead of `feat/phase-b-live-wiring`. Recovery: cherry-pick to correct branch; stray commit left on Pérotin's branch as carryforward cleanup. **Rule reinforced:** every Bash call that writes (commit, push, branch ops) must `git branch --show-current` first AND explicitly checkout if wrong. Inline it into the per-agent prompt as a checkpoint discipline.

**L10 — `verifyDeleteSafe` is doing its job (the SAFE-halt is the design intent, not a failure).** Phase B re-execution had 4 "blockedDeletes" that the team initially read as gaps. On analysis: they were the system correctly preventing data destruction. `organization.contact_email` 6/6 still hold values → blocked. `member.joined_at` instances hold values → blocked. `organization.member_count` formula-ref Probe 1 hit (false positive on word-boundary regex). These aren't failures; they're the safety contract working. **Rule:** "blockedDeletes" in reports is a signal that data cleanup is needed before the delete is safe — not a bug. Plan a Phase B.1-style follow-up pattern in Phase C/D specs for blocked deletes (data cleanup → re-run).

**L11 — Out-of-band specialist (Pérotin pattern) saves cycles.** PO's suggestion to spawn a temporary seeder role (which became permanent Pérotin) avoided the need for a CREATE_INSTANCE op kind + executor branch + live wiring + RED/GREEN cycle in Phase B. ~30 min cycle replaced with a 5-line idempotent script + 1 live run. **Pattern applies broadly:** for tactical one-off live ops (seeding, probes, cleanup), out-of-band specialist is cheaper than baking-into-orchestrator. Use Pérotin for Phase B.1 cleanup + future Phase C/D seeding.

**Session 7 state at this checkpoint (~05:07):**
- `feat/chore-5-bff-skeleton` merged (`a08f15b`); issue #5 closed
- Phase B spec on main (`6daf1e6`); voice_type findings on main (`a063135`); Q1+Q3 findings on feat branch (`c37bb66`)
- Phase B GREEN v2 in flight (Josquin closing Bentham's 4 blockers + YELLOW-1)
- Entu auth issues (PO-reported) — Q2 touch-save probe + live --dry-run held until recovery
- Tasks #19 (CSRF gate), #20 (DRY base URL) carried forward from CHORE-5 review
- About to dispatch CHORE-2 (#2) Tailwind v4 in parallel — Tallis RED + Byrd GREEN

(*MVOX:Palestrina*)

---

### [PROCESSED 2026-05-20] session-6 → session-7 — text archived, see top-of-file for end-of-session-7 status

**Phase A landed live.** Polyphony Entu db is now v4E-additive-aligned. 9 new entity types + 79 property additions committed against the live db at 03:46 UTC. Exit 0, zero failures. Full execution report at `scripts/migrations/reports/2026-05-19-phase-a-2026-05-20T03-46-18-833Z.{md,json}` (committed as `a127729`).

**Session 7 next concrete task:** design Phase B (renames + property type changes + formula updates + obsolete-prop deletions). Phase B is the FIRST phase with data migration — riskier than A; needs backup strategy decided first.

**Phase A merge train (origin/main HEAD = `a127729`):**
- `9f04578` Phase A design spec + handbook §1.5 "What Propagates" primer (session 6 early)
- `bf0d4fc` Phase A implementation plan
- `e3ceb28` `feat(#26)` Phase A script (squash of 24 commits on `feat/phase-a-migration`)
- `0400cba` `fix(#27)` partial-failure recovery (Bentham YELLOW #1)
- `a127729` Phase A executed report (live execution artifact)

**Phase A deliverables landed in repo:**
- `scripts/migrations/2026-05-19-phase-a.{ts,spec.ts}` — CLI entry point
- `scripts/migrations/lib/{entu-client,schema-loader,diff,executor,reporter,v4e-translator,phase-a-scope}.{ts,spec.ts}` — 7 modules, 62 tests
- `docs/migration/specs/2026-05-19-phase-a-design.md` — spec
- `docs/migration/specs/2026-05-19-phase-a-plan.md` — impl plan
- `docs/migration/v4e-divergence-2026-05-19.md` — Finn's polyphony↔v4E divergence audit
- `docs/migration/entu-schema-mutation-handbook.md` — handbook updated with §1.5 primer + reframings

**Expected first action session 7:**
1. Verify statusline on launch (sanity check launch-dir convention)
2. Read end of `entu-schema-mutation-handbook.md` §4 (migration phases) + §5 (open questions) + `v4e-divergence-2026-05-19.md` §4.3 (deferred Phase B items)
3. Surface to PO the backup-strategy decision pending (carry-forward from session-4 seed — still unresolved)
4. Design Phase B via brainstorming skill (same flow as Phase A); land spec at `docs/migration/specs/2026-05-20-phase-b-design.md`

**Phase B scope (from `v4e-divergence-2026-05-19.md` §4.3, ~14 ops):**

Property renames (each = rename + data backfill):
- `person.photo` → `person.avatar`
- `section.ordinal` → `section.display_order`
- `section.voice_type` (string) → `section.voice` (reference) — uses voice type now created in Phase A ✓
- `work.voicing` → `work.original_voicing`
- `work.duration` → `work.original_duration`
- `work.language` → `work.original_language`

Property deletions (data migrated first then delete):
- `work.arranger` (data → `edition.arranger` which was created in Phase A)
- `person.forename` + `person.surname` (keep formula `name` already in db)
- Obsolete org: `contact_email`, `language`, `locale`, `org_type`, `timezone`
- Obsolete member: `email`, `invited_by`, `joined_at`, `nickname`

Formula updates / touch-saves:
- `program_item.name` formula `edition.*.work CONCAT` (Phase A created `edition.work` ✓)
- `repertoire_item.name` formula `work.*.name CONCAT`
- `section.member_count` formula update (existing prop, change formula to recursive form)
- Touch-save all 6 `organization` instances for the Phase-A `member_count_per_section` formula to materialize (after `section.member_count` formula change above)

Phase B is BIGGER than Phase A in volume of API ops (estimated ~50-200 property-value writes depending on how many existing rows reference each renamed prop). Still well within "human can observe in one session" range, NOT the 87-min worst case (which only applies to 104k bulk deletes).

**Pending PO decisions before Phase B execution:**
1. **Backup strategy** — Entu has no documented snapshot. Options: export-via-API + store locally; or accept "Phase B is purely property-level, additive-then-delete, can fix-forward." This is the LAST chance to settle the backup question before destructive operations begin (Phase C/D have higher risk).
2. **Phase B scoping** — one big script (like Phase A), or per-rename script (small PRs, safer)? Session 5 seed had implicit "single script" instinct; Phase B's data migration risk argues for per-rename batches.
3. **Schema-Change trailer** — Phase B introduces a `Schema-Change` event in the sense that the property *definitions* change names. Same logic as Phase A (script consumes v4E without modifying it → no trailer needed)? Or different because the SHAPE of the live db is what's mutating?
4. **The 3 Phase A formula-deferred touch-saves** — handle as part of Phase B, or as a separate "Phase A post-execution" cleanup pass? Suggest folding into Phase B since two of them depend on Phase B formula additions anyway.

**Carry-forward from session-4 → session-5 seed (still pertinent):**
- Migration commit attribution convention (`Schema-Change:` trailer direction) — PARTIALLY resolved for Phase A (no trailer needed since script consumes, doesn't define schema). Re-confirm for B/C/D.
- Migration code location — RESOLVED in session 6: mvox repo, `scripts/migrations/`.
- 8 Entu doc-improvement issue candidates — only 1 filed so far (`entu/www#10` — the "what propagates" primer). 7 remaining from Finn's handbook §6 list. PO+team-lead review pending before more filings.

**Brilliant KB updates needed (deferred to session 7 or whenever PO has bandwidth):**
- Update `Projects/polyphony` body to note v4E migration Phase A complete
- Update `Decisions/mvox/polyphony-v4e-divergence` with the executed-Phase-A outcome
- Possibly create `Patterns/entu-additive-migration` from Phase A's pattern (worth doing if Phase B reuses the same script structure)

**Process lessons from session 6 (worth remembering):**

1. **Cross-fire on coordination** — Tallis + Josquin both autonomous agents; multiple of my "stop / sequence change" messages crossed in flight with their commits. Three rounds of this. Net effect on correctness: zero (TDD discipline + auto-tests caught everything). Net effect on coordination overhead: real but manageable. **Lesson for next time:** when spawning two implementer agents simultaneously, brief them with explicit sequential-checkpoint instructions in the spawn message itself, not via follow-up coordination — by the time the follow-up lands, they've already moved.

2. **Specs need self-review before brainstorming → writing-plans handoff** — I missed the diff/executor inline-vs-separate contract inconsistency at spec-self-review time. Josquin caught it implementing Task 4 GREEN. The self-review checklist in the brainstorming skill is too loose for spec-with-shared-types — add "trace one example object through every test it touches" to your personal self-review when shared types span tasks.

3. **Persisted source of truth matters** — Finn's session-4 verbal divergence report (never written down) caused the entire Phase A spec to be built on a wrong model. Josquin caught it during dry-run. Result: ~30min rework + a doc that should have existed from day 1. **Always force critical research findings into a committed file before designing on them.**

4. **PO "merge if green automatically" works** — both PR #26 and PR #27 merged on Bentham GREEN without needing PO at each step. Saves real time. Live-execution gate stayed explicit, as intended.

5. **Bentham proposing fixes IN his review** — for PR #26's YELLOW he proposed the exact 3-line `PHASE_A_NEW_TYPES` bypass; Tallis + Josquin implemented it verbatim in PR #27. This is a healthy review pattern; don't push back on it.

6. **Entu rename-via-POST works for entity types** — Finn confirmed (P3 probe). Entity type renames are free. But property renames don't auto-migrate data values — Phase B has to write backfills. Make sure session 7 doesn't forget this.

(*MVOX:Palestrina*)

---

### [PROCESSED 2026-05-20] session-5 → session-6 seed

Session 6 executed against this seed. Headline outcomes:
- Read Finn's handbook end-to-end ✓
- Discovered Entu propagation model (PO-taught) → §1.5 of handbook + Entu docs PR #10 filed ✓
- Designed + executed Phase A (this session's main work) ✓
- Triage of 6 open PO questions: 5 settled by probing or PO direct answer; 1 (bulk delete) settled by accepting serial-only as confirmed reality ✓
- 8 Entu doc-improvement candidates: 1 filed (`entu/www#10`); 7 still queued for PO+team-lead review ✗
- `_inheritrights` retroactive flip on organization: untouched (Phase D work) — correctly deferred

Original session-5 → session-6 seed text follows (for archival reference, downgraded tag).

### [NEXT SESSION] 2026-05-19 — session-5 → session-6

**Launch this session from `~/workspace`, NOT from `~`.** The new convention pinned at the top of `~/.claude/CLAUDE.md`: `cd ~/workspace && claude`. Required so the statusline (`~/workspace/.claude/statusline-command.sh`) resolves via `CLAUDE_PROJECT_DIR`, and so the workspace-scoped permissions/hooks in `~/workspace/.claude/settings.json` activate. Verify by checking that you have a statusline at the bottom of the terminal — if not, you launched from the wrong dir.

**Session 5 was a procedural-surgery session, not a migration session.** Migration path (the actual headline work from session-4 → session-5 seed) did NOT advance. Finn's handbook at `docs/migration/entu-schema-mutation-handbook.md` remains UNREAD. The 6 open questions for PO are still queued. Phase A design has not started. Session 6 picks up exactly where session 5 was supposed to start.

**What landed in session 5:**
- **`startup.md` repaired** — `mvox-dev/mvox_v4e_web@f58910d`. Old Phase 2 (`rm -rf`) removed; new Phase 2 ("Establish team") is a three-state probe (A: warm reconnect / B: fresh / C: inconsistent). Conditional new Phase 4 restores tasks from snapshot only in State C. Renumbering: 0 Orient, 1 Sync, 2 Establish, 3 Restore inboxes, 4 Restore tasks (conditional), 5 Spawn, 6 Ready. Phase 5/6 numbers unchanged.
- **Brilliant article published** — `Patterns/team-startup-clear-soft-restart` (id `d6a33567-c5da-443b-b047-5303d3bea21d`), intelligence type, shared sensitivity. 4 `relates_to` links: `Methods/team-design`, `Teams/ai-teams/framework-research`, `Teams/ai-teams/mvox-dev`, `Projects/ai-teams`.
- **FR issue comment** — `mitselek/ai-teams#62` got a comment with the mvox-dev three-state probe as an alternative to Schliemann's "always TeamDelete" proposal. Side-by-side trade-off table; FR picks the canonical template approach.
- **Launch convention pinned** — `~/.claude/CLAUDE.md` top of file now mandates `cd ~/workspace` before launching Claude. Will be true for ALL future sessions of this assistant on this host.

**Mvox repo state at end of session 5:**
- `main` HEAD: **f58910d** chore(mvox-dev): repair startup procedure for /clear soft-restart
- All pushed to origin/main.
- Working tree clean.

(*MVOX:Palestrina* — historical, end of session 5)

---

### [PROCESSED 2026-05-19] session-4 → session-5 seed
### [PROCESSED 2026-05-19] session-3 → session-4 seed
### [PROCESSED 2026-05-18] session-2 → session-3 seed

(Older seed text removed for length — see git history `9f04578^^..a127729^^` for prior session-N-end states of this file. The processed tags above are the index entries.)

(*MVOX:Palestrina*)
