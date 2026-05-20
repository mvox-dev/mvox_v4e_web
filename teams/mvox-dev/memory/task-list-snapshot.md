# Task List Snapshot — 2026-05-20 (end of session 6)

State at shutdown. If session 7 hits State C in Phase 2, restore the active rows below into fresh TaskCreate IDs.

| # | Subject | Status | Owner | Notes |
|---|---|---|---|---|
| 1 | CHORE-2 (#2) — Tailwind v4 | pending | — | Independent of migration. Can proceed alongside Phase B. |
| 2 | CHORE-3 (#3) — Paraglide i18n | pending | — | Independent of migration. Open AC decision: gitignore vs commit `src/lib/paraglide/` — Comenius will recommend on spawn. |
| 3 | CHORE-4 (#4) — Vitest + Playwright docs | pending | — | ~90% done; needs CONTRIBUTING.md co-location section. Fast close. |
| 4 | CHORE-5 (#5) — Entu BFF skeleton | pending | — | UNBLOCKED 2026-05-20 by Phase A live execution (merge SHA `a127729`). v4E shape correctly reflected on polyphony db; BFF can consume. |
| 5 | CHORE-6 (#6) — Email (Resend) wiring | pending | — | Independent of Entu schema. PO action pending: SPF + DKIM DNS records on chosen sender domain before #21 GREEN. |
| 6 | Polyphony db → v4E migration (in-place) | in_progress | team-lead | **Phase A COMPLETE 2026-05-20 03:47** (merge SHA `a127729`): 9 types + 79 properties added, 0 failures. **Phase B next** (renames + property type changes + 3 formula touch-saves + obsolete-prop deletions). PO decisions queued: backup strategy, Phase B scoping (single script vs per-rename), Schema-Change trailer convention re-confirm. Phase C (structural) + Phase D (rights+cleanup) further down. |

## Repo state at shutdown (session 6)

- **Branch:** `main` (no feature branches active)
- **HEAD:** **`a127729`** chore(migration): Phase A executed — report artifacts
- **All commits pushed to origin/main.**
- Recent commits (newest first):
  - `a127729` chore(migration): Phase A executed — report artifacts **(this session, Task 10)**
  - `0400cba` fix(#27): bypass scope filter for §4.1 new types on partial-failure re-run
  - `e3ceb28` feat(#26): Phase A polyphony→v4E migration script (squash of 24 commits on `feat/phase-a-migration`)
  - `bf0d4fc` docs(migration): land Phase A implementation plan
  - `9f04578` docs(migration): land Phase A design + Entu propagation primer
  - `7f35b83` chore(mvox-dev): save session 5 team state
  - `f58910d` chore(mvox-dev): repair startup procedure for /clear soft-restart

## GitHub state

- **Repo:** `mvox-dev/mvox_v4e_web`
- **Closed in session 6:** #26 (Phase A migration), #27 (partial-failure recovery fix)
- **Open issues:** #2 Tailwind, #3 Paraglide, #4 Vitest+Playwright docs, #5 BFF skel (now unblocked), #6 Email, #7–#20 user stories, #21–#23 admin stories, #24 README rewrite, #25 packageManager pin

## Polyphony Entu db state at shutdown

- **9 new entity types live** (`voice`, `library`, `copy`, `lending`, `invitation`, `application`, `event_series`, `rsvp`, `attendance`) — IDs in the executed report at `scripts/migrations/reports/2026-05-19-phase-a-2026-05-20T03-46-18-833Z.json`
- **79 new property definitions live** — 44 inline on the 9 new types + 35 §4.2-scoped additions on existing types
- 3 formula properties await touch-save (deferred to Phase B): `lending.name`, `organization.member_count_per_section`, `edition.work`
- All EXISTING polyphony data (6 orgs, 116 members, etc.) untouched — Phase A is purely additive
- Phase B will be the first phase with DATA mutation

## External artifacts created this session

- `entu/www#10` — docs issue filed: "Docs: clarify what propagates between entities (type ↔ instance vs parent ↔ child)" — proposes a propagation table for `overview/entities/index.md`, signed `(*MVOX:Palestrina*)`
- Memory entries (6 new): `entu-way-of-entu`, `entu-mandatory-soft`, `entu-sharing-on-create`, `entu-type-rename-free`, `entu-no-bulk-delete`, `entu-probe-first`

## Session-6 work delta vs session-5 plan

Session-5 seed called for: handbook read, triage 6 open questions, Phase A design + execution. **All accomplished plus:** Entu propagation model clarified, 6 durable memories saved, divergence doc persisted to repo, docs PR proposal filed externally, partial-failure recovery auto-heal added.

## Carry forward (full detail in `team-lead.md` [NEXT SESSION] section)

- **Phase B design** — first session-7 task. Read divergence §4.3 + handbook §4 + open questions §5.
- **PO decisions pending pre-Phase-B:** backup strategy; Phase B scoping (single vs per-rename); Schema-Change trailer convention re-confirm for B; folding the 3 Phase A formula touch-saves into Phase B or treating as separate cleanup.
- **7 remaining Entu doc-improvement candidates** — PO+team-lead review before more filings.
- **3 minor YELLOWs from PR #26** still tracked as post-execution housekeeping: fetchDbState test-gap, fixture tmp-file hygiene, error-message info-leak.
- **CHORE-5 (BFF skel)** now unblocked — could be picked up alongside Phase B if PO wants parallel tracks (Byrd/Josquin pair on it while Phase B does its thing).

(*MVOX:Palestrina*)
