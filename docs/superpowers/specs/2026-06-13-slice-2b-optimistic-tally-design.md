# Slice-2b addendum — optimistic tally refresh

**Status:** APPROVED (PO, 2026-06-13). Follow-up polish on shipped slice-2b (`eaa3c1b`).

## Problem

The tally badge is read once at list hydration (`listRehearsals`/`listAgenda`). After a singer RSVPs, their own control updates optimistically, but the tally badge keeps its load-time value until (a) the `event.rsvp_tally` formula propagates (~seconds, materialised) AND (b) the list is re-fetched. So the count appears "stuck" until reload — a confusing UX on the very surface where the action happens.

## Fix — optimistic delta on the action surface (`/agenda`)

A singer's RSVP change affects exactly their own one rsvp, so the tally delta is deterministic: old status bucket −1, new status bucket +1. Apply it to the affected event's displayed tally immediately, client-side — no dependency on formula propagation. Revert on write failure (alongside the existing rsvp-state revert). The authoritative formula value reconciles on the next real load.

Scope: `/agenda` only (where the RSVP action originates). `/seasons` (conductor view, no RSVP control) keeps load-time tally — reload to refresh; out of scope.

### Pure helper — `applyTallyDelta` in `rsvpData.ts`

```ts
export function applyTallyDelta(
	tally: RsvpTally,
	oldStatus: RsvpStatus | null,
	newStatus: RsvpStatus | null,
): RsvpTally {
	const next = { ...tally };
	if (oldStatus) next[oldStatus] = Math.max(0, next[oldStatus] - 1);
	if (newStatus) next[newStatus] = next[newStatus] + 1;
	return next;
}
```
- `null` old → no decrement (was no rsvp); `null` new → no increment (clearing). `null→null` is a no-op.
- `Math.max(0, …)` floor guards a stale-low load-time value from going negative.
- Returns a new object (runes reactivity).

### Page wiring — `/agenda/+page.svelte`

In the existing `onrsvpchange` handler, after the optimistic rsvp-state update and before/around the write call:
1. Capture the event's current tally + the old status.
2. Optimistically set the item's tally = `applyTallyDelta(tally, oldStatus, newStatus)` (reassign for reactivity).
3. On write rejection: revert the tally to the captured value (alongside the existing rsvp-state + `rsvp_error` revert).

Both the rsvp-state and tally optimistic updates share the same try/revert envelope and the existing YELLOW-10.1 staleness guard.

## Testing

- `rsvpData.spec.ts`: `applyTallyDelta` — `null→going` (going+1), `going→maybe` (going−1, maybe+1), `going→null` (going−1), `maybe→late`, `null→null` (no-op), clamp (`going→x` when going already 0 → stays 0). Full-shape `toEqual`.
- `agenda/page.spec.ts`: RSVP change optimistically adjusts the affected row's tally; write-failure reverts both tally and rsvp state.

## Out of scope

`/seasons` live tally refresh (reload-to-refresh stands); cross-user real-time (another user's RSVP still needs a reload + propagation — this only makes the *acting singer's own* change feel instant).

**Chain (single-tree):** spec+plan → main → `feat/optimistic-tally` → Tallis RED → Josquin (`applyTallyDelta`) → Byrd (page wiring) → Bentham → merge → deploy. No i18n, no schema change (no trailers needed — pure client logic).

(*MVOX:Palestrina*)
