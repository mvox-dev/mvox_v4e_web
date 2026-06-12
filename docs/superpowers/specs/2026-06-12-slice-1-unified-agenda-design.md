# MVP Slice 1 — Unified Singer Agenda (#10)

**Parent scope:** `docs/superpowers/specs/2026-06-12-mvp-rehearsal-attendance-loop-design.md` §4 slice 1.
**Issue:** #10 (B1: Unified multi-choir agenda).

## 1. What it is

`/agenda` — one chronological list of upcoming rehearsals across every org the signed-in user belongs to. Read-only in this slice; slice 2 adds the inline RSVP control to these rows.

## 2. Existing hooks (already in place)

- **Nav:** `MvoxNav` already defines `agenda` as the FIRST tab (`nav_tab_agenda`, all 4 locales) — it currently links nowhere. This slice gives it a real `href="/agenda"` + active-tab state, mirroring the existing `/seasons` tab wiring.
- **Auth guard:** `/agenda` is already in the protected-paths list (`session-cookie.spec.ts` asserts it) — unauthenticated visits 302 to `/auth/login?redirect=/agenda`.
- **Org source:** `userStore` (`src/lib/auth/userStore.ts`) hydrates the user's orgs (member-derived ∪ owner-derived, per #68) as `Org { id, label, initials }`.
- **Data helpers:** `listSeasons(cfg, orgId)` and `listRehearsals(cfg, {orgId, seasonId})` in `src/lib/seasons/entuSeasons.ts`.

## 3. Data layer

New module `src/lib/agenda/agendaData.ts` — aggregation only, consumes existing seasons helpers (no new Entu wire code):

```
listAgenda(cfg, orgs: Org[], now: Date): Promise<AgendaItem[]>
```

1. For each org (parallel): `listSeasons` → keep seasons with `endDate >= today` (ongoing/future).
2. For each kept season (parallel): `listRehearsals` → annotate each with `orgId`, `orgLabel`, `seasonId`.
3. Merge → filter `startDatetime >= now` → sort ascending by `startDatetime`.
4. Per-org failures don't sink the agenda: a failing org contributes zero items and an `errors: string[]` entry (org label) surfaced as a non-blocking notice.

```ts
export interface AgendaItem extends Rehearsal {
	orgId: string;
	orgLabel: string;
}
export interface AgendaResult {
	items: AgendaItem[];
	errors: string[]; // org labels that failed to load
}
```

Org scope decision: the agenda reads ALL `userStore` orgs (member or owner). Singers see their choirs; the PO (owner of all 6 seed orgs) sees everything — which doubles as the live-test path. Membership-specific semantics (the rsvp `member` ref) are slice 2's concern.

## 4. UI

- **Route:** `src/routes/agenda/+page.svelte`. Hydrates `userStore`, then `listAgenda`, client-side (existing pattern: `/seasons`).
- **Component:** `src/lib/components/agenda/AgendaList.svelte` — chronological rows grouped under date headers (e.g. "Teisipäev, 16. juuni" via `Intl.DateTimeFormat`, locale-aware, Europe/Tallinn).
- **Row content:** start time + duration, rehearsal name, org label chip (initials chip reuses the existing org-chip look), location when present.
- **Multi-org legibility:** the org chip is the differentiator; no per-org sections (one merged timeline is the point of B1).
- **Mobile-first:** stacked rows, no horizontal layout to collapse; desktop gets the same list with wider measure. Paper-and-ink: Inter for everything, no Caveat (no marginalia moment here).
- **States:** loading skeleton → list | empty-no-orgs ("you're not in any choir yet") | empty-no-rehearsals ("no upcoming rehearsals") | partial-error notice listing failed orgs.
- **Nav:** agenda tab href + active state; `/agenda` becomes the natural post-login landing for singers (changing the login redirect default is OUT of scope this slice).

## 5. i18n

New keys ×4 locales (en/et/lv/uk): `agenda_title`, `agenda_empty_no_orgs`, `agenda_empty_no_rehearsals`, `agenda_partial_error`, `agenda_duration_min` (suffix). Comenius owns key naming per i18n-conventions.

## 6. Testing

- `agendaData.spec.ts`: merge ordering across orgs, ongoing-season filter, upcoming filter (boundary: rehearsal earlier today is excluded), per-org failure isolation, empty inputs. Full-shape `toEqual` assertions (per `feedback_partial_assertions_hide_bugs`); drive with realistic Entu wire shapes (ISO datetimes).
- `AgendaList.spec.ts`: date grouping, row content, all four UI states.
- `page.spec.ts` route test: hydrate → render flow with mocked data layer.

## 7. Test-data prerequisite (live verification)

PO live-tests on preview. Requires: PO's account sees ≥1 org with upcoming rehearsals (owner-derived works — EFK 2026/27 Tuesday series, 16 events, exists). For a real multi-org merge in the UI, a second org needs an upcoming series — Pérotin seeds one (after his probe task) if PO wants the merge visible before sign-off.

## 8. Out of scope (this slice)

RSVP control (slice 2), past rehearsals/history, filtering or per-org toggles, concerts (`event_type` other than rehearsal), per-org timezone (Europe/Tallinn hardcoded, consistent with series generation), login-redirect change.

(*MVOX:Palestrina*)
