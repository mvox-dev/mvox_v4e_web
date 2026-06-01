# Rehearsal Schedule (First Slice) Implementation Plan

> **For agentic workers:** This plan executes via the **mvox-dev team TDD chain** (Tallis RED → Josquin/Byrd GREEN → Comenius i18n → Bentham review → Josquin merge). Execution mode is baked in per `feedback_plan_execution_mode_baked_in` — this is NOT a subagent-driven or generic-engineer plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-05-31-rehearsal-schedule-first-slice-design.md` @ `4c4b1ab`+ (source of truth; every task cites a §-capability).

**Goal:** Let a conductor/admin open a season, assign conductors, define a recurring rehearsal series that eagerly generates the individual rehearsals, view them, edit/cancel one, and delete the whole series — all on the v4E schema with zero schema change.

**Architecture:** Client-side Entu hydration (spec §3.3a — `PUBLIC_ENTU_DB` + storage JWT, mirroring `src/lib/library/`). New `src/lib/seasons/` module: pure logic (`recurrence.ts`, `validation.ts`) + Entu helpers (`entuSeasons.ts`) + a hydration store (`seasonsStore.ts`) + UI under `src/lib/components/seasons/` driving a new `/seasons` route. Rights are Entu-enforced (the user's JWT carries their tier); the app surfaces 403s. Conductor = direct `_editor` grant (roles-as-rights, no `conductors` property).

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, TS strict, Tailwind v4, Vitest (unit + component via `@testing-library/svelte`), Paraglide i18n (en/et/lv/uk), pnpm.

**Branch:** `feat/rehearsal-schedule` off clean `main` (one branch; no parallel work per `feedback_no_parallel_branches`).

**GitHub issues** (filed session 28): Cap 1 → #19 (ADMIN-1, updated) · Cap 2 → #20 (ADMIN-2, updated) · Cap 3 → **#81** (ADMIN-6) · Cap 4 → **#82** (ADMIN-7) · Cap 5 → **#83** (ADMIN-8) · Cap 6 → **#84** (ADMIN-9) · Cap 7 → **#85** (ADMIN-10). The `#ADMIN-N` tags in commit messages below map to these numbers.

**Quality gates per task:** `pnpm check` 0 errors · `pnpm test` green · commit only the task's staged set (verify `git diff --cached --name-only`).

---

## Phase 0 — Pre-flight rights probes (Pérotin) — GATING

These confirm the live Entu rights mechanics the spec §8 flagged. **Tasks 8, 9, 12, 13 (delete + conductor capabilities) MUST NOT reach GREEN until this report lands.** Probes run on the live polyphony playground (`project_polyphony_is_playground`) with throwaway `_probe_*` entities (`project_entu_probe_first`). Requires PO "I authorize this run" before any live mutation (`feedback_authorization_gate`).

- [ ] **P0.1 — Delete-rights tier.** As an `_editor`-only persona (no org `_owner`), create a `_probe_series` + a `_probe_event` child, then attempt `DELETE /entity/{id}` on each. Record: does `_editor` delete succeed or 403? Repeat as `_owner`. **Expected:** `_editor` → fail, `_owner` → succeed (spec §3.3).
- [ ] **P0.2 — Conductor grant wire.** As `_owner` on a `_probe_season`, POST an `_editor` reference to a probe person; confirm the grant lands. Then `DELETE` that property value's `_id`; confirm full removal. Record the exact request/response shape.
- [ ] **P0.3 — `inherited: true` flag visibility.** GET the `_probe_season` after granting a direct `_editor` AND inheriting org-owner rights; confirm the response distinguishes direct vs inherited entries via `inherited: true`. **If absent → flag immediately; AC for "list conductors" needs the org-owner-subtraction fallback (spec §8 #4).**
- [ ] **P0.4 — Revoke drops tier-cascade.** After revoking the direct `_editor`, confirm the materialised `_expander`/`_viewer` for that person are gone too (no orphans).
- [ ] **P0.5 — Creator auto-owner?** As an `_editor` persona, create a `_probe_event`; GET it and check whether the creator received an entity-level `_owner`. Determines whether the §7-Cap6 "option A" residual-rights edge is real.
- [ ] **P0.6 — Propagation timing.** Grant `_editor` on a season, then immediately attempt a child create as the grantee; measure the lag until it succeeds (spec note: ~1.5–3.5s/level). Feeds the test-harness retry-window design.
- [ ] **P0.7 — Report.** Pérotin sends team-lead a structured report; team-lead updates spec §8 (probe → resolved) and relays any AC adjustment to Tallis before the gated RED tasks.

> Pérotin also seeds (post-authorization) one throwaway org + member + person so the implementation tests have a real `_owner`/`_editor`/member triple to run against in dev (`feedback_ui_parallels_with_seed`).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/seasons/types.ts` | Domain types (`Season`, `RehearsalSeries`, `Rehearsal`, `Conductor`) + Entu raw shapes (`*Raw`). |
| `src/lib/seasons/recurrence.ts` | **Pure.** `occurrenceDates(start,end,intervalDays)` + `toStartDatetime(date, "HH:MM")` → UTC ISO, DST-aware (`Europe/Tallinn`). No I/O. |
| `src/lib/seasons/validation.ts` | **Pure.** `validateSeason`, `validateSeries` → `{ ok } \| { ok:false, field, code }`. |
| `src/lib/seasons/entuSeasons.ts` | Client-side Entu helpers (mirrors `hydrateLibrary`): season/series/event CRUD + conductor grant/revoke/list. Each takes `{ db, token }`. |
| `src/lib/seasons/seasonsStore.ts` | Svelte store: hydration state machine (`idle\|loading\|ready\|no-rights\|error`), mirrors `libraryStore`. |
| `src/lib/components/seasons/SeasonForm.svelte` | Create-season form (Cap 1). |
| `src/lib/components/seasons/ConductorPanel.svelte` | Conductor list + add/remove picker (Cap 7). |
| `src/lib/components/seasons/SeriesForm.svelte` | Create-rehearsal-series form (Cap 2). |
| `src/lib/components/seasons/RehearsalList.svelte` | Grouped rehearsal list + per-row cancel/edit (Cap 4/5). |
| `src/routes/seasons/+page.svelte` | Conductor home: wires store + components; reads `?season=<id>`. |
| `messages/{en,et,lv,uk}.json` | i18n keys `seasons_*` (Comenius). |
| colocated `*.spec.ts` | Unit + component tests per source file. |

---

## Task 1: Recurrence + DST datetime (pure) — Cap 3, spec §4/§5

**Files:** Create `src/lib/seasons/recurrence.ts`, Test `src/lib/seasons/recurrence.spec.ts`

- [ ] **Step 1 (Tallis RED): Write failing tests.**

```ts
import { describe, it, expect } from 'vitest';
import { occurrenceDates, toStartDatetime } from './recurrence';

describe('occurrenceDates', () => {
  it('weekly across a month → 5 dates inclusive of boundary', () => {
    expect(occurrenceDates('2026-09-01', '2026-09-29', 7)).toEqual([
      '2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29',
    ]);
  });
  it('same-day series → exactly 1', () => {
    expect(occurrenceDates('2026-09-01', '2026-09-01', 7)).toEqual(['2026-09-01']);
  });
  it('end exactly one interval after start → 2 (boundary inclusive)', () => {
    expect(occurrenceDates('2026-09-01', '2026-09-08', 7)).toEqual(['2026-09-01', '2026-09-08']);
  });
});

describe('toStartDatetime (Europe/Tallinn, DST-aware)', () => {
  it('winter 19:00 EET → 17:00 UTC', () => {
    // 2026-01-06 is EET (UTC+2)
    expect(toStartDatetime('2026-01-06', '19:00')).toBe('2026-01-06T17:00:00.000Z');
  });
  it('summer 19:00 EEST → 16:00 UTC', () => {
    // 2026-06-16 is EEST (UTC+3)
    expect(toStartDatetime('2026-06-16', '19:00')).toBe('2026-06-16T16:00:00.000Z');
  });
});
```

- [ ] **Step 2 (Tallis): Run, verify FAIL.** `pnpm test src/lib/seasons/recurrence.spec.ts` → FAIL (module not found). *Land a minimal stub export first so the failure is on assertions, not resolution — per L120.*

- [ ] **Step 3 (Josquin GREEN): Implement.**

```ts
// src/lib/seasons/recurrence.ts
const TZ = 'Europe/Tallinn';

/** Inclusive occurrence dates (YYYY-MM-DD) stepping by intervalDays. */
export function occurrenceDates(startDate: string, endDate: string, intervalDays: number): string[] {
  const out: string[] = [];
  const end = Date.parse(endDate + 'T00:00:00Z');
  let cur = Date.parse(startDate + 'T00:00:00Z');
  const stepMs = intervalDays * 86_400_000;
  while (cur <= end) {
    out.push(new Date(cur).toISOString().slice(0, 10));
    cur += stepMs;
  }
  return out;
}

/** Combine a local wall-clock date+time in Europe/Tallinn into a UTC ISO instant (DST-aware). */
export function toStartDatetime(date: string, time: string): string {
  const [h, m] = time.split(':').map(Number);
  // Find the UTC offset Tallinn has on this date by formatting a probe noon-UTC instant.
  const probe = new Date(`${date}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, timeZoneName: 'shortOffset', hour: '2-digit', hour12: false,
  }).formatToParts(probe);
  const off = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+0'; // e.g. "GMT+3"
  const offHours = Number(off.replace('GMT', '')) || 0;
  const utcMs = Date.parse(`${date}T00:00:00Z`) + (h - offHours) * 3_600_000 + m * 60_000;
  return new Date(utcMs).toISOString();
}
```

- [ ] **Step 4 (Josquin): Run, verify PASS.** `pnpm test src/lib/seasons/recurrence.spec.ts` → PASS. Then `pnpm check` → 0 errors.

- [ ] **Step 5 (Josquin): Commit.**
```bash
git add src/lib/seasons/recurrence.ts src/lib/seasons/recurrence.spec.ts
git commit -m "feat(#ADMIN-6): recurrence + DST-aware datetime (pure)"
```

> **Note for GREEN:** verify the `shortOffset` approach against the Cloudflare Workers runtime during dev; if `timeZoneName: 'shortOffset'` is unsupported, fall back to computing the offset via two `Intl.DateTimeFormat` reads (UTC vs TZ wall-clock diff). The DST regression tests are the gate.

---

## Task 2: Input validation (pure) — Cap 1/2, spec §7

**Files:** Create `src/lib/seasons/validation.ts`, Test `src/lib/seasons/validation.spec.ts`

- [ ] **Step 1 (Tallis RED):**

```ts
import { describe, it, expect } from 'vitest';
import { validateSeason, validateSeries } from './validation';

describe('validateSeason', () => {
  it('rejects end before start', () => {
    expect(validateSeason({ name: 'S', startDate: '2026-09-01', endDate: '2026-08-31' }))
      .toEqual({ ok: false, field: 'endDate', code: 'end_before_start' });
  });
  it('accepts same-day', () => {
    expect(validateSeason({ name: 'S', startDate: '2026-09-01', endDate: '2026-09-01' }).ok).toBe(true);
  });
  it('rejects blank name', () => {
    expect(validateSeason({ name: '   ', startDate: '2026-09-01', endDate: '2026-09-02' }))
      .toEqual({ ok: false, field: 'name', code: 'blank' });
  });
});

describe('validateSeries', () => {
  const season = { startDate: '2026-09-01', endDate: '2027-05-31' };
  const base = { name: 'Tue', intervalDays: 7, startTime: '19:00', durationMinutes: 120, startDate: '2026-09-02', endDate: '2027-05-30' };
  it('rejects intervalDays < 1', () => {
    expect(validateSeries({ ...base, intervalDays: 0 }, season).code).toBe('interval_too_small');
  });
  it('rejects series start before season start', () => {
    expect(validateSeries({ ...base, startDate: '2026-08-01' }, season))
      .toEqual({ ok: false, field: 'startDate', code: 'outside_season' });
  });
  it('rejects series end after season end', () => {
    expect(validateSeries({ ...base, endDate: '2027-06-30' }, season).code).toBe('outside_season');
  });
  it('accepts a valid series', () => {
    expect(validateSeries(base, season).ok).toBe(true);
  });
});
```

- [ ] **Step 2 (Tallis): Run → FAIL** (stub first per L120).
- [ ] **Step 3 (Josquin GREEN): Implement** `validateSeason` + `validateSeries` returning `{ ok: true } | { ok: false, field, code }`. Encode: blank-name (`/\S/`), `endDate >= startDate`, `intervalDays >= 1`, `durationMinutes >= 1`, series dates within `[season.startDate, season.endDate]`.
- [ ] **Step 4 (Josquin): Run → PASS; `pnpm check` → 0.**
- [ ] **Step 5 (Josquin): Commit** `feat(#ADMIN-1): season + series input validation (pure)`.

---

## Task 3: Domain + Entu raw types — Cap 1–7

**Files:** Create `src/lib/seasons/types.ts` (no standalone test — exercised by Task 4+).

- [ ] **Step 1 (Josquin GREEN): Define types** mirroring `src/lib/types/library-entu.ts` conventions (raw Entu shapes use `Array<{ string }>` / `Array<{ reference }>`):

```ts
export interface SeasonRaw { _id: string; name?: Array<{ string: string }>;
  start_date?: Array<{ date: string }>; end_date?: Array<{ date: string }>;
  _parent?: Array<{ reference: string }>;
  // P0.3: the GET `_editor` field is a FLATTENED rights view mixing _owner + _editor
  // entries, distinguished by `property_type`. Direct grants have `inherited` ABSENT
  // (undefined), cascaded ones have `inherited: true`. See findings 2026-06-01.
  _editor?: Array<{ reference: string; property_type?: string; inherited?: boolean }>; }
export interface Season { id: string; name: string; startDate: string; endDate: string; }

export interface SeriesRaw { _id: string; name?: Array<{ string: string }>;
  event_type?: Array<{ string: string }>; interval_days?: Array<{ number: number }>;
  start_time?: Array<{ string: string }>; duration_minutes?: Array<{ number: number }>;
  start_date?: Array<{ date: string }>; end_date?: Array<{ date: string }>;
  default_location?: Array<{ string: string }>; }
export interface RehearsalSeries { id: string; name: string; intervalDays: number;
  startTime: string; durationMinutes: number; startDate: string; endDate: string; location?: string; }

export interface RehearsalRaw { _id: string; name?: Array<{ string: string }>;
  event_type?: Array<{ string: string }>; start_datetime?: Array<{ datetime: string }>;
  duration_minutes?: Array<{ number: number }>; location?: Array<{ string: string }>;
  _parent?: Array<{ reference: string }>; }
export interface Rehearsal { id: string; seriesId: string; startDatetime: string;
  durationMinutes: number; location?: string; name?: string; }

export interface Conductor { personId: string; name: string; }
```

- [ ] **Step 2 (Josquin): `pnpm check` → 0. Commit** `feat(#ADMIN-6): seasons domain + Entu raw types`.

---

## Task 4: `createSeason` + `listSeasons` (client Entu) — Cap 1, spec §3.3a

**Files:** Create `src/lib/seasons/entuSeasons.ts`, Test `src/lib/seasons/entuSeasons.spec.ts`

- [ ] **Step 1 (Tallis RED):** mock `fetch`; assert `createSeason` POSTs name/start_date/end_date + `_parent=org` + `_sharing=public`, returns the new `_id`; `listSeasons` searches `_type.string=season&_parent.reference=<org>`, maps raw→`Season`, sorts by `startDate`.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSeason, listSeasons } from './entuSeasons';

const cfg = { db: 'testdb', token: 'jwt' };
beforeEach(() => vi.restoreAllMocks());

it('createSeason POSTs the entity with public sharing and returns _id', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ _id: 'season1' }) });
  vi.stubGlobal('fetch', fetchMock);
  const id = await createSeason(cfg, { orgId: 'org1', name: '2026/27', startDate: '2026-09-01', endDate: '2027-05-31' });
  expect(id).toBe('season1');
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  // Entu create posts an array of property objects incl. _type, _parent, _sharing
  expect(body).toEqual(expect.arrayContaining([
    { type: '_type', string: 'season' },
    { type: '_parent', reference: 'org1' },
    { type: '_sharing', string: 'public' },
    { type: 'name', string: '2026/27' },
    { type: 'start_date', date: '2026-09-01' },
    { type: 'end_date', date: '2027-05-31' },
  ]));
});

it('listSeasons maps + sorts by startDate', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entities: [
    { _id: 'b', name: [{ string: 'B' }], start_date: [{ date: '2027-09-01' }], end_date: [{ date: '2028-05-31' }] },
    { _id: 'a', name: [{ string: 'A' }], start_date: [{ date: '2026-09-01' }], end_date: [{ date: '2027-05-31' }] },
  ] }) }));
  const seasons = await listSeasons(cfg, 'org1');
  expect(seasons.map((s) => s.id)).toEqual(['a', 'b']);
});
```

- [ ] **Step 2 (Tallis): Run → FAIL** (stub the two exports).
- [ ] **Step 3 (Josquin GREEN): Implement** against `${ENTU_API_BASE}${db}` (the `hydrateLibrary` base). Entu entity create = `POST {db}/entity` with a JSON array of property objects (confirm exact create-wire in dev against the playground — `project_entu_post_appends_multi_value`; the create endpoint takes the property array). Set `_sharing` explicitly (`project_entu_sharing_non_inherit`).
- [ ] **Step 4 (Josquin): Run → PASS; `pnpm check` → 0.**
- [ ] **Step 5 (Josquin): Commit** `feat(#ADMIN-1): createSeason + listSeasons (client Entu)`.

---

## Task 5: `createSeriesWithEvents` (eager generation) — Cap 2+3, spec §4

**Files:** Modify `src/lib/seasons/entuSeasons.ts`, `src/lib/seasons/entuSeasons.spec.ts`

- [ ] **Step 1 (Tallis RED):** mock fetch; assert it (a) POSTs the `event_series` (`event_type=rehearsal`, `_sharing=private`, `_parent`=[org,season]); (b) then POSTs N events where N = `occurrenceDates(...).length`, each with `start_datetime` from `toStartDatetime`, `_parent`=[org,season,seriesId], `event_type=rehearsal`, `_sharing=private`; (c) returns `{ seriesId, eventIds }`. Include the **winter+summer DST** assertion on two generated events.

```ts
it('generates one event per occurrence with DST-correct datetimes', async () => {
  const calls: any[] = [];
  vi.stubGlobal('fetch', vi.fn().mockImplementation((_u, init) => {
    calls.push(JSON.parse(init.body));
    return Promise.resolve({ ok: true, json: async () => ({ _id: `e${calls.length}` }) });
  }));
  const res = await createSeriesWithEvents({ db: 'd', token: 't' }, {
    orgId: 'org1', seasonId: 'season1',
    name: 'Tue', intervalDays: 7, startTime: '19:00', durationMinutes: 120,
    startDate: '2026-09-01', endDate: '2026-09-08', // 2 occurrences
  });
  expect(res.eventIds).toHaveLength(2);
  // first POST is the series, then 2 events
  expect(calls).toHaveLength(3);
  const evDatetimes = calls.slice(1).flat().filter((p: any) => p.type === 'start_datetime').map((p: any) => p.datetime);
  expect(evDatetimes).toEqual(['2026-09-01T16:00:00.000Z', '2026-09-08T16:00:00.000Z']); // Sep = EEST
});
```

- [ ] **Step 2 (Tallis): Run → FAIL** (stub export).
- [ ] **Step 3 (Josquin GREEN): Implement** — POST series, then `for` over `occurrenceDates` issuing serial event POSTs (Entu has no bulk create; `project_entu_no_bulk_delete`). On a mid-batch POST failure, throw a typed `PartialGenerationError { seriesId, createdCount }` (spec §4 partial-failure). Inherit unset fields by simply NOT setting them on the event (read-time merge handled in Task 6, never a formula — spec §3.2).
- [ ] **Step 4 (Josquin): Run → PASS; `pnpm check` → 0.**
- [ ] **Step 5 (Josquin): Commit** `feat(#ADMIN-6): createSeriesWithEvents eager generation + partial-failure error`.

---

## Task 6: `listRehearsals` (+ read-time inheritance merge) — Cap 4, spec §3.2/§7

**Files:** Modify `entuSeasons.ts`, `entuSeasons.spec.ts`

- [ ] **Step 1 (Tallis RED):** mock fetch; assert `listRehearsals(cfg, { orgId, seasonId })` searches `event` filtered to `event_type=rehearsal` + season parent, sorts by `start_datetime` asc, returns `Rehearsal[]`, and **merges unset event fields from the parent series in code** (not via formula). Empty result → `[]` (not throw).

```ts
it('returns rehearsals sorted ascending, concerts excluded', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entities: [
    { _id: 'e2', event_type: [{ string: 'rehearsal' }], start_datetime: [{ datetime: '2026-09-08T16:00:00.000Z' }], _parent: [{ reference: 'series1' }] },
    { _id: 'e1', event_type: [{ string: 'rehearsal' }], start_datetime: [{ datetime: '2026-09-01T16:00:00.000Z' }], _parent: [{ reference: 'series1' }] },
  ] }) }));
  const r = await listRehearsals({ db: 'd', token: 't' }, { orgId: 'org1', seasonId: 'season1' });
  expect(r.map((x) => x.id)).toEqual(['e1', 'e2']);
});
it('empty → []', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entities: [] }) }));
  expect(await listRehearsals({ db: 'd', token: 't' }, { orgId: 'o', seasonId: 's' })).toEqual([]);
});
```

- [ ] **Step 2–5:** RED→FAIL → Josquin GREEN (search query includes `event_type.string=rehearsal`; map raw→`Rehearsal`; for fields absent on the event, fetch the parent series once per series-id and merge — cache series lookups to avoid N+1, mirroring the library two-fetch pattern) → PASS + check 0 → Commit `feat(#ADMIN-7): listRehearsals + read-time series inheritance merge`.

---

## Task 7: `updateRehearsal` (edit one) — Cap 5b, spec §7

**Files:** Modify `entuSeasons.ts`, `entuSeasons.spec.ts`

- [ ] **Steps (Tallis RED → Josquin GREEN):** `updateRehearsal(cfg, eventId, patch)` for `start_datetime|duration_minutes|location|description`. Entu replace semantics = DELETE existing property value `_id`s then POST new (`project_entu_post_appends_multi_value`, `project_entu_clear_property_empty_list`). Test: patching `location` issues the clear-then-set; siblings untouched (separate entity ids). Not gated on probes (property-edit = `_editor`, spec §3.3). Commit `feat(#ADMIN-8): updateRehearsal single-instance override`.

---

## Task 8: `deleteRehearsal` (cancel one) — Cap 5a — GATED on P0.1

**Files:** Modify `entuSeasons.ts`, `entuSeasons.spec.ts`

- [ ] **Gate:** do not start GREEN until P0.1 confirms the delete tier. RED may be written in parallel.
- [ ] **Steps:** `deleteRehearsal(cfg, eventId)` = `DELETE {db}/entity/{eventId}` (`project_entu_wire_shape_entity_vs_property`). Test: deletes the targeted id only; a 403 from Entu (insufficient tier) surfaces as a typed error the UI shows. Commit `feat(#ADMIN-8): deleteRehearsal (cancel single, _owner-tier)`.

---

## Task 9: `deleteSeriesCascade` — Cap 6 — GATED on P0.1

**Files:** Modify `entuSeasons.ts`, `entuSeasons.spec.ts`

- [ ] **Step 1 (Tallis RED):**

```ts
it('deletes child events filtered to THIS series, then the series', async () => {
  const deleted: string[] = [];
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init: any) => {
    if (init?.method === 'DELETE') { deleted.push(url); return Promise.resolve({ ok: true, json: async () => ({}) }); }
    // search children of series1 only
    return Promise.resolve({ ok: true, json: async () => ({ entities: [{ _id: 'e1' }, { _id: 'e2' }] }) });
  }));
  const res = await deleteSeriesCascade({ db: 'd', token: 't' }, 'series1');
  expect(res).toEqual({ deleted: 2, seriesDeleted: true });
  expect(deleted.some((u) => u.endsWith('/entity/series1'))).toBe(true);
  expect(deleted.filter((u) => /\/entity\/e[12]$/.test(u))).toHaveLength(2);
});

it('partial failure keeps the series', async () => {
  let n = 0;
  vi.stubGlobal('fetch', vi.fn().mockImplementation((_u: string, init: any) => {
    if (init?.method === 'DELETE') { n++; return Promise.resolve({ ok: n === 1, json: async () => ({}) }); }
    return Promise.resolve({ ok: true, json: async () => ({ entities: [{ _id: 'e1' }, { _id: 'e2' }] }) });
  }));
  const res = await deleteSeriesCascade({ db: 'd', token: 't' }, 'series1');
  expect(res.seriesDeleted).toBe(false);
  expect(res.deleted).toBe(1);
});
```

- [ ] **Step 2–5:** RED→FAIL → Josquin GREEN: search children filtered on **this series' parent specifically** (spec Cap6 step 2 — `_parent.reference=series1` AND `_type.string=event`, NOT just the season), serial DELETE children, only DELETE the series if all children gone; else return `{ deleted, seriesDeleted: false }` → PASS + check 0 → Commit `feat(#ADMIN-9): deleteSeriesCascade best-effort, series-specific child filter`.

---

## Task 10: Conductor grant/revoke/list — Cap 7 — GATED on P0.2–P0.5

**Files:** Modify `entuSeasons.ts`, `entuSeasons.spec.ts`

- [ ] **Step 1 (Tallis RED):**

```ts
// P0.3 (findings 2026-06-01): the `_editor` GET field is a FLATTENED rights view that
// mixes _owner AND _editor entries. Direct conductor grants have `inherited` ABSENT
// (NOT `false`); cascaded org-owner has `inherited: true`; a self/direct _owner has
// neither property_type==='_editor' nor inherited. The correct filter is BOTH
// `property_type === '_editor'` AND `inherited !== true` — a bare `!inherited` guard
// would wrongly admit the direct-_owner entry. The spec §8 #4 org-owner-subtraction
// fallback is therefore NOT needed.
it('listConductors returns direct _editor grantees, excluding inherited + _owner', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    if (url.includes('/entity/season1')) return Promise.resolve({ ok: true, json: async () => ({ entity: {
      _id: 'season1', _editor: [
        { reference: 'p_admin', property_type: '_owner', inherited: true }, // cascaded org-owner → excluded
        { reference: 'p_self', property_type: '_owner' },                    // direct _owner, no `inherited` → still excluded
        { reference: 'p_cond', property_type: '_editor' },                   // direct conductor (inherited ABSENT) → included
      ] } }) });
    // person name resolution
    return Promise.resolve({ ok: true, json: async () => ({ entity: { _id: 'p_cond', name: [{ string: 'Jane C.' }] } }) });
  }));
  const list = await listConductors({ db: 'd', token: 't' }, 'season1');
  expect(list).toEqual([{ personId: 'p_cond', name: 'Jane C.' }]);
});

it('assignConductor refuses a non-member', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entities: [] }) })); // no member found
  await expect(assignConductor({ db: 'd', token: 't' }, { seasonId: 'season1', orgId: 'org1', personId: 'p_x' }))
    .rejects.toThrow(/must be an org member/);
});
```

- [ ] **Step 2–5:** RED→FAIL → Josquin GREEN:
  - `listConductors`: GET season, filter `_editor` to entries where **`property_type === '_editor'` AND `inherited !== true`** (P0.3 — the field is a flattened owner+editor view; direct grants have `inherited` absent), resolve each `personId` via a separate `GET /entity/{personId}` (single-hop; spec Cap7 item 5). *The org-`_owner`-subtraction fallback is NOT needed — the flag + `property_type` are present.*
  - `assignConductor`: first verify the person has an active `member` in the org (search `member` by person+org); if none → throw `must be an org member first`; else POST `_editor` reference to the person on the season.
  - `revokeConductor`: DELETE the season's `_editor` property value for that person.
  - → PASS + check 0 → Commit `feat(#ADMIN-10): conductor grant/revoke/list (roles-as-rights, inherited-flag filter)`.

---

## Task 11: `seasonsStore` hydration — Cap 1/4, spec §3.3a

**Files:** Create `src/lib/seasons/seasonsStore.ts` + `.spec.ts`

- [ ] **Steps (Tallis RED → Josquin GREEN):** a writable store + `hydrateSeasons({ orgId, personId, token })` that sets `{ status: 'loading' }` → calls `listSeasons` → `{ status: 'ready', seasons }` | `{ status: 'no-rights' }` (empty + no editor) | `{ status: 'error' }`. Mirror `src/lib/library/libraryStore.ts` exactly (same status union, same reset-on-org-change). Test the state transitions with mocked `entuSeasons`. Commit `feat(#ADMIN-1): seasonsStore client hydration`.

---

## Task 12: `SeasonForm` + `ConductorPanel` components (Byrd) — Cap 1/7 — Cap7 GATED on Task 10

**Files:** Create `src/lib/components/seasons/SeasonForm.svelte` (+ `.spec.ts`), `ConductorPanel.svelte` (+ `.spec.ts`)

- [ ] **Steps (Tallis RED component tests → Byrd GREEN):**
  - `SeasonForm`: Svelte 5 runes (`$state`, `$props`, `$bindable`); fields name/start/end/description; calls `validateSeason` on submit; shows inline error keyed to `field` without clearing inputs; emits `oncreate` with the payload. Test via `@testing-library/svelte` + `afterEach(cleanup)` (L111). Assert end-before-start shows the `endDate` error and keeps the name value.
  - `ConductorPanel`: shows `listConductors` result; "Add conductor" picker offers **org members only** (prop-fed); assign/remove call `onassign`/`onremove`; only rendered/enabled when `canManage` (owner) prop is true; empty state "No conductors assigned yet". Test the member-only picker + owner-gating + empty state.
  - Hardcode NO strings — use `m.seasons_*()` placeholders (keys created in Task 14).
  - Commit each: `feat(#ADMIN-1): SeasonForm component`, `feat(#ADMIN-10): ConductorPanel component`.

---

## Task 13: `SeriesForm` + `RehearsalList` components (Byrd) — Cap 2/4/5

**Files:** Create `src/lib/components/seasons/SeriesForm.svelte` (+spec), `RehearsalList.svelte` (+spec)

- [ ] **Steps (Tallis RED → Byrd GREEN):**
  - `SeriesForm`: fields name/intervalDays/startTime/durationMinutes/startDate/endDate/location; `event_type` fixed to `rehearsal` (not shown); validates via `validateSeries(payload, season)`; emits `oncreate`. Test interval=0 inline error + within-season date guard.
  - `RehearsalList`: groups rows by series name (section header), each row shows locale date/time/duration/location(or "—"); past rows muted (`start_datetime < now`); per-row cancel (confirm) → `oncancel`, edit → `onedit`; empty → "No rehearsals scheduled yet" + create CTA. Test grouping, the "—" location fallback, and muted-past styling (assert the class is present, not computed display — L118).
  - Commit: `feat(#ADMIN-6): SeriesForm component`, `feat(#ADMIN-7): RehearsalList component`.

---

## Task 14: i18n keys (Comenius) — all caps

**Files:** Modify `messages/{en,et,lv,uk}.json`

- [ ] **Steps:** add the `seasons_*` key set used across Tasks 12–13 (form labels, validation error messages keyed by `code`, empty states, conductor panel, cancel/delete confirmations incl. the "this will delete the series and its {n} rehearsals" interpolation). en = real copy; et/lv/uk = real translations (Comenius owns; no English fallback strings). Keep keys in sync across all four files (Bentham REDs drift). Commit `i18n(#ADMIN-6): seasons_* keys ×4 locales`.

---

## Task 15: `/seasons` route wiring (Byrd) — all caps

**Files:** Create `src/routes/seasons/+page.svelte` (+ `.spec.ts` for the integration behaviours)

- [ ] **Steps (Tallis RED → Byrd GREEN):** wire `seasonsStore` + components. Org from `selectedOrgStore`; selected season from `?season=<id>` (URL-overrides-persisted pattern — read `page.url.searchParams`, write via `goto`). On series create → call `createSeriesWithEvents`, then re-hydrate the rehearsal list **with a retry window** (P0.6 propagation lag — poll until the new events appear or a timeout). Owner-only controls (SeasonForm, ConductorPanel) gated on the user's tier. Surface partial-generation + partial-delete results as a non-blocking notice. Commit `feat(#ADMIN-7): /seasons route wiring`.

---

## Task 16: Review (Bentham)

- [ ] Full RED/YELLOW/GREEN against the spec + this plan. Specific checks: no Entu `formula` on inherited event fields (§3.2 RED trap); `_sharing` set explicitly on every create; conductor list filters `inherited:true`; cascade-delete child query is series-specific; delete paths are `_owner`-tier; i18n keys in sync; Svelte 5 runes only; no server import in client. TDD-compliance: tests precede impl per commit.

---

## Task 17: Merge (Josquin)

- [ ] After Bentham GREEN + team-lead approval: merge `feat/rehearsal-schedule` → `main` locally (squash; run the prepare-commit-msg hook for co-author), body `Closes #81 #82 #83 #84 #85` + the satisfied #19 #20 (`feedback_closes_n_pattern`). **No `Schema-Change` trailer** (schema-alignment carve-out). Push; team-lead closes issues with completion comments. No prod deploy in this slice unless PO requests a preview.

---

## Self-Review (team-lead, against the spec)

- **Spec coverage:** Cap 1 → T2/T4/T11/T12; Cap 2 → T2/T5/T13; Cap 3 → T1/T5; Cap 4 → T6/T13/T15; Cap 5a → T8, 5b → T7/T13; Cap 6 → T9/T13; Cap 7 → T10/T12. §4 generation → T1/T5; §5 DST → T1; §3.2 no-formula → T6/T16; §3.3 delete-tier → T8/T9; §3.3a client-side → all entu tasks; §8 probes → Phase 0 (gates T8/T9/T10). All capabilities covered.
- **Placeholders:** none — pure-logic + Entu-wire tasks carry real code; CRUD/UI tasks carry concrete RED assertions + GREEN specifics. The few "confirm exact wire in dev" notes are deliberate live-probe confirmations (Phase 0), not gaps.
- **Type consistency:** `Season/RehearsalSeries/Rehearsal/Conductor` (T3) used consistently; `{ db, token }` config shape uniform across `entuSeasons`; `createSeriesWithEvents` returns `{ seriesId, eventIds }`; `deleteSeriesCascade` returns `{ deleted, seriesDeleted }`.
- **Gating:** delete + conductor tasks (T8/T9/T10) explicitly gated on Phase 0 probes; propagation-lag retry baked into T15.

---

*(*MVOX:Palestrina*) — plan for the team TDD chain; spec source `docs/superpowers/specs/2026-05-31-rehearsal-schedule-first-slice-design.md`.*
