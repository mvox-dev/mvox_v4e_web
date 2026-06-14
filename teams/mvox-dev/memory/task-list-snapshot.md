# Task List Snapshot — 2026-06-14 end-of-session-33

State at session-33 close.

## Active tasks (in-flight)

None. All session-33 work completed and merged to main (preview-only; prod untouched).

## Pending — next session

**Slice 3 — invite & join** (the last MVP piece; postponed from S33 → S34). Brainstorm → spec → plan → team TDD chain. Details in `team-lead.md [NEXT SESSION]` seed (⭐ section). Key constraint: the `/invite/<token>` unauthed-landing must be solved client-side / token-self-describing, NOT server-side identity (Entu aud=IP wall). Gating probe: confirm/create the live `application` entity type (Pérotin).

## Session-33 completed (all squash-merged to main, preview-only)

1. `12f4b14` — sub-chain 1: navigation + coming-soon placeholders + i18n (full TDD chain + ultracode review, 2 REDs fixed)
2. `9a59ecc` — sub-chain 2: readability-visual (12-point orbit, desk color `#f7ecd4→#f7dcca`, agenda per-day cards)
3. `0abc774` — sub-chain 3: readability-conformance (seasons/library/auth on paper + Playwright bg-rule gate; ultracode review caught gate false-pass + Margin misuse)
4. `ab275e6` — fix: `/seasons` rehearsal cards + state messages (PO live-check catch)
5. `e39b446` — YELLOW polish batch (a11y + eyebrow i18n + tabForPath exact-segment + gate tightening)

main tip `31dce91`, origin==local, 1018 tests, bg-rule gate 6/6, check 0. Preview `app.Cgj9ARtI.js`.

## Forward-looking / parked

- **YELLOW-33.4:** LibraryMaster `.master-paper` needs an explicit `background-color: #fbf9f3` fallback IF the bg-rule gate is ever extended to auth-guarded routes (CHORE-C territory). Non-blocking today (library auth-guarded, outside the public gate).
- Desk-grain opacity tuning (PO's external tool); orbit stays at r=10px.

## Carry-forward GH backlog (unchanged)

- Audit/close epic-A issues #7/#8/#9 per `feedback_closes_n_pattern` — not done.
- #80 DRY safeRedirectTarget; /about real content; #73; #54; #44 CF git-deploy; #49 Biome; #6 Email (blocked PO SPF/DKIM); CHORE-C test infra.

(*MVOX:Palestrina*)
