# MVP Slice 2b — Conductor RSVP Tally (formula-based)

**Status:** DRAFT for PO approval (the UI-placement decision in §4 is the one open call).
**Parent:** `2026-06-12-mvp-rehearsal-attendance-loop-design.md` §4 slice 2.
**Depends on:** entu/research#52 (merged `52c2c16`) + the live polyphony prop-defs (applied + verified 3/3, `35f30ec`). The tally formulas are LIVE.

**Merge trailers (required):**
```
Schema-Change: entu/research@52c2c16 "rsvp sentinel refs + event tally formulas"
PO-Approved: 2026-06-12/13 verbal in session, logged by team-lead
```

## 1. What it is

A conductor sees, per rehearsal, how many singers responded going / not_going / maybe / late — **counts only**, read straight off the event's public formula properties. No server, no elevated op, no identity (the whole point of the formula approach).

## 2. Write-path augmentation (the sentinel half) — `src/lib/rsvp/rsvpData.ts`

The shipped slice-2a writes `status`; slice-2b also maintains the matching sentinel ref so the event's count formulas fire. Mapping is mechanical: `status` value `X` → prop `X_ref` (going→`going_ref`, not_going→`not_going_ref`, maybe→`maybe_ref`, late→`late_ref`), value = the event `_id`.

- **`createRsvp`**: add one prop to the create body — `{ type: \`${input.status}_ref\`, reference: input.eventId }`. (One sentinel set at birth.)
- **`updateRsvpStatus`**: currently GETs `status` value-ids, clears, re-posts. Extend: GET `props=status,event,going_ref,not_going_ref,maybe_ref,late_ref`; DELETE all existing `status` AND all existing sentinel value-ids; POST new `status` + new `{ type: \`${status}_ref\`, reference: <event ref from the GET> }`. (The event id comes from the rsvp's own `event` ref — `updateRsvpStatus` keeps its `(cfg, rsvpId, status)` signature.)
- **`deleteRsvp`**: unchanged — deleting the rsvp entity removes its sentinel with it.

Best-effort, non-transactional (mirrors the existing clear-then-set in `updateSeason`/`updateRsvpStatus`); a mid-sequence failure throws and surfaces, a re-hydrate shows the true state.

## 3. Tally read — fold into the existing event queries (no N+1)

```ts
export interface RsvpTally { going: number; not_going: number; maybe: number; late: number; }
export function parseTally(raw: string | undefined): RsvpTally; // JSON.parse; all-zeros on absent/bad
```

`rsvp_tally` is a public formula property on each event, so **add it to the props the rehearsal/event list queries already fetch** rather than a per-event round-trip:
- `listRehearsals` (`entuSeasons.ts`): add `rsvp_tally` to its `props=…` list; map each row's `rsvp_tally?.[0]?.string` through `parseTally` onto a new `Rehearsal.tally: RsvpTally` field (`types.ts`).
- `listAgenda` already maps `listRehearsals` output → `AgendaItem` inherits `tally` for free.

`parseTally`: `JSON.parse` the string; on absent/unparseable return `{going:0,not_going:0,maybe:0,late:0}` + `console.warn` (a missing tally must not break the list). Zero extra requests — the tally rides the queries we already make.

(Reading the single `rsvp_tally` string over the 4 separate count props, per architecture-B.)

## 4. UI placement — BOTH `/seasons` and `/agenda` (PO decision 2026-06-13)

Counts are public, surfaced in two places:
- **`/seasons` RehearsalList (conductor/manage):** tally badge per rehearsal row — "conductor sees who's coming."
- **`/agenda` rows (singer):** same badge — social "who's coming tonight."

Both render from the `tally` field already on each `Rehearsal`/`AgendaItem` (§3) — no extra fetches, one shared tally component. Badge form: `✓ 12 · ✗ 3 · ? 2 · ⏱ 1` (icons + numbers) or worded labels — Byrd/Comenius settle at build.

## 5. i18n

New keys if worded labels used: `tally_going`, `tally_not_going`, `tally_maybe`, `tally_late` (×4 locales). If purely iconic (✓/✗/?/⏱ + numbers), minimal/none. Comenius decides at the i18n step.

## 6. Testing

- `rsvpData.spec.ts`: `createRsvp` sets the matching sentinel (full-shape body assertion, all 4 status→sentinel mappings); `updateRsvpStatus` clears all sentinels + sets the new one + reads event ref (call-order: GET → DELETEs → POSTs); `deleteRsvp` unchanged; `parseTally` parses valid JSON + all-zeros fallback on absent/bad value.
- `entuSeasons.spec.ts` / agenda data: `listRehearsals` query includes `rsvp_tally` in props; each Rehearsal carries the parsed `tally`.
- Component tests: tally badge renders the four counts per row (RehearsalList + AgendaList); zero-state renders `0`s.

## 7. Out of scope

Name lists (who specifically — would need the elevated read we abandoned; counts-only for MVP); RSVP lockout.

**Chain (single-tree):** spec+plan → main → `feat/conductor-tally` → Tallis RED → Josquin GREEN (data) → Byrd GREEN (UI) → Comenius (i18n if worded) → Bentham → merge (+trailers) → deploy.

(*MVOX:Palestrina*)
