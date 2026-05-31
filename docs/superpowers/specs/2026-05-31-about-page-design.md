# /about page (placeholder) — Design

**Issue:** closes #72 (footer `/about` link 404s → make the route real)
**Date:** 2026-05-31
**Author:** (*MVOX:Palestrina*)
**Status:** Design approved (PO, session 27 — structure delegated to team-lead)

## Problem

`LandingFooter.svelte:25` ships `<a href="/about">` but `/about` has no route → 404 on click. #72 originally scoped this as "swap to a no-op `href="#"` + `data-todo`". PO decision (session 27): instead build a **real, minimalistic `/about` page** — proper structure, English-only, lorem-ipsum body, real content filled later. Building the route fixes the footer link for real (the existing `href="/about"` resolves to 200) and closes #72.

## Constraints / context

- **`/about` is already public** in the CHORE-79 auth-guard allowlist (`session-cookie.ts` `PUBLIC_EXACT`), already covered by `hooks.server.spec.ts` + `session-cookie.spec.ts`. No guard change needed; the page is reachable logged-out.
- **Footer link needs no change** — `href="/about"` is already correct; it just needs the route to exist.
- **Aesthetic:** reuse the locked landing/auth paper-and-ink primitives for consistency — `DeskSurface`, `PaperCard`, `BrandMark`, `Margin` (Caveat marginalia). Inter for body/headings, Caveat reserved for the handwritten marginalia accent only (per `feedback_mvox_hybrid_aesthetic`). No new design tokens.
- **English only, content-later:** body copy is lorem ipsum placeholder; section headings + tagline are real English. All strings via Paraglide (no hardcoded English — Bentham rule). `en.json` gets the real headings + lorem; `et/lv/uk` get the English placeholder copy with a `TODO` marker (translate when real content lands).

## Design

A single static route `src/routes/about/+page.svelte`. No data load, no server logic, no `+page.server.ts`. Pure presentational page on the desk surface.

### Structure (PO pick session 27: hero intro + Mission + Story + Values — mission-forward)

1. **Header** — `BrandMark` + page title "About mvox" + a **hero intro paragraph** (real English lead, sets the tone); a Caveat marginalia accent for a human touch.
2. **"Our Mission"** — lead with the why (heading + lorem body).
3. **"Our Story"** — history (heading + lorem body).
4. **"What We Believe"** — values (heading + lorem body).
5. **Closing marginalia** — a handwritten Caveat sign-off line (e.g. "~ the mvox team").

Sections live in one or more `PaperCard`s on a `DeskSurface`, vertically stacked, centered, comfortable reading width. Mirror the spacing/scale vocabulary already used in `auth/login/+page.svelte` and the landing components so it reads as the same product.

### i18n keys (`about_*`)

| key | en value |
|---|---|
| `about_page_title` | About mvox |
| `about_intro` | (hero intro paragraph — real English lead) |
| `about_mission_heading` | Our Mission |
| `about_mission_body` | (lorem ipsum) |
| `about_story_heading` | Our Story |
| `about_story_body` | (lorem ipsum) |
| `about_values_heading` | What We Believe |
| `about_values_body` | (lorem ipsum) |
| `about_marginalia` | ~ the mvox team |

`et/lv/uk`: same English values with a leading `TODO:` translation marker convention per `i18n-conventions.md` (Comenius decides exact marker form). Lorem body is identical across locales (placeholder).

## Acceptance criteria

- **AC1** — `/about` route exists and returns 200 logged-out (it's in the public allowlist).
- **AC2** — Page renders a title ("About mvox"), a hero intro paragraph, and three content sections with the headings "Our Mission", "Our Story", "What We Believe".
- **AC3** — All visible strings come from Paraglide `m.about_*()` calls; no hardcoded English in the `.svelte`.
- **AC4** — Page uses the established primitives (`DeskSurface`, `PaperCard`, `BrandMark`, `Margin`) — visually of-a-piece with landing/auth.
- **AC5** — Footer "About mvox" link now resolves to the page (no 404). No change to `LandingFooter.svelte` required; verify the link works.
- **AC6** — `messages/{en,et,lv,uk}.json` all carry the `about_*` keys (en real headings + lorem; et/lv/uk English placeholder + TODO marker). Locale files stay in sync (no missing keys).

## Out of scope

- Real about content (lorem ipsum placeholder only; swap later).
- Translations (English placeholder in all locales for now).
- Any nav/menu entry for /about beyond the existing footer link.

## Testing

Vitest component test (`src/routes/about/page.spec.ts`, happy-dom): renders the page, asserts the title + three section headings are present (via `m.about_*()` — assert on testids or rendered text). Keep `LandingFooter.spec.ts` green. A real-route 200 smoke is covered by the existing guard specs (allowlist) + the build; an E2E click-through is a deferred Playwright note if warranted.

## TDD chain

Tallis (RED) → Byrd (GREEN, `.svelte`) → Comenius (i18n keys ×4 locales) → Bentham (review) → Josquin (merge). No Josquin server work (static page). Preview deploy → PO visual-verify → merge (per session norm for user-facing UI).
