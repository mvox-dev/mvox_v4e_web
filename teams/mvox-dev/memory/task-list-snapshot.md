# Task List Snapshot — 2026-05-20 (end of session 8)

State at shutdown. If session 9 hits State C in Phase 2, restore the active (pending/in_progress) rows below into fresh TaskCreate IDs.

| # | Subject | Status | Owner | Notes |
|---|---|---|---|---|
| 2 | CHORE-3 (#3) — Paraglide i18n | pending | — | Independent of Phase C/D. Open AC decision: gitignore vs commit `src/lib/paraglide/`. Comenius will recommend on spawn. |
| 3 | CHORE-4 (#4) — Vitest + Playwright docs | pending | — | ~90% done; needs CONTRIBUTING.md co-location section. Fast close. |
| 5 | CHORE-6 (#6) — Email (Resend) wiring | pending | — | Blocked on PO SPF + DKIM DNS records on chosen sender domain. |
| 6 | Polyphony db → v4E migration (in-place) | in_progress | team-lead | **Phase A + B + B.1 complete.** Toolkit extracted + applied. Phase C/D unstarted. |
| 19 | YELLOW-1: CSRF gate at first cookie-authed mutation route | pending | — | Review-gate for next BFF PR introducing a mutation. |
| 20 | YELLOW-2: DRY DEFAULT_BASE_URL into shared config | pending | — | 4-line cosmetic. Fold into next `src/lib/server/entu/` PR. |
| 32 | YELLOW: relax CHORE-2 OKLCH color assertion on next Tailwind upgrade | pending | — | Brittle exact-value match in `tests/tailwind.spec.ts`. Relax to regex on next Tailwind minor. |
| 41 | Phase D — §2.8 person.forename/surname deletion + person.name as plain string | pending | — | Scope NARROWED from session 7 framing. v4E schema.ts already declares plain `name`. Phase D just backfills name from live forename+surname + deletes those props on instances + retires prop-defs. No `Schema-Change` trailer needed. |

All completed session-8 tasks (#44, #47, #52, #53, #54, #55, #56, #57, #58, #59) closed via the merges listed in `team-lead.md` [NEXT SESSION] section.

## Carry-forward summary (full detail in `team-lead.md` [NEXT SESSION] section)

### Migration roadmap status

- ✅ **Phase A** complete (session 6) — additive
- ✅ **Phase B** complete (session 7-8) — renames + backfills + obsolete deletes + formula updates + touch-saves
- ✅ **Phase B.1** complete (session 8) — 4 blocked deletes cleared
- ✅ **Phase B post-execution YELLOWs** all resolved (12/13/14)
- ✅ **Toolkit extraction** complete (PRs A-E) — 5 lib + 4 toolkit helpers + 4 consumer-script refactors
- 📌 **Phase C** undesigned — structural migrations (inventory_copy→copy+lending, participation→rsvp+attendance, affiliation retire, role→rights). Brainstorming session needed.
- 📌 **Phase D** undesigned — rights/sharing flips (`organization._inheritrights:false` × 6 instances, _sharing alignment, _DEPRECATED_* cleanup, §2.8 person.forename/surname per #41).

### Independent chores

- CHORE-3 (#3) Paraglide i18n — unblocked
- CHORE-4 (#4) Vitest+Playwright docs — unblocked
- CHORE-6 (#6) Email Resend — blocked on PO DNS action

### Team composition delta this session

- **Pérotin gained 7th standing concern**: toolkit extraction (added pre-session at `d0ab9da`).
- All 5 active agents (finn, bentham, tallis, josquin, perotin) participated in session 8.

## Repo state at shutdown (session 8)

- **Branch:** `main` (no outstanding feature branches; all PRs merged)
- **HEAD on main:** `6260ee7` test(migration): pin listInstancesByType extraQuery contract (#58 YELLOW-14)
- **All commits pushed to origin/main.**
- Last 6 commits (newest first):
  - `6260ee7` (#58 YELLOW-14) lib extraQuery test pin
  - `1d8b562` PR E — seed-collectives uses toolkit
  - `9565363` PR D — phase-b-1-cleanup uses toolkit
  - `8495883` PR C — seed-voices uses toolkit
  - `db19ecf` PR B — probe-mutation-ops uses toolkit
  - `0cda89f` PR A — toolkit extraction (5 lib + 4 toolkit helpers)

## GitHub state

- **Repo:** `mvox-dev/mvox_v4e_web`
- **Closed in session 8:** none directly via GitHub issues (no PRs opened; all squash-merges direct to main per established convention)
- **Open issues:** #3 Paraglide, #4 Vitest+Playwright docs, #6 Email, #7-#20 user stories, #21-#23 admin stories, #24 README rewrite, #25 packageManager pin

## Polyphony Entu db state at shutdown (session 8 + Phase B.1 + practice + seed-collectives)

- **Pre-v4E real members:** 115 (was 116; Mait Vaher deleted as DELETE_ENTITY practice op)
- **v4E-clean seed entities (newly created session 8):**
  - 120 person instances (mock Estonian names, plain `name: string` per v4E schema.ts)
  - 120 member instances (person ref + current_section ref + status:active + _sharing:private)
- **Phase B.1 cleanup:**
  - 6 `organization.contact_email` values deleted (6/6 orgs)
  - 6 `organization.org_type` values deleted (6/6 orgs)
  - 116 → 0 `member.joined_at` values deleted (was 116, then 115 after Mait Vaher deletion)
  - `organization.member_count` prop-def DELETED via op #4
- **Practice ops (probe-mutation-ops-2026-05-20.ts):**
  - EFK Soprano section's `display_order`: UPDATED 1→10→1 roundtrip; ended at 1 (original state)
  - EFK Soprano section's `ordinal`: REMOVED (pre-v4E residual)
  - Mait Vaher (member): DELETE_ENTITY
- **Phase B final re-run output:** `section.member_count` formula self-cleaned (3 polluted values pruned, 1 correct value remaining: `(_child.member COUNT) (_child.section.member_count SUM) +`)
- **Touch-saves materialized:** `organization.member_count_per_section` formula re-computed across all 6 orgs

## External artifacts created this session

- `docs/migration/findings/entu-mutation-wire-shapes-2026-05-20.md` — wire shapes for UPDATE/REMOVE/DELETE_ENTITY (Pérotin)
- `docs/migration/findings/phase-b-1-diagnostic-2026-05-20.md` — Pérotin's Phase B.1 diagnostic + Probe-1-false-positive proof
- `docs/migration/findings/seeding-source-plan-2026-05-20.md` — v4E-aligned proposal doc (rewrite from session-7 stale version)
- `scripts/migrations/phase-b-1-cleanup.ts` — Pérotin's cleanup script (toolkit-consuming as of PR D)
- `scripts/migrations/probes/probe-mutation-ops-2026-05-20.ts` — Pérotin's mutation-ops probe (toolkit-consuming as of PR B)
- `scripts/migrations/seed-collectives.ts` — Pérotin's seed script (toolkit-consuming as of PR E)
- `scripts/migrations/seed-sources/collectives.json` — v4E-clean seed manifest (rewrite from session-7 stale version)
- `scripts/migrations/perotin-toolkit.ts` — new file, Pérotin-owned (isDryRun, writeResultArtifact, replaceProperty, findOrCreateByName)
- Lib additions to `scripts/migrations/lib/entu-client.ts`: fetchEntity, postProperties, deletePropertyValue, deleteEntity, listInstancesByType
- 4 session-8 result artifacts in `scripts/migrations/seed-results/` + 1 in `scripts/migrations/reports/`
- 2 new architecture-decisions.md entries (seed-data model + Entu mutation wire shapes)
- 2 new memory entries (project_entu_wire_shape_entity_vs_property, project_seed_data_v4e_clean)

## Session-8 work delta vs session-7 plan

Session-7 seed called for: Phase B.1 → pre-Phase-C hardening (v11 + YELLOW-12 + YELLOW-13) → collectives manifest → Phase C design.

**Accomplished:**
- Phase B.1 ✓
- v11 parent_copy delegation (#44) ✓
- YELLOW-12 (#52) ✓
- YELLOW-13 (#54) ✓
- Plus NEW discoveries: wire-shape bug (#56) + YELLOW-14 (#58) + toolkit extraction (PRs A-E)
- Collectives manifest rewrite + live execution ✓
- Mutation-ops practice probe (UPDATE/REMOVE/DELETE_ENTITY) — bonus

**Not accomplished:**
- Phase C undesigned (scope grew on Phase B + toolkit-extraction beyond estimate)
- Phase D undesigned

**Net:** session 8 went deeper into Phase B residue + toolkit work than planned. Phase C deferred to session 9 (where it now sits as the headline item).

(*MVOX:Palestrina*)
