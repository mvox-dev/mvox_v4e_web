# MVP Slice 2b — Conductor Tally Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development or executing-plans. Checkbox steps.

**Goal:** Per-rehearsal RSVP tally (counts) on both `/seasons` (conductor) and `/agenda` (singer), read from the public `event.rsvp_tally` formula; RSVP writes maintain the sentinel refs that feed it. Spec: `docs/superpowers/specs/2026-06-13-slice-2b-conductor-tally-design.md`. Formulas are LIVE on polyphony (`35f30ec`).

**Branch:** `feat/conductor-tally` off main.
**Chain (single-tree, serial):** Tallis RED → Josquin GREEN (data: write sentinels + tally in queries) → Byrd GREEN (UI: shared tally badge on both lists) → Comenius (i18n if worded labels) → Bentham → merge (+trailers) → deploy.

**Merge trailers (REQUIRED — Bentham REDs without):**
```
Schema-Change: entu/research@52c2c16 "rsvp sentinel refs + event tally formulas"
PO-Approved: 2026-06-12/13 verbal in session, logged by team-lead
```

## File Map

| File | Action | Owner |
|---|---|---|
| `src/lib/rsvp/rsvpData.ts` | createRsvp + updateRsvpStatus sentinel mgmt; `RsvpTally` + `parseTally` | Josquin |
| `src/lib/seasons/entuSeasons.ts` | `listRehearsals` props += `rsvp_tally`; map `tally` | Josquin |
| `src/lib/seasons/types.ts` | `Rehearsal.tally: RsvpTally` | Josquin |
| `src/lib/components/agenda/RsvpTallyBadge.svelte` | shared tally badge (NEW) | Byrd |
| `src/lib/components/seasons/RehearsalList.svelte` | render badge per row | Byrd |
| `src/lib/components/agenda/AgendaList.svelte` | render badge per row | Byrd |
| `messages/{en,et,lv,uk}.json` | tally_* keys (if worded) | Comenius |
| spec files' `*.spec.ts` | per below | Tallis |

### Task 1: RED (Tallis)

- [ ] **`rsvpData.spec.ts`**:
  - `createRsvp` with each status → body contains `{ type: '<status>_ref', reference: <eventId> }` exactly once (parameterize all 4: going→going_ref, not_going→not_going_ref, maybe→maybe_ref, late→late_ref); full-shape `arrayContaining` incl. the sentinel.
  - `updateRsvpStatus`: GET requests `props=status,event,going_ref,not_going_ref,maybe_ref,late_ref`; all existing status + sentinel value-ids DELETEd; POST new status + `{ type: '<newstatus>_ref', reference: <event ref from GET> }`. Assert call ordering (GET before DELETEs before POSTs) and that the sentinel reference = the event id read from the GET.
  - `parseTally`: valid `'{"going":3,"not_going":1,"maybe":2,"late":0}'` → `{going:3,not_going:1,maybe:2,late:0}`; `undefined` → all-zeros; malformed `'{oops'` → all-zeros (+ no throw).
  - `deleteRsvp`: unchanged (regression pin).
- [ ] **agenda/seasons data**: `listRehearsals` query string includes `rsvp_tally`; a row with `rsvp_tally:[{string:'{"going":2,...}'}]` maps to `tally:{going:2,...}`; row without → `tally:{going:0,...}`.
- [ ] **Stub** `RsvpTallyBadge.svelte` (minimal `$props()` + `data-testid="rsvp-tally"`); **`RsvpTallyBadge.spec.ts`**: given `tally={going:12,not_going:3,maybe:2,late:1}` renders the four numbers with testids `tally-going`/`tally-not_going`/`tally-maybe`/`tally-late`; all-zero renders `0`s.
- [ ] Add `RsvpTally`/`parseTally`/`tally`-field stubs to source so `pnpm check` passes at RED (L120). Run targeted vitest → RED for the right reasons; `pnpm check` 0. Commit `test(#slice-2b): RED — sentinel writes + tally parse + badge` → push → handoff.

### Task 2: GREEN data (Josquin)

- [ ] `rsvpData.ts`: `createRsvp` appends `{ type: \`${input.status}_ref\`, reference: input.eventId }`. `updateRsvpStatus` → GET `props=status,event,going_ref,not_going_ref,maybe_ref,late_ref`; collect + DELETE all status + sentinel value-ids; read event id from the GET; POST `[{type:'status',string:status},{type:\`${status}_ref\`,reference:eventId}]`. Add `RsvpTally` interface + `parseTally`.
- [ ] `entuSeasons.ts`: add `rsvp_tally` to `listRehearsals` props; map `tally: parseTally(raw.rsvp_tally?.[0]?.string)` onto each `Rehearsal`. `types.ts`: `Rehearsal.tally: RsvpTally` (+ `RehearsalRaw.rsvp_tally?`).
- [ ] `pnpm vitest run src/lib/rsvp src/lib/seasons src/lib/agenda` GREEN; `pnpm check` 0. Commit `feat(#slice-2b): rsvp sentinel writes + tally in rehearsal queries` → push → message Byrd via team-lead.

### Task 3: GREEN UI (Byrd)

- [ ] `RsvpTallyBadge.svelte`: props `{ tally: RsvpTally }`; render the four counts (icons ✓/✗/?/⏱ + numbers, or `m.tally_*()` labels — your call w/ Comenius); testids per RED. Runes-only, compact, paper-and-ink. Hide nothing on zero (show `0`s) — a conductor wants to see "0 responded".
- [ ] Render `<RsvpTallyBadge tally={item.tally} />` per row in BOTH `RehearsalList.svelte` and `AgendaList.svelte`.
- [ ] Full suite + `pnpm check` green. Commit `feat(#slice-2b): tally badge on rehearsal + agenda rows` → push → handoff (note if worded labels → Comenius needed).

### Task 4: i18n (Comenius — only if worded labels)

- [ ] If Byrd used `m.tally_*()`: add `tally_going`/`tally_not_going`/`tally_maybe`/`tally_late` ×4 locales. Else skip. `pnpm check`; commit `i18n(#slice-2b): tally labels ×4 locales` → push → handoff.

### Task 5: REVIEW (Bentham)

- [ ] Diff `main..feat/conductor-tally`. Checklist: sentinel mapping correct + mutually-exclusive (update clears ALL sentinels before setting one); event id sourced from the rsvp's own `event` ref (not trusted from client); `parseTally` never throws (graceful zero); `rsvp_tally` rides existing queries (no N+1); counts-only (no name leak); badge renders zero-state; full-shape test assertions; trailers present in planned squash. Verdict → team-lead.

### Task 6: MERGE + deploy (Josquin)

- [ ] Squash `feat(#slice-2b): conductor + singer RSVP tally (formula-based)` with the two trailers + `Closes` the relevant issue (#85 conductor-adjacent? — team-lead confirms which). Verify main, push, delete branch. Build + deploy preview. Report build hash → team-lead pings PO to live-test (RSVP on /agenda → see the tally update on both /agenda and /seasons).

(*MVOX:Palestrina*)
