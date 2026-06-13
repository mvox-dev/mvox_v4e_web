# S33 — UI/UX Cleanup: Readability + Navigation

**Status:** Design approved (PO, 2026-06-13). Ready for implementation plan.
**Author:** (*MVOX:Palestrina*)
**Scope:** Two goals — (1) **readability** over the wood-grain desk, (2) **navigation** that's honest about what works and what's still coming. No new product features; no v4E schema change.

---

## 1. Background

mvox renders all content pages on a warm wood-grain desk (`DeskSurface.svelte`, pure-CSS animated gradient). A comprehensive audit (S33, 9-agent workflow + adversarial verifier) found ~32 places where text renders **directly on the wood-grain** with no colored-background ancestor, and a navigation bar where most tabs don't actually navigate. This spec fixes both.

The work is grounded by, but not limited to, the live audit. The runtime Playwright check (§4.3) is the authoritative arbiter of conformance — static analysis missed/over-flagged a few (e.g. it wrongly flagged `ConductorPanel`, which actually has a `#fbf9f3` panel).

---

## 2. The background-readability rule (new standing invariant)

> **Every text item must sit on a colored background (a non-transparent `background-color`, opacity negotiable per case) somewhere in its parent chain — EXCEPT (a) intentional marginalia and (b) big/display titles, which may sit directly on the desk.**

- **Exceptions are explicit and auditable.** An exempt element (or its nearest meaningful wrapper) carries a `data-desk-text` attribute. This is the opt-out the enforcement tooling and reviewer key off.
  - **Marginalia** = handwritten-Caveat desk notes (the deliberate "annotation on the desk" aesthetic).
  - **Big/display titles** = large page/hero headings (e.g. the 30px agenda `.page-title`, hero headings, pillars `h2`). Small decorative eyebrows / mono labels are NOT automatically titles — Bentham's judgment: tag as marginalia or give a chip background.
- **Opacity is negotiable.** A semi-transparent paper background (e.g. the agenda header at `rgba(251,249,243,0.8)`) satisfies the rule.
- **Misuse of `data-desk-text` is a review blocker.** Bentham REDs any use of the marker on text that is neither genuine marginalia nor a big title.

---

## 3. Navigation cleanup

The nav (`MvoxNav.svelte`) declares six tabs in order: **Agenda · Library · Roster · Notices · Settings · Rehearsals** (`nav_tab_rehearsals` → `/seasons`). Today only Agenda + Rehearsals are real links (desktop); the rest are dead `<span>`s, the mobile menu navigates nowhere, and the active-tab highlight is wrong for `/seasons`.

### 3.1 Make every real page reachable & clickable

1. **Library → real link.** Render Library as `<a href="/library">` (it's a working page wrongly rendered as a `<span>`). Keep the librarian chip behavior.
2. **Fix the mobile hamburger menu.** Every menu item is currently a non-navigating `<div role="menuitem">`. Real tabs (Agenda, Library, Rehearsals) become `<a>` links; unbuilt tabs get the same "soon" treatment as desktop and link to their placeholder page.
3. **Fix the active-tab highlight.** `currentTab` (in `+layout.svelte`) has no `/seasons` branch and falls through to `agenda`, so visiting Rehearsals highlights Agenda. Rewrite so each path highlights its own tab: `/agenda`→agenda, `/library`→library, `/roster`→roster, `/notices`→notices, `/settings`→settings, `/seasons`→rehearsals.

### 3.2 Unbuilt tabs — mark + placeholder pages

Roster, Notices, Settings have **no routes**. Per PO decision:

- **Tab marker:** rendered as clickable links with a **handwritten "soon" marginalia** marker (Caveat script, amber `--color-amber`, slight `rotate(-6deg)`) beside the muted label. Applies on desktop inline tabs AND the mobile menu.
- **Placeholder pages:** create three new routes `/roster`, `/notices`, `/settings`, each rendering an **informative "coming soon" page** on the desk, in a paper card:
  - Section label (small uppercase) + name (reuse `nav_tab_roster|notices|settings`) + a one-line description + a handwritten "coming soon" + a "‹ Back to Agenda" link.
  - Descriptions (en):
    - Roster: "See who sings in your choir — sections, voice parts, and contact details."
    - Notices: "Announcements and messages for your choir."
    - Settings: "Your account and preferences."

### 3.3 About reachability

`/about` is orphaned once signed in (footer only renders on the logged-out landing). Add an **"About"** item to the `AvatarMenu` dropdown (alongside "Sign out"), linking to `/about`.

---

## 4. Readability cleanup

### 4.1 Wood-grain orbit → 12-point (resolution 12)

Replace the three 4-stop `@keyframes` in `DeskSurface.svelte` (cardinal-only → square path) with 13-stop versions (every 30°, near-circle). Radius `r=10px` and per-layer phase offsets (layer1=0°, layer2=120°, layer3=240°) preserved; `.wood-bg` initial phase values unchanged. Exact CSS (computed + verified to hold r=10px at every stop):

```css
/* LAYER 1: 12-point orbit (phase = 0°) */
@keyframes wood-orbit1 {
	0%       { --dx1: 10.00px;  --dy1: 0.00px;  }
	8.333%   { --dx1: 8.66px;   --dy1: 5.00px;  }
	16.667%  { --dx1: 5.00px;   --dy1: 8.66px;  }
	25%      { --dx1: 0.00px;   --dy1: 10.00px; }
	33.333%  { --dx1: -5.00px;  --dy1: 8.66px;  }
	41.667%  { --dx1: -8.66px;  --dy1: 5.00px;  }
	50%      { --dx1: -10.00px; --dy1: 0.00px;  }
	58.333%  { --dx1: -8.66px;  --dy1: -5.00px; }
	66.667%  { --dx1: -5.00px;  --dy1: -8.66px; }
	75%      { --dx1: 0.00px;   --dy1: -10.00px;}
	83.333%  { --dx1: 5.00px;   --dy1: -8.66px; }
	91.667%  { --dx1: 8.66px;   --dy1: -5.00px; }
	100%     { --dx1: 10.00px;  --dy1: 0.00px;  }
}
/* LAYER 2: 12-point orbit (phase = 120°) */
@keyframes wood-orbit2 {
	0%       { --dx2: -5.00px;  --dy2: 8.66px;  }
	8.333%   { --dx2: -8.66px;  --dy2: 5.00px;  }
	16.667%  { --dx2: -10.00px; --dy2: 0.00px;  }
	25%      { --dx2: -8.66px;  --dy2: -5.00px; }
	33.333%  { --dx2: -5.00px;  --dy2: -8.66px; }
	41.667%  { --dx2: 0.00px;   --dy2: -10.00px;}
	50%      { --dx2: 5.00px;   --dy2: -8.66px; }
	58.333%  { --dx2: 8.66px;   --dy2: -5.00px; }
	66.667%  { --dx2: 10.00px;  --dy2: 0.00px;  }
	75%      { --dx2: 8.66px;   --dy2: 5.00px;  }
	83.333%  { --dx2: 5.00px;   --dy2: 8.66px;  }
	91.667%  { --dx2: 0.00px;   --dy2: 10.00px; }
	100%     { --dx2: -5.00px;  --dy2: 8.66px;  }
}
/* LAYER 3: 12-point orbit (phase = 240°) */
@keyframes wood-orbit3 {
	0%       { --dx3: -5.00px;  --dy3: -8.66px; }
	8.333%   { --dx3: 0.00px;   --dy3: -10.00px;}
	16.667%  { --dx3: 5.00px;   --dy3: -8.66px; }
	25%      { --dx3: 8.66px;   --dy3: -5.00px; }
	33.333%  { --dx3: 10.00px;  --dy3: 0.00px;  }
	41.667%  { --dx3: 8.66px;   --dy3: 5.00px;  }
	50%      { --dx3: 5.00px;   --dy3: 8.66px;  }
	58.333%  { --dx3: 0.00px;   --dy3: 10.00px; }
	66.667%  { --dx3: -5.00px;  --dy3: 8.66px;  }
	75%      { --dx3: -8.66px;  --dy3: 5.00px;  }
	83.333%  { --dx3: -10.00px; --dy3: 0.00px;  }
	91.667%  { --dx3: -8.66px;  --dy3: -5.00px; }
	100%     { --dx3: -5.00px;  --dy3: -8.66px; }
}
```

### 4.2 Bring text into conformance

Apply the §2 rule. Solution favors **wrapping containers** (a card/panel) over per-element backgrounds.

**A. Genuine bugs (highest priority):**
- `auth/callback/+page.svelte`, `auth/[provider]/+page.svelte` — do not wrap in DeskSurface; bare `text-gray-600/red-600/blue-600`. Wrap content in DeskSurface + a paper card. (Also: these use raw Tailwind grays instead of theme tokens — switch to `text-ink-*`.)
- `library/+page.svelte` — `library-loading` (l.216) and `library-error` (l.227) reference CSS classes that **don't exist**. Give them styled paper containers (mirror an existing state-message style).
- Loose **state messages**: agenda `.state-msg` (loading / no-orgs), seasons `.state-msg` (loading/error/empty), `RsvpControl` `.not-member-hint`, `LibraryMobileList` empty/no-results — put each on a paper chip/container.

**B. Content surfaces:**
- **Agenda list** (`AgendaList.svelte`): restyle to **one paper card per day** (PO choice C) — each date group is a card whose header is the date; that day's rehearsal rows render inside. The big `.page-title` "Agenda" stays on the desk (exempt, `data-desk-text`). All row text (time/duration/name/location/tally/date-header) is now inside the per-day card → conforms.
- **Seasons forms** (`SeasonForm`, `SeriesForm`, `RehearsalEditForm`): wrap each form in a panel (precedent: `ConductorPanel`'s `#fbf9f3` panel) so headings, field labels, and field errors sit on paper. `RehearsalList` group-headers and empty-text get a container too.
- **Library mobile list** (`LibraryMobileList.svelte`): wrap rows + empty-state in a paper container; the mobile back link (`LibraryMasterDetail`) gets a colored-bg ancestor.

**C. Exemptions (tag `data-desk-text`, leave on desk):**
- Marginalia: `LandingInvitesSection`, `LandingRequestSection`, `LandingHero` "already invited" line, `LandingDashboardGreet` marginalia, `LibraryEmptyState` `.empty-marginalia`.
- Big titles: agenda `.page-title`, landing hero heading, `LandingPillarsSection` `h2`, `LandingDashboardGreet` `h1`. (Eyebrows/mono labels: reviewer's call — tag or chip.)

### 4.3 Enforcement — hybrid gate (PO decision)

- **Automated:** a reusable **Playwright** test that, for each renderable route, walks the DOM: for every element with direct text, climb ancestors checking `getComputedStyle().backgroundColor` (alpha > 0) or a background-image *before* reaching the `.wood-bg` desk element; **skip** elements with `data-desk-text`. Fail with the offending selector. Wired this session for the **public routes we can render** (`/`, `/about`, `/auth/login`, the three new placeholder pages). (jsdom can't compute styles — this must be Playwright, per L118.)
- **Manual backstop:** Bentham REDs any new bare-text-on-desk and any misuse of `data-desk-text`. Coverage of signed-in empty-states grows automatically as the CHORE-C data-mock harness lands (out of scope here).

---

## 5. i18n (Comenius)

New keys (× en/et/lv/uk). Reuse existing `nav_tab_roster|notices|settings` as placeholder page titles.

| Key | en value |
|---|---|
| `page_coming_soon_label` | "Coming soon" |
| `page_coming_soon_back_to_agenda` | "Back to Agenda" |
| `page_roster_description` | "See who sings in your choir — sections, voice parts, and contact details." |
| `page_notices_description` | "Announcements and messages for your choir." |
| `page_settings_description` | "Your account and preferences." |
| `nav_menu_about` | "About" |

Existing nav keys already present (no change): `nav_tab_agenda/library/roster/notices/settings/rehearsals`, `nav_chip_librarian`, `nav_sign_in/out`, `nav_signed_in_as`, `nav_menu_open`, `nav_org_picker_placeholder/switch_to`, `nav_user_menu_aria`.

---

## 6. Out of scope / deferred

- **Full automated bg-rule coverage** of signed-in empty-states — blocked on CHORE-C data-mock harness; Bentham backstops meanwhile.
- **Hardcoded `#293556`** avatar-chip hex (MvoxNav + OrgPicker ×4) → theme token: nice-to-have polish; include only if cheap, else file a YELLOW follow-up.
- No new product features (Roster/Notices/Settings remain placeholders). No v4E schema change.

---

## 7. Acceptance criteria

**Navigation:**
- [ ] Library, Agenda, Rehearsals are clickable `<a>` links on desktop AND in the mobile menu, all navigating correctly.
- [ ] Roster/Notices/Settings show the handwritten "soon" marker (desktop + mobile) and link to their placeholder page.
- [ ] `/roster`, `/notices`, `/settings` each render the informative coming-soon page (label + name + description + "coming soon" + Back to Agenda), all strings localized.
- [ ] The active-tab highlight matches the current route for all six tabs (esp. `/seasons` → Rehearsals).
- [ ] "About" appears in the avatar menu and navigates to `/about`.

**Readability:**
- [ ] `DeskSurface` orbit uses the 12-point keyframes; animation visibly smoother (near-circular); no regression in the fixed-attachment desk.
- [ ] Agenda list renders as one paper card per day; all row/date text sits on paper.
- [ ] Seasons forms, library mobile list, all state/loading/error/hint messages, and the auth callback/provider pages sit on a colored background.
- [ ] Only genuine marginalia + big titles remain on the desk, each tagged `data-desk-text`.
- [ ] The Playwright bg-rule check passes for all public routes and fails loudly on an injected bare-text element.

**Gates:** `pnpm check` 0 · `pnpm test` green · Bentham GREEN.

---

## 8. Implementation notes

- **One feature branch**, single-tree protocol (no worktrees, no parallel branches). This spec + the plan commit to `main` BEFORE the branch is created.
- TDD chain: Tallis RED → Byrd (components/routes/CSS) + Josquin (any server/route plumbing for the new pages) GREEN → Comenius (i18n) → Bentham (review, incl. `data-desk-text` policing + Playwright check) → Josquin merge.
- Likely sequenced as a few sub-chains given breadth (nav+placeholders; orbit; agenda per-day cards; seasons/library/auth conformance + the Playwright gate). The plan decides the task breakdown.
- Preview-deploy → PO live-check before any prod consideration. Production `mvox.eu` untouched unless PO explicitly approves.
