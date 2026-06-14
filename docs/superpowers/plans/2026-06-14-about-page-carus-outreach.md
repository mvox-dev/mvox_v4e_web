# About Page — Carus Outreach Implementation Plan

> **For agentic workers:** This plan is executed by the mvox-dev TDD chain (Tallis RED → Byrd GREEN → Comenius i18n → Bentham REVIEW → Josquin merge). Steps use checkbox (`- [ ]`) syntax for tracking. Only the current branch owner commits; ownership transfers via handoff message to team-lead.

**Goal:** Rewrite `/about` so it serves choirs AND works as public proof-of-devotion to the singer↔publisher relationship — the page the PO points Carus-Verlag to.

**Architecture:** Content-led change. Keep the existing `DeskSurface` / `PaperCard` / `Margin` scaffold and section structure (intro + Our Mission / Our Story / What We Believe + marginalia). Replace the three Lorem-ipsum bodies with real copy, add one intro "larger circle" line, a publisher offer block, and a contact line with a `mailto:` link. Real et/lv/uk translations replace the current `TODO:`/Lorem placeholders. No new components, no schema involvement.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, Tailwind v4, Paraglide i18n (en/et/lv/uk), Vitest (unit) + Playwright (E2E / bg-rule gate), Biome formatter.

**Source spec:** `docs/superpowers/specs/2026-06-14-about-page-carus-outreach-design.md` (+ gist `aa93f7e683174e9779bc59f5893f30a5`, cosmetic-only delta). PO-approved 2026-06-14.

**Branch:** `feat/about-carus`. **Deploy target this session: PREVIEW only** (push branch → CF auto-preview). Do NOT merge to `main` (= prod) without PO sign-off.

---

## Decisions locked at plan time (team-lead)

- **Contact line = `mailto:` link.** Resolves the spec's open item. The email `mihkel.putrinsh@gmail.com` is rendered as an `<a href="mailto:...">` with the address as literal link text. The email literal stays OUT of the message catalog (not translatable); only the lead-in phrase is a translated key.
- **No German.** en is canonical + publisher-facing; et/lv/uk fully translated.
- **Final en wording may be refined by Finn's tone report** (Carus/Sven correspondence). The copy below is the PO-approved draft direction and is the default; if Finn's report lands before GREEN, Byrd applies refinements that stay within this structure and voice. Tone target: sincere, plain, confident, warm — "quiet infrastructure" register. No defensiveness, no naming any partner/dispute.

## i18n key map (final shape — 12 keys)

| Key | Status | en value (target) |
|---|---|---|
| `about_page_title` | keep | `About mvox` |
| `about_intro` | keep | (current "back-of-house / quiet infrastructure" line) |
| `about_intro_circle` | **NEW** | `A choir sits inside a larger circle — singers, conductors, composers, and the publishers who carry their work into the world. mvox is built for that whole circle.` |
| `about_mission_heading` | keep | `Our Mission` |
| `about_mission_body` | **rewrite** | `Most music isn't copied out of disrespect. It's copied because, in the minutes before a rehearsal, the honest path is the hard one and the shortcut is right there. mvox exists to flip that — to make finding, holding, licensing, and sharing choral music simpler than not, so honouring the people who wrote and published it becomes the natural default.` |
| `about_story_heading` | keep | `Our Story` |
| `about_story_body` | **rewrite** | `We didn't start as a software company. We started as singers and organisers inside Estonia's choral world — and we've been on the wrong side of the line ourselves. We've shared scores when we shouldn't have, and learned, sometimes uncomfortably, what that costs the people whose living is the music. That discomfort is why mvox exists. We're not building it to defend a position; we're building it so that respecting a composer's and a publisher's work is the natural default, not an act of heroism.` |
| `about_values_heading` | keep | `What We Believe` |
| `about_values_body` | **rewrite** | `Every copy should be accounted for. Licensing should be easy enough that no one is tempted to skip it. A publisher should see their work respected — not wonder where it went.` |
| `about_values_offer` | **NEW** | `To publishers: mvox is being built to be the easiest place for choirs to do right by you. We'd rather design that with you than for you. This is our opening position — tell us where it's wrong, and help us define what "honest by default" should mean.` |
| `about_contact` | **NEW** | `Publishers and rights-holders: write to` (link text/email rendered separately) |
| `about_marginalia` | keep | `~ the mvox team` |

---

## Task 1 — RED (Tallis): failing tests for the new structure

**Files:**
- Modify: `src/routes/about/page.spec.ts` (unit, vitest + happy-dom)
- Verify (no edit): `tests/bg-rule.spec.ts` already covers `/about` — must stay green after GREEN phase.

The page mocks `$lib/paraglide/messages.js`. Update the mock to the real target copy AND add assertions for the new elements. Every assertion must be able to fail (no vacuous guards).

- [ ] **Step 1: Update the message mock + add failing assertions**

Replace the `vi.mock('$lib/paraglide/messages.js', ...)` block and the `describe` body in `src/routes/about/page.spec.ts` with:

```ts
vi.mock('$lib/paraglide/messages.js', () => ({
	about_page_title: () => 'About mvox',
	about_intro: () =>
		'mvox is the back-of-house for choral organisations. We build the quiet infrastructure that keeps a choir running: its library, its roster, its rehearsal record.',
	about_intro_circle: () =>
		'A choir sits inside a larger circle — singers, conductors, composers, and the publishers who carry their work into the world. mvox is built for that whole circle.',
	about_mission_heading: () => 'Our Mission',
	about_mission_body: () =>
		"Most music isn't copied out of disrespect. It's copied because, in the minutes before a rehearsal, the honest path is the hard one and the shortcut is right there. mvox exists to flip that — to make finding, holding, licensing, and sharing choral music simpler than not, so honouring the people who wrote and published it becomes the natural default.",
	about_story_heading: () => 'Our Story',
	about_story_body: () =>
		"We didn't start as a software company. We started as singers and organisers inside Estonia's choral world — and we've been on the wrong side of the line ourselves.",
	about_values_heading: () => 'What We Believe',
	about_values_body: () =>
		'Every copy should be accounted for. Licensing should be easy enough that no one is tempted to skip it. A publisher should see their work respected — not wonder where it went.',
	about_values_offer: () =>
		"To publishers: mvox is being built to be the easiest place for choirs to do right by you. We'd rather design that with you than for you.",
	about_contact: () => 'Publishers and rights-holders: write to',
	about_marginalia: () => '~ the mvox team',
}));
```

Then add these tests inside the `describe('/about page', ...)` block (keep the existing 5 passing tests for title/headings/intro):

```ts
it('renders the intro "larger circle" lens line', () => {
	const { container } = render(AboutPage);
	const el = container.querySelector('[data-testid="about-intro-circle"]');
	expect(el).not.toBeNull();
	expect(el?.textContent).toContain('whole circle');
});

it('renders the honest-path mission body (no Lorem placeholder)', () => {
	const { container } = render(AboutPage);
	const text = container.querySelector('[data-testid="about-mission-body"]')?.textContent ?? '';
	expect(text).toContain('honest path');
	expect(text.toLowerCase()).not.toContain('lorem ipsum');
});

it('renders the own-a-misstep story body (no Lorem placeholder)', () => {
	const { container } = render(AboutPage);
	const text = container.querySelector('[data-testid="about-story-body"]')?.textContent ?? '';
	expect(text).toContain('wrong side of the line');
	expect(text.toLowerCase()).not.toContain('lorem ipsum');
});

it('renders the belief baseline body (no Lorem placeholder)', () => {
	const { container } = render(AboutPage);
	const text = container.querySelector('[data-testid="about-values-body"]')?.textContent ?? '';
	expect(text).toContain('Every copy should be accounted for');
	expect(text.toLowerCase()).not.toContain('lorem ipsum');
});

it('renders the publisher offer block', () => {
	const { container } = render(AboutPage);
	const el = container.querySelector('[data-testid="about-values-offer"]');
	expect(el).not.toBeNull();
	expect(el?.textContent).toContain('design that with you');
});

it('renders a mailto contact link for publishers', () => {
	const { container } = render(AboutPage);
	const link = container.querySelector(
		'[data-testid="about-contact"] a',
	) as HTMLAnchorElement | null;
	expect(link).not.toBeNull();
	expect(link?.getAttribute('href')).toBe('mailto:mihkel.putrinsh@gmail.com');
	expect(link?.textContent).toContain('mihkel.putrinsh@gmail.com');
});
```

- [ ] **Step 2: Run the unit test, verify the NEW tests fail**

Run: `pnpm test:unit -- src/routes/about/page.spec.ts`
Expected: the 6 new tests FAIL (elements `about-intro-circle`, `about-mission-body`, `about-story-body`, `about-values-body`, `about-values-offer`, `about-contact a` don't exist yet — the current page has bodies but no `data-testid` on them and no circle/offer/contact). The 5 original tests still PASS.

- [ ] **Step 3: Commit RED**

```bash
git add src/routes/about/page.spec.ts
git commit -m "test(about): RED — failing tests for Carus-outreach structure"
```

- [ ] **Step 4: Handoff to Byrd** (message team-lead: TESTS_WRITTEN, branch `feat/about-carus`).

---

## Task 2 — GREEN (Byrd): wire the page + en keys

**Files:**
- Modify: `messages/en.json` (add `about_intro_circle`, `about_values_offer`, `about_contact`; rewrite `about_mission_body`, `about_story_body`, `about_values_body`)
- Modify: `src/routes/about/+page.svelte`

- [ ] **Step 1: Add/rewrite en keys** in `messages/en.json` using the en target values from the key map table above. Keep flat alphabetical-ish placement consistent with the file. Do NOT touch et/lv/uk yet (Comenius owns those in Task 3).

- [ ] **Step 2: Wire `src/routes/about/+page.svelte`.** Add `data-testid` to the three body paragraphs, add the intro circle line under the existing intro, add the offer block + contact line inside the "What We Believe" section. All new text stays inside `PaperCard` (colored bg → bg-rule conformant). Target structure:

```svelte
<!-- inside the intro block, after the existing about-intro <p> -->
<p
	data-testid="about-intro-circle"
	class="font-sans text-[13px] text-ink-2 leading-relaxed mt-2"
>
	{m.about_intro_circle()}
</p>
```

```svelte
<!-- mission section body -->
<p data-testid="about-mission-body" class="font-sans text-[13px] text-ink-2 leading-relaxed">
	{m.about_mission_body()}
</p>
```

```svelte
<!-- story section body -->
<p data-testid="about-story-body" class="font-sans text-[13px] text-ink-2 leading-relaxed">
	{m.about_story_body()}
</p>
```

```svelte
<!-- What We Believe section: body + offer + contact -->
<p data-testid="about-values-body" class="font-sans text-[13px] text-ink-2 leading-relaxed">
	{m.about_values_body()}
</p>
<p
	data-testid="about-values-offer"
	class="font-sans text-[13px] text-ink-2 leading-relaxed mt-3 border-l-2 border-ink/15 pl-3"
>
	{m.about_values_offer()}
</p>
<p data-testid="about-contact" class="font-sans text-[13px] text-ink-2 leading-relaxed mt-3">
	{m.about_contact()}
	<a href="mailto:mihkel.putrinsh@gmail.com" class="text-ink underline underline-offset-2"
		>mihkel.putrinsh@gmail.com</a
	>
</p>
```

> The offer block uses a subtle left-border lift (`border-l-2 border-ink/15 pl-3`) — a visual accent that keeps the text on the paper bg (bg-rule safe; no `data-desk-text` needed since it sits on PaperCard).

- [ ] **Step 3: Run unit tests, verify all pass**

Run: `pnpm test:unit -- src/routes/about/page.spec.ts`
Expected: all 11 tests PASS.

- [ ] **Step 4: Run type check + the bg-rule E2E gate**

Run: `pnpm check` → expect 0 errors.
Run: `pnpm test:e2e -- tests/bg-rule.spec.ts` → expect `/about` still GREEN (all new text is on PaperCard).

- [ ] **Step 5: Format (Biome — NOT Prettier) + commit GREEN**

```bash
pnpm format
git add messages/en.json src/routes/about/+page.svelte
git commit -m "feat(about): GREEN — Carus-outreach content + en keys + mailto contact"
```

- [ ] **Step 6: Handoff to Comenius** (message team-lead: TESTS_PASSING).

---

## Task 3 — i18n (Comenius): real et/lv/uk translations

**Files:**
- Modify: `messages/et.json`, `messages/lv.json`, `messages/uk.json`

Current state: et/lv/uk have `about_intro` = `"TODO: <english>"` and the three bodies are still Lorem-ipsum English. This is genuine translation work, not sync.

- [ ] **Step 1: Translate all `about_*` keys** into et, lv, uk — including the rewritten bodies and the three new keys (`about_intro_circle`, `about_values_offer`, `about_contact`). Remove every `TODO:` prefix and all Lorem-ipsum. Estonian (`et`) is the priority locale for the choral audience; preserve the sincere/plain/warm register. The email literal is NOT in the catalog, so no email appears in `about_contact` — translate only the lead-in phrase ("write to" equivalent), keeping it grammatically correct before an inline email link.

- [ ] **Step 2: Verify 4-locale key parity**

Run:
```bash
for l in en et lv uk; do echo -n "$l: "; jq -r '[to_entries[]|select(.key|startswith("about_"))|.key]|sort|join(",")' messages/$l.json; done
```
Expected: identical key set across all 4 (12 `about_*` keys each), and no `TODO:` / `Lorem` strings remain:
```bash
grep -RlE 'TODO:|[Ll]orem ipsum' messages/{et,lv,uk}.json && echo "STILL HAS PLACEHOLDERS — fix" || echo "clean"
```

- [ ] **Step 3: Type check + format + commit i18n**

```bash
pnpm check
pnpm format
git add messages/et.json messages/lv.json messages/uk.json
git commit -m "i18n(about): real et/lv/uk translations for Carus-outreach copy"
```

- [ ] **Step 4: Handoff to Bentham** (message team-lead: I18N_COMPLETE).

---

## Task 4 — REVIEW (Bentham): verdict

- [ ] Review the full diff on `feat/about-carus` (tip SHA in handoff). Check:
  - **Tone/intent:** sincere, plain, warm; no defensiveness; NO naming of Carus / Tormis / Sven / any dispute on the public page.
  - **bg-rule conformance:** all new `/about` text on a colored bg; `tests/bg-rule.spec.ts` green; no spurious `data-desk-text`.
  - **i18n completeness:** AUTHORED-BUT-DEAD-I18N audit — all 4 locales have all 12 `about_*` keys, no `TODO:`/Lorem residue, et/lv/uk are real translations not English copies.
  - **TDD compliance:** Tallis's tests committed before/with implementation; the 6 new assertions are non-vacuous.
  - **No schema involvement** (none expected → no Schema-Change trailer needed).
- [ ] Emit RED/YELLOW/GREEN with rationale + who acts on any RED. Handoff to team-lead.

---

## Task 5 — Preview deploy (team-lead) — NO prod merge

- [ ] After Bentham GREEN: push `feat/about-carus` to origin → Cloudflare auto-builds a **preview** URL.

```bash
git push -u origin feat/about-carus
```

- [ ] Capture the CF preview URL (Pages auto-preview for the branch). Curl it to confirm 200 + the new content is live.
- [ ] Report preview URL + chain summary to PO. **STOP — do not merge to `main`** (that auto-deploys prod) until PO signs off on the preview.

---

## Self-review (team-lead, against spec)

- **Spec §Structure (5 blocks):** intro + circle line (Task 2) ✓; mission honest-path (key map) ✓; story own-a-misstep, no names (key map + Bentham check) ✓; What We Believe baseline + offer (Task 2) ✓; contact line mailto (decisions + Task 2) ✓; marginalia kept ✓.
- **Spec §i18n:** en canonical, et/lv/uk real translations, no German (Task 3) ✓; 3 new keys + 3 rewrites (key map) ✓.
- **Spec §Technical:** content-led, no new components ✓; bg-rule conformance (Task 2 step 4, Task 4) ✓; no schema ✓.
- **Spec open items:** mailto resolved (locked decision) ✓; Carus/Sven tone read → Finn report feeds en polish before/at GREEN ✓.
- **Type consistency:** testids `about-intro-circle` / `about-mission-body` / `about-story-body` / `about-values-body` / `about-values-offer` / `about-contact` used identically in Tasks 1 and 2 ✓.

(*MVOX:Palestrina*)
