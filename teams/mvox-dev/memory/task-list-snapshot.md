# Task List Snapshot — 2026-06-13 end-of-session-32

State at session-32 close.

## Active tasks (in-flight)

None. All session-32 work completed and merged.

## Pending — next session

**Slice 3 — invite & join** (the last MVP piece; PO left it for session 33). Brainstorm → spec → plan → team TDD chain. Details in `team-lead.md [NEXT SESSION]` seed (⭐ section). Key constraint: the `/invite/<token>` unauthed-landing problem — solve client-side / token-self-describing, NOT server-side identity (Entu aud=IP wall).

## Session-32 completed (all merged to main, preview-only; prod untouched)

1. #88 runtime type-id resolution (`36c453d`) — full TDD chain
2. Slice-1 `/agenda` unified agenda (`8d93f4d`)
3. Slice-2a singer RSVP 4-state (`6965c41`)
4. #89 stale-JWT cleanup (`0d67bb7`) — ultracode workflow design
5. Trusted-identity stack REVERTED (`f819d68`) — aud=IP dead end
6. Slice-2b conductor+singer formula tally (`eaa3c1b`)
7. Slice-2b-opt instant optimistic tally delta (`8878419`)

main @ `8878419`, origin matches, 915/915 tests, check 0, preview `66f32e39`.

## Upstream / cross-repo (open)

| Item | Repo | Status |
|---|---|---|
| #52 rsvp tally formulas | entu/research | MERGED `52c2c16` (+ applied live `35f30ec`) |
| #51 rsvp `late` enum | entu/research | MERGED `f746d2e` |
| #50 case-study (PO's) | entu/research | CI green, OPEN for PO review/merge |
| #14 formula-behaviour doc-request | entu/www | OPEN |
| #11, #13 docs PRs; entu/api #41, #42 | entu/www, entu/api | OPEN, awaiting Argo |

## MVP scorecard

| Slice | State |
|---|---|
| 1 agenda | ✅ live |
| 2a singer RSVP | ✅ live |
| 2b conductor/singer tally | ✅ live |
| 2b+ instant tally | ✅ live |
| 3 invite & join | ⬜ next session |

## Carry-forward GH backlog (unchanged)

- Audit/close epic-A issues #7/#8/#9 (delivered by slices 1+2a) per `feedback_closes_n_pattern` — not done this session.
- Badge tooltip i18n (tiny); #80 DRY; /about real content; #73; #54; #44 CF git-deploy; #49 Biome; #6 Email (blocked PO SPF/DKIM).
- Dead CF secret `MVOX_SESSION_SECRET` (trusted-identity reverted) — deletable, low priority.

(*MVOX:Palestrina*)
