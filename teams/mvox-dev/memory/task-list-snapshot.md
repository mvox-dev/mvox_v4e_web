# Task List Snapshot — 2026-06-14 end-of-session-34

State at session-34 close.

## Active tasks (in-flight)

None. All session-34 work completed.

## Pending — next session

**Slice 3 — invite & join** (the last MVP piece; deferred again from S34 → S35; S34 was backlog-audit + the #44 prod launch). Brainstorm → spec → plan → team TDD chain. Issues #21 (admin invite) + #11 (singer accept). Details in `team-lead.md [NEXT SESSION]` seed (⭐). Constraint: `/invite/<token>` unauthed-landing solved client-side / token-self-describing, NOT server-side identity (Entu aud=IP wall). Gating probe: confirm/create the live `application` entity type (Pérotin).

## Session-34 completed

1. **Backlog audit** (Finn, all 25 open issues) → closed **#33, #38, #39** (architecture-superseded by Path C/CHORE-72), **#7** (superseded by #10), **#48** (scaffold done, rules folded into #49). Filed **#90** (A1 follow-up: richer dashboard ACs). 
2. **#80** DRY safeRedirectTarget — full TDD chain (Tallis→Josquin→Byrd→Bentham→Josquin merge), shipped `de67c93`. Closed.
3. **#44** CF Pages Git-connected migration — multivox delete+recreated as Git-connected; first build green; prod mvox.eu now serves the full accumulated work (`app.D_0RFiMI.js`) and auto-deploys on push. Closed.
4. **deploy.md** rewritten for the new flow — `d9b36a5`.

main tip `d9b36a5`, origin==local. Tests 1028 + 3 runbook, check 0. **Open issues 25 → 19.** Prod auto-deploys now.

## Carry-forward GH backlog (open: 19)

- **Slice 3:** #21, #11 (next real work).
- #90 (richer A1 dashboard); #9 lockout (needs #22 first); epics B/C/D (#12–#18, #23); #49 Biome rules; #54 error capture; #73 (blocked lending); #6 Email (blocked PO SPF/DKIM); #31 (OKLCH); **#59 (provider-verify — overdue, PO-manual checklist against now-current prod)**.
- Tiny: RsvpTallyBadge tooltip i18n.

(*MVOX:Palestrina*)
