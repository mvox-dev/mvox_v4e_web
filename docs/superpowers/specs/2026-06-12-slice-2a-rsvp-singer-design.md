# MVP Slice 2a — Singer RSVP (#8, singer half)

**Parent scope:** `2026-06-12-mvp-rehearsal-attendance-loop-design.md` §4 slice 2.
**Split rationale:** conductor visibility (2b) is blocked — the elevated-report design needs an auth-architecture fix (CLIENT-TAINTED cookie, Finn audit 2026-06-12 — PO escalation required), and the grants-at-write alternative awaits Pérotin's member-tier rights probe. 2a is the unblocked singer half: write + own-status display. **No conductor-facing RSVP surface ships in 2a.**

**Schema:** rsvp per v4E (child of person, `event`+`member` refs, status enum). Status enum incl. `late` per entu/research@f746d2e. Merge trailers required:
```
Schema-Change: entu/research@f746d2e "add 'late' to rsvp status enum"
PO-Approved: 2026-06-12 verbal in session, logged by team-lead
```

## 1. Behavior

Each agenda row gets a 4-state RSVP control: **going / not going / maybe / late**. Tap to set; tap the active state to clear (delete the rsvp). Freely changeable until rehearsal start (no lockout). Optimistic UI with revert + visible error on failure — no silent retry (fail-loudly).

**Member-pairing edge (fail loudly):** an rsvp requires a `member` ref. If the user has no active member row in the event's org (e.g., PO as owner-only), the control renders disabled with `rsvp_not_member` text. No silent fallback to memberless writes.

## 2. Data layer — new `src/lib/rsvp/rsvpData.ts`

```ts
export type RsvpStatus = 'going' | 'not_going' | 'maybe' | 'late';
export interface MyRsvp { rsvpId: string; eventId: string; status: RsvpStatus; }
```

- `listMyRsvps(cfg, personId): Promise<MyRsvp[]>` — one query: `_type.string=rsvp&_parent.reference={personId}&props=event,member,status&limit=500`. Page maps by eventId.
- `findMyMemberId(cfg, personId, orgId): Promise<string | null>` — `_type.string=member&person.reference={personId}&_parent.reference={orgId}&status.string=active&props=_id&limit=1`; `null` when absent (drives the disabled state). Memoized per `${db}:${personId}:${orgId}`.
- `createRsvp(cfg, {personId, eventId, memberId, status}): Promise<string>` — POST entity create: `_type` via `resolveTypeId(cfg, 'rsvp')` (#88 pattern), `_parent` = personId, `event` ref, `member` ref, `status` string. No explicit `_sharing` (private parent → private default, per create-time-copy semantics).
- `updateRsvpStatus(cfg, rsvpId, status): Promise<void>` — self-resolving clear-then-set on the `status` property (mirrors `updateSeason`).
- `deleteRsvp(cfg, rsvpId): Promise<void>` — `DELETE /entity/{rsvpId}` (clearing one's own rsvp).

All run client-side under the user's JWT (creator `self` per schema — native rights).

`personId` source: the user's person entity id already resolved during `hydrateUserStore` (JWT claims → person). Exposed from userStore state; if not currently retained, extend `UserState.ready` with `personId` (additive, no signature break).

## 3. UI

- `src/lib/components/agenda/RsvpControl.svelte` — segmented 4-button control; props `{ status: RsvpStatus | null, disabled: boolean, onchange: (s: RsvpStatus | null) => void }`. Active state visually distinct; tap active → null (clear). Disabled state shows `rsvp_not_member` as title/hint text.
- `/agenda/+page.svelte` — after `listAgenda` resolves: parallel `listMyRsvps` + `findMyMemberId` per distinct org. Wire `RsvpControl` per row: status from the map; change handler does optimistic set → calls create/update/delete → on error reverts and shows `rsvp_error` notice (row-level).
- **YELLOW-10.1 fix folded in:** the page `$effect` gets an `AbortController`/staleness guard in cleanup so late responses can't overwrite newer state.

## 4. i18n (×4 locales)

`rsvp_going`, `rsvp_not_going`, `rsvp_maybe`, `rsvp_late`, `rsvp_not_member`, `rsvp_error`.

## 5. Testing

- `rsvpData.spec.ts`: each helper — query shape, create body full-shape (`toEqual`, `_type` as resolved reference, parent person, event+member refs, status), update clear-then-set wire order, delete; memberId found/absent; memoization.
- `RsvpControl.spec.ts`: renders 4 states; active marking; tap inactive → onchange(status); tap active → onchange(null); disabled blocks interaction + hint.
- `page.spec.ts` additions: rsvp map drives row controls; optimistic update + revert-on-error; no-member org rows disabled; abort/staleness guard (YELLOW-10.1 regression test).

## 6. Out of scope (2a)

Conductor tally/visibility (2b — blocked, see header), `_viewer` grants at write (await probe), lockout, rsvp notes field, attendance.

(*MVOX:Palestrina*)
