# Task List Snapshot — 2026-05-21 (end of session 9)

State at shutdown. If session 10 hits State C in Phase 2, restore the active (pending/in_progress) rows below into fresh TaskCreate IDs.

| # | Subject | Status | Owner | Notes |
|---|---|---|---|---|
| 2 | CHORE-3 (#3) — Paraglide i18n | pending | — | Open AC decision: gitignore vs commit `src/lib/paraglide/`. Comenius will recommend on spawn. |
| 5 | CHORE-6 (#6) — Email (Resend) wiring | pending | — | Blocked on PO SPF + DKIM DNS records on chosen sender domain. |
| 6 | Polyphony db → v4E migration (in-place) | in_progress | team-lead | **Phase A + B + B.1 + D complete.** Toolkit extracted. **Phase C unstarted** — structural restructuring is the big remaining item. |
| 19 | YELLOW-1: CSRF gate at first cookie-authed mutation route | pending | — | Review-gate for next BFF PR introducing a mutation. |
| 20 | YELLOW-2: DRY DEFAULT_BASE_URL into shared config | pending | — | 4-line cosmetic. Fold into next `src/lib/server/entu/` PR. |
| 32 | YELLOW: relax CHORE-2 OKLCH color assertion on next Tailwind upgrade | pending | — | Brittle exact-value match in `tests/tailwind.spec.ts`. Relax to regex on next Tailwind minor. |
| 60 | YELLOW-15: formula-cached-value sanity-check pattern | pending | — | Pérotin self-flagged from session 9 sub-op 1 incident. Bentham added as [PATTERN] in scratchpad + folded into architecture-decisions formula-mechanics entry. Lift formal pattern entry if not already covered by Bentham's session-9 edits. |
| 63 | CONTRIBUTING.md follow-ups: PR submission + code style sections | pending | — | Out-of-scope of CHORE-4. Low priority; create GitHub issue when PO wants triage. |
| 64 | Phase D YELLOW fixup commit (D1, D3, D5, D6, dead helper) | pending | — | Bundle 5 deferred YELLOWs into single Pérotin fix-up; Bentham re-verifies GREEN post-edit. ~30 min. |

All session-9 phase work tasks (#3 CHORE-4, #41 Phase D, #61 Test User cleanup, #62 process calibration tracking) closed via the merges listed in `team-lead.md` [NEXT SESSION] section.

## Carry-forward summary (full detail in `team-lead.md` [NEXT SESSION] section)

### Migration roadmap status

- ✅ **Phase A** complete (session 6) — additive
- ✅ **Phase B** complete (session 7-8) — renames + backfills + obsolete deletes + formula updates + touch-saves
- ✅ **Phase B.1** complete (session 8) — 4 blocked deletes cleared
- ✅ **Phase B post-execution YELLOWs** all resolved (12/13/14)
- ✅ **Toolkit extraction** complete (PRs A-E)
- ✅ **Phase D** complete (session 9) — narrowed full bundle: person.name formula→plain, forename/surname retired, _inheritrights:false on 6 org instances + organization TYPE default
- 📌 **Phase C** undesigned — structural migrations (inventory_copy→copy+lending, participation→rsvp+attendance, affiliation retire, role→rights). Brainstorming session needed.

### Independent chores

- CHORE-3 (#3) Paraglide i18n — unblocked
- CHORE-6 (#6) Email Resend — blocked on PO DNS action

### Team composition delta this session

- **Authorization-gate discipline codified** across Pérotin prompt + project feedback memory + team-lead seed. New non-negotiable: explicit "I authorize this run" SendMessage before any live mutation. Bentham's call-out, accepted.
- All 4 active agents (finn, bentham, perotin, tallis) participated; perotin carried the headline work.

## Repo state at shutdown (session 9)

- **Branch:** `main` (no outstanding feature branches; all work direct commits to main)
- **HEAD on main:** `850b7c4` YELLOW-D4 organization TYPE default fix (Bentham's stewardship commit and Tallis's CONTRIBUTING.md commit land after this in shutdown commits)
- **All commits pushed to origin/main.**
- Last 12 commits land Phase D end-to-end (session 9 commit chain in team-lead.md).

## GitHub state

- **Repo:** `mvox-dev/mvox_v4e_web`
- **Closed in session 9:** issue #4 (CHORE-4 Vitest+Playwright docs) via structured comment after CONTRIBUTING.md landed
- **Open issues:** #3 Paraglide, #6 Email, #7-#20 user stories, #21-#23 admin stories, #24 README rewrite, #25 packageManager pin

## Polyphony Entu db state at shutdown (session 9 Phase D complete)

- **person:** 122 instances total (2 real with non-whitespace names + 120 v4E-clean seeds with " " names). `person.name` is now PLAIN string (formula removed). `person.forename` + `person.surname` prop-defs RETIRED. PO + Test User have only `name` (forename/surname deleted).
- **organization:** 6 instances + 1 TYPE entity, ALL with `_inheritrights=false`. Future org instances will be born aligned.
- **Test User:** name="Test User" (3 prior stale values cleared this session).
- **`_DEPRECATED_*` types:** zero. Confirmed in discovery; no-op.

## External artifacts created this session

- `docs/migration/findings/entu-formula-unwrap-2026-05-21.md` — Pérotin's sub-op 0 probe finding (formula→plain conversion mechanic)
- `docs/migration/findings/org-rights-cascade-audit-2026-05-21.md` — Pérotin's post-exec rights audit + YELLOW-D4 discovery
- `scripts/migrations/probes/probe-phase-d-discovery-2026-05-21.ts` — Pérotin's discovery probe
- 5 cleanup scripts under `scripts/migrations/cleanup-phase-d-*-2026-05-21.ts` (sub-ops 1, 2, 3+4, 5, YELLOW-D4)
- 9+ result artifacts in `scripts/migrations/seed-results/cleanup-phase-d-*-*.json`
- `CONTRIBUTING.md` (new file, Tallis-authored) — test conventions
- 2 new architecture-decisions.md entries from Pérotin (formula-unwrap mechanic) + 4 from Bentham (boolean-POST wire shape + formula-cache `_id` corollary + schema-alignment carve-out + Q5 tightening)
- 1 new project feedback memory entry: `feedback_authorization_gate.md`
- Pérotin prompt update: explicit auth-gate language under Live Operations

## Session-9 work delta vs session-8 plan

Session-8 seed called for: Phase C design (headline). Session-9 reality: PO chose Phase D narrowed instead (full bundle). Phase D landed end-to-end in ~5h.

**Accomplished:**
- Phase D full bundle ✓ (5 sub-ops, ~133 ops on live polyphony)
- YELLOW-D4 caught + fixed via post-exec audit ✓
- CHORE-4 finalized (CONTRIBUTING.md) ✓
- Test User stale-name cleanup ✓ (bonus)
- Authorization-gate discipline codified ✓ (3 layers)
- 4 architecture-decisions entries landed ✓

**Not accomplished:**
- Phase C still undesigned

**Net:** session 9 punched through Phase D (smaller than C) end-to-end + codified the gate discipline that will make Phase C safer. Phase C is the headline for session 10.

(*MVOX:Palestrina*)
