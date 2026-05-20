# Palestrina — Team Lead Scratchpad

### [CHECKPOINT] 2026-05-20 — session-7 lessons in flight

Captured mid-session so future-Palestrina doesn't re-discover the same things.

**L1 — Shared working-tree coordination.** Local-mode teams share ONE git working tree. When team-lead `git checkout main`s to commit a docs/finding while an implementer agent is mid-edit on a feat branch, the implementer's branch context switches under them. First time I bit on this (2026-05-20 04:25 — committing voice_type findings to main during Tallis's RED): saved by stash + switch-back, but caused needless confusion. Second time (committing Finn's Q1+Q3 findings 04:48): chose to commit on feat branch instead, deferring main landing until squash-merge. **Rule:** mid-session doc commits go on whichever feat branch is active, OR wait for "team idle" to switch. Don't `git checkout main` while an implementer's working files are uncommitted — period.

**L2 — Message cross-fire (sub-genre of session-6 lesson 1).** Two patterns observed in session 7:
- Tallis 04:32 "3 questions" message went out BEFORE my 04:26 answers landed in his inbox — he resolved them by reading the messages on next wake; no harm. But his summary read stale.
- Josquin 04:55 "two issues blocking" message crossed with my 04:59 GREEN v2 dispatch. Each was operating on the other's pre-message state. Net: I had to send a 05:00 "to synchronize" message clarifying the message ordering.
- **Mitigation:** When briefing an agent that's in flight, lead with one line: "this updates / supersedes message X from time Y". Saves the agent a state-reconciliation step. Also: be explicit about what's superseded vs. what's additive.

**L3 — Verify-before-rotate (auth-investigation pattern).** When an agent reports an external system anomaly (e.g., "key returns anonymous"), my instinct was to ask PO to rotate. PO pushed back: "you trying the same key Phase A used?". Forced a 30-sec investigation: same file, same mtime, same key. The bug was almost certainly in the agent's probe flow (raw API key as Bearer vs. JWT exchange). Then PO added "Entu might have some troubles with auth ATM" — third possibility I hadn't considered. **Rule:** before recommending external-system mitigation (key rotation, retries, escalations), verify locally first. The cheap investigation often resolves it; the expensive mitigation rarely needs to fire.

**L4 — Bentham proposing the GREEN spec mid-RED is a smell.** When I sent Josquin "Step 1: Richer fetchDbState" at 04:50 — that's TEAM-LEAD proposing the implementation shape, which is Tallis's territory (he writes the RED contract that specifies what GREEN must do). I should have written "Tallis: write RED for richer fetchDbState contract" and let Tallis specify the shape. Bentham later RED'd the orchestrator's `fetchTypesOnly` for the exact same reason — and his recommendation was the same (have Tallis write RED). Net effect: zero (Tallis ended up writing the RED), but the process bypass was telegraphed.

**L5 — Implementer agents pre-ship between checkpoints.** Tallis's RED v1 at 04:28 included full impls of phase-b-scope.ts, snapshotter.ts, data-migrator.ts, diff.ts. Josquin came online expecting stubs, found working impls, re-implemented them anyway to verify (the Write calls produced byte-identical content). **Rule:** when spec-driven impls land in a RED commit, the commit message MUST flag them ("stub impls" vs "full impls"). Otherwise the receiving agent burns cycles. Add to Tallis's prompt: if you write impl alongside the test, label it as such in the commit.

**L6 — Phase B is bigger than estimated.** Spec said "~14 operations, ~43-87 API writes." Tallis-Josquin reality at GREEN v1 needed: 22 RED tests → 168 passing total. Bentham RED'd with 4 blockers. Tallis RED v2: 15 more tests → 188 expected GREEN total. Plus the Q2 probe + live dry-run + likely a YELLOW round. **Estimate revision:** Phase B is closer to "2-3 hours of session time" than the implicit "1 hour Phase A pace." Note this for Phase C/D planning.

**Session 7 state at this checkpoint (~05:07):**
- `feat/chore-5-bff-skeleton` merged (`a08f15b`); issue #5 closed
- Phase B spec on main (`6daf1e6`); voice_type findings on main (`a063135`); Q1+Q3 findings on feat branch (`c37bb66`)
- Phase B GREEN v2 in flight (Josquin closing Bentham's 4 blockers + YELLOW-1)
- Entu auth issues (PO-reported) — Q2 touch-save probe + live --dry-run held until recovery
- Tasks #19 (CSRF gate), #20 (DRY base URL) carried forward from CHORE-5 review
- About to dispatch CHORE-2 (#2) Tailwind v4 in parallel — Tallis RED + Byrd GREEN

(*MVOX:Palestrina*)

---

### [NEXT SESSION] 2026-05-20 — session-6 → session-7

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
