# Task List Snapshot — 2026-05-19 (end of session 5)

**Task IDs renumbered this session.** Session-4's #1–#7 (including completed CHORE-1) were wiped at session-5 startup when the broken Phase 2 procedure forced a `TeamDelete` recovery. The 6 rows below are the fresh numbering after manual recreation. No row preserves the "completed CHORE-1" state — closure is recorded in GitHub issue #1 and commit `6962329`, not here.

If session 6 hits State C again (it shouldn't — Phase 2 is fixed now), restore from this snapshot. New startup.md Phase 4 spells out the procedure.

| # | Subject | Status | Owner | Notes |
|---|---|---|---|---|
| 1 | CHORE-2 (#2) — Tailwind v4 | pending | — | Independent of Entu schema. Can proceed in parallel with migration. |
| 2 | CHORE-3 (#3) — Paraglide i18n | pending | — | Independent of Entu schema. Open AC decision: gitignore vs commit `src/lib/paraglide/` — Comenius will recommend on spawn. |
| 3 | CHORE-4 (#4) — Vitest + Playwright docs | pending | — | **~90% already done** by CHORE-1 in session 4 (configs + 9 vitest tests + 1 playwright test all landed). Only AC remaining: "co-location convention documented" — a CONTRIBUTING.md section. Fast close. |
| 4 | CHORE-5 (#5) — Entu BFF skeleton | pending (blocked) | — | **Blocked by task #6 (migration Phase A).** Do NOT start until at least Phase A of polyphony→v4E migration is complete. Schema assumptions in any BFF code would be against the wrong shape. |
| 5 | CHORE-6 (#6) — Email (Resend) wiring | pending | — | Independent of Entu schema (just adds an email provider). PO action pending: SPF + DKIM DNS records on a chosen sender domain **before #21 GREEN**, NOT before #6 GREEN. |
| 6 | Polyphony db → v4E migration (in-place) | pending (was in_progress in session 4) | finn (research delivered) | **PO decision 2026-05-19 00:35**: in-place migration, not new db. Phase A (additive) is first concrete execution. Multi-session. Finn's session-4 handbook delivered at `docs/migration/entu-schema-mutation-handbook.md`. 6 open questions for PO + 8 doc-gap candidates awaiting review. **Session 6 first action: read the handbook + triage questions.** |

## Repo state at shutdown (session 5)

- **Branch:** `main` (no feature branches active)
- **HEAD:** **`f58910d`** chore(mvox-dev): repair startup procedure for /clear soft-restart
- **All commits pushed to origin/main.**
- Recent commits (newest first):
  - `f58910d` chore(mvox-dev): repair startup procedure for /clear soft-restart **(this session)**
  - `8742ec7` chore(mvox-dev): save session 4 team state
  - `d69186a` docs(migration): land Entu schema-mutation handbook (session 4)
  - `e7cf148` chore(mvox-dev): correct Entu docs URL in josquin prompt (session 4)
  - `17e74d8` Tallis [PROCESS] note: team-config commits belong on main not feature branches (session 4)
  - `85da3ee` Bentham scratchpad — CHORE-1 calibration anchor (session 4)
  - `6962329` feat(#1): bootstrap SvelteKit + adapter-cloudflare (squash-merge, CHORE-1, session 4)

## GitHub state

- **Repo:** `mvox-dev/mvox_v4e_web`
- **Closed in prior sessions:** #1 (CHORE-1)
- **Open issues:** #2 Tailwind, #3 Paraglide, #4 Vitest+Playwright docs, #5 BFF skel, #6 Email, #7–#20 user stories, #21–#23 admin stories, #24 README rewrite, #25 packageManager pin

## Brilliant KB updates this session

- **Created `Patterns/team-startup-clear-soft-restart`** (`d6a33567-c5da-443b-b047-5303d3bea21d`) — startup-procedure `/clear` gotcha + three-state probe fix. Linked to `Methods/team-design`, `Teams/ai-teams/framework-research`, `Teams/ai-teams/mvox-dev`, `Projects/ai-teams`.

## Framework-research issue comment posted

- `mitselek/ai-teams#62` got a comment with mvox-dev's three-state probe as an alternative to Schliemann's "always TeamDelete" fix. FR picks the canonical template approach.

## Session-5 work delta vs session-4 plan

Session-4 → session-5 seed (in `team-lead.md`) called for reading Finn's handbook + triaging open PO questions. **None of that happened.** Session 5 was 100% startup-procedure surgery + statusline diagnostic. Session 6 picks up the migration thread from where session 5 should have started.

## Carried forward (see `team-lead.md` [NEXT SESSION] for full detail)

- **First action session 6**: verify statusline appears (validates launch-dir convention), then read Finn's handbook + triage the 6 open questions for PO.
- **PO decisions pending**: how/where to store schema migration code, attribution convention reversal, backup strategy.
- **8 Entu doc-improvement issue candidates** queued for PO+team-lead review before filing.
- **CHORE-4 is nearly free** — small CONTRIBUTING.md addition closes it.
- **CHORE-2/3 unblocked** if PO wants parallel scaffolding work alongside migration design.

(*MVOX:Palestrina*)
