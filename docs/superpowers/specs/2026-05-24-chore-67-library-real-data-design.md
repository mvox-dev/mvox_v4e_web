# CHORE-67 — Wire /library to real Entu data

**Status:** Design landed. Awaiting PO review.
**Date:** 2026-05-24 (session 23)
**Related issues:** GH #67 (done, env-lift), GH #68 (done, founder-union), GH #71 (subsumed by this CHORE — /library over-fetches all orgs)
**Builds on:** CHORE-60 (squash `ab6dcc5`, /library page + 21-component UI kit) + CHORE-66 (squash `9266e2e`, navbar auth wiring + `$userStore` + `$selectedOrgStore`)

---

## Context

CHORE-60 shipped /library as a 100% mock-data page using `$lib/fixtures/library-mock.ts` and `$lib/library/derive.ts`. CHORE-66 added `$userStore` (with member-walk-derived orgs) + `$selectedOrgStore`. CHORE-68 added founder-union so the userStore also includes orgs the user `_owner`s without being a member.

The page still fires a now-discovered over-fetch (GH #71): `GET /entity?_type.string=organization&props=...&limit=50` — no `_owner.reference` filter, no user-rights scoping. Returns every organization in the database. Happens to work for PO (founder of all 6 orgs) but is the wrong semantic for any other user.

CHORE-67 replaces the mock layer for the catalog with real Entu queries scoped to the user's selected org's library — and introduces a master-detail interaction so users can drill into individual works without leaving the page.

## Scope (locked)

### In scope

- Replace the catalog strip (`MiniWorkCard` × 6) at the bottom of /library with a **master-detail unit**: compact work index on the left, scrollable column of work-detail paperstacks on the right.
- Real Entu data: works under the selected org's library entity, with their editions.
- Librarian-only gating: if the user has no librarian rights on the selected org, /library redirects to /.
- URL state synchronization for the selected work (`?work=<id>`).
- Wood-grain DeskSurface as the page background, dominating the canvas.
- All scrollbars hidden globally.

### Out of scope (deferred to future CHOREs)

- The 3 task stacks (Returns / Overdue / Pull) keep their mock data from `$lib/fixtures/library-mock.ts`. These need Copy + Lending entity types we don't yet have.
- MEMBERS chip and member-related UI keep their mock data.
- Detail panel content beyond metadata + editions: copies, loans, loan picker, edit/delete buttons, delete-if-referenced guard. All deferred.
- File attachments (score/parts/track/notes), file-kind dots, file rows.
- Add-work / add-edition flows.
- Route refactor to `/members/<slug>/library` (Claude Design canonical) — kept at `/library` for this CHORE; route refactor is a future migration.
- Pagination / search / filter / sorting beyond composer-alpha.

### Out-of-scope decision rationale

PO's "minimal scope, no big pivot" framing during brainstorm rules these out. Each cluster (Copy + Lending UI, /members/<slug>/library route, edit flows) is its own significant CHORE. Bundling here would balloon CHORE-67 past the "minimal" threshold.

## Audience & gating

**/library is librarian-only.** A user is a librarian on org X when:
1. They are `_editor` on org X's `library` child entity, OR
2. They are `_owner` on org X itself (cascading rights — `_owner` on parent confers full rights on children unless `_inheritrights: false` blocks it; libraries inherit, so cascade applies).

Detection happens by querying the org's library entity and checking `_editor` for the current user; the BFF defers to Entu's user-rights mode (no elevation).

### Org picker behavior

**The picker is global everywhere.** It always shows the full `$userStore.orgs` union (member-walk ∪ founder-union from CHORE-66 + CHORE-68). No per-page filter. /library's picker shows the same orgs as /'s picker.

This means a user CAN select an org on /library where they don't have librarian rights.

### Redirect rule

When a user navigates to /library (or switches the picker on /library) and the selected org's library doesn't grant them librarian rights, the page redirects to /. No rejection panel renders, no toast — clean redirect.

The redirect happens client-side after the user-rights check resolves. If the check is in flight, a skeleton/loading state renders briefly.

### Direct URL access

A user direct-linking `/library?org=<id>&work=<id>` for an org they don't have librarian rights on lands on /library momentarily (skeleton state) and then bounces to / once the rights check resolves.

## Page layout

The /library page top-to-bottom:

```
┌─ DeskSurface (wood-grain, fills viewport, background-attachment: fixed) ───────────┐
│                                                                                    │
│   Library · librarian's desk · <ORG_NAME>           [floats on wood, no paper]    │
│   On the desk today                                                                │
│   Rehearsal HH:MM · in Xh Ym   ⌘K                                                  │
│                                                                                    │
│   ┌─ Returns ─┐  ┌─ Overdue ─┐  ┌─ Pull ─┐         [3 task papers, MOCK data]     │
│   │           │  │            │  │         │                                       │
│   └───────────┘  └────────────┘  └─────────┘                                       │
│                                                                                    │
│   ┌─ Master (sticky) ─┐   ┌─ Detail (scrolls) ─────────────┐                       │
│   │  N works          │   │  ╔═ Work paperstack ═══════╗   │                       │
│   │  composer ↑       │   │  ║  Composer — *Title*     ║   │                       │
│   │ ─────────────     │   │  ║  Voicing · Lang · Year  ║   │                       │
│   │  Duruflé          │   │  ║  Editions · N           ║   │                       │
│   │  Kreek    [sel]   │   │  ║   ┌ Ed1: label · year ┐ ║   │                       │
│   │  Mägi             │   │  ║   ┌ Ed2: label · year ┐ ║   │                       │
│   │  Pärt             │   │  ╚════════════════════════╝   │                       │
│   │  Sisask           │   │                                │                       │
│   │  …                │   │  ╔═ Next work paperstack ══╗   │                       │
│   │ (paper fades)     │   │  ║  …                       ║   │                       │
│   │                   │   │                                │                       │
│   └─ wood shows ↑     ┘   │  (page scrolls; master stays)  │                       │
│                            └────────────────────────────────┘                       │
└────────────────────────────────────────────────────────────────────────────────────┘
```

### Visual treatment

- **Wood-grain desk:** Three-stripe `repeating-linear-gradient(94deg, …)` + 2-3 radial-gradient knots + warm wood base `linear-gradient(110deg, #9c6a37 → #8a5d2a)`. `background-attachment: fixed` so it doesn't slide as the user scrolls. Owns the whole viewport.
- **Title floats on wood:** Eyebrow + heading + rehearsal time render in warm cream `#f3e6cc` with subtle text-shadow. No paper backing.
- **Task stacks (unchanged from CHORE-60):** Each is its own `PaperStack` component with substantial wood gap between them.
- **Master paper:** ~240px wide. Paper backing uses `linear-gradient(90deg, #fbf9f3 0%, #fbf9f3 50%, rgba(251,249,243,0.5) 75%, rgba(251,249,243,0) 100%)` so it fades to transparent on the right edge, exposing the wood grain. No right border (the fade is the edge).
- **Detail column:** Full natural height. Each work is a `WorkPaperStack` with 3-paper-back box-shadow (front + 2 offset paper-backs in lighter creams). Active work — the one currently scrolled into the viewport center — gets an orange-tinted shadow stack (`#f0c997` / `#d8a266`).
- **Edition subcards:** Inside each WorkPaperStack, editions render as tinted single-sheet subcards (`#f4ead8` background, lighter border). Visually subordinate — they're "pages inside the stack", not equal siblings.
- **Scrollbars:** Hidden globally on `html`, `body`, and any inner overflow element (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`). Scrolling still works via wheel, trackpad, keyboard.

### Master sticky behavior

The master column is wrapped in `<div class="master-col">` with `position: sticky; top: 24px;` so it stays parked top-left as the user scrolls the detail column. The master's internal scroll is capped at `calc(100vh - <header-clearance>)` so the full list of works is reachable when the index is longer than the viewport.

### Empty-library state

When the selected org has a library but the library has zero works:

- The master column shows the header (`0 works`) and an empty body.
- The detail column shows ONE marginalia message in Caveat handwriting on the wood: *"Nothing's catalogued yet — add a first work to start the shelf."* (No CTA in CHORE-67; add-work is out of scope.)

The page does NOT redirect in this case — the user IS a librarian; they just have no inventory yet.

## Data flow

Path C semantics apply: all Entu calls fire from the browser using the JWT in `localStorage.token`. Same pattern as `hydrateUserStore` in `src/lib/auth/userStore.ts`.

### Query sequence

Triggered by `$effect` on `$selectedOrgStore.id` (and on initial mount):

1. **Resolve the library entity for the selected org**
   ```
   GET /entity?_type.string=library&_parent.reference=<orgId>&props=name,_editor
   ```
   Expect 0 or 1 hits (one library per org).
   - **0 hits:** org has no library. User is not a librarian here (there's nothing to librarian). Redirect to /.
   - **1 hit:** check `_editor` for current `personId`. If absent AND user is not `_owner` of the org, redirect to /. Otherwise proceed.

2. **Query works under the library**
   ```
   GET /entity?_type.string=work&_parent.reference=<libraryId>&props=name,composer,voicing,language,year&limit=200
   ```
   200 should comfortably cover all real choirs (EFK has 28 in seeded data; large libraries are still well under 200). If we hit 200, future CHORE handles pagination.

3. **Query editions for each work — strategy (b) LOCKED**
   Pérotin's session-24 probe (commit `6a248b9`) confirmed editions are direct children of works (`edition._parent.entity_type = "work"`), NOT children of the library. Strategy (b) is the canonical path:
   ```
   N parallel GETs via Promise.all:
   GET /entity?_type.string=edition&_parent.reference=<workId>&props=name,year,publisher,license_note&limit=50
   ```
   One query per work, fired in parallel after the works fetch resolves. Acceptable for N < 200 (EFK seeded data has 28 works). If we hit scale issues at a real choir, batchable via Entu's multi-`_id` syntax (future CHORE).

   **Note on ISBN field:** real edition entities do NOT carry an `isbn` property. ISBN-equivalents are stored in `license_note` (per session-19 seed decision: "Catalogue: UE-19400"). The spec's UI mentions of "ISBN" should map to `license_note` in render code, or accept that ISBN is absent on all real editions. `i18n key library_field_isbn` stays; it labels the `license_note` value when present.

### Types

New types under `src/lib/types/library-entu.ts` (parallel to the existing mock `src/lib/types/library.ts`; mock stays during this CHORE for the 3 task stacks):

```ts
export interface EntuLibrary {
  id: string;            // _id
  name: string;          // name[0].string
  orgId: string;         // _parent.reference (the org)
  editorIds: string[];   // _editor.*.reference
}

export interface EntuWork {
  id: string;
  libraryId: string;
  composer: string;
  title: string;
  voicing?: string;
  language?: string;
  year?: number;
}

export interface EntuEdition {
  id: string;
  workId: string;        // _parent.reference of the work the edition belongs to
  label: string;         // name[0].string
  year?: number;
  publisher?: string;
  isbn?: string;
}
```

Existing mock types (`Work`, `Edition`, `Loan`, `Member`, `Task`, etc.) in `src/lib/types/library.ts` stay for the task-stacks-on-mock half of the page.

### Hydration state

A new derived store, `librarySectionStore`, holds the master-detail section's hydration state:

```ts
type LibrarySectionState =
  | { status: 'loading' }
  | { status: 'no-rights' }       // redirect-to-/ trigger
  | { status: 'no-library' }      // same as no-rights — org has no library entity
  | { status: 'empty'; library: EntuLibrary }       // library exists, 0 works
  | { status: 'ready'; library: EntuLibrary; works: EntuWork[]; editionsByWork: Map<string, EntuEdition[]> }
  | { status: 'error'; reason: string };
```

The page renders different sections based on `$librarySectionStore.status`. Status transitions:
- `loading` on mount + on `$selectedOrgStore.id` change
- → `no-rights` or `no-library` → triggers `goto('/')` redirect (with toast?)
- → `empty` → renders empty marginalia
- → `ready` → renders master + detail
- → `error` → fall back to /? or render Caveat error? See open items below.

## Reactivity & scroll-sync

The page uses `IntersectionObserver` to keep the master list selection synced with whichever work paperstack is currently in the viewport center:

1. On mount, observe each `.work-stack` element with the document as the root, threshold at viewport center.
2. When a `.work-stack` enters the central observation band, find its `data-work-id` and update `$selectedWorkStore.id`.
3. Master rows derive `selected` state from `$selectedWorkStore.id`.

Click handlers:
- Click a master row → `goto('/library?org=<currentOrg>&work=<workId>')` and `document.getElementById('work-' + workId).scrollIntoView({ behavior: 'smooth', block: 'start' })`.
- Scroll triggers via IntersectionObserver → update `$selectedWorkStore.id` and push the new `?work=<id>` via `history.replaceState` (not `goto`, to avoid creating a new history entry per scroll position).

User input always wins: if the user scrolls while a programmatic scroll-into-view is animating, the scroll-into-view promise is aborted (or we don't await it — letting native scroll cancel it via `scroll-behavior` is acceptable).

## URL state

Per Bentham's URL-overrides-persisted architecture-decisions entry (`3a37e42` from session 22):

- `?org=<orgId>` — set by OrgPicker as in CHORE-66. URL is source of truth on read; mismatch with persisted store triggers a write to both URL and store.
- `?work=<workId>` — new for CHORE-67. Same semantics: URL wins on read, two-write symmetry on user interaction (click-master + scroll-into-view) and on read-time divergence.

If the URL `?work=<id>` is set but no such work exists in the loaded library (e.g., stale link from a different org), the page silently drops the param and renders the first work as in-view.

## Components

### New components (Byrd scope, `src/lib/components/library/*.svelte`)

- **`LibraryMasterDetail.svelte`** — top-level container. Receives `$librarySectionStore` + reactive selected-work state. Composes the master + detail columns. Owns the IntersectionObserver setup.
- **`LibraryMaster.svelte`** — the sticky compact index. Receives `works[]` + `selectedWorkId`. Emits `select(workId)` on click. Internal scroll for long lists.
- **`LibraryWorkPaperStack.svelte`** — one work's full paperstack card. Receives a work + its editions. Renders metadata + edition subcards. Has a `data-work-id` attribute for the IntersectionObserver.
- **`LibraryEditionCard.svelte`** — a single edition subcard inside a WorkPaperStack.
- **`LibraryEmptyState.svelte`** — Caveat marginalia "Nothing's catalogued yet — add a first work to start the shelf."

### Reused (no changes)

- `DeskSurface.svelte` — already provides the wood-grain background. Confirm `background-attachment: fixed` is already on it; add if not. (May need a small CHORE-67-internal tweak to the existing component.)
- `PaperStack.svelte`, `StackHeader.svelte`, `PencilSearch.svelte`, `WorkTitle.svelte`, `Margin.svelte`, `BorrowerCard.svelte`, `PullItemCard.svelte`, `VoiceTally.svelte`, `CopyChip.svelte`, `MiniWorkCard.svelte` — unchanged. `MiniWorkCard` is no longer used on /library after this CHORE but stays in the UI-kit for future reuse.

### Replaced

- The current `+page.svelte` catalog strip section (`<section>` with the `MiniWorkCard` row) is replaced by `<LibraryMasterDetail>`.

## i18n

New `library_*` paraglide keys added by Comenius:

| Key | en value |
|---|---|
| `library_master_count` | `"{n, plural, one {1 work} other {{n} works}}"` |
| `library_master_sort_label` | `"composer ↑"` |
| `library_empty_marginalia` | `"Nothing's catalogued yet — add a first work to start the shelf."` |
| `library_work_eyebrow_metadata` | `"Metadata"` |
| `library_work_eyebrow_editions` | `"Editions · {n}"` |
| `library_work_eyebrow_in_view` | `"in view"` |
| `library_field_voicing` | `"Voicing"` |
| `library_field_language` | `"Language"` |
| `library_field_year` | `"Year"` |
| `library_field_isbn` | `"ISBN"` |
| `library_field_publisher` | `"Publisher"` |
| `library_redirect_toast` | (optional) — see open items |

Existing `library_top_eyebrow`, `library_top_heading`, `library_rehearsal_in`, `library_search_placeholder` etc. stay unchanged.

All keys translated to et/lv/uk by Comenius.

## Acceptance criteria

1. **Picker is global** — switching between any two orgs in `$userStore.orgs` from the OrgPicker on /library either renders the librarian view OR redirects to /.
2. **Non-librarian-org → redirect** — selecting an org where the user has no `_editor` on the org's library AND no `_owner` on the org redirects to / within ~200ms of the rights check resolving.
3. **Catalog renders real data** — the master list and the detail column show works from the selected org's library, not from `$lib/fixtures/library-mock.ts`. Composer-alpha sorted.
4. **Editions render real data** — each work paperstack shows that work's actual editions from Entu.
5. **Scroll-sync works** — scrolling the page advances which work is "in view" (visible via the orange-tinted paperstack); the master row highlights in parallel.
6. **Click-master → smooth scroll** — clicking a master row scrolls the detail column to that work's paperstack with smooth behavior.
7. **URL state sync** — `?work=<id>` reflects current selection; navigating to a URL with `?work=<id>` scrolls to that work on load.
8. **No scrollbars visible** — neither page-level nor inner scrolling shows scrollbar UI; mouse-wheel + trackpad + keyboard scroll all work normally.
9. **Empty library** — selecting an org where the library has 0 works shows the Caveat marginalia, not an empty list with no explanation.
10. **3 task stacks unchanged** — Returns / Overdue / Pull continue to render their mock data unchanged.
11. **GH #71 resolved** — the over-fetch query (`?_type.string=organization&props=...&limit=50`) no longer fires from /library.
12. **Quality gates** — `pnpm check` 0 errors, `pnpm test` all pass (new tests + existing), `pnpm lint` clean, `pnpm build` clean.

## Test coverage (Tallis)

- Unit tests for `LibraryMaster.svelte` — renders work rows, emits select event on click, applies `sel` class to active row.
- Unit tests for `LibraryWorkPaperStack.svelte` — renders metadata + editions, applies `active` class when prop set, exposes `data-work-id` correctly.
- Unit tests for the data layer (or `librarySectionStore`) — covers status transitions (loading → no-rights → empty → ready), mocks all 3 Entu fetches.
- Integration tests for /library `+page.svelte` — given a mocked librarySectionStore in each state, verify the right top-level section renders.
- Specifically tests for the GH #71 fix — assert the over-fetch URL pattern does NOT fire after CHORE-67 (mock-fetch + assert `.mock.calls`).

E2E (Playwright) is out of scope; CHORE-C (test infra) covers e2e bootstrap separately.

## Open items / future CHOREs

These were surfaced during brainstorm but deferred:

- ~~**Edition data fetch strategy**~~ — RESOLVED session-24: strategy (b) confirmed by Pérotin probe (`6a248b9`). Editions are children of works; N parallel fetches per work via `Promise.all`. See "Data flow → Query sequence → step 3" above.
- **Error toast on redirect-to-/** — When CHORE-67 redirects a user from /library to / due to no librarian rights, do we show a transient toast ("You're not the librarian for X") or silently redirect? Lean silent for now; revisit if user feedback suggests otherwise.
- **Member chip on the master header** — Could show the librarian's name/initial in the master header. Currently the navbar already shows the user's identity; this would duplicate. Skip for CHORE-67.
- **Search inside master** — The `PencilSearch` component is present in the top bar (CHORE-60). Wiring it to filter the master list is out of CHORE-67 scope.
- **Edition properties beyond label+year** — ISBN, publisher, voicing, language are rendered if Entu has them but aren't required fields. File attachments (score/parts/track) need Edition + File entity work that's a much bigger CHORE.
- **Sort options beyond composer-alpha** — title, year, most-recently-added, language-grouped — all future.
- **The 3 task stacks → real data** — separate CHORE; needs Copy + Lending entity types + UI for recording lendings.
- **Route refactor to /members/<slug>/library** — separate migration CHORE.

## Visual companion

The agreed design is captured in the mockup at `.superpowers/brainstorm/<session>/content/library-b-v6.html`. The mockup represents the v6 lock:
- Wood-grain DeskSurface fills the viewport, `background-attachment: fixed`.
- Master fades 100% → 100% → 50% → 0% paper-to-transparent left-to-right.
- Detail flows full-height with master sticky.
- All scrollbars hidden globally.
- Stacked-paper work cards with nested edition subcards.

(*MVOX:Palestrina*)
