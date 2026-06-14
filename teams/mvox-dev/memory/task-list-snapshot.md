# Task List Snapshot — 2026-06-14 end-of-session-35

State at session-35 close.

## Active tasks (in-flight)

None. Session wrapped.

## Pending — next session (S36)

**About page (Carus outreach)** — PO priority (politically pressing, ahead of the slice-3 MVP blocker). Brainstorm DONE + PO-approved. Spec: `docs/superpowers/specs/2026-06-14-about-page-carus-outreach-design.md`. Next: `writing-plans` → TDD chain (content + i18n; `about_*` keys already exist in 4 locales). Read Carus/Tormis Gmail thread `19e3f59f52444354` + "isiklik" letter `19e27cc9ff5325f3` for tone first. See team-lead.md [NEXT SESSION] seed (⭐) + memory `project_mvox_carus_publisher_outreach`.

## Deferred — slice-3 invite/accept (MVP blocker, parked at #91)

Resume via the NATIVE keyless + leak-free design (= documented v4E intent): singer creates `application` (own JWT, private) granting `_viewer` to org admins; admin approves → own owner JWT creates `member`. Run ONE probe first (does a `_viewer`-granted application appear in the admin's LIST query?); possibly add an aggregate formula on `organization`. Salvage ~70% of branch `feat/invite-join` (@ `8b5ec86`, pushed; green but DO-NOT-MERGE — unfixed RED-35.1); delete `elevated.ts` + 2 `/api/invite` endpoints. Do NOT provision `ENTU_SERVICE_KEY`. Full rationale + 7 team perspectives on issue **#91**. Issues #21 + #11 stay open.

## Session-35 completed

1. **Slice-3 Phase 0 probes** (gating) — all green; `application` type confirmed live (resolved the S32 concern).
2. **Slice-3 plan doc** finalized + committed (`d4c1718`).
3. **Slice-3 TDD chain → green service-key impl** (`feat/invite-join`, 1127 tests, check 0). Bentham RED caught the accept-flow `orgId` bug (every Accept 403'd, hidden by a vacuous async test); re-spin fixed it; Tallis codebase-wide vacuous-guard audit.
4. **No-key model probe** (`cfce0c9`) + **schema-design convergence** → issue **#91** filed with 7 team perspectives; Josquin 🥇 found the native design is the documented v4E intent.
5. **About-page/Carus design** brainstormed + PO-approved; spec committed; gist created.

## State

`main` tip = wrap commit. `feat/invite-join` pushed @ `8b5ec86` (parked, do-not-merge). Open issues ~21. All agents shut down clean.

(*MVOX:Palestrina*)
