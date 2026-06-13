# Slice-2b Optimistic Tally Refresh — Plan

> REQUIRED SUB-SKILL: subagent-driven-development or executing-plans. Checkbox steps.

**Goal:** On `/agenda` RSVP change, optimistically adjust the affected event's tally badge by the known ±1 delta (revert on failure) — instant feedback, no propagation dependency. Spec: `docs/superpowers/specs/2026-06-13-slice-2b-optimistic-tally-design.md`.

**Branch:** `feat/optimistic-tally` off main.
**Chain (single-tree, serial):** Tallis RED → Josquin (helper) → Byrd (page) → Bentham → merge → deploy. No i18n, no schema change (pure client logic — no trailers).

## Files
- `src/lib/rsvp/rsvpData.ts` — `applyTallyDelta` (Josquin)
- `src/lib/rsvp/rsvpData.spec.ts` — helper tests (Tallis)
- `src/routes/agenda/+page.svelte` — wire optimistic tally + revert (Byrd)
- `src/routes/agenda/page.spec.ts` — page test (Tallis)

### Task 1: RED (Tallis)
- [ ] Stub `applyTallyDelta(tally, oldStatus, newStatus): RsvpTally` in `rsvpData.ts` (throws 'not implemented') so `pnpm check` passes (L120).
- [ ] `rsvpData.spec.ts` — `applyTallyDelta` (full-shape `toEqual`): `null→going`→going+1; `going→maybe`→going−1,maybe+1; `going→null`→going−1; `maybe→late`→maybe−1,late+1; `null→null`→unchanged; clamp: tally with going=0, `going→maybe`→going stays 0, maybe+1.
- [ ] `agenda/page.spec.ts` — after an RSVP change on a row, that row's tally badge reflects the delta (e.g. going 2→3 when null→going); on `createRsvp`/`updateRsvpStatus` rejection, the tally reverts to its pre-change value (alongside the existing rsvp-state revert). Mock the rsvpData calls.
- [ ] Targeted vitest RED for right reasons; `pnpm check` 0. Commit `test(#slice-2b-opt): RED — applyTallyDelta + optimistic page tally` → push → handoff.

### Task 2: GREEN helper (Josquin)
- [ ] Implement `applyTallyDelta` in `rsvpData.ts` per spec (clone, dec old w/ `Math.max(0,…)`, inc new, return new object).
- [ ] `pnpm vitest run src/lib/rsvp` GREEN; `pnpm check` 0. Commit `feat(#slice-2b-opt): applyTallyDelta helper` → push → handoff (msg Byrd via team-lead).

### Task 3: GREEN page (Byrd)
- [ ] `agenda/+page.svelte` `onrsvpchange`: capture old status + current tally; optimistically set the item's tally via `applyTallyDelta` (reassign for reactivity); on write rejection revert tally alongside the existing rsvp-state + `rsvp_error` revert. Keep within the existing try/revert + staleness guard.
- [ ] Full suite + `pnpm check` green. Commit `feat(#slice-2b-opt): optimistic tally delta on /agenda RSVP` → push → handoff.

### Task 4: REVIEW (Bentham)
- [ ] Verify: delta math correct + clamped; revert restores tally on failure (paired with rsvp-state revert); `/seasons` untouched; runes reactivity (reassign, not mutate); no drift hazard beyond the documented next-load reconciliation. Verdict → team-lead.

### Task 5: MERGE + deploy (Josquin)
- [ ] Squash `feat(slice-2b): optimistic tally delta on /agenda RSVP`. Verify main, push, delete branch. Build + deploy preview. Report build hash → team-lead pings PO (RSVP on /agenda → tally moves instantly, no reload).

(*MVOX:Palestrina*)
