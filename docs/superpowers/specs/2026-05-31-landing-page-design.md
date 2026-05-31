# CHORE-72 — Landing page (`/`) redesign — Design Spec

**Date:** 2026-05-31
**Status:** spec ready for plan
**Brainstorm artifacts:** `.superpowers/brainstorm/21627-1780205921/content/` (visual companion screens 01-04)
**Predecessor:** CHORE-60 (UI kit) · CHORE-66 (navbar auth wiring) · CHORE-67 (/library real-data)

## Goal

Replace the current scaffold `/` route with a coherent paper-and-ink landing page that serves two distinct audiences from the same URL:

- **Signed-out:** a marketing-flavored doorway for **curious bystanders** that pitches mvox as the back-of-house for choirs, gates access behind an invitation request.
- **Signed-in:** a **welcome-back dashboard** with quick-actions for the four pillars (library, roster, rehearsal notes, repertoire), preserving the same visual register.

The redesign closes the gap where `/` currently uses generic Tailwind utilities (`text-gray-900`, `bg-blue-600`, plain bordered org-cards) while the rest of mvox runs the paper/ink/desk design system from CHORE-60 onward.

## Non-goals

- Sign-up flow beyond a `mailto:hello@mvox.eu` request. No on-site form, no captcha, no email-API integration. (Real form is gated on CHORE-6 Resend wiring + PO DNS work.)
- Federation / public-org-browse / signed-out catalog preview. Pillars are described, not previewed.
- Roster / Rehearsal notes / Repertoire pillar implementations. Pillar cards are visual placeholders with `SOON` / `COMING` badges; the dashboard pillar quick-actions link to routes that may not exist yet (interim: render a "coming soon" placeholder route or disable the link — implementation chooses).
- Locale-detection beyond the existing Paraglide default. (The footer locale picker IS functional — see "Footer locale picker" under Component contracts — but no new detection / persistence logic is added.)
- Time-of-day-aware greetings ("Good morning"). Greeting is static.

## Audience and positioning (decisions from brainstorm)

| Decision | Value | Source |
|---|---|---|
| Page job | Doorway (first-time visitor) + dashboard (returning user) | Q1, Q9 |
| Visitor archetype | Curious bystander — high bounce risk, low pre-existing context | Q2 |
| Launch posture | Invite-only — primary CTA "Request an invite" via `mailto:` | Q3, Q14 |
| Positioning | "The back-of-house for your choir" — whole back-office pitch | Q4 |
| Visual register | Direction A (Open Desk) — max character, paper-stack metaphor | Q5 |
| Form factor | Mobile-first, scaled-up at desktop (>768px); no distinct desktop layout | Q6, Q12 |
| Hero composition | A1 — vertical paper stack (roster → library → hero card) | Q7 |
| Page depth | Full marketing scroll — hero + 4 below-fold sections | Q8 |
| Section list | Pillars-first lean: hero / pillars / invites / request / footer | Q9 |
| Dashboard composition | D1 — scattered pillar cards on the desk | Q11, signed-in |
| Copy ownership | Spec locks placeholder copy as production; PO edits during review | Q13 |
| Request email | `hello@mvox.eu` (CF Email Routing → `mitselek+mvox@gmail.com`) | Q14 |

## Page architecture

```
/  (single SvelteKit route)
├── +page.server.ts  (empty load; no SSR data needed for either state)
└── +page.svelte     (orchestrator — branches on $userStore status)
       │
       ├── (signed-out) <LandingMarketing />
       │     ├── <LandingHero />            — A1 vertical paper stack
       │     ├── <LandingPillarsSection />  — 2×2 grid of <LandingPillarCard />
       │     ├── <LandingInvitesSection />  — wax-seal explainer
       │     ├── <LandingRequestSection />  — mailto: card
       │     └── <LandingFooter />          — ink slab; brand, links, locales, micro
       │
       └── (signed-in)  <LandingDashboard />
             ├── <LandingDashboardGreet />  — eyebrow + headline + Caveat marginalia
             └── <LandingDashboardScatter />— 4 scattered <DashboardPillarCard />
```

Top 60px of every state is occupied by the existing `MvoxNav` from `src/routes/+layout.svelte` — **do not modify the layout**. All landing components render below it. On signed-out, `MvoxNav` shows brand + "Sign in"; on signed-in, it shows brand + org-picker + avatar (the existing CHORE-66 wiring).

### State branching in `+page.svelte`

```ts
const status = $derived($userStore.status);
// 'loading' | 'anonymous' | 'ready'
```

- `loading` → render `<LandingMarketing />` (anonymous is the assumption while userStore hydrates; avoids flicker into "Welcome back, undefined")
- `anonymous` → render `<LandingMarketing />`
- `ready` → render `<LandingDashboard />`

Rationale for showing marketing during `loading`: most fresh tabs are anonymous; the false-positive flash of marketing for an already-authed returning user is shorter (~50-100ms before userStore hydrates from localStorage) than the false-positive flash of dashboard for an anonymous visitor would be.

### Routes the landing page links to

| Link | Route | Notes |
|---|---|---|
| Hero CTA "Request an invite" | `mailto:hello@mvox.eu?subject=...` | Pre-fill subject; see Copy |
| Hero secondary "Already invited? sign in" | `/auth/login` | Existing route |
| Request-section CTA "Open mail · request an invite" | same `mailto:` as hero | |
| Footer "About mvox" | `/about` | **Route may not exist** — render the link disabled or scoped to a noop until /about ships. Mark in code with TODO so it's findable. |
| Footer "Open infrastructure (v4E)" | `https://github.com/entu/research#v4e` | External; opens new tab |
| Footer "Contact: hello@mvox.eu" | `mailto:hello@mvox.eu` | |
| Footer "Source · github.com/mvox-dev" | `https://github.com/mvox-dev/mvox_v4e_web` | External; opens new tab |
| Footer locale picker | Triggers the existing locale-switch chain | Implementation reuses whatever Comenius wires for locale changes; presentational here |
| Dashboard pillar — Library | `/library` | Existing route |
| Dashboard pillar — Roster | `/roster` | **Route does not exist** — link disabled (button non-interactive) with SOON badge visible. |
| Dashboard pillar — Rehearsal notes | `/notes` | Same — disabled, SOON badge. |
| Dashboard pillar — Repertoire | `/repertoire` | Same — disabled, SOON badge. |

## Component contracts

### `<LandingHero />`

Vertical paper stack (A1 composition) on a desk backdrop.

**Props:** none (static composition).

**Internal structure (mobile, 390px):**
- Roster card (back of stack, rotated -3°, partial)
- Library card (middle, rotated +2.5°, single-line "EFK · Library" style decorative content)
- Hero card (front, rotated -1°): red 3px left border; `INVITE ONLY` stamp top-right; eyebrow; h1; subhead; full-width CTA
- Caveat marginalia "already invited? sign in" below the stack, rotated -2°

**Desktop scale-up (>768px):**
- Stack max-width grows from 340px → ~440px; type scales h1 28→36px, sub 14→16px; container centers in viewport with desk-grain on both sides

**Backdrop:** `DeskSurface` component (existing — animated wood-grain E-recipe from CHORE-67; 3 orbital `repeating-radial-gradient` layers at 8/13/21s linear infinite). **Note:** the wood-grain CSS is intentionally inherited from `DeskSurface` and NOT re-specified here. Brainstorm mockups showed static gradient approximations for review-speed; the implementation uses the animated component for visual consistency with /library. Per PO during brainstorm: "we'll work on wood grain CSS later — we did achieve really good results in previous sessions."

**Live reference:** the deployed `https://mvox.eu/library` page is the canonical visual reference for the wood-grain surface. Tallis can ground RED-spec assertions against the live element classes; Byrd can verify GREEN parity by eyeballing the deployed page side-by-side with `pnpm dev`. No need to read CSS source to understand the target — it's already in production.

Used in all backdrops: marketing hero, pillars section, invites section, request section, dashboard scattered area. Footer is the only section that does NOT use `DeskSurface` (it's a flat ink slab).

### `<LandingPillarsSection />`

`What's inside` section. 2×2 grid of `<LandingPillarCard />` on desk backdrop.

**Props:** none (static list of 4 pillars).

**Section header:** eyebrow + h2, centered.

### `<LandingPillarCard />`

A single pillar card on the desk.

**Props:**
```ts
type LandingPillarCardProps = {
  variant: 'library' | 'roster' | 'notes' | 'repertoire';
  status: 'shipped' | 'indev' | 'coming';
};
```

- Card has slight rotation per variant (deterministic, not random — for visual consistency across renders)
- Icon area top-left (~64px tall): mini-paper-thumbnail per variant
- Title (h3, Inter bold 14px)
- One-line body copy (Inter regular 11.5px, ink-3)
- Status badge top-right: `SHIPPED` (green), `IN DEV` (amber), `COMING` (paper-3 + ink-5 border)

### `<LandingInvitesSection />`

Wax-seal explainer card (single column on the desk).

**Props:** none.

**Structure:**
- Card with red 3px left border
- Red wax-seal stamp positioned top-right, partly overlapping the card edge (translate -28px outside the card top)
- Eyebrow + h2 + two paragraphs
- Caveat marginalia "scroll for the address ↓" below the card

### `<LandingRequestSection />`

Conversion card with `mailto:` button.

**Props:** none.

**Structure:**
- Card with ink 3px left border (heavier visual weight than other sections — this is the conversion moment)
- "RECEIVED"-style ink-stamp top-right (paper-3 background, ink-2 border)
- Eyebrow + h2 + body paragraph
- Email-line block: `hello@mvox.eu` in JetBrains Mono on paper-2 background with dashed ink-4 border (visually echoes a typed address)
- Full-width CTA button (ink fill, paper text): `Open mail · request an invite →`
  - Button is a `<a href="mailto:...">` styled as button (semantically a link, visually a button) — accessibility OK
- Caveat marginalia "we read every one" centered below

### `<LandingFooter />`

Ink slab. Full-width, ~360px tall on mobile.

**Props:** none.

**Structure (top to bottom):**
- Brand-mark row: `m` tile + "mvox" wordmark in paper-on-ink
- Tagline paragraph (ink-4)
- Links list (vertical, paper-text on ink, no underline default, underline on hover): About / Open infra / Contact / Source
- Locale picker (horizontal row of 4 chips: EN / ET / LV / UK; active state inverts — paper background, ink text). Each chip is a `<button>` that calls Paraglide's `setLocale(code)` runtime helper (existing — used elsewhere in mvox by Comenius's earlier wiring). No persistence beyond Paraglide's defaults.
- Micro line at bottom: copyright (left) + invite-only badge (right), all JetBrains Mono ink-4

### `<LandingDashboard />` (signed-in state)

D1 scattered composition.

**Props:** consumes `$userStore` and `$selectedOrgStore` directly (per the Path C pattern; no prop-drilling from `+page.svelte`).

**Structure:**
- Greeting block centered at top (~76px from top of content): eyebrow "Welcome back" + h1 "Welcome back, {name}." + Caveat marginalia "{org} · the back office"
- Scattered area below: 4 `<DashboardPillarCard />` positioned absolutely with deterministic rotations to scatter them across the desk

### `<DashboardPillarCard />`

Variant of `LandingPillarCard` tuned for dashboard (action-shaped, larger, with meta).

**Props:**
```ts
type DashboardPillarCardProps = {
  variant: 'library' | 'roster' | 'notes' | 'repertoire';
  status: 'shipped' | 'indev' | 'coming';
  meta?: string;  // freeform: "28 works · 552 copies · 2 overdue" or "In development"
  href?: string;  // omit for disabled (coming/indev) cards
  orgChar?: string;  // optional 2-char prefix for the lbl line; defaults to a generic label
};
```

- Library card pulls **real meta** from the user's selected org: `{worksCount} works · {copiesCount} copies · {overdueCount} overdue`. If `overdueCount > 0`, the "overdue" segment renders in red+bold.
- Other 3 cards show static `In dev` / `Coming` text in the meta slot.
- Card-left-border color: red (library), amber (roster), ink-3 (notes + repertoire)
- `go` arrow `→` Caveat 22px in bottom-right when `href` is set; absent when `href` is unset (disabled state)

**Data source for Library meta:** consume `librarySectionStore` from `src/lib/library/libraryStore.ts` (already populated by CHORE-67). If the store is in `idle` / `loading` state, render meta as "—". If in `empty` state, render "No catalogue yet". If in `ready` state, render the counts.

## Copy (verbatim production English — locks Q13)

### Hero
| Slot | String |
|---|---|
| Stamp | `INVITE ONLY` |
| Eyebrow | `For choirs · by invite` |
| Headline | `The back-of-house for your choir.` |
| Subhead | `Library, roster, rehearsal notes, repertoire — kept properly, shared with people who need them.` |
| CTA | `Request an invite →` (arrow is Caveat-rendered) |
| Marginalia | `already invited? sign in ↗` |

### Pillars section
| Slot | String |
|---|---|
| Eyebrow | `Four parts of the back office` |
| Heading | `What's inside` |

### Pillar cards
| Variant | Title | Body | Status |
|---|---|---|---|
| library | `Library` | `Catalogue, copies, lending. Every score accounted for.` | `SHIPPED` |
| roster | `Roster` | `Members, sections, contact details. Who sings where.` | `IN DEV` |
| notes | `Rehearsal notes` | `Notes, attendance, schedule. The week-to-week record.` | `COMING` |
| repertoire | `Repertoire` | `Programs, seasons, what to sing next.` | `COMING` |

### Invites section
| Slot | String |
|---|---|
| Stamp | `INVITE ONLY` |
| Eyebrow | `Getting in` |
| Heading | `mvox is invite-only.` |
| Paragraph 1 | `We're growing slowly. **Conductors and librarians** are the first cohort — they bring their choirs in once the back office fits.` |
| Paragraph 2 | `If your choir would benefit, write to us. We'll set you up.` |
| Marginalia | `scroll for the address ↓` |

### Request section
| Slot | String |
|---|---|
| Stamp | `RECEIVED` |
| Eyebrow | `Request access` |
| Heading | `Write to us.` |
| Body | `Tell us your choir's name, where you sing, and what you'd want mvox to keep. A sentence is plenty.` |
| Email display | `hello@mvox.eu` |
| CTA | `Open mail · request an invite →` |
| Marginalia | `we read every one` |

**mailto: target:**
```
mailto:hello@mvox.eu?subject=Invite%20request%20%E2%80%94%20mvox
```
(Subject = `Invite request — mvox`; no body pre-fill — let users compose.)

### Footer
| Slot | String |
|---|---|
| Tagline | `The back-of-house for your choir. Library, roster, rehearsal notes, repertoire.` |
| Link 1 | `About mvox` |
| Link 2 | `Open infrastructure (v4E)` |
| Link 3 | `Contact: hello@mvox.eu` |
| Link 4 | `Source · github.com/mvox-dev` |
| Micro left | `© 2026 mvox.eu` |
| Micro right | `v4E · invite-only` |

### Dashboard
| Slot | String |
|---|---|
| Eyebrow | `Welcome back` |
| Headline | `Welcome back, {name}.` (param) |
| Marginalia | `{org} · the back office` (param) |
| Library lbl | `{orgInitials} · catalogue` (param; e.g., `EFK · catalogue`) |
| Roster lbl | `Members` |
| Notes lbl | `Week` |
| Repertoire lbl | `Season` |
| Soon badge | `SOON` |
| Library meta (ready) | `{worksCount} works · {copiesCount} copies · {overdueCount} overdue` |
| Library meta (empty) | `No catalogue yet` |
| Library meta (loading) | `—` |
| Pillar meta (indev) | `In development` |
| Pillar meta (coming) | `Coming` |

## i18n keys (catalogue for Comenius)

Naming convention: `landing_<section>_<slot>`. Existing `landing_*` keys (`landing_signed_out_headline`, etc.) from the scaffold era are **deleted** as part of this CHORE — they're orphaned after the redesign.

```jsonc
// New keys (en lockstrings above; et/lv/uk = Comenius's task)
{
  "landing_hero_stamp": "INVITE ONLY",
  "landing_hero_eyebrow": "For choirs · by invite",
  "landing_hero_headline": "The back-of-house for your choir.",
  "landing_hero_sub": "Library, roster, rehearsal notes, repertoire — kept properly, shared with people who need them.",
  "landing_hero_cta": "Request an invite",
  "landing_hero_already_invited": "already invited?",
  "landing_hero_sign_in": "sign in",

  "landing_pillars_eyebrow": "Four parts of the back office",
  "landing_pillars_heading": "What's inside",

  "landing_pillar_library_title": "Library",
  "landing_pillar_library_body": "Catalogue, copies, lending. Every score accounted for.",
  "landing_pillar_roster_title": "Roster",
  "landing_pillar_roster_body": "Members, sections, contact details. Who sings where.",
  "landing_pillar_notes_title": "Rehearsal notes",
  "landing_pillar_notes_body": "Notes, attendance, schedule. The week-to-week record.",
  "landing_pillar_repertoire_title": "Repertoire",
  "landing_pillar_repertoire_body": "Programs, seasons, what to sing next.",
  "landing_pillar_badge_shipped": "SHIPPED",
  "landing_pillar_badge_indev": "IN DEV",
  "landing_pillar_badge_coming": "COMING",

  "landing_invites_stamp": "INVITE ONLY",
  "landing_invites_eyebrow": "Getting in",
  "landing_invites_heading": "mvox is invite-only.",
  "landing_invites_body_1_html": "We're growing slowly. <strong>Conductors and librarians</strong> are the first cohort — they bring their choirs in once the back office fits.",
  "landing_invites_body_2": "If your choir would benefit, write to us. We'll set you up.",
  "landing_invites_marginalia": "scroll for the address ↓",

  "landing_request_stamp": "RECEIVED",
  "landing_request_eyebrow": "Request access",
  "landing_request_heading": "Write to us.",
  "landing_request_body": "Tell us your choir's name, where you sing, and what you'd want mvox to keep. A sentence is plenty.",
  "landing_request_cta": "Open mail · request an invite",
  "landing_request_marginalia": "we read every one",
  "landing_request_subject": "Invite request — mvox",

  "landing_footer_tagline": "The back-of-house for your choir. Library, roster, rehearsal notes, repertoire.",
  "landing_footer_link_about": "About mvox",
  "landing_footer_link_openinfra": "Open infrastructure (v4E)",
  "landing_footer_link_contact": "Contact: hello@mvox.eu",
  "landing_footer_link_source": "Source · github.com/mvox-dev",
  "landing_footer_micro_year": "© 2026 mvox.eu",
  "landing_footer_micro_invite": "v4E · invite-only",

  "landing_dashboard_eyebrow": "Welcome back",
  "landing_dashboard_greeting": "Welcome back, {name}.",
  "landing_dashboard_marginalia": "{org} · the back office",
  "landing_dashboard_library_lbl": "{org} · catalogue",
  "landing_dashboard_roster_lbl": "Members",
  "landing_dashboard_notes_lbl": "Week",
  "landing_dashboard_repertoire_lbl": "Season",
  "landing_dashboard_badge_soon": "SOON",
  "landing_dashboard_library_meta_ready": "{worksCount} works · {copiesCount} copies · {overdueCount} overdue",
  "landing_dashboard_library_meta_empty": "No catalogue yet",
  "landing_dashboard_library_meta_loading": "—",
  "landing_dashboard_pillar_meta_indev": "In development",
  "landing_dashboard_pillar_meta_coming": "Coming"
}
```

**Total new keys: 41.** Plus deletion of 7 scaffold-era keys (`landing_signed_out_*`, `landing_signed_in_*`, `landing_empty_state`, `landing_error_state`, `landing_retry_button`, `landing_members_per_section`).

**HTML in i18n note:** `landing_invites_body_1_html` carries inline `<strong>` markup. Render via Svelte `{@html}` after defensive sanitation — this is our string, no user input, low risk. Comenius preserves the tag in translations; document this in `teams/mvox-dev/memory/i18n-conventions.md` as the project's first `_html`-suffixed key.

**ICU plural concern (for Library meta):** the meta string `{worksCount} works · {copiesCount} copies · {overdueCount} overdue` has plural-form gotchas (1 work / 2 works) that Paraglide + plugin-message-format doesn't fully handle per the CHORE-67 finding (L100-adjacent). Punt: render the words "works" / "copies" / "overdue" as static suffixes regardless of count. ET/LV/UK may need translator notes if their grammar requires count-form agreement.

## Design tokens (consumed from `src/app.css`, already defined)

| Token | Use in landing |
|---|---|
| `--color-paper` `#f7f1e1` | Main paper for hero card, request card, footer-tile, dashboard greet |
| `--color-paper-2` `#efe7d2` | Roster card, library decorative card, alt pillar cards, hint-paper backgrounds |
| `--color-paper-3` `#e5dcc4` | Footer accent fills, "COMING" badge background, RECEIVED stamp background |
| `--color-ink` `#2a2620` | Headlines, CTA fill, footer slab background, brand tile, stamp colors |
| `--color-ink-2` `#4b443a` | Body text |
| `--color-ink-3` `#7a7166` | Sub-body / labels |
| `--color-ink-4` `#a89f91` | Dividers, dashed borders, tertiary text |
| `--color-ink-5` `#c9bfa9` | Page-title text in dark contexts, COMING badge border |
| `--color-red` `#b54a3a` | Hero stamp, hero card left border, INVITE eyebrow, overdue count, wax-seal stamp |
| `--color-green` `#5f7a3b` | SHIPPED badge text |
| `--color-green-soft` `#dde9cb` | SHIPPED badge background |
| `--color-amber` `#b67a1e` | IN DEV badge text, dashboard roster card left border |
| `--color-amber-soft` `#f5e3bf` | IN DEV badge background |
| `--color-desk-base` `#d3bf95` | Desk backdrop base color (via `DeskSurface`) |
| `--color-desk-1` `#d6c39a`, `--color-desk-2` `#d8c79e` | Desk gradient highs |
| `--font-sans` `'Inter'` | All load-bearing text |
| `--font-mono` `'JetBrains Mono'` | Stamps, eyebrows, footer micro, email display, badge text |
| `--font-display` `'Caveat'` | Marginalia only (per `feedback_mvox_hybrid_aesthetic`) — never headlines |

## Loading / empty / error states

### Signed-out marketing page
- No data fetching. No loading state. Renders deterministic content on first paint.

### Signed-in dashboard
- **userStore loading**: render marketing instead (see "State branching" — avoids "Welcome back, undefined" flicker)
- **selectedOrgStore = null** (user has 0 orgs): render dashboard but with `landing_dashboard_marginalia` showing `no choir · the back office` and all pillar cards in `coming` state (disabled). Add a small "Ask your conductor to invite your choir" note via Caveat marginalia at the bottom. Footer is omitted on dashboard view.
- **librarySectionStore loading**: Library card meta shows `—`
- **librarySectionStore empty**: Library card meta shows `No catalogue yet`
- **librarySectionStore error**: Library card meta shows `—` and the card still navigates to /library on click (where error UX is handled)

## Accessibility

- Hero CTA button: `<a href="mailto:..." role="button" class="...">` — anchor styled as button so right-click/middle-click work, and screen readers announce "link to mailto:..."
- `INVITE ONLY` stamps: `aria-hidden="true"` on the decorative stamp text; rely on the heading + body for invitation context
- Caveat marginalia: announced normally (semantic value of "already invited? sign in" matters); for purely-decorative marginalia like "EFK · the back office", `aria-hidden="true"`
- Pillar cards: `<button>` or `<a>` semantically; disabled pillars (coming/indev) use `<button disabled>` or `<a aria-disabled="true">`; status badges use `aria-label` for screen-reader context ("Library — shipped", "Roster — in development")
- Skip-link: not added in this CHORE (no such pattern elsewhere in mvox yet; defer to a later a11y pass)
- Color contrast: all ink-on-paper combinations pass WCAG AA at body sizes; ink-3 on paper-2 in marginalia is the most marginal — at Caveat 18-20px it's readable but borderline. Bentham gate may YELLOW this; PR can address by darkening to ink-2 if Bentham requests.

## Testing

Per the team TDD chain: Tallis writes specs first (RED), then Byrd implements (GREEN), then Comenius i18n, then Bentham review, then Josquin merge.

### Vitest unit specs (per component)

For each new component, the spec asserts:
- Renders without crashing on default props
- Renders i18n strings via the `m.*()` function (assert key invocation, not string equality — Tallis style)
- Branches on props correctly (e.g., `LandingPillarCard` renders correct status badge per status prop)
- `DashboardPillarCard` href omission ⇒ no anchor, button is non-interactive
- `LandingDashboard` consumes `selectedOrgStore` reactive value (assert text matches store mock)

### Page-level spec (`src/routes/+page.spec.ts`)

Replaces the existing page spec. Asserts:
- `loading` and `anonymous` userStore states ⇒ marketing renders (presence of hero CTA)
- `ready` userStore state ⇒ dashboard renders (presence of greeting headline)
- `mailto:` link href is exactly `mailto:hello@mvox.eu?subject=Invite%20request%20%E2%80%94%20mvox`
- All footer external links have `target="_blank"` and `rel="noopener noreferrer"`

### Coverage of CHORE-66 / CHORE-67 regression

- Tests assert that `MvoxNav` is NOT rendered by `LandingMarketing` / `LandingDashboard` (it's the layout's job; preserve no-double-render)
- Tests assert `librarySectionStore` is NOT mutated by the landing page (it only reads)

### Playwright (deferred to CHORE-C; not in scope here)

The CHORE-C MSW + Playwright bootstrap (plan exists at `docs/superpowers/plans/2026-05-23-chore-53-c-test-infra.md`) will cover end-to-end scroll + viewport tests. This CHORE does not add Playwright specs.

## Acceptance criteria

1. Visiting `/` while signed-out renders the 5-section marketing page on mobile (390px viewport) with all copy from "Copy" section above
2. Visiting `/` while signed-in renders the D1 dashboard composition with 4 pillar cards
3. The Library dashboard card shows real `worksCount · copiesCount · overdueCount` derived from `librarySectionStore` for the user's `selectedOrg`
4. The Library dashboard card's "overdue" segment renders in red+bold when `overdueCount > 0`
5. Roster / Notes / Repertoire pillar cards on the dashboard show SOON badges and are non-interactive (no navigation on click)
6. The hero "Request an invite" CTA opens the user's mail client with `mailto:hello@mvox.eu` and subject `Invite request — mvox`
7. The hero "already invited? sign in" link navigates to `/auth/login`
8. The footer locale picker shows EN / ET / LV / UK with the current locale visually active
9. All new strings present in `messages/en.json` and translated to et/lv/uk
10. 7 deprecated scaffold keys removed from all 4 locale files
11. `pnpm check`: 0 errors
12. `pnpm test:unit`: all green; new specs pass
13. `pnpm lint`: clean (biome + eslint)
14. `pnpm build`: clean Cloudflare adapter output
15. Bentham review: GREEN

## Mockup references (source of truth for positioning / rotations / dimensions)

Brainstorm visual companion saved exact pixel values, transform rotations, and color choices. Implementation MUST mirror these unless the implementer surfaces a deviation for PO/Bentham review.

| Brainstorm file | Shows |
|---|---|
| `.superpowers/brainstorm/21627-1780205921/content/02-mobile-A.html` | A1 vertical stack hero — exact rotations (-3°, +2.5°, -1°), card widths (300/310/340px at 390 viewport), stack offsets (-22px overlap), stamp angle (+8°), marginalia angle (-2°) |
| `.superpowers/brainstorm/21627-1780205921/content/03-full-page.html` | Full 5-section flow — pillars 2×2 grid spacing (14px gap, 208px card height), pillar individual rotations (-1.2°, +0.8°, +0.6°, -0.6°), wax-seal positioning (-28px above invites card), email-line styling (paper-2 + dashed ink-4), footer slab spacing |
| `.superpowers/brainstorm/21627-1780205921/content/04-signed-in-dashboard.html` | D1 dashboard — scattered card absolute positions (top:0,left:22px / top:100px,right:18px / top:220px,left:14px / top:330px,right:24px), individual rotations (-2°, +2.5°, -3°, +1.5°), 4 distinct left-border colors (red/amber/ink-3/ink-3) |

Implementer should read these files directly. They are NOT runtime artifacts — they're design references.

## Files touched (estimated)

| Status | File | Why |
|---|---|---|
| Rewrite | `src/routes/+page.svelte` | Orchestrator branches on userStore status |
| Unchanged | `src/routes/+page.server.ts` | Already an empty load |
| Unchanged | `src/routes/+layout.svelte` | MvoxNav stays |
| Rewrite | `src/routes/+page.spec.ts` | New assertions per acceptance |
| New | `src/lib/components/landing/LandingMarketing.svelte` | Signed-out wrapper |
| New | `src/lib/components/landing/LandingHero.svelte` | A1 hero |
| New | `src/lib/components/landing/LandingHero.spec.ts` | Tallis RED |
| New | `src/lib/components/landing/LandingPillarsSection.svelte` | What's inside |
| New | `src/lib/components/landing/LandingPillarsSection.spec.ts` | |
| New | `src/lib/components/landing/LandingPillarCard.svelte` | Pillar primitive |
| New | `src/lib/components/landing/LandingPillarCard.spec.ts` | |
| New | `src/lib/components/landing/LandingInvitesSection.svelte` | Wax-seal explainer |
| New | `src/lib/components/landing/LandingInvitesSection.spec.ts` | |
| New | `src/lib/components/landing/LandingRequestSection.svelte` | mailto: card |
| New | `src/lib/components/landing/LandingRequestSection.spec.ts` | |
| New | `src/lib/components/landing/LandingFooter.svelte` | Ink slab |
| New | `src/lib/components/landing/LandingFooter.spec.ts` | |
| New | `src/lib/components/landing/LandingDashboard.svelte` | Signed-in wrapper |
| New | `src/lib/components/landing/LandingDashboard.spec.ts` | |
| New | `src/lib/components/landing/LandingDashboardGreet.svelte` | Greeting block |
| New | `src/lib/components/landing/LandingDashboardGreet.spec.ts` | |
| New | `src/lib/components/landing/LandingDashboardScatter.svelte` | 4-card scattered layout |
| New | `src/lib/components/landing/LandingDashboardScatter.spec.ts` | |
| New | `src/lib/components/landing/DashboardPillarCard.svelte` | Dashboard pillar primitive |
| New | `src/lib/components/landing/DashboardPillarCard.spec.ts` | |
| Modified | `messages/en.json` | +41 new keys / -7 deprecated |
| Modified | `messages/et.json` | Comenius |
| Modified | `messages/lv.json` | Comenius |
| Modified | `messages/uk.json` | Comenius |
| Modified | `teams/mvox-dev/memory/i18n-conventions.md` | Document `_html`-suffix convention |

**Total: ~25 files. ~14 new components + specs, page rewrite + spec rewrite, 4 locale files, 1 memory file.**

## Schema impact

None. No new Entu entity types, no new properties, no new formulas, no rights changes. The dashboard reads existing `librarySectionStore` data populated by CHORE-67. No `Schema-Change:` commit trailer required.

## Open questions / deferred

- **`/about` route**: linked from footer but doesn't exist. Decision deferred to a follow-up CHORE; landing implementation renders the link with `href="#"` and a `data-todo="about-page"` attribute so it's `grep`-able later. Bentham may YELLOW this; expected.
- **`/roster`, `/notes`, `/repertoire` routes**: dashboard links to them disabled (per Component contracts above). When those CHOREs land, swap `disabled` → `href`.
- **Real form vs mailto:**: defer until CHORE-6 ships SPF/DKIM. Spec uses `mailto:`. Migration path: replace `LandingRequestSection`'s anchor with a `<form>` POST'ing to a CF Worker function calling Resend.
- **Time-of-day greeting**: out of scope; static "Welcome back". A future polish CHORE may add it.
- **Public catalog preview** (curious bystander browses a sample library without signing in): considered + rejected at Q3 (invite-only). Revisit if/when posture changes to open-beta.
- **Vertical-skin neutrality (binding constraint, not deferred)**: this CHORE is the first exemplar of the project-wide "Vertical-skin neutrality" rule landed in `teams/mvox-dev/memory/architecture-decisions.md` on 2026-05-31. All "choir" references in the landing copy MUST live in `messages/en.json` values, never in templates / component names / type names / file names / routes / comments. The i18n keys themselves stay vocabulary-neutral (`landing_hero_headline`, not `landing_hero_choir_headline`). Tallis RED-triggers and Bentham RED-triggers are specified in the architecture-decisions entry. See that entry for the full rule + violation/non-violation examples; this CHORE follows it by construction (all copy in messages, all components named neutrally).

## Related

- `feedback_mvox_visual_personality` — lean character-rich (drove Direction A pick at Q5)
- `feedback_mvox_hybrid_aesthetic` — Inter load-bearing, Caveat marginalia-only (drove font usage above)
- `feedback_ui_parallels_with_seed` — never ship skin-only pages (drove "redesign signed-in too" at Q11; dashboard consumes real Library counts)
- CHORE-60 (`docs/superpowers/specs/2026-05-23-library-page-ui-kit.md`) — UI kit + DeskSurface origin
- CHORE-66 (squash `9266e2e`) — userStore + selectedOrgStore + MvoxNav (consumed by signed-in dashboard)
- CHORE-67 (`docs/superpowers/specs/2026-05-24-chore-67-library-real-data-design.md`) — librarySectionStore (consumed for Library card meta)
- `architecture-decisions.md` "URL parameters override persisted state" — not directly applicable here (no URL params on `/`), but flagged for the dashboard if future iterations add e.g. `?welcome=true` modals

(*MVOX:Palestrina*)
