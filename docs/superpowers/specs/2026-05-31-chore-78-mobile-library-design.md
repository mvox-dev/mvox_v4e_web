# CHORE-78 — Mobile library: filtered work list → detail

**Issue:** #78
**Date:** 2026-05-31
**Author:** (*MVOX:Palestrina*)
**Status:** Design approved (PO, session 26)

## Problem

`/library` (the CHORE-67 master-detail desk layout) has zero responsive handling and is unusable on mobile. Three desktop-locked structures break on a narrow viewport:

1. The three task cards (Returns / Overdue / Pull) — a hard 3-column grid (`grid-template-columns: 1fr 1fr 1.15fr`, inline style) that crushes to ~110px per column.
2. `LibraryMasterDetail` — a fixed `240px + 1fr` grid; on a 375px screen the detail column gets ~110px.
3. `LibraryMaster` — a sticky index column + fixed-width search; meaningless / overflowing on mobile.

No `sm:`/`md:`/`lg:` classes or `@media` queries exist anywhere in the library components.

## Scope

**Mobile only (`< sm`, the Tailwind `sm` breakpoint = 640px).** Desktop (`sm`+) master-detail is untouched — byte-for-byte identical. This is deliberately not a unified redesign (PO decision, session 26): desktop power-users keep the jump-to index; mobile gets a filtered list.

## Design

### Information architecture (PO direction)
Replace the *navigate-by-index* model with *narrow-by-filter* on mobile. The sticky master index has no meaning in a single column; a search filter does.

### View model — driven by the existing `?work=<id>` URL param
Desktop already uses `?work=<id>` for detail selection (per the URL-overrides-persisted architecture rule). Mobile derives its view mode from the same param:

- **No `?work=`** → **list mode**: search box + filtered work rows.
- **`?work=<id>` set** → **detail mode**: that work's editions/copies + a "‹ Works" back affordance (clears the param → returns to list).

Rationale: browser back works for free; the view is shareable/bookmarkable; consistent with the desktop architecture and the URL-overrides-persisted rule. Alternatives rejected — local-only `$state` view flag (breaks the back button + the URL rule); a separate `/library/[workId]` route (overkill, restructures routing for a viewport concern).

### Layout

**List mode (`< sm`, no `?work=`):**
- Hidden: the three task cards, the desktop sticky index (`LibraryMaster`), the two-column grid.
- Sticky search box on top — placeholder "Search title or composer…". Filters the works list client-side, case-insensitive substring match against `title` + `composer`.
- Compact work rows below: each shows title, composer, edition count, and a chevron. Tapping a row sets `?work=<id>`.
- Empty-result state when the search matches no works.

**Detail mode (`< sm`, `?work=<id>`):**
- "‹ Works" back affordance at top — clears `?work=` → list mode.
- The selected work's detail, reusing the existing `LibraryWorkPaperStack` + edition cards, single column. Same content the desktop detail column renders.

**Desktop (`sm`+):** unchanged. The two-column grid, sticky index, and scroll-spy all render via `sm:` gating.

### Behavior notes
- The desktop scroll-spy (IntersectionObserver that writes `?work=` as work-stacks cross the viewport) must be gated to `sm`+ so it does not auto-write `?work=` while the user scrolls the mobile list (which would force detail mode).
- No new components/primitives for detail — reuse `LibraryWorkPaperStack` + edition cards.

### Data flow
No new Entu fetches. Search filters the already-hydrated works array on `title` + `composer` — both confirmed fetched today (`EntuWork` in `src/lib/types/library-entu.ts`, via `hydrateLibrary.ts`). Edition count is derivable from the already-fetched editions.

### i18n (Comenius, ×4 locales en/et/lv/uk)
New keys:
- `library_search_placeholder` — "Search title or composer…"
- `library_back_to_works` — "‹ Works" (back affordance label)
- `library_search_no_results` — empty-result message (e.g. "No works match your search")

## Acceptance Criteria

- **AC1** — Below `sm`, the three task cards (Returns/Overdue/Pull) are hidden.
- **AC2** — Below `sm`, the desktop sticky index (`LibraryMaster`) and the `240px + 1fr` two-column grid are not rendered; layout is single-column.
- **AC3** — Below `sm` with no `?work=` param: a sticky search box renders on top of a list of work rows (title, composer, edition count).
- **AC4** — Typing in the search box narrows the list to works whose title OR composer contains the query (case-insensitive). No matches → empty-result state.
- **AC5** — Tapping a work row sets `?work=<id>` (mobile enters detail mode).
- **AC6** — Below `sm` with `?work=<id>`: detail mode renders that work's editions (reusing the existing work/edition components) plus a "‹ Works" back affordance; activating back clears `?work=` and returns to the list.
- **AC7** — The desktop scroll-spy does not write `?work=` below `sm` (no auto-navigation into detail while scrolling the list).
- **AC8** — Desktop (`sm`+) renders identically to today — no visual or behavioral regression.
- **AC9** — All new user-facing strings are i18n keys present in all four locales.

## Testing

Tallis RED encodes AC1–AC9 structurally (jsdom has no layout engine, so breakpoint behavior is asserted via class presence/absence + render-with-param). A true mobile-viewport visual + paint-order check is deferred to Playwright and logged in `test-gaps.md`.

## Out of scope

- Voicing / language / availability filters (PO chose text-search-only; voicing/language also carry a v4E field-name-mismatch risk per Finn's audit — `original_voicing`/`original_language` vs the fetched `voicing`/`language`).
- Wiring the mock task cards to real data.
- Any desktop layout change.
