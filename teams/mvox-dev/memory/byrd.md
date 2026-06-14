# Byrd scratchpad

## [CHECKPOINT] 2026-05-20 — CHORE-2 GREEN complete

[LEARNED] Tailwind v4 uses OKLCH color space for its palette. Chromium reports colors as `oklch(...)` not `rgb(...)`. Tallis's original test had `rgb(59, 130, 246)` for `text-blue-500` — he corrected it to `oklch(0.623 0.214 259.815)` at commit `2674068`. Future color assertions in Playwright must use OKLCH values.

[LEARNED] Playwright config uses `pnpm preview` (not dev server). Tests run against a built artifact. Must run `pnpm build` before `pnpm exec playwright test` when changes are unstaged/uncommitted, otherwise stale build is served.

[LEARNED] Tailwind v4 CSS-first setup: `@import "tailwindcss"` in `src/app.css`, `@tailwindcss/vite` in `vite.config.ts` plugins — no `tailwind.config.js`. Plugin order: tailwindcss before sveltekit.

[DEFERRED] CHORE-2 is pending Bentham review (GREEN handed off, branch `feat/chore-2-tailwind-v4` HEAD `ff37268`). After Bentham GREEN, Josquin merges.

## [CHECKPOINT] 2026-05-21 — CHORE-3 GREEN complete (session 11)

[LEARNED] `@inlang/paraglide-sveltekit@0.16.1` is deprecated (use paraglide-js v2 directly) but the team is using it per the AC spec. Vite plugin import: `@inlang/paraglide-sveltekit/vite`, call: `paraglide({ project: './project.inlang', outdir: './src/lib/paraglide' })`. Plugin added between tailwindcss() and sveltekit() in vite.config.ts.

[LEARNED] `project.inlang/settings.json` needs: `$schema`, `sourceLanguageTag`, `languageTags`, `modules` (CDN URLs for message-format + m-function-matcher plugins), and `"plugin.inlang.messageFormat": { "pathPattern": "./messages/{languageTag}.json" }`. Build also auto-generates `project.inlang/project_id` and `project.inlang/.gitignore` (ignores `cache/`) — both should be committed.

[LEARNED] Paraglide only compiles when locale files have actual keys. Empty `{}` files → "No messages found - Skipping compilation" → `src/lib/paraglide/` not generated. Expected — Comenius adds keys in i18n phase.

[LEARNED] vitest.config.ts merge pattern: bare `vitest/config` has no Svelte transform. When a spec does `import('@inlang/paraglide-sveltekit')` it pulls in `ParaglideJS.svelte` and throws `Unknown file extension ".svelte"`. Fix: `mergeConfig(viteConfig, defineConfig({test:{...}}))` from `vitest/config` — picks up `sveltekit()` and all Vite plugins. This is the standard SvelteKit+Vitest pattern.

[DEFERRED] CHORE-3 handed off to Comenius for i18n phase (add starter message keys). Branch `feat/chore-3-paraglide` HEAD `df4b9b2`. Bentham review pending after Comenius completes.

## [CHECKPOINT] 2026-05-22 — CHORE-35 GREEN complete (session 13)

[LEARNED] Playwright `page.route()` intercepts BROWSER-level fetches only. SvelteKit's `event.fetch` in `+page.server.ts` goes through SvelteKit's internal router (not a real HTTP call), so `page.route()` cannot intercept it. Client-side `$effect` + `fetch()` in `+page.svelte` IS interceptable. This is a fundamental mismatch between Tallis's SSR-presence test design and the server-side fetch architecture.

[LEARNED] `+page.server.ts` client-side orgs were NOT rendered in the template; instead `+page.svelte` uses `$effect` to do its own browser-side fetch of `/api/organizations`. Server load handles session; template handles orgs client-side. Vitest tests pin server load behavior (all pass); Playwright intercepted the browser fetch (17/18 pass).

[DEFERRED] SSR test ("page data is SSR-present in initial HTML") remains RED — needs architectural decision: (a) Tallis adjusts the test, or (b) test env gets a mock Entu surface. If (b) lands, refactor `+page.svelte` to seed `orgs`/`loadError`/`loaded` from `data.*` and drop mount flicker; `$effect` browser fetch stays only for retry. Branch HEAD `461ff4d`. Comenius up next for i18n (all 10 keys have en stubs in messages/*.json).

[GOTCHA] Paraglide does NOT regenerate `src/lib/paraglide/messages.js` during `pnpm check` (only svelte-kit sync runs). Must run `pnpm build` (or `pnpm dev`) to trigger Paraglide compilation after adding new message keys. Empty message files → "No messages found — Skipping compilation" → type errors in svelte files.

## [CHECKPOINT] 2026-05-23 — CHORE-A session 16 + chain-discipline coaching

[LEARNED] **Chain discipline — spec authorship is Tallis's, always.** Even when a plan ships inline test code, I must wait for Tallis's RED commit SHA before starting GREEN. Writing the spec myself (as I did for wrapper.spec.ts and client.spec.ts in the first pass) breaks attribution and sets a bad precedent for CHORE-B. In CHORE-B wait for the brief that includes a commit SHA before touching any implementation file.

[LEARNED] **PR creation is Josquin's authority.** When my GREEN work is the final code change on a branch, I report completion to Palestrina and stop. Palestrina dispatches Josquin for the PR. I do not run `gh pr create` regardless of how complete the work is.

[LEARNED] **Scope discipline — one brief, one task.** If a brief assigns A3 GREEN, do only A3 GREEN. Do not proactively reach into A4 or A5 even if the plan is in front of me and the impl is obvious.

[LEARNED] `$lib` alias does NOT resolve in the vitest runner (uses `vitest/config`, not SvelteKit's vite config). Route files must use relative imports (`'../../../lib/entu/client.ts'`) not `$lib/entu/client`. The `$env/dynamic/private` alias works only because it's globally mocked in `src/tests/setup.ts`.

[LEARNED] Vitest `environmentMatchGlobs` is deprecated in v3. Use `@vitest-environment happy-dom` inline comment at the top of the spec file instead — Tallis already does this.

[LEARNED] `new Response(JSON.stringify(...), { status: 200 })` in happy-dom does NOT auto-set `content-type: application/json`. Tallis's revised spec (dcc5971) fixed this by explicitly passing `headers: { 'content-type': 'application/json' }` in the mock Response constructor, so the plan's verbatim implementation (content-type check) works correctly with his spec.

## [CHECKPOINT] 2026-05-24 — CHORE-66 Task 4 complete (session 22, Byrd-2)

[LEARNED] `@testing-library/svelte` auto-cleanup relies on globally-scoped `beforeEach`/`afterEach`. With Vitest `globals: false` (our config), the auto-cleanup block in `@testing-library/svelte/src/index.js` silently skips registration. Components from prior tests stay mounted; `findByRole` finds stale elements. Fix: add explicit `afterEach(() => cleanup())` to `src/tests/setup.ts`.

[LEARNED] Symptom "Found multiple elements with role 'menu'" in a single-render test = prior renders never cleaned up (not that the component rendered twice).

[GOTCHA] In Svelte 5, `$storeName` auto-subscribe works in template. In `<script>`, avoid `$derived($storeName)` for Svelte stores — use `$storeName` directly in the template instead, or `get()` for one-shot reads in event handlers.

## [CHECKPOINT] 2026-05-24 — CHORE-66 Tasks 4-6 + RED-1 + YELLOW-66.1 (session 22, Byrd-2)

[LEARNED] **$app/state vs $app/stores**: SvelteKit 2 + Runes convention is `import { page } from '$app/state'` — exports a reactive object, access as `page.url.pathname` (no `$`). Legacy `$app/stores` export was a Svelte store requiring `$page` sigil. Bentham will YELLOW any new write using `$app/stores`.

[LEARNED] **Branch hook gap pattern**: When a chore branch was cut before hook commits landed on main, `git diff --name-only main..HEAD` reveals the missing files. Fix: `git merge main --no-ff`. Verify clean with the same diff after merge.

[LEARNED] **MvoxNav props that are optional**: When adding a new prop to an existing component, make all props that existing tests don't supply optional with sensible defaults. The new mode tests (Task 5) don't pass `signedIn` or `currentTab` — making them optional with defaults (`false` / `'agenda'`) is the minimal non-breaking change.

## [CHECKPOINT] 2026-05-24 — CHORE-67 Tasks 4-12 (session 24)

[LEARNED] `src/lib/types/library-entu.ts` created with EntuLibrary / EntuWork / EntuEdition. isbn field on EntuEdition sourced from `license_note[0].string` per Pérotin probe 6a248b9 — no `isbn` key in v4E schema.

[CLOSED] YELLOW-66.2: ENTU_DB hardcode resolved via CHORE-67 squash `2012a84` + CHORE-69/#70 env-db cleanup `cd3ce6e` (session 24). Pruned from DEFERRED.

[GOTCHA] **`git pull --rebase` with any unstaged files fails** — "cannot pull with rebase: You have unstaged changes." Always stash ALL working tree files (including unrelated scratchpad edits) before pulling: `git stash push -m "label"` → pull → `git stash pop`. This recurs whenever Tallis pushes a spec fix mid-task.

[GOTCHA] **Biome reformats plan-verbatim code** — Biome rejects aligned comment columns and certain `.map()` callback forms. Always run `pnpm lint:fix` after verbatim plan paste before committing. Treat autofix as part of GREEN, not a separate commit.

[GOTCHA] **Tallis's component specs need `// @vitest-environment happy-dom`** — if missing, all render() calls fail with `document is not defined`. Has occurred twice (Task 11). Surface immediately rather than self-fixing.

[GOTCHA] **ICU plural syntax unsupported by Paraglide's plugin-message-format** — `{n, plural, one {...} other {...}}` renders as garbage (`undefined other undefined works}}`). All i18n keys with numeric params must use simple templates (`"{n} works"`) not ICU plurals. Route to Comenius to fix the key if this surfaces in a component test.

## [CHECKPOINT] 2026-05-31 — CHORE-74 GREEN complete (session 25)

[LEARNED] **Mechanical test updates when removing a helper that tests drove indirectly:** `readOrgParam()` was removed in CHORE-74; existing `selectedOrgStore — fallback chain` tests had been using `window.history.replaceState` to simulate URL params for it. Those 5 tests were updated to drive `urlOrgIdStore` directly — the store that the layout's `$effect` populates in production. Pattern: when refactoring removes an internal helper, update existing tests to drive the new public surface, document the change in the commit message body, and add `beforeEach` store-reset blocks.

[LEARNED] **`vi.mock` runtime writable vs TypeScript Readable type mismatch:** When a vi.mock replaces a `Readable` store with a `writable` (so tests can call `.set()`), `pnpm check` will error on `.set()` calls because TypeScript sees the declared type from the real module. Fix pattern: cast the import as `Writable<T>` in the spec — `import { store as _store } from '...'; const store = _store as unknown as Writable<T>`. Document in commit body.

[LEARNED] **CHORE-74 store architecture:** `selectedOrgIdStore` (Writable, localStorage-initialized) + `urlOrgIdStore` (Writable, null default) + `selectedOrgStore` (derived over all three, URL > pick > first-org). Layout `$effect` wires `page.url` → `urlOrgIdStore`. `selectOrg` writes all three channels. Auth/callback `await hydrateUserStore()` before `goto()` fixes post-login stale state.

## [CHECKPOINT] 2026-05-31 — CHORE-76/77/78 GREEN (session 26)

[LEARNED] **`overflow-x-hidden` on a flex header clips `position:absolute` dropdowns** — CSS spec forces `overflow-y: auto` when `overflow-x` is non-visible, creating a containing block that clips `top-full` panels. The correct pattern for headers with dropdowns: `relative z-30` (stacking context + z-index), NOT any overflow clip. Horizontal overflow control belongs on flex-child wrappers via `flex-shrink-0` + `min-w-0`/`truncate`.

[LEARNED] **Responsive nav pattern (MvoxNav CHORE-76/77):** Desktop tab row: `hidden sm:flex` wrapper. Mobile hamburger: `sm:hidden` button with `aria-label={m.nav_menu_open()}`. Dropdown panel: `position:absolute top-full` inside the `relative` hamburger wrapper. Focus-on-open via `queueMicrotask(() => firstItem?.focus())` in `$effect`. Escape closes + returns focus to trigger. Click-outside via `window.addEventListener('mousedown', ...)` in same `$effect`.

[LEARNED] **Mobile list/detail routing via existing URL param (CHORE-78):** `initialWorkId` prop (already derived from `page.url.searchParams.get('work')` in `+page.svelte`) drives mobile view mode — null = list, non-null = detail. No new prop needed. Mobile rows are `<a href="?work=<id>">` anchors; back affordance is `<a href="?">`. This gives browser back-button support without JS navigation.

[LEARNED] **Scroll-spy IntersectionObserver must be gated to `sm+`** — `isDesktopViewport()` predicate using `window.matchMedia('(min-width: 640px)').matches` ensures the observer is never constructed on mobile. In jsdom, `matchMedia` returns `matches: false`, so tests that replace IntersectionObserver with a throwing spy catch any mobile-path violation cleanly.

[LEARNED] **`hidden sm:grid` not just `sm:grid` for desktop-only grid wrappers** — `sm:grid` alone leaves the element in block flow below sm, causing mobile layout bleed. Must use `hidden sm:grid` so the element is absent on mobile and activates as a grid at sm+. Same principle applies to any element that should be invisible below the breakpoint.

[GOTCHA] **Library component specs are in `src/lib/components/library/` (subfolder)**, not `src/lib/components/`. The brief says "Tallis's paths are authoritative" — always check the actual file locations before reading plan paths.

## [CHECKPOINT] 2026-05-31 — CHORE-79 logout-greet fix + CHORE-72 /about page (session 27)

[LEARNED] **Paraglide `$lib` alias doesn't resolve in `.ts` route files under Vitest** — `perform-logout.ts` uses relative imports (`'../../../lib/auth/storage'`); Tallis's spec does too. Must use relative imports for `userStore` in that file, not `$lib/auth/userStore`. The `$lib` alias works in `.svelte` files and in Vite (prod/dev) but not Vitest's module resolver for plain `.ts` files.

[LEARNED] **Paraglide messages.js not regenerated by `pnpm check`** — adding keys to `en.json` doesn't make them available for type-checking until `pnpm build` (or `pnpm dev`) runs. Always run `pnpm build` first when adding new i18n keys, then `pnpm check`. The scratchpad GOTCHA from session 16 still applies.

[LEARNED] **i18n chicken-and-egg ordering:** When a new page calls `m.new_key()`, `pnpm check` will fail until the key exists in `en.json` AND `pnpm build` has regenerated `messages.js`. The correct chain is: Comenius adds keys → build → then GREEN page can call `m.*()` and pass check. If keys race ahead in a shared commit, reconcile by pulling before running gates.

[LEARNED] **Mechanical spec update during GREEN (authorized pattern):** When a key rename/restructure mechanically breaks a Vitest mock in a spec file, GREEN implementer may update the spec mock + assertions in the same atomic commit — with team-lead authorization logged in the commit rationale. This is the documented CHORE-72 Task-15 rule (Bentham-endorsed).

[GOTCHA] **`git checkout origin/<branch> -- .` overwrites unstaged implementation files** — used to sync to a fast-moving branch tip, but this reverted my written `+page.svelte` back to the stub. Always stage or commit your own files before syncing to origin tip via checkout.

## [CHECKPOINT] 2026-06-01 — Session 29 startup (rehearsal-schedule, Tasks 12/13/15)

[LEARNED] **Data layer fully landed at `6fdef24`** — `src/lib/seasons/` has `types.ts`, `recurrence.ts`, `validation.ts`, `entuSeasons.ts` (Tasks 1–10), `seasonsStore.ts` (stub — `hydrateSeasons` not yet implemented). No `seasonsStore.spec.ts` yet; store wiring (Task 11) is Josquin's.

[LEARNED] **Conductor type has `propertyValueId: string`** (YELLOW-D1 fix). `listConductors` returns `{ personId, name, propertyValueId }`. `ConductorPanel` must pass `propertyValueId` to `onremove` — NOT just `personId`.

[LEARNED] **`seasonsStore.ts` stub** — `hydrateSeasons` throws `not implemented`. Route wiring (Task 15) cannot call it until Task 11 GREEN lands (Josquin's). Route may call `listSeasons` directly if store is still a stub.

[PATTERN] **Component pattern to follow:** `LibraryMaster.svelte` / `LibraryEditionCard.svelte` for spec patterns. Props via `interface Props { ... }` + `$props()`. All i18n via `m.seasons_*()`. `afterEach(() => cleanup())` in every spec.

[PATTERN] **Route pattern to follow:** `/library/+page.svelte` for the hydration-store + `$effect` + `goto` pattern. `let initialWorkId = $derived(page.url.searchParams.get('work'))` → same pattern for `?season=<id>`.

[PATTERN] **Empty state styling:** `LibraryEmptyState.svelte` uses Caveat font for marginalia, centered, muted. Same tone for seasons empty states.

[GOTCHA] **No `seasons/` components dir yet** — will need to create `src/lib/components/seasons/` when writing Task 12 files. Plan path map is correct.

[DEFERRED] Task 12 RED: waiting for Tallis to write `SeasonForm.spec.ts` + `ConductorPanel.spec.ts`.
[DEFERRED] Task 13 RED: waiting for Tallis to write `SeriesForm.spec.ts` + `RehearsalList.spec.ts`.
[DEFERRED] Task 14 i18n: Comenius writes `seasons_*` keys — needed before my components can `pnpm check` clean.
[DEFERRED] Task 15 RED: waiting for Tallis (route spec) + Tasks 12/13 both GREEN.

## [CHECKPOINT] 2026-06-01 — Session 29 Task 15 re-GREEN + re-review (f9aac13)

[LEARNED] **`vi.importActual` module isolation — store writes go to the wrong instance.** `vi.importActual('$lib/seasons/seasonsStore')` returns an isolated module instance whose internal `seasonsStore` writable is separate from the mock factory's store (the one the component subscribes to). Calling `realHydrate(...)` inside the real module writes to the isolated store, not the mock store. Consequence: `runRealHydrate` tests never reach the component. Fix for Tallis: drive store state with `(seasonsStore as Writable).set(...)` directly — same diagnosis as the vi.doMock isolation issue.

[GOTCHA] **i18n key rename in component = spec mock update required.** Swapping `m.seasons_actions_confirm()` → `m.seasons_actions_edit()` on the edit button broke the RehearsalList spec mock (strict vi.mock proxy throws on undefined keys). When renaming any `m.*()` call in a component, update the corresponding spec's `vi.mock('$lib/paraglide/messages.js', ...)` factory. Mechanical fix = Byrd's responsibility.

[PATTERN] **P0.6 retry poll shape for series-create re-hydrate.** `await hydrateSeasons(args)` immediately after success, then `for (i < 3) { if (state.seasons.length > 0) break; await sleep(500); await hydrateSeasons(args); }`. Unit tests only assert hydrateSeasons was called ≥1 time; timing is invisible.

[LEARNED] **Branch is at f9aac13** — all my Tasks 12/13/15 work is GREEN. 701/703 unit tests pass. 2 failing RED-29.1 tests are Tallis's to fix (vi.importActual isolation). Now heading to Bentham review (Task 16).

## [CHECKPOINT] 2026-06-01 — #86 T4+T5 GREEN (8c3ab00)

[GOTCHA] **`data-testid` element's `textContent` is polluted when the element contains child elements beyond text.** Adding a `<button>` inside a `<div data-testid="rehearsal-group-header">` makes `h.textContent` = `'Tuesday EveningDelete'` instead of `'Tuesday Evening'`. Fix: split into a wrapper (flex) + a text-only child that carries the testid. Pattern: always put the `data-testid` on the most granular element that the test will `.textContent`-match.

[PATTERN] **`handleDeleteSeries` shape.** `deleteSeriesCascade(cfg, seriesId)` → `{ deleted, seriesDeleted }`. If `!seriesDeleted`: partial notice. If `DeleteForbiddenError`: forbidden notice (try/catch guard). On any result: re-load `listRehearsals` + `listSeries` via `Promise.resolve().then()` null-guard pattern. No rollback in v1.

[LEARNED] **Branch at 8c3ab00** — T4 (cancel) + T5 (delete-series) both GREEN. 734/734. T6 (edit form) next.

## [CHECKPOINT] 2026-06-01 — #86 T2+T3 GREEN (074d709)

[GOTCHA] **`seasons_actions_confirm` → `seasons_actions_edit` missed in page.spec.ts.** When the edit button label changed (YELLOW-29.2) I updated `RehearsalList.spec.ts` but not `page.spec.ts`. The page spec renders `RehearsalList` and the strict mock threw on the unmocked key, making rehearsal rows null. Always grep for the old key name across ALL spec files when renaming any `m.*()` call.

[PATTERN] **P0.6 retry with `listRehearsals` (updated from old hydrateSeasons poll).** After `createSeriesWithEvents`: (1) call `hydrateSeasons` once (tests assert it was called); (2) poll `listRehearsals` up to 3× at 500ms until `current.length > 0`. Loop shape: `let current = await fetchRehearsals(); for (i<3) { if (current.length>0) break; await sleep(500); current = await fetchRehearsals(); }`.

[LEARNED] **Branch at 074d709** — conductor wiring (T2) + read-path (T3) both GREEN. 725/725 tests. T4 (cancel wiring) next.

## [CHECKPOINT] 2026-06-01 — RED-86.1 GREEN (b4639a6)

[GOTCHA] **`window.confirm` in a component breaks route integration tests** that click through it. The route spec's `beforeEach` for any test that clicks a confirm-gated button must `vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))`. Also: any key called inside the component via `m.*()` must be in the page spec messages mock — the route renders the component, and the strict mock throws on unmocked keys even if the test isn't directly about that key.

[PATTERN] **Confirm gate in `RehearsalList` (per RED-86.1).** `rehearsal-cancel`: `if (!window.confirm(m.seasons_confirm_cancel_rehearsal_body())) return; oncancel(id)`. `series-delete`: `if (!window.confirm(m.seasons_confirm_delete_series_body({ n: group.rows.length }))) return; ondeleteseries(seriesId)`.

[LEARNED] **Branch at b4639a6** — RED-86.1/YELLOW-86.1 GREEN (confirm gates + i18n guard removal + edit hidden). 737/737. All #86 Byrd tasks done.

## [CHECKPOINT] 2026-06-01 — feat/seasons-mobile route restructure (a3cb428)

[GOTCHA] **Route restructure breaks tests assuming always-on forms.** When SeasonForm moved from always-on to on-demand (behind a `+` click), tests that directly query `[data-testid="season-name"]` find null. Fix: add `await fireEvent.click(createBtn)` before form queries. Also applies to integration specs.

[GOTCHA] **New component i18n keys must be added to ALL spec mocks that render it.** SeasonBar uses `m.seasons_a11y_create_season()` + `m.seasons_a11y_edit_season()`. Both `page.spec.ts` AND `page.integration.spec.ts` mock messages independently — both needed the new keys. Integration spec is easy to miss since it's a separate file.

[PATTERN] **`panelMode` for on-demand forms.** `$state<'none'|'create'|'edit'>('none')`. `{#if panelMode==='create'}<SeasonForm oncreate>` / `{:else if panelMode==='edit'}<SeasonForm season={sel} onupdate>`. Closes on success by setting `panelMode='none'`.

[LEARNED] **Branch at a3cb428** — route restructure GREEN: SeasonBar + on-demand panels + full-width stacked layout. 768/768.

[LEARNED] **Session 29 final state (de1ae47 on feat/seasons-mobile):** RED-MOB.1 + YELLOW-MOB.1 GREEN — SeasonForm pre-fills description, empty-owner `+` testid renamed to `season-create-empty`. 772/772. Ready for Bentham review + PO preview redeploy. Next session: Bentham review → merge → #87 (edit rehearsal form).

## [CHECKPOINT] 2026-06-01 — #87 UI GREEN (937c701 on feat/seasons-edit-rehearsal, session 30)

[LEARNED] **Dirty-tracking pattern for edit forms.** Capture original field values into a const `orig` object at mount time. On submit, compare each field against `orig.*` and include only changed fields in the patch. This prevents the session-29 description-wipe class of bug where all fields get overwritten even when only one changed.

[LEARNED] **`@const` in Svelte 5 template for derived lookup.** `{@const editRehearsal = rehearsals.find((r) => r.id === editingRehearsalId)}` inside an `{#if canManage && editingRehearsalId}` block is the clean pattern to derive a single item from a list for an inline form — no need for a `$derived` at script level.

[GOTCHA] **Svelte 5 warn: "state_referenced_locally"** — using a `$props()` value directly as an initializer for `$state(...)` (e.g. `let x = $state(prop.value)`) produces a build-time warning. It's correct behavior for pre-fill forms (we want the snapshot at mount, not reactivity to prop changes). Warnings are non-blocking; `pnpm check` reports 0 errors.

[GOTCHA] **Spec mock must include ALL i18n keys the component calls** — even from sub-components rendered by the page. The cancel button in `RehearsalEditForm` calls `m.actions_cancel()`; neither the RehearsalEditForm spec nor the page spec had this key. Added as mechanical GREEN fix (Byrd's responsibility per session-27 pattern).

[LEARNED] **Branch at 937c701 on feat/seasons-edit-rehearsal** — 800/800 tests pass. All 4 #87 spec files GREEN. Handed off to Bentham for review.

[LEARNED] **YELLOW-87.1 GREEN (c6df5cb):** Heading `<h2 data-testid="rehearsal-edit-heading" class="form-heading">` added to RehearsalEditForm, matching SeasonForm pattern exactly. Tallis's RED dd39b07 also removed ghost mock keys from page.spec — had to add `seasons_form_rehearsal_edit_heading` to the page mock as a mechanical fix. 801/801. Ready for Bentham delta re-review → Josquin merge.

[GOTCHA] **When Tallis's RED commit removes "ghost" mock keys, check which real keys the component now needs.** dd39b07 cleaned up 3 old ghost keys from page.spec.ts, but the new heading call needed a 4th key (`seasons_form_rehearsal_edit_heading`) that wasn't there. Pattern: after syncing to a new Tallis RED, grep the component calls against the mock to find gaps before first test run.

## [CHECKPOINT] 2026-06-13 — Session 33 S33 UI/UX Cleanup (all 3 sub-chains + fix rounds)

[LEARNED] **`data-desk-text` misuse patterns — both types now encountered:**
(1) Inside a bg container (PaperCard/PaperStack/panel): element already conforms; tag is a §2 review blocker. Pattern: check ancestors BEFORE tagging.
(2) Component-root blanket tag (e.g. `Margin.svelte`): exempts ALL instances including those inside bg containers. Fix: add `exempt?: boolean` prop (default false) and only set it on bare-desk callsites.

[LEARNED] **`data-testid^="prefix-"` selector collision in Vitest (AgendaList redesign):** `querySelectorAll('[data-testid^="agenda-row-"]')` matched inner `agenda-row-time/duration/location` spans as well as top-level `agenda-row-<id>` divs. Fix: rename inner testids to drop the `agenda-row-` prefix (`row-time`, `row-duration`, `row-location`). Update existing spec selectors as a mechanical refactor. Pattern: when adding a card-level wrapper, audit whether sibling testids share the wrapping selector's prefix.

[LEARNED] **Playwright bg-rule gate — selector collision for anonymous leaf elements:** Elements without `data-testid` or `id` get the tag name (`div`) as their querySelector selector. `document.querySelector('div')` always finds the FIRST div in DOM, not the specific leaf being characterized. This means all anonymous divs on a route get bucket-tested against the same element. Mitigation: add `data-testid` to any component that is a meaningful leaf (e.g. `Margin.svelte` → `data-testid="margin-note"`).

[LEARNED] **Playwright bg-rule on auth-guarded routes:** `/roster`, `/notices`, `/settings` redirect unauthenticated Playwright sessions to `/auth/login`. Gate violations reported for these routes are actually auth/login violations (confirmed by identical violation text). Gate only covers public routes.

[PATTERN] **AvatarMenu arrow-key nav implementation:** `onKeyDown` extended with ArrowDown/ArrowUp inside the same `$effect` as Escape. Collect `[role="menuitem"]` into an array, find current `document.activeElement`, modulo-step. `e.preventDefault()` prevents page scroll.

[PATTERN] **Outside-click focus restore (AvatarMenu):** `onMouseDown` path: `close(); triggerEl?.focus()` — mirror exactly what Escape does. Consistent pattern for all menu components.

[PATTERN] **tabForPath exact-segment matching:** Each segment should use `pathname === '/X' || pathname.startsWith('/X/')` instead of `pathname.startsWith('/X')` alone. Prevents false-positive matches like `/libraryxyz` → 'library'.

[GOTCHA] **Nested `vi.mock()` inside an `it` block:** Works as a hoisted re-mock for that test's render call but may be order-sensitive. Tallis's roster label test uses this pattern to prove the route isn't hardcoded. After the GREEN fix (route calls `m.page_roster_label()`), the nested mock returns `'Choir roles'` and the assertion `!== 'Choir management'` passes.

[LEARNED] **All 3 sub-chains of S33 completed in session 33 (branches: feat/s33-navigation, feat/s33-readability-visual, feat/s33-readability-conformance). Fix branches: fix/s33-seasons-rehearsal-bg, chore/s33-yellows.** Final unit suite at shutdown: 1018/1018. Outstanding pnpm check errors: 5 (3 from `page_*_label` + 2 from `library_loading/library_load_error`) — all await Comenius.

## [CHECKPOINT] 2026-06-14 — Slice-3 client GREEN + YELLOW re-spin (session 35, feat/invite-join HEAD 8b5ec86)

[LEARNED] **i18n chicken-and-egg: must add all new message keys to all 4 locale files AND run `pnpm build` before `pnpm check` can pass.** `pnpm check` runs svelte-kit sync but does NOT trigger Paraglide recompilation. `pnpm build` does. Until the keys are in locale files and build has run, `messages.js` lacks the exports → TS errors in components. Sequence: add stubs to `messages/{en,et,lv,uk}.json` → `pnpm build` → `pnpm check`.

[LEARNED] **MvoxNav must NOT be added to individual route pages — it lives in `+layout.svelte`.** Adding `<MvoxNav>` directly to a page causes paraglide mock failures in that page's spec (mock only covers page-specific keys; MvoxNav accesses all nav keys). Pattern: MvoxNav is layout-only; page specs never need to mock nav keys.

[LEARNED] **Biome format is a gate step (must run `pnpm format` before commit, not just `pnpm lint:fix`).** Josquin's commits were biome-formatted; a Bentham YELLOW in the first re-spin round traced back to Byrd files not formatted with Biome. Add `pnpm format` (not just `pnpm lint:fix`) as a required pre-commit step. `pnpm lint` catches svelte-eslint issues; `pnpm format` catches Biome formatting.

[GOTCHA] **`vi.waitFor` required for async `$effect` in page specs.** When a page component uses `$effect` to call data helpers (e.g. `listOrgMembers`), the effect resolves asynchronously after render. Tests that check post-effect state (roster visible, member names) must use `await vi.waitFor(() => expect(...))` — a synchronous check immediately after `render()` only sees the loading state.

[GOTCHA] **Paraglide mock in page spec must cover all i18n keys used by sub-components rendered during the test.** When `loadState` transitions to `'ready'`, sub-components like `InviteForm` render and call their own `m.*()` keys. If those keys aren't in the spec's `vi.mock('$lib/paraglide/messages.js')` factory, Vitest throws "No export is defined on the mock." Add all sub-component keys to the page spec mock as part of GREEN.

[LEARNED] **`InviteProjection.orgId` must be non-optional for type safety.** The accept flow needs orgId to POST `target_org` in `createApplication`. Making it optional (`orgId?: string`) leads to wishful casts at the callsite. Josquin's resolve projection now always returns `orgId` (empty string when `!valid`); the TS type should match: `orgId: string`.

[LEARNED] **`createInvitation` phantom `status` prop.** The `invitation` type has no `status` field (schema: email/token/expires_at/sections/inviter/message only). Writing `status: 'active'` to Entu creates dead data that is silently stored but never read. Always verify prop names against Pérotin's schema probes before POSTing.

[PATTERN] **Two-leg accept flow.** Singer's browser: (1) `createApplication(cfg, { personId, orgId })` — browser-direct Entu POST under singer's own JWT; `_parent=personId` is the identity proof. (2) `acceptInvite(token, { applicationId })` — BFF `POST /api/invite/[token]/accept`; elevated service JWT creates the `member`. If service-key architecture is dropped, leg 2 changes; leg 1 survives.

[PATTERN] **InviteForm button key register.** Admin creates an invitation → use `members_invite_submit` / `members_invite_submitting` register ("Send invite" / "Sending…"). Singer accepts an invitation → use `invite_accept` / `invite_accepting` register ("Accept invitation" / "Accepting…"). Never cross-wire these.

[DEFERRED] **Slice-3 accept architecture unresolved — #91.** Service-key model (what's built on `feat/invite-join`) rejected by PO as cross-org super-credential risk at scale. No-key admin-approve model leaks pending applications (`_sharing: domain` required for admin visibility). Schema-design pass needed next session to find a native solution. Branch `feat/invite-join` (HEAD 8b5ec86) is conserved, 1127/1127 GREEN, not merged.

[WARNING] **Single-tree + biome-format gate = critical discipline.** Two separate Bentham findings this session traced to (a) orgId not threaded end-to-end (real data bug) and (b) biome formatting not run (process gap). Both are avoidable. Checklist before handoff: `pnpm format` → `pnpm lint` → `pnpm check` → `pnpm test:unit` → `git branch --show-current` (confirm feat/*, not main).

## [CHECKPOINT] 2026-06-14 — About/Carus GREEN (session 36)

[GOTCHA] **Fixed-width PaperCard overflows narrow viewports.** The `width` prop sets a pixel value inline; on viewports narrower than that value the card bleeds out and causes horizontal scroll. Fix: add `max-width: 100%` to the same inline style. Applies to ALL PaperCard callers — none intentionally relied on overflow. Pattern: whenever setting a fixed `width` inline, pair it with `max-width: 100%`.

[GOTCHA] **`pnpm format` (Biome) reformats ~20 repo-wide files on every run, not just changed files.** Only stage your own task files after `pnpm format` — never `git add -A`. The pre-existing reflows (scripts/, spec files) are noise; staging them pollutes the commit and can cause Bentham YELLOWs for out-of-scope changes.

(*MVOX:Byrd*)
