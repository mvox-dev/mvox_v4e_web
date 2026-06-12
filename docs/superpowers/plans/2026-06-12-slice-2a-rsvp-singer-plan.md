# MVP Slice 2a — Singer RSVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 4-state RSVP control (going/not_going/maybe/late) on /agenda rows; singer writes own rsvp under their person entity; own-status display; fail-loudly member-pairing edge. Spec: `docs/superpowers/specs/2026-06-12-slice-2a-rsvp-singer-design.md`.

**Architecture:** New `src/lib/rsvp/rsvpData.ts` (client-side Entu helpers, `resolveTypeId` pattern). New `RsvpControl.svelte`. `/agenda` page wires control per row with optimistic update + revert-on-error and the YELLOW-10.1 abort guard.

**Branch:** `feat/rsvp-singer` off main.

**Merge trailers (REQUIRED — Bentham REDs without them):**
```
Schema-Change: entu/research@f746d2e "add 'late' to rsvp status enum"
PO-Approved: 2026-06-12 verbal in session, logged by team-lead
```

**Chain:** Comenius (i18n) → Tallis (RED) → Josquin (GREEN data + userStore personId) → Byrd (GREEN UI) → Bentham → Josquin (merge + deploy).

---

## File Map

| File | Action | Owner |
|---|---|---|
| `messages/{en,et,lv,uk}.json` | +6 `rsvp_*` keys | Comenius |
| `src/lib/rsvp/rsvpData.ts` | Create (stub in RED) | Josquin |
| `src/lib/rsvp/rsvpData.spec.ts` | Create | Tallis |
| `src/lib/auth/userStore.ts` + `types.ts` | Expose `personId` on ready state (if not already) | Josquin |
| `src/lib/components/agenda/RsvpControl.svelte` | Create (stub in RED) | Byrd |
| `src/lib/components/agenda/RsvpControl.spec.ts` | Create | Tallis |
| `src/routes/agenda/+page.svelte` | Wire RSVP + YELLOW-10.1 abort guard | Byrd |
| `src/routes/agenda/page.spec.ts` | Extend | Tallis |

---

### Task 1: i18n (Comenius)

- [ ] Add to all 4 locales (en values; Comenius authors et/lv/uk):

```json
{
	"rsvp_going": "Going",
	"rsvp_not_going": "Not going",
	"rsvp_maybe": "Maybe",
	"rsvp_late": "Late",
	"rsvp_not_member": "You're not a member of this choir — RSVP unavailable.",
	"rsvp_error": "Couldn't save your RSVP. Please try again."
}
```

- [ ] `pnpm check` clean → commit `i18n(#8): rsvp keys ×4 locales (6 keys)` → push.

---

### Task 2: RED (Tallis)

Stubs per L120 (module resolves, check green, tests fail on assertions).

- [ ] **Stub `src/lib/rsvp/rsvpData.ts`:**

```ts
import type { EntuCfg } from '$lib/seasons/entuSeasons';

export type RsvpStatus = 'going' | 'not_going' | 'maybe' | 'late';

export interface MyRsvp {
	rsvpId: string;
	eventId: string;
	status: RsvpStatus;
}

export interface CreateRsvpInput {
	personId: string;
	eventId: string;
	memberId: string;
	status: RsvpStatus;
}

export async function listMyRsvps(_cfg: EntuCfg, _personId: string): Promise<MyRsvp[]> {
	throw new Error('not implemented');
}
export async function findMyMemberId(
	_cfg: EntuCfg,
	_personId: string,
	_orgId: string,
): Promise<string | null> {
	throw new Error('not implemented');
}
export function resetMemberIdCache(): void {}
export async function createRsvp(_cfg: EntuCfg, _input: CreateRsvpInput): Promise<string> {
	throw new Error('not implemented');
}
export async function updateRsvpStatus(
	_cfg: EntuCfg,
	_rsvpId: string,
	_status: RsvpStatus,
): Promise<void> {
	throw new Error('not implemented');
}
export async function deleteRsvp(_cfg: EntuCfg, _rsvpId: string): Promise<void> {
	throw new Error('not implemented');
}
```

- [ ] **`rsvpData.spec.ts`** — global-fetch mock pattern (mirror `entuSeasons.spec.ts`; route type-resolution GETs on `url.includes('_type.string=entity')` per the #88 pattern; `resetTypeIdCache()` + `resetMemberIdCache()` in setup). Cover:
  1. `listMyRsvps` — query URL contains `_type.string=rsvp&_parent.reference={personId}`; maps entities (refs in `event[0].reference`, `status[0].string`) to full-shape `MyRsvp[]` via `toEqual`.
  2. `findMyMemberId` — URL contains member-type + person + org + `status.string=active`; returns `entities[0]._id`; empty → `null`; second call same person+org does NOT refetch (memoized); different org refetches.
  3. `createRsvp` — create POST body full-shape `toEqual(arrayContaining)`: `_type` reference = RESOLVED rsvp type id (via mocked resolution), `_parent` = personId, `event` ref, `member` ref, `status` string. NO `_sharing` property in body. Returns `_id`.
  4. `updateRsvpStatus` — GET rsvp props → DELETE each existing status value-id (`/property/{id}`) → POST new status to `/entity/{rsvpId}` (clear-then-set order asserted via call sequence).
  5. `deleteRsvp` — `DELETE /entity/{rsvpId}`; throws on !ok.
  6. Error paths: each helper throws on !ok (status surfaced in message).
- [ ] **Stub `RsvpControl.svelte`** (minimal `$props()` + empty div `data-testid="rsvp-control"`).
- [ ] **`RsvpControl.spec.ts`** — 4 buttons rendered with `m.rsvp_*()` labels + `data-testid="rsvp-btn-<status>"`; `status` prop marks active (`aria-pressed="true"`); click inactive → `onchange(status)`; click active → `onchange(null)`; `disabled` → all buttons disabled + `rsvp_not_member` hint rendered.
- [ ] **`page.spec.ts` extensions** (mock `$lib/rsvp/rsvpData` too): after agenda load, `listMyRsvps` + `findMyMemberId` called; row's control receives status from map; org with `findMyMemberId→null` renders disabled control; failed `setRsvp` path reverts optimistic status and shows `rsvp_error` (mock createRsvp reject); YELLOW-10.1 regression: a stale `listAgenda` resolution after a newer one does NOT overwrite (staleness guard).
- [ ] Run targeted vitest — new tests RED for the right reasons; `pnpm check` 0 errors. Commit `test(#8): RED — rsvpData + RsvpControl + page wiring (stubs per L120)` → push.

---

### Task 3: GREEN data (Josquin)

- [ ] Implement all five helpers in `rsvpData.ts` per spec §2 — follow `entuSeasons.ts` house patterns exactly: `authHeaders`, `ENTU_API_BASE`, `resolveTypeId(cfg, 'rsvp')` for create `_type`, self-resolving clear-then-set for `updateRsvpStatus` (copy `updateSeason` shape, single `status` field), module-level member-id `Map` keyed `${cfg.db}:${personId}:${orgId}`.
- [ ] **userStore personId:** check `UserState.ready` — if person entity id isn't already exposed, add `personId: string` to the ready variant and populate it in `hydrateUserStore` (it already resolves the person; additive change). Update any exhaustive type tests mechanically (refactor rule).
- [ ] `pnpm vitest run src/lib/rsvp src/lib/auth` GREEN; `pnpm check` 0. Commit `feat(#8): rsvp data helpers + userStore personId` → push → message Byrd via team-lead.

---

### Task 4: GREEN UI (Byrd)

- [ ] `RsvpControl.svelte`: segmented 4-button row, runes-only, compact (fits agenda row on mobile); active = filled/inverted; `aria-pressed`; disabled state + hint per RED contract. Paper-and-ink, Inter.
- [ ] `+page.svelte`: after `listAgenda` resolves → parallel `listMyRsvps(cfg, personId)` + `findMyMemberId` per distinct org of loaded items; build `eventId → MyRsvp` + `orgId → memberId|null` maps. `onchange` handler: optimistic local update → `createRsvp` / `updateRsvpStatus` / `deleteRsvp` (null) → on rejection revert + row-level `rsvp_error` notice. **YELLOW-10.1:** add staleness guard (request-id or AbortController in `$effect` cleanup) covering ALL the page's async loads.
- [ ] Full suite + check green. Commit `feat(#8): RSVP control on /agenda — optimistic 4-state + member-pairing guard + YELLOW-10.1 staleness fix` → push.

---

### Task 5: REVIEW (Bentham)

- [ ] Diff `main..feat/rsvp-singer`. Standing checklist + slice-specifics: create body posts `_type` via resolveTypeId (GOTCHA-ENTU-TYPE-CREATE-WIRE standing trigger); no `_sharing` on rsvp create (private-parent default — verify intent comment present); clear-then-set order on update; optimistic-revert is loud (error surfaced, no silent retry); staleness guard present (YELLOW-10.1 closure); no conductor-facing read path snuck in (2b is blocked); trailers present in the PLANNED merge commit message. Verdict → team-lead.

---

### Task 6: MERGE + deploy (Josquin)

- [ ] Squash-merge to main. Commit message:

```
feat(#8): singer RSVP — 4-state control on /agenda

going|not_going|maybe|late inline on agenda rows; rsvp entity under
own person (creator self, user-rights native); member-pairing guard
fails loudly for non-member orgs; optimistic update with revert;
YELLOW-10.1 staleness guard. Conductor visibility deferred (slice 2b).

Schema-Change: entu/research@f746d2e "add 'late' to rsvp status enum"
PO-Approved: 2026-06-12 verbal in session, logged by team-lead

Closes #8
```

- [ ] Verify main: full suite + check. Push; delete branch local+remote. Build + deploy preview (standard command). Report SHA + build hash.

---

(*MVOX:Palestrina*)
