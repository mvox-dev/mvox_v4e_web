# Task List Snapshot — 2026-05-20 (end of session 7)

State at shutdown. If session 8 hits State C in Phase 2, restore the active (pending/in_progress) rows below into fresh TaskCreate IDs.

| # | Subject | Status | Owner | Notes |
|---|---|---|---|---|
| 1 | CHORE-2 (#2) — Tailwind v4 | completed | byrd | Merged `6a7964c`. Issue #2 closed. |
| 2 | CHORE-3 (#3) — Paraglide i18n | pending | — | Independent of Phase C/D migration; could land any session. Open AC decision: gitignore vs commit `src/lib/paraglide/` — Comenius will recommend on spawn. |
| 3 | CHORE-4 (#4) — Vitest + Playwright docs | pending | — | ~90% done; needs CONTRIBUTING.md co-location section. Fast close. |
| 4 | CHORE-5 (#5) — Entu BFF skeleton | completed | josquin | Merged `a08f15b`. Issue #5 closed. |
| 5 | CHORE-6 (#6) — Email (Resend) wiring | pending | — | PO action pending: SPF + DKIM DNS records on chosen sender domain before #21 GREEN. |
| 6 | Polyphony db → v4E migration (in-place) | in_progress | team-lead | **Phase A complete** (`a127729`). **Phase B substantially complete** (`e155cc9` — 6 renames + 34 backfills + 14 deletes + 1 formula + 3 touch-saves succeeded; 4 SAFE-halt blockedDeletes deferred to Phase B.1). **Phase C/D unstarted.** |
| 18 | Phase B design spec — draft + commit | completed | team-lead | `6daf1e6` |
| 19 | YELLOW-1: CSRF gate at first cookie-authed mutation route | pending | — | Review gate from CHORE-5 Bentham review. Apply at next BFF PR introducing a mutation. |
| 20 | YELLOW-2: DRY DEFAULT_BASE_URL into shared config | pending | — | 4-line cosmetic. Fold into next `src/lib/server/entu/` PR. |
| 32 | YELLOW: relax CHORE-2 OKLCH color assertion on next Tailwind upgrade | pending | — | Brittle exact-value match in `tests/tailwind.spec.ts`. Relax to regex on next Tailwind minor. |
| 37 | Phase B live-wiring follow-up PR | completed | josquin | Merged as part of `e155cc9`. |
| 41 | Phase D — §2.8 person.forename/surname deletion + person.name as plain string | pending | — | Deferred from Phase B per Q4+Q5 findings: formula values persist on instance after source-delete, but person.name not directly writable. Freezing names today is a UX commitment we won't make. Phase D will need v4E schema change (Schema-Change trailer) to convert person.name → plain string, OR accept frozen names. |
| 44 | Phase B v11 hardening — full parent_copy delegation before Phase C | pending | — | Bentham v10 carve-out: `buildLiveCallbacks.migrateProperty` parent_copy branch retains inline impl. ~20-30 min cycle: update RED-1 fixture to accommodate parentLookup pre-flight, Josquin delegates to data-migrator. Land before Phase C/D. |
| 47 | Pérotin: seeding source plan — collectives + members | pending | perotin | Branch `chore/seeding-source-plan` HEAD `c15df7a`. Proposal MD + 4-collective manifest (120 members, mix `@example.ee` + null, all orphan, variable 3-12/section) committed. PO format-reviewed; needs final merge decision (with or without `seed-collectives.ts` script). |
| 52 | YELLOW-12: updateFormula bare-catch swallows DELETE failures | pending | — | Bentham v12 YELLOW. `updateFormula` pre-delete loop has bare `catch {}` that swallows mid-loop DELETE failures → silent Q5-multi-value-style pollution. ~5-line fix: split try/catch to scope only fetchEntityJson failures. Land alongside v11 hardening. |
| 53 | Phase B.1 — clear blocked-delete instance data + manual org.member_count override | pending | perotin | 4 §3 obsolete deletes SAFE-halted by verifyDeleteSafe at Phase B execution. Pérotin scripts clear `organization.contact_email`, `organization.org_type`, `member.joined_at` instance data; manual targeted DELETE on `organization.member_count` prop-def (`_id` `69c7ea498489bfcb0e819e96` — Probe 1 false positive on member_count_per_section formula). Then re-run Phase B; 4 ops succeed; Phase B 100% complete. |
| 54 | YELLOW-13: verifyDeleteSafe Probe 2 limit=10 undercount | pending | — | Bentham post-execution flag. Probe 2's `?...&limit=10` undercounts actual instance set. For Phase B's `member.joined_at` block, report said "10 instance(s)" but polyphony has 116 members. ~1-line fix: raise to 500. Land alongside v11 or Phase B.1. |

## Carry-forward summary (full detail in `team-lead.md` [NEXT SESSION] section)

### Migration roadmap status

- ✅ **Phase A** complete (session 6) — 9 types + 79 properties additive
- ✅ **Phase B** substantially complete (session 7) — renames + backfills + most obsolete deletes + formula updates + touch-saves
- 📌 **Phase B.1** queued — 4 blocked deletes cleanup (instance data + manual override)
- 📌 **v11 parent_copy hardening** queued — before Phase C
- 📌 **YELLOW-12, YELLOW-13** queued — fold into pre-Phase-C hardening
- 📌 **Phase C** undesigned — structural migrations (inventory_copy→copy+lending, participation→rsvp+attendance, affiliation retire, role→rights)
- 📌 **Phase D** undesigned — rights/sharing flips (`organization._inheritrights:false` × 6 instances, _sharing alignment, _DEPRECATED_* cleanup, §2.8 person.forename/surname)

### Independent chores

- CHORE-3 (#3) Paraglide i18n — unblocked
- CHORE-4 (#4) Vitest+Playwright docs — unblocked
- CHORE-6 (#6) Email Resend — blocked on PO DNS action

### Team composition delta this session

- **Pérotin promoted to permanent member** (data manager, sonnet, color orange, spawn on-demand). Roster + prompt + common-prompt + startup.md updated.

## Repo state at shutdown (session 7)

- **Branch:** `main` (with two outstanding feature branches: `chore/seeding-source-plan` HEAD `c15df7a` carrying Pérotin's manifest + stray Phase B artifacts cherry-picked back to feat branch — needs cleanup at squash-merge time)
- **HEAD on main:** `e155cc9` feat(migration): Phase B complete — renames + backfills + obsolete deletes + formula cleanup + touch-saves
- **All commits pushed to origin/main.**
- Recent commits (newest first):
  - `e155cc9` feat(migration): Phase B complete — Phase B live execution + 13 cycles of fixes
  - `b76f9de` chore(seed): seed 5 voice instances on polyphony — script + result artifact
  - `91c890a` docs(migration): update API key findings with Argo's authoritative answer
  - `e5e84a0` docs(migration): land Entu API key expiry findings
  - `963bbfa` feat(migration): Phase B scaffolding + dry-run plan + 214 tests
  - `6a7964c` feat(#2): Tailwind CSS v4 setup — CSS-first config + vite plugin
  - `a08f15b` feat(#5): Entu BFF skeleton — EntuClient + auth route + JWT cookie

## GitHub state

- **Repo:** `mvox-dev/mvox_v4e_web`
- **Closed in session 7:** #2 (Tailwind v4), #5 (BFF skeleton)
- **Open issues:** #3 Paraglide, #4 Vitest+Playwright docs, #6 Email, #7-#20 user stories, #21-#23 admin stories, #24 README rewrite, #25 packageManager pin

## Polyphony Entu db state at shutdown

- **Phase B mutations applied** (with 4 carryforward blocked deletes):
  - 6 v4E rename targets present on existing types (person.avatar, section.display_order, section.voice ref, work.original_voicing/duration/language)
  - 34 instance-level backfills complete (16 ordinal→display_order, 16 voice_type→voice ref, 2 photo→avatar)
  - 14 obsolete/source property-defs deleted
  - section.member_count formula clean (single recursive expression; no stale concatenation)
  - 5 voice INSTANCES seeded (alto/baritone/bass/soprano/tenor) by Pérotin
  - 6 organization instances touched via touch-save (organization.member_count_per_section re-materialized)
- **Carryforward state (Phase B.1):**
  - organization.contact_email property-def still present; 6/6 instances still hold value
  - organization.org_type property-def still present; 6/6 instances still hold value
  - organization.member_count formula property-def still present (Probe 1 false positive)
  - member.joined_at property-def still present; ~all 116 member instances hold value
- **Touched live test entity:** `6a097dcc90c8df7a1cc7d6dd` (anonymous person) now carries `forename=Test, surname=User, name="Test User"` from Q4/Q5 probe procedures (final-state of probes per PO direction)

## External artifacts created this session

- `docs/migration/findings/section-voice-types-2026-05-20.md` — Finn's voice_type audit
- `docs/migration/findings/phase-b-api-probes-2026-05-20.md` — Q1+Q2+Q3+Q4+Q5 wire-shape findings
- `docs/migration/findings/entu-api-key-expiry-2026-05-20.md` — Argo-authoritative API key mechanics
- `docs/migration/findings/phase-b-execution-diagnostics-2026-05-20.md` — Josquin's post-incident analysis
- `docs/migration/findings/seeding-source-plan-2026-05-20.md` — Pérotin's collectives + members proposal (on chore/seeding-source-plan)
- `scripts/migrations/seed-voices.ts` — Pérotin's idempotent voice-seeding script
- `scripts/migrations/seed-results/seed-voices-2026-05-20T08-14-58-992Z.json` — Pérotin's live run result
- `scripts/migrations/snapshots/polyphony-pre-phase-b-2026-05-20T08-58-08-137Z.json` — 462-entity Phase B pre-execution backup
- `scripts/migrations/seed-sources/collectives.json` — Pérotin's seed source manifest (on chore/seeding-source-plan, 302 lines)
- Memory entries (3 new): `project_entu_formula_mechanics`, `project_entu_post_appends_multi_value`, `project_entu_api_key_mechanics`

## Session-7 work delta vs session-6 plan

Session-6 seed called for: Phase B design + execution + Phase C/D in this session if possible.

**Accomplished:**
- Phase B design + scaffolding + live execution (including a partial-failure recovery cycle) ✓
- 8+ memory entries on Entu mechanics ✓
- Pérotin permanent member ✓
- 2 CHOREs (#2 Tailwind, #5 BFF) merged alongside ✓

**Not accomplished:**
- Phase C undesigned (scope grew on Phase B faster than estimated)
- Phase D undesigned
- §2.8 person.forename/surname formally deferred to Phase D per Q4+Q5 evidence
- 4 Phase B blocked deletes deferred to Phase B.1

(*MVOX:Palestrina*)
