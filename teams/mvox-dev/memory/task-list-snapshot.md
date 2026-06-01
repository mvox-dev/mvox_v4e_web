# Task List Snapshot — 2026-06-01 end-of-session-29

State at session-29 close.

## Active tasks (in-flight)

**Pencil-toggle — at RED, DEFERRED to session 30 by PO.** Branch `feat/seasons-pencil-toggle` off main `674b1d9`. RED commit `f761ca4` pushed (tests only). Next step = Byrd GREEN. Full brief in `team-lead.md [NEXT SESSION]` seed (the ⭐ FIRST ACTION block).

## Pending tasks (deferred)

None in the harness task list. Session-29 work was driven through the TDD chain + PO live-testing iterations, not the harness task list.

## What shipped this session (rehearsal-schedule first slice → live preview)

main advanced `89632a4` → `674b1d9` (origin matches). Key commits:
- `723d09e` — first slice (create season/series, eager events, view list)
- `1e787f3` — `/seasons` nav tab + protected-route guard
- `3878291` — manage-ops wiring (#86): conductors, cancel, delete-series + rehearsal read-path (#82)
- `47be076` — `_type`-as-reference create fix (Entu 400)
- `bbfacb1` — conductor dedupe (3-layer) + soft-warn season dates + remove dead setProperty
- `674b1d9` — mobile redesign: SeasonBar + on-demand panels + edit-season + responsive stacking

Live at `preview-seasons.multivox.pages.dev` (build `app.vQrtCqAM.js`). **mvox.eu production untouched.**

## EFK demo seed (live in polyphony Entu db)

Org EFK `69c7f8718489bfcb0e81b065`: season 2026/27 + Tuesday series → 16 events (DST flip 2026-10-27 verified). Recorded on `chore/seed-demo-seasons` (`2dd6f46`, Pérotin scratchpad).

## GitHub issues — slice capabilities

| Capability | Issue | State |
|---|---|---|
| Create season | #19 | done (live) |
| Create rehearsal series | #20 | done (live) |
| Generate events (eager) | #81 | done (live) |
| View rehearsal list | #82 | done (live, read-path fixed) |
| Cancel/edit single instance | #83 | cancel done; edit-one = **#87** open |
| Delete series (cascade) | #84 | done (live) |
| Assign/manage conductors | #85 | done (live, dedupe-correct) |
| Manage-ops wiring umbrella | #86 | delivered |
| Edit single rehearsal (Cap 5b) | #87 | **open** — UI wiring of `updateRehearsal` |
| Runtime type-id resolution | #88 | **open** — TYPE_IDS hardcoded |

**Action session 30:** `gh issue list` audit — close #83/#84/#85 portions satisfied by #86 (`feedback_closes_n_pattern`).

## Memory written this session

- `project_entu_create_type_reference`
- `partial-assertions-and-seams-hide-real-bugs`
- updated `spawn-agents-with-worktree-isolation`

## Next session focus

1. **Finish the pencil-toggle** (Byrd GREEN → Bentham → Josquin merge → redeploy preview → ping PO). RED is primed at `f761ca4`.
2. Close satisfied GH issues; **#87** (edit one rehearsal) is the natural next capability.
3. Eventually promote the slice from `preview-seasons` to `mvox.eu` when PO is satisfied.

## Carry-forward GH backlog (unchanged)

- **#80** DRY safeRedirectTarget; **/about** real content; **#73** overdue red+bold (blocked lending); **#54** client error capture; **#44** CF Pages git-deploy; **#49** Biome lint; **#6** Email (blocked PO SPF/DKIM); **CHORE-C** test infra (heavy).

(*MVOX:Palestrina*)
