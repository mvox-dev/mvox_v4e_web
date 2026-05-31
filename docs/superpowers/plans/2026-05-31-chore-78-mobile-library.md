# CHORE-78 — Mobile Library: filtered list → detail — Implementation Plan

> **Execution mode:** mvox-dev team TDD chain (Comenius → Tallis RED → Byrd GREEN → Bentham REVIEW → Josquin MERGE). NOT subagent-driven / inline — the team's named-role chain is the baked-in mode for this repo. Steps use `- [ ]` for tracking.

**Goal:** Make `/library` usable on mobile (`< sm`) with a search-filtered work list that taps into a per-work detail screen, leaving the desktop master-detail layout untouched.

**Architecture:** Mobile view mode is derived from the existing `?work=<id>` URL param (no param → list; param → detail), consistent with the URL-overrides-persisted rule. Below `sm` we hide the desktop task cards + sticky index + 2-col grid and render a single-column search-over-list / detail view; at `sm`+ the current layout renders unchanged via breakpoint gating.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Tailwind v4, Paraglide i18n, Vitest + @testing-library/svelte.

**Spec:** `docs/superpowers/specs/2026-05-31-chore-78-mobile-library-design.md` · **Issue:** #78

---

## File Map

- **Modify** `src/routes/library/+page.svelte` — gate task-card grid + top-bar search to `sm:` (hide `< sm`).
- **Modify** `src/lib/components/LibraryMasterDetail.svelte` — below `sm`, replace the `240px + 1fr` grid with the mobile list/detail rendering; gate the scroll-spy IntersectionObserver to `sm`+.
- **Modify** `src/lib/components/LibraryMaster.svelte` — gate the sticky desktop index to `sm`+ (hidden on mobile).
- **Create** `src/lib/components/LibraryMobileList.svelte` — mobile search box + filtered work rows (list mode).
- **Reuse (no change)** `src/lib/components/LibraryWorkPaperStack.svelte` + edition cards — for mobile detail mode.
- **Modify** `messages/{en,et,lv,uk}.json` — 3 new keys.
- **Modify** `src/lib/components/MvoxNav.spec.ts`? No — tests live with the library: **Modify/Create** `src/lib/components/LibraryMasterDetail.spec.ts` + `LibraryMobileList.spec.ts`.

## Shared contract (data-testids + breakpoint classes)

Byrd implements; Tallis asserts against these.

| Element | testid | Breakpoint behavior |
|---|---|---|
| Task-card grid wrapper | `library-task-cards` | `hidden sm:grid` (hidden `< sm`) |
| Desktop master index | `library-master` (on `LibraryMaster` root) | `hidden sm:block` |
| Master-detail grid wrapper | `library-md-grid` | single-col `< sm`, `sm:grid` 2-col |
| Mobile list container | `library-mobile-list` | `block sm:hidden`, rendered only when no `?work=` |
| Mobile search input | `library-mobile-search` | inside mobile list; `aria-label`/placeholder = `m.library_search_placeholder()` |
| Mobile work row | `library-mobile-row` (one per work; carry `data-work-id`) | tap sets `?work=<id>` |
| Mobile empty-result | `library-mobile-empty` | shown when filtered list is empty |
| Mobile detail container | `library-mobile-detail` | `block sm:hidden`, rendered only when `?work=<id>` |
| Mobile back affordance | `library-mobile-back` | label = `m.library_back_to_works()`; clears `?work=` |

i18n keys: `library_back_to_works`, `library_search_no_results`, `library_search_placeholder`.

---

## Task 1 — i18n keys (Comenius)

**Files:** Modify `messages/{en,et,lv,uk}.json`

- [ ] **Step 1:** Add three keys (alphabetical, `library_*` family) to all four locales:
  - `library_search_placeholder` — en: "Search title or composer…"
  - `library_back_to_works` — en: "‹ Works" (translate the word, keep the ‹ glyph)
  - `library_search_no_results` — en: "No works match your search"
  Provide proper et/lv/uk translations (concept-mapped, consistent with existing `library_*` keys).
- [ ] **Step 2:** Run i18n build (`pnpm i18n:gen`) so `src/lib/paraglide/` regenerates. Verify all 4 locales in sync.
- [ ] **Step 3:** `pnpm check` (0 errors), `pnpm lint` (exit 0).
- [ ] **Step 4:** Commit (`messages/*` + regenerated paraglide if tracked). `MVOX_EXPECTED_BRANCH=chore/mobile-library`, no `Co-authored-by:` lines. Handoff to Tallis.

---

## Task 2 — RED tests (Tallis)

**Files:** Modify `src/lib/components/LibraryMasterDetail.spec.ts`; Create `src/lib/components/LibraryMobileList.spec.ts`

Write failing tests (jsdom + @testing-library/svelte; explicit `afterEach(cleanup)` per L111) encoding AC1–AC9 via the Shared contract. Assert structurally — class presence/absence + render-with-prop — since jsdom has no layout engine.

- [ ] **Step 1:** Write the tests:
  - AC1: task-card wrapper (`library-task-cards`) carries `hidden sm:grid`.
  - AC2: `library-master` carries `hidden sm:block`; `library-md-grid` is single-col `< sm` (no fixed 2-col without `sm:`).
  - AC3/AC4: `LibraryMobileList` renders `library-mobile-search`; given a works array, typing a query that matches one work's title (or composer) filters `library-mobile-row` count to the matches; a non-matching query shows `library-mobile-empty`. Search is case-insensitive, matches title OR composer.
  - AC5: clicking a `library-mobile-row` invokes the select handler / navigates with `?work=<id>` (assert the handler is called with the work id, or that the row is an anchor/button targeting the param — match Byrd's mechanism; coordinate via handoff).
  - AC6: `LibraryMasterDetail` with a `selectedWorkId` prop set renders `library-mobile-detail` + `library-mobile-back`; back affordance clears the param (assert handler/anchor clears `?work=`).
  - AC7: scroll-spy does not run below `sm` — assert the IntersectionObserver wiring is gated (e.g., the observer is only constructed when a `isDesktop`/media condition is true; coordinate the testable seam with Byrd in handoff — prefer a small exported predicate or a `matchMedia`-gated `$effect`).
  - AC8: desktop path — with no mobile media, the existing master + detail render (existing tests stay green).
  - AC9: search placeholder + back label come from `m.*()` (no hardcoded English) — assert rendered text equals the en message or that the `m.` accessor is used.
- [ ] **Step 2:** Run `pnpm test:unit` — new tests FAIL; existing library tests green. Run `pnpm lint:fix` before committing (per the spec-commit ritual).
- [ ] **Step 3:** `pnpm check` 0 errors. Commit specs only. Update `test-gaps.md` with the deferred Playwright mobile-viewport + paint-order note. `MVOX_EXPECTED_BRANCH=chore/mobile-library`. Handoff to Byrd with the finalized testable seams (select mechanism, scroll-spy gate predicate).

---

## Task 3 — GREEN implementation (Byrd)

**Files:** Create `src/lib/components/LibraryMobileList.svelte`; Modify `LibraryMasterDetail.svelte`, `LibraryMaster.svelte`, `src/routes/library/+page.svelte`

Make Task 2 tests pass. Svelte 5 runes; Tailwind v4 full class names; mobile-first.

- [ ] **Step 1:** `+page.svelte` — add `library-task-cards` testid to the task-card grid wrapper and gate it `hidden sm:grid`; gate the top-bar fixed-width search (`w-[280px]`) to `sm:` (hidden `< sm` — the mobile search lives in the list instead).
- [ ] **Step 2:** `LibraryMaster.svelte` — add `library-master` testid to the root; gate the sticky index `hidden sm:block`.
- [ ] **Step 3:** Create `LibraryMobileList.svelte` — props: the works array (typed via existing `EntuWork`/library types). Sticky search input (`library-mobile-search`, placeholder `m.library_search_placeholder()`), `$state` query, `$derived` filtered list (case-insensitive substring on `title` OR `composer`). Render `library-mobile-row` per filtered work (title, composer, edition count, chevron; `data-work-id`); row click sets `?work=<id>` (use the same `selectedWorkId`/`syncUrl` mechanism `LibraryMasterDetail` already uses — coordinate with the existing handler). Empty filtered list → `library-mobile-empty` with `m.library_search_no_results()`.
- [ ] **Step 4:** `LibraryMasterDetail.svelte` — wrap the existing 2-col grid with `library-md-grid`, gate it `sm:grid` (single column `< sm`). Below `sm`: when no `selectedWorkId` → render `<LibraryMobileList>`; when `selectedWorkId` set → render `library-mobile-detail` containing the existing `LibraryWorkPaperStack` for that work + a `library-mobile-back` affordance (`m.library_back_to_works()`) that clears `?work=`. Gate the scroll-spy IntersectionObserver so it only runs at `sm`+ (use the predicate/`matchMedia` seam agreed with Tallis).
- [ ] **Step 5:** `pnpm check` 0 errors, `pnpm test:unit` all green (Task 2 tests pass, existing green), `pnpm lint` exit 0 (lint:fix first), `pnpm build`.
- [ ] **Step 6:** Commit (the 1 new + 3 modified components). `MVOX_EXPECTED_BRANCH=chore/mobile-library`, no `Co-authored-by:`. Handoff to Bentham. (If a new user-facing string slipped in beyond the 3 keys, surface to team-lead → Comenius before review.)

---

## Task 4 — REVIEW (Bentham)

- [ ] Verify AC1–AC9; desktop (`sm`+) no-regression (the 2-col grid/index/scroll-spy still render via `sm:` gating); search semantics (title OR composer, case-insensitive); `?work=` drives both desktop selection AND mobile view mode without conflict; scroll-spy genuinely gated off `< sm` (not just structurally — reason about the media seam); i18n completeness ×4 + no hardcoded English; per-commit-GREEN; merge-shape (`git log HEAD..main` empty). Verdict RED/YELLOW/GREEN + who-acts.

---

## Task 5 — MERGE + deploy (Josquin)

- [ ] **Phase 1 (preview):** `pnpm build` → `pnpm exec wrangler pages deploy .svelte-kit/cloudflare --project-name=multivox --branch=chore/mobile-library` (creds inline; no production touch). Report the unique preview URL + `curl -sI` 200 + `x-sveltekit-page: true`. HOLD for PO verify on mobile + desktop.
- [ ] **Phase 2 (on team-lead "PO approved, merge"):** `git checkout main && git pull` → `git merge --squash chore/mobile-library` → commit `feat(#78): mobile library — search-filtered work list → detail` with body `Closes #78` (hook adds PO co-author; no `Co-authored-by:` lines; `MVOX_EXPECTED_BRANCH=main`) → `git push` → production `pnpm exec wrangler pages deploy .svelte-kit/cloudflare --project-name=multivox` → delete branch local+remote → report SHA + chunks + mvox.eu 200. Team-lead closes #78.

---

## Notes for the chain

- **Branch:** `chore/mobile-library`, cut from clean main by team-lead at dispatch.
- **L100:** i18n keys (Task 1) land before consuming code (Task 3) — that ordering is why Comenius is first here, ahead of the usual phase-4 slot.
- **Shared-tree discipline:** one owner at a time; `MVOX_EXPECTED_BRANCH` set on every commit; no `Co-authored-by:` lines in dispatch/commit bodies (short-circuits the PO-trailer hook).
- **Memory-file noise:** uncommitted scratchpads (bentham/tallis/test-gaps.md) sit in the tree; each agent `git add`s only its own files.

(*MVOX:Palestrina*)
