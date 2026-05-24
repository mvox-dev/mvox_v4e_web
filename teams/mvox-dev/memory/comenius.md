# Comenius — i18n Specialist Scratchpad

Personal notes. Only Comenius writes here. Keep under 100 lines; prune stale entries.

Tags: `[DECISION]`, `[PATTERN]`, `[WIP]`, `[CHECKPOINT]`, `[DEFERRED]`, `[GOTCHA]`, `[CONVENTION]`, `[TRANSLATION]`

---


## Session 22 — CHORE-62 + CHORE-66 i18n keys (2026-05-24)

[CHECKPOINT] Added 6 nav_tab_* + nav_chip_librarian keys (a439228) and 2 nav_org_picker_* keys (1c9e5da) across 4 locales. All on separate branches; per-commit-GREEN gate verified each time.

[CONVENTION] New env-var branch guard: `MVOX_EXPECTED_BRANCH=<branch> git commit ...` — pre-commit hook enforces branch intent. No `.git/EXPECTED_BRANCH` file needed (superseded by env var, hook at `8a42302`).

[PATTERN] Gate order for keys-only commits: `pnpm build` first (regenerates paraglide), then `pnpm check`, `pnpm test:unit`, `pnpm lint`. Build must precede check or check fails on missing generated types.

(*MVOX:Comenius*)

---

## Session 21 — CHORE-60 i18n ship (2026-05-24)

[CHECKPOINT] Completed Tasks 30, YELLOW-A, YELLOW-D for CHORE-60 feat/library-page-ui-kit branch.

[DECISION] Task 30 (f6247af): Added 60 keys across 4 locales — library_*, auth_login_*, auth_provider_*, auth_logout_*. Updated auth_login_heading "Sign in to mvox" → "Welcome back". 1 TODO marker per non-en locale on library_overdue_marginalia (date-specific copy, needs PO input).

[DECISION] YELLOW-A (615a7e0): Wired 28 m.*() substitutions into /library/+page.svelte. Gotcha: `{@const}` invalid outside {#if}/{#each} blocks in Svelte 5 — must declare derived vars in <script> block instead.

[DECISION] YELLOW-D (0aa63d8): Added 4 *_unit keys (owned_unit, available_unit, on_loan_unit, overdue_unit) in all 4 locales. Pattern: when colored `<span>` wrappers around numbers need to survive i18n wiring, split parameterized key into separate unit-label key. Parameterized originals left in place (unused but harmless). No TODOs — unit strings directly derived from parameterized values.

[GOTCHA] `{@const}` placement: Svelte 5 only allows `{@const}` as immediate child of `{#snippet}`, `{#if}`, `{:else}`, `{#each}`, `{:then}`, `{:catch}`, `<svelte:fragment>`, `<svelte:boundary>`, or `<Component>`. NOT inside plain `<div>` or other HTML elements. Move splits/derives to `<script>` block.

(*MVOX:Comenius*)

## Session 14 — #37 i18n landing gap (2026-05-22)

[CHECKPOINT] Completed i18n phase for #37 (hardcoded "members/section" replacement). Commit `69f6ee6` on `chore/37-i18n-landing-members-per-section`. Ready for Bentham REVIEW.

[DECISION] Key name: `landing_members_per_section`. Parameterized with `{count}`. No pluralization variants — `count` can be a decimal average (e.g., 4.5), so full noun declension by number would be wrong. Partitive/genitive forms used for all locales work correctly regardless of numeric value.

[TRANSLATION] Translations:
- en: `{count} members/section`
- et: `{count} liiget häälerühmas` — `liiget` = members (partitive, works with all numbers); `häälerühmas` = in the voice group (choral term for section)
- lv: `{count} locekļi katrā sekcijā` — `locekļi` = members (nom. pl.); `katrā sekcijā` = in each section
- uk: `{count} учасників на секцію` — `учасників` = participants (gen. pl., standard with numeric count); `на секцію` = per section

[GOTCHA] `pnpm check` fails after adding new message keys if `src/lib/paraglide/` has not been regenerated. Must run `vite build` (or `pnpm build`) first to trigger Paraglide plugin regen before running `pnpm check`. No standalone `build:i18n` script exists; regen only happens via Vite. Logged for future i18n tasks.

(*MVOX:Comenius*)

## Session 14 — CHORE-41 i18n phase (2026-05-22)

[CHECKPOINT] Completed i18n phase for #41 (Real OAuth wiring). Commit `32e837f` on `feat/oauth-wiring`. Handed off to team-lead for Bentham REVIEW routing.

[DECISION] 5 OAuth auth flow keys translated (et/lv/uk). Placeholder translations were drafted against an older English version; updated to match Byrd's final copy. Key changes: added "Please try again." to `auth_callback_failed`; added "Redirecting…" phrase to `auth_callback_success`; introduced "security check" concept + "start again" in `auth_error_csrf_mismatch`; softened `auth_error_missing_session_token` from "no token received" to "did not complete".

[CONVENTION] "Start again" vs "try again" distinction: CSRF error uses `alusta uuesti`/`sāciet no jauna`/`почніть знову` — implies full flow restart, not just button retry. Logged in `i18n-conventions.md`.

(*MVOX:Comenius*)

---

## Session 13 — CHORE-35 i18n phase (2026-05-22)

[CHECKPOINT] Completed i18n phase for #35 (frontend scaffolding). Commit `98eaa33` on `feat/frontend-scaffolding-mvp`. Handed off to team-lead for Bentham REVIEW routing.

[DECISION] Translated all 10 new keys for landing + nav + login into et/lv/uk. Improved two English stubs: `landing_retry_button` → "Try again" (from "Retry"); `landing_error_state` → added "Try again." suffix for inline actionability.

[CONVENTION] Vocabulary anchored for choir domain: choir = `koor`/`koris`/`хор`; Sign in = `Logi sisse`/`Pierakstīties`/`Увійти`; Sign out = `Logi välja`/`Izrakstīties`/`Вийти`; OAuth CTA = imperative (et) / formal infinitive (lv/uk). All logged in `i18n-conventions.md`.

[GOTCHA] Pre-existing Tailwind color test (`tests/tailwind.spec.ts:22`) was failing before i18n work. Confirmed by stash+rerun. Not a Comenius concern — flag to Tallis if it resurfaces in review.

(*MVOX:Comenius*)

---

## Session 10 — CHORE-3 AC research (2026-05-21)

[CHECKPOINT] First real Comenius session. Delivered gitignore-vs-commit AC recommendation to team-lead via SendMessage.

### Findings

[DECISION] `src/lib/paraglide/` should be **gitignored**, not committed.

Key evidence:
- Paraglide compiler option `emitGitIgnore` defaults to `true` — it auto-writes a `.gitignore` inside the output dir on every compile. Committing the output requires explicitly overriding this with `emitGitIgnore: false`, which goes against Paraglide's own intent.
- The `paraglideVitePlugin` (used in `vite.config.ts`) regenerates the output dir on every `pnpm dev` and `pnpm build`. Cloudflare Pages runs `pnpm build`, so CI is covered without a separate compile step.
- No drift risk: generated output always reflects current `messages/*.json`.
- Zero PR noise: generated TS never appears in diffs.

`.gitignore` line to add:
```
src/lib/paraglide/
```

[GOTCHA] `pnpm check` (`svelte-check`) runs outside Vite and needs the generated types to exist. In a fresh CI checkout with no prior build, `pnpm check` will fail if `src/lib/paraglide/` is absent. Fix: ensure `pnpm build` runs before `pnpm check` in CI, OR add a `postinstall`/`prepare` script that runs `paraglide-js compile`. Deferred to CHORE-3 implementation — Tallis should verify how CI is structured before adding the hook.

[DEFERRED] Second-order questions sent to team-lead for resolution at CHORE-3 implementation time:
1. Does Cloudflare Pages CI run `pnpm check` separately or only `pnpm build`?
2. Exact package: `@inlang/paraglide-sveltekit` (per AC) vs `paraglideVitePlugin` from `@inlang/paraglide-js` — policy is the same either way.
3. Confirm `emitGitIgnore: false` is NOT set in the Vite config (default true reinforces the gitignore policy).

(*MVOX:Comenius*)
