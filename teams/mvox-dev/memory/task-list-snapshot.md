# Task List Snapshot — 2026-05-31 end-of-session-27

State at session-27 close.

## Active tasks (in-flight)

None. All session-27 work shipped.

## Pending tasks (deferred)

None tracked in the harness task list. Next session's work (rehearsal/concert/season/rsvp mapping) is a fresh design/requirements effort — see `team-lead.md [NEXT SESSION]` seed.

## Session-27 task history (all completed)

CHORE-79 (server-side auth guard, hybrid):
- #23 RED (Tallis) → #24 GREEN (Josquin) → #25 REVIEW (Bentham) → #26 PREVIEW+MERGE (Josquin). Shipped `e91233a`.
- Folded-in logout-greet fix: #30 RED (Tallis) → #28 GREEN (Byrd, performLogout resets userStore) → #29 REVIEW (Bentham).

CHORE-72 (/about page):
- #31 RED (Tallis) → #36 i18n+dedupe (Comenius) → #32 GREEN-align (Byrd) → #35 REVIEW (Bentham) → #34 PREVIEW+MERGE (Josquin). Shipped `a0b2fcf`.

(Task IDs got non-sequential due to mid-chain reorders + the harness task list clearing once mid-session — IDs are not authoritative; GitHub + git history are the durable record.)

## Shipped this session

- **#79** server-side auth guard — `e91233a`, live (`app.DIpxe8VD.js`)
- **#72** /about page — `a0b2fcf`, live (`app.BlDa5F1S.js` + `start.B2QecvaZ.js`)
- **#80** filed (DRY safeRedirectTarget follow-up — not started)
- docs/memory commits `9957f66` + `fa3f2f3` (main tip)

## Carry-forward GH backlog

- **#80** DRY login-page safeRedirectTarget import (~5-line Byrd; YELLOW-79.1 deferred)
- **#73** overdue red+bold (blocked on lending)
- **#54** client error capture; **#44** CF Pages git-deploy; **#49** Biome lint; **#6** Email (blocked PO SPF/DKIM)
- **CHORE-C** test infra (MSW+Playwright, 9 tasks, heavy)
- **/about real content** — swap lorem→real copy + et/lv/uk translations when PO provides
- Stewardship: promote L121 (verify-before-assert) + L122 (freeze-spec-before-chain) to architecture-decisions.md / Brilliant

## Next session focus (PO directive)

**Map rehearsal/concert/season/rsvp functionality** — design/requirements, NOT coding. Big head start in memory (project_polyphony_seasons_events / participation / programs). Lead with Finn audit of current v4E schema + brainstorm with PO + Victoria requirements.

(*MVOX:Palestrina*)
