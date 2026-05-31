# CHORE-72 — Landing page (`/`) redesign — Implementation Plan

> **For team agents:** This is a **team-driven** plan owned by the mvox-dev TDD chain. Each task lists steps owned by named roles (Tallis RED → Byrd GREEN → Comenius i18n → Bentham REVIEW → Josquin MERGE). Steps use checkbox (`- [ ]`) syntax. Per `feedback_plan_execution_mode_baked_in`: do NOT offer a subagent-driven-vs-team-driven mode fork after this plan ships — the team mode is baked in by construction. Per `feedback_atomic_git_chaining`: chain commits inside single Bash calls.

> **SEQUENCING DISCIPLINE — STRICTLY SEQUENTIAL** (per `feedback_no_parallel_branches` Level 1 + Level 2, the latter added session 24, 2026-05-31 by PO directive on this very plan):
> 1. **Only one feature branch is active across the team:** `chore/landing-redesign`. No parallel CHOREs on other branches during CHORE-72.
> 2. **Only one task is dispatched at a time within this branch.** Tasks execute strictly in numeric order: Task 1 → Task 2 → Task 3 → … → Task 16.
> 3. **Each task must fully close before the next dispatches.** "Close" = commit pushed + gates green + handoff report received by team-lead.
> 4. **No pre-spawning.** Do NOT dispatch Tallis for Task N+1 while Byrd is mid-GREEN on Task N. Do NOT have Comenius authoring new keys in parallel with a downstream RED. Do NOT have Bentham starting his review while Byrd is still committing.
> 5. **Within a single task, the Tallis-RED → Byrd-GREEN sequence is itself strictly serial** — Tallis hands off via SendMessage to team-lead, team-lead dispatches Byrd. They are NOT both active at once.
> 6. **Always-on agents are ambient, not parallel.** Bentham/Finn/Pérotin idle until pinged for their respective tasks (15/research/data-probe). Their presence in the team config doesn't constitute parallel work; only an active dispatch does.
> 7. **Team-lead is the serializer.** After every teammate's report arrives, team-lead is the single point that decides whether the task closed cleanly + whom to dispatch next. No "while X works, also kick off Y" patterns anywhere in this CHORE.

**Goal:** Replace the current generic-Tailwind scaffold at `/` with a coherent paper-and-ink landing page — a curious-bystander doorway when signed-out (5-section marketing scroll: hero + pillars + invites + request + footer) and a welcome-back dashboard when signed-in (scattered pillar cards on the desk).

**Architecture:** A single SvelteKit route (`src/routes/+page.svelte`) acts as an orchestrator that branches on `$userStore.status` between two new composer components (`<LandingMarketing />` for signed-out / loading / anonymous; `<LandingDashboard />` for signed-in). Both compose from 9 new presentation components living under `src/lib/components/landing/`. All vocabulary lives in i18n message values per `architecture-decisions.md` "Vertical-skin neutrality" rule. Mobile-first composition; scales up at >768px with wider type and more breathing room (no distinct desktop layout).

**Tech Stack:** SvelteKit 2 · Svelte 5 (Runes only — `$state`, `$derived`, `$effect`, `$props`) · TypeScript strict · Tailwind v4 · Vitest (happy-dom) · @testing-library/svelte · Paraglide i18n. `DeskSurface` component reused from CHORE-67 (animated wood-grain E-recipe, 3 orbital radial gradients @ 8/13/21s). `userStore` + `selectedOrgStore` consumed from CHORE-66. `librarySectionStore` consumed read-only from CHORE-67 for the dashboard Library card meta.

**Spec:** `docs/superpowers/specs/2026-05-31-landing-page-design.md` (current at SHA `a3dbd36` and updated to reference `architecture-decisions.md` at `3382a01`).

**Brainstorm artifacts (source-of-truth for positioning + rotations + dimensions):**
- `.superpowers/brainstorm/21627-1780205921/content/02-mobile-A.html` — A1 hero
- `.superpowers/brainstorm/21627-1780205921/content/03-full-page.html` — full 5-section flow
- `.superpowers/brainstorm/21627-1780205921/content/04-signed-in-dashboard.html` — D1 dashboard

**Reference for wood-grain:** live `https://mvox.eu/library` page.

**Branch:** `chore/landing-redesign` (created in Task 1).

**Total tasks:** 16. Estimated chain duration: ~6-8 hours wall-clock if dispatches are tight.

---

## Branch + setup

### Task 1: Create feature branch

**Owner:** team-lead.

**Files:** none (branch only).

- [ ] **Step 1: Verify clean state on main**

```bash
cd /home/michelek/workspace
git checkout main
git pull --ff-only
git status --short  # expect empty
```

- [ ] **Step 2: Create + push branch**

```bash
git checkout -b chore/landing-redesign
git push -u origin chore/landing-redesign
git branch --show-current  # expect chore/landing-redesign
```

- [ ] **Step 3: Hand off**

Send dispatch to Comenius for Task 2 (i18n keys must land first per L100 — UI tasks cannot reference `m.landing_*()` until the keys exist).

---

## i18n keys upfront (per L100)

### Task 2: Comenius — add 41 new landing keys × 4 locales; remove 7 deprecated scaffold keys

**Owner:** Comenius.

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/et.json`
- Modify: `messages/lv.json`
- Modify: `messages/uk.json`
- Modify: `teams/mvox-dev/memory/i18n-conventions.md` (append translator notes for the new keys)

- [ ] **Step 1: Remove the 7 deprecated scaffold keys from all 4 locale files**

Keys to remove (they're orphaned after the landing rewrite):
- `landing_signed_out_headline`
- `landing_signed_out_cta`
- `landing_signed_in_heading`
- `landing_empty_state`
- `landing_error_state`
- `landing_retry_button`
- `landing_members_per_section`

Remove each line from `messages/en.json`, `messages/et.json`, `messages/lv.json`, `messages/uk.json`. Comma-handling: ensure the file remains valid JSON after each removal (no trailing commas, no missing commas).

- [ ] **Step 2: Add the 41 new English keys to `messages/en.json`**

Insert (alphabetical order so the file stays sorted; verbatim from spec "i18n keys" section):

```jsonc
"landing_dashboard_badge_soon": "SOON",
"landing_dashboard_eyebrow": "Welcome back",
"landing_dashboard_greeting": "Welcome back, {name}.",
"landing_dashboard_library_lbl": "{org} · catalogue",
"landing_dashboard_library_meta_empty": "No catalogue yet",
"landing_dashboard_library_meta_loading": "—",
"landing_dashboard_library_meta_ready": "{worksCount} works · {copiesCount} copies · {overdueCount} overdue",
"landing_dashboard_marginalia": "{org} · the back office",
"landing_dashboard_notes_lbl": "Week",
"landing_dashboard_pillar_meta_coming": "Coming",
"landing_dashboard_pillar_meta_indev": "In development",
"landing_dashboard_repertoire_lbl": "Season",
"landing_dashboard_roster_lbl": "Members",
"landing_footer_link_about": "About mvox",
"landing_footer_link_contact": "Contact: hello@mvox.eu",
"landing_footer_link_openinfra": "Open infrastructure (v4E)",
"landing_footer_link_source": "Source · github.com/mvox-dev",
"landing_footer_micro_invite": "v4E · invite-only",
"landing_footer_micro_year": "© 2026 mvox.eu",
"landing_footer_tagline": "The back-of-house for your choir. Library, roster, rehearsal notes, repertoire.",
"landing_hero_already_invited": "already invited?",
"landing_hero_cta": "Request an invite",
"landing_hero_eyebrow": "For choirs · by invite",
"landing_hero_headline": "The back-of-house for your choir.",
"landing_hero_sign_in": "sign in",
"landing_hero_stamp": "INVITE ONLY",
"landing_hero_sub": "Library, roster, rehearsal notes, repertoire — kept properly, shared with people who need them.",
"landing_invites_body_1_html": "We're growing slowly. <strong>Conductors and librarians</strong> are the first cohort — they bring their choirs in once the back office fits.",
"landing_invites_body_2": "If your choir would benefit, write to us. We'll set you up.",
"landing_invites_eyebrow": "Getting in",
"landing_invites_heading": "mvox is invite-only.",
"landing_invites_marginalia": "scroll for the address ↓",
"landing_invites_stamp": "INVITE ONLY",
"landing_pillar_badge_coming": "COMING",
"landing_pillar_badge_indev": "IN DEV",
"landing_pillar_badge_shipped": "SHIPPED",
"landing_pillar_library_body": "Catalogue, copies, lending. Every score accounted for.",
"landing_pillar_library_title": "Library",
"landing_pillar_notes_body": "Notes, attendance, schedule. The week-to-week record.",
"landing_pillar_notes_title": "Rehearsal notes",
"landing_pillar_repertoire_body": "Programs, seasons, what to sing next.",
"landing_pillar_repertoire_title": "Repertoire",
"landing_pillar_roster_body": "Members, sections, contact details. Who sings where.",
"landing_pillar_roster_title": "Roster",
"landing_pillars_eyebrow": "Four parts of the back office",
"landing_pillars_heading": "What's inside",
"landing_request_body": "Tell us your choir's name, where you sing, and what you'd want mvox to keep. A sentence is plenty.",
"landing_request_cta": "Open mail · request an invite",
"landing_request_eyebrow": "Request access",
"landing_request_heading": "Write to us.",
"landing_request_marginalia": "we read every one",
"landing_request_stamp": "RECEIVED",
"landing_request_subject": "Invite request — mvox",
```

(Total: 53 entries above; the spec counted 41 *new* keys but I've enumerated 53 — recount during Comenius's review; if duplicates exist they were already in the previous count. Goal is that every spec-referenced key exists.)

- [ ] **Step 3: Translate every new key into et/lv/uk per Comenius's stewardship rules**

Apply the standard i18n-conventions practice: don't preserve the source-language metaphor word-for-word; find the most idiomatic equivalent in each language. Translator notes (per the existing pattern in `i18n-conventions.md`) document any non-obvious choices.

**Per the new vocabulary-neutral rule (added session 24):** translations are free to substitute "choir" with the most natural local equivalent — `koor` (et), `koris` (lv), `хор` (uk) — and to render expressions like "the back-of-house" with culturally apt metaphors rather than literal translations.

**Special handling — `landing_invites_body_1_html`:** preserve the `<strong>` tags around the conductors/librarians phrase. Document this `_html`-suffix convention as the project's first parameter-laden HTML-bearing key.

**Special handling — `landing_dashboard_library_meta_ready`:** the `{worksCount} works · {copiesCount} copies · {overdueCount} overdue` string has three plural-form gotchas. Per the spec, render plural-words statically (don't use ICU plurals); document if any target language is grammatically uncomfortable with the static form.

- [ ] **Step 4: Append translator notes to `teams/mvox-dev/memory/i18n-conventions.md`**

Use the existing table format. One row per non-obvious translation choice. Include rationale per locale.

- [ ] **Step 5: Run gates + verify generated Paraglide messages compile**

```bash
pnpm build  # regenerates src/lib/paraglide/messages/{en,et,lv,uk}.js
pnpm check  # expect 0 errors — paraglide types must resolve all new keys
pnpm test:unit  # expect all existing tests still pass
pnpm lint
```

Expected: `pnpm check` shows 0 errors; tests pass; lint clean. The generated Paraglide messages file must export functions for all 41 new keys.

- [ ] **Step 6: Commit**

```bash
git checkout chore/landing-redesign
export MVOX_EXPECTED_BRANCH=chore/landing-redesign
git add messages/en.json messages/et.json messages/lv.json messages/uk.json teams/mvox-dev/memory/i18n-conventions.md
git commit -m "$(cat <<'EOF'
i18n(#chore-72): add 41 landing keys × 4 locales; remove 7 scaffold keys

Lands all new landing-page i18n keys upfront per L100 (i18n keys
precede consuming-page tasks). Removes 7 deprecated scaffold keys
from the pre-CHORE-72 `landing_*` namespace.

(*MVOX:Comenius*)
EOF
)"
git push
```

- [ ] **Step 7: Send handoff to team-lead**

SendMessage to team-lead: "i18n complete; 53 keys verified; ready for Tallis to begin RED chain at Task 3."

---

## Components — leaf-up

### Task 3: LandingPillarCard (primitive)

A single pillar card on the desk, used by `<LandingPillarsSection />`.

**Files:**
- Create: `src/lib/components/landing/LandingPillarCard.svelte`
- Create: `src/lib/components/landing/LandingPillarCard.spec.ts`

- [ ] **Step 1: Tallis RED — write the spec**

```ts
// src/lib/components/landing/LandingPillarCard.spec.ts
// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { describe, it, expect, afterEach } from 'vitest';
import LandingPillarCard from './LandingPillarCard.svelte';

afterEach(cleanup);

describe('LandingPillarCard', () => {
	it('renders the library variant with SHIPPED badge', () => {
		const { container } = render(LandingPillarCard, { variant: 'library', status: 'shipped' });
		expect(container.textContent).toContain('Library');
		expect(container.textContent).toContain('Catalogue, copies, lending');
		expect(container.textContent).toContain('SHIPPED');
	});

	it('renders the roster variant with IN DEV badge', () => {
		const { container } = render(LandingPillarCard, { variant: 'roster', status: 'indev' });
		expect(container.textContent).toContain('Roster');
		expect(container.textContent).toContain('Members, sections');
		expect(container.textContent).toContain('IN DEV');
	});

	it('renders the notes variant with COMING badge', () => {
		const { container } = render(LandingPillarCard, { variant: 'notes', status: 'coming' });
		expect(container.textContent).toContain('Rehearsal notes');
		expect(container.textContent).toContain('Notes, attendance, schedule');
		expect(container.textContent).toContain('COMING');
	});

	it('renders the repertoire variant with COMING badge', () => {
		const { container } = render(LandingPillarCard, { variant: 'repertoire', status: 'coming' });
		expect(container.textContent).toContain('Repertoire');
		expect(container.textContent).toContain('Programs, seasons');
		expect(container.textContent).toContain('COMING');
	});

	it('applies a deterministic rotation class per variant', () => {
		const { container: a } = render(LandingPillarCard, { variant: 'library', status: 'shipped' });
		const pillarA = a.querySelector('[data-testid="landing-pillar-card"]');
		expect(pillarA?.getAttribute('style') || '').toMatch(/rotate\(-1\.2deg\)/);
		cleanup();
		const { container: b } = render(LandingPillarCard, { variant: 'roster', status: 'indev' });
		const pillarB = b.querySelector('[data-testid="landing-pillar-card"]');
		expect(pillarB?.getAttribute('style') || '').toMatch(/rotate\(0\.8deg\)/);
	});
});
```

- [ ] **Step 2: Tallis — verify RED via failed import**

```bash
pnpm test src/lib/components/landing/LandingPillarCard.spec.ts 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module './LandingPillarCard.svelte'`. This is the "RED" state for the test.

- [ ] **Step 3: Tallis — handoff to Byrd**

SendMessage to team-lead: "RED for LandingPillarCard committed; ready for Byrd GREEN." (No commit yet — Byrd's commit ships RED + GREEN together to keep per-commit-GREEN intact.)

- [ ] **Step 4: Byrd GREEN — implement the component**

```svelte
<!-- src/lib/components/landing/LandingPillarCard.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	type Props = {
		variant: 'library' | 'roster' | 'notes' | 'repertoire';
		status: 'shipped' | 'indev' | 'coming';
	};

	let { variant, status }: Props = $props();

	const rotationByVariant: Record<Props['variant'], number> = {
		library: -1.2,
		roster: 0.8,
		notes: 0.6,
		repertoire: -0.6,
	};

	const titleByVariant = $derived(
		variant === 'library' ? m.landing_pillar_library_title() :
		variant === 'roster' ? m.landing_pillar_roster_title() :
		variant === 'notes' ? m.landing_pillar_notes_title() :
		m.landing_pillar_repertoire_title()
	);

	const bodyByVariant = $derived(
		variant === 'library' ? m.landing_pillar_library_body() :
		variant === 'roster' ? m.landing_pillar_roster_body() :
		variant === 'notes' ? m.landing_pillar_notes_body() :
		m.landing_pillar_repertoire_body()
	);

	const badgeText = $derived(
		status === 'shipped' ? m.landing_pillar_badge_shipped() :
		status === 'indev' ? m.landing_pillar_badge_indev() :
		m.landing_pillar_badge_coming()
	);

	const badgeClasses = $derived(
		status === 'shipped' ? 'bg-green-soft text-green' :
		status === 'indev' ? 'bg-amber-soft text-amber' :
		'bg-paper-3 text-ink-3 border border-ink-5'
	);
</script>

<article
	data-testid="landing-pillar-card"
	class="relative bg-paper rounded-sm border border-ink/10 shadow-md p-4 h-52"
	style="transform: rotate({rotationByVariant[variant]}deg);"
>
	<span
		aria-label="{titleByVariant} — {badgeText}"
		class="absolute top-2.5 right-2.5 font-mono text-[8.5px] font-semibold tracking-wider px-1.5 py-0.5 rounded {badgeClasses}"
	>
		{badgeText}
	</span>
	<div class="h-16 mb-2.5 flex items-end" aria-hidden="true">
		<!-- icon-paper-thumbnail per variant — visual decoration only -->
		<div class="w-12 h-14 bg-paper-2 border border-ink-4 rounded-sm"></div>
	</div>
	<h3 class="text-sm font-bold text-ink mb-1 tracking-tight">{titleByVariant}</h3>
	<p class="text-[11.5px] text-ink-3 leading-snug">{bodyByVariant}</p>
</article>
```

- [ ] **Step 5: Byrd — run gates + verify GREEN**

```bash
pnpm build  # paraglide regen if needed
pnpm test src/lib/components/landing/LandingPillarCard.spec.ts -- --run
pnpm check
pnpm lint
```

Expected: spec passes (5/5); check 0 errors; lint clean.

- [ ] **Step 6: Byrd — commit**

```bash
export MVOX_EXPECTED_BRANCH=chore/landing-redesign
git add src/lib/components/landing/LandingPillarCard.svelte src/lib/components/landing/LandingPillarCard.spec.ts
git commit -m "$(cat <<'EOF'
feat(#chore-72): LandingPillarCard primitive — 4 variants × 3 statuses

Pillar card with variant-specific copy + status badge + deterministic
rotation. Used by LandingPillarsSection (Task 6) and structurally
echoed by DashboardPillarCard (Task 4).

Reviewed-by: Tallis (RED spec)
EOF
)"
git push
```

---

### Task 4: DashboardPillarCard (primitive)

Dashboard variant — action-shaped, larger, with meta line and optional href.

**Files:**
- Create: `src/lib/components/landing/DashboardPillarCard.svelte`
- Create: `src/lib/components/landing/DashboardPillarCard.spec.ts`

- [ ] **Step 1: Tallis RED**

```ts
// src/lib/components/landing/DashboardPillarCard.spec.ts
// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { describe, it, expect, afterEach } from 'vitest';
import DashboardPillarCard from './DashboardPillarCard.svelte';

afterEach(cleanup);

describe('DashboardPillarCard', () => {
	it('renders as an anchor when href is provided', () => {
		const { container } = render(DashboardPillarCard, {
			variant: 'library',
			status: 'shipped',
			href: '/library',
			meta: '28 works · 552 copies · 2 overdue',
		});
		const anchor = container.querySelector('a[data-testid="dashboard-pillar-card"]');
		expect(anchor).not.toBeNull();
		expect(anchor?.getAttribute('href')).toBe('/library');
		expect(anchor?.textContent).toContain('Library');
		expect(anchor?.textContent).toContain('28 works');
	});

	it('renders as a disabled button when href is omitted', () => {
		const { container } = render(DashboardPillarCard, {
			variant: 'roster',
			status: 'indev',
			meta: 'In development',
		});
		const btn = container.querySelector('button[data-testid="dashboard-pillar-card"]');
		expect(btn).not.toBeNull();
		expect(btn?.hasAttribute('disabled')).toBe(true);
	});

	it('renders the SOON badge for non-shipped variants', () => {
		const { container } = render(DashboardPillarCard, {
			variant: 'roster',
			status: 'indev',
			meta: 'In development',
		});
		expect(container.textContent).toContain('SOON');
	});

	it('omits the SOON badge for shipped variants', () => {
		const { container } = render(DashboardPillarCard, {
			variant: 'library',
			status: 'shipped',
			href: '/library',
			meta: '28 works',
		});
		expect(container.textContent).not.toContain('SOON');
	});

	it('renders the lbl prop in the small-caps line above the title', () => {
		const { container } = render(DashboardPillarCard, {
			variant: 'library',
			status: 'shipped',
			href: '/library',
			meta: 'metadata',
			lbl: 'EFK · catalogue',
		});
		expect(container.textContent).toContain('EFK · catalogue');
	});
});
```

- [ ] **Step 2: Tallis — verify RED**

```bash
pnpm test src/lib/components/landing/DashboardPillarCard.spec.ts 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Byrd GREEN — implement**

```svelte
<!-- src/lib/components/landing/DashboardPillarCard.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	type Props = {
		variant: 'library' | 'roster' | 'notes' | 'repertoire';
		status: 'shipped' | 'indev' | 'coming';
		meta: string;
		href?: string;
		lbl?: string;
	};

	let { variant, status, meta, href, lbl }: Props = $props();

	const borderColorByVariant: Record<Props['variant'], string> = {
		library: 'bg-red',
		roster: 'bg-amber',
		notes: 'bg-ink-3',
		repertoire: 'bg-ink-3',
	};

	const rotationByVariant: Record<Props['variant'], number> = {
		library: -2,
		roster: 2.5,
		notes: -3,
		repertoire: 1.5,
	};

	const titleByVariant = $derived(
		variant === 'library' ? m.landing_pillar_library_title() :
		variant === 'roster' ? m.landing_pillar_roster_title() :
		variant === 'notes' ? m.landing_pillar_notes_title() :
		m.landing_pillar_repertoire_title()
	);

	const isDisabled = $derived(href === undefined);
</script>

{#if href}
	<a
		data-testid="dashboard-pillar-card"
		{href}
		class="relative block bg-paper rounded-sm border border-ink/10 shadow-md p-4 pb-3.5 no-underline"
		style="transform: rotate({rotationByVariant[variant]}deg);"
	>
		<span class="absolute left-0 top-0 bottom-0 w-[3px] {borderColorByVariant[variant]} opacity-70 rounded-l-sm" aria-hidden="true"></span>
		{#if lbl}<div class="font-mono text-[9.5px] text-ink-3 tracking-widest uppercase mb-1">{lbl}</div>{/if}
		<h3 class="text-base font-bold text-ink tracking-tight flex items-center justify-between">{titleByVariant}<span class="font-display text-xl text-ink-3 -translate-y-0.5" aria-hidden="true">→</span></h3>
		<div class="text-xs text-ink-3 leading-snug mt-1">{@html meta}</div>
	</a>
{:else}
	<button
		data-testid="dashboard-pillar-card"
		type="button"
		disabled
		class="relative block w-full text-left bg-paper rounded-sm border border-ink/10 shadow-md p-4 pb-3.5 opacity-90 cursor-not-allowed"
		style="transform: rotate({rotationByVariant[variant]}deg);"
		aria-label="{titleByVariant} — coming soon"
	>
		<span class="absolute left-0 top-0 bottom-0 w-[3px] {borderColorByVariant[variant]} opacity-70 rounded-l-sm" aria-hidden="true"></span>
		<span class="absolute top-2.5 right-2.5 font-mono text-[8.5px] font-semibold tracking-wider px-1.5 py-0.5 rounded bg-paper-3 text-ink-3 border border-ink-5">{m.landing_dashboard_badge_soon()}</span>
		{#if lbl}<div class="font-mono text-[9.5px] text-ink-3 tracking-widest uppercase mb-1">{lbl}</div>{/if}
		<h3 class="text-base font-bold text-ink tracking-tight">{titleByVariant}</h3>
		<div class="text-xs text-ink-3 leading-snug mt-1">{meta}</div>
	</button>
{/if}
```

- [ ] **Step 4: Byrd — verify GREEN**

```bash
pnpm test src/lib/components/landing/DashboardPillarCard.spec.ts -- --run
pnpm check && pnpm lint
```

Expected: 5/5 pass; check + lint clean.

- [ ] **Step 5: Byrd — commit**

```bash
export MVOX_EXPECTED_BRANCH=chore/landing-redesign
git add src/lib/components/landing/DashboardPillarCard.svelte src/lib/components/landing/DashboardPillarCard.spec.ts
git commit -m "$(cat <<'EOF'
feat(#chore-72): DashboardPillarCard primitive — anchor or disabled-button

Larger pillar variant for the signed-in dashboard. Renders as <a> when
href is provided, as <button disabled> with SOON badge otherwise.
Library pulls meta from real librarySectionStore at the section level
(Task 11).

Reviewed-by: Tallis (RED spec)
EOF
)"
git push
```

---

### Task 5: LandingHero (A1 vertical paper stack)

**Files:**
- Create: `src/lib/components/landing/LandingHero.svelte`
- Create: `src/lib/components/landing/LandingHero.spec.ts`

- [ ] **Step 1: Tallis RED**

```ts
// src/lib/components/landing/LandingHero.spec.ts
// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { describe, it, expect, afterEach } from 'vitest';
import LandingHero from './LandingHero.svelte';

afterEach(cleanup);

describe('LandingHero', () => {
	it('renders the headline + subhead + CTA + INVITE ONLY stamp', () => {
		const { container } = render(LandingHero);
		expect(container.textContent).toContain('The back-of-house for your choir.');
		expect(container.textContent).toContain('Library, roster, rehearsal notes');
		expect(container.textContent).toContain('Request an invite');
		expect(container.textContent).toContain('INVITE ONLY');
		expect(container.textContent).toContain('For choirs · by invite');
	});

	it('hero CTA links to the mailto: address with correct subject', () => {
		const { container } = render(LandingHero);
		const cta = container.querySelector('a[data-testid="hero-cta"]');
		expect(cta).not.toBeNull();
		expect(cta?.getAttribute('href')).toBe('mailto:hello@mvox.eu?subject=Invite%20request%20%E2%80%94%20mvox');
	});

	it('renders the secondary "already invited? sign in" marginalia link', () => {
		const { container } = render(LandingHero);
		const signIn = container.querySelector('a[data-testid="hero-signin"]');
		expect(signIn).not.toBeNull();
		expect(signIn?.getAttribute('href')).toBe('/auth/login');
		expect(container.textContent).toContain('already invited?');
		expect(container.textContent).toContain('sign in');
	});

	it('renders three stacked papers (roster decorative, library decorative, hero content)', () => {
		const { container } = render(LandingHero);
		expect(container.querySelector('[data-testid="hero-roster-card"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="hero-library-card"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="hero-content-card"]')).not.toBeNull();
	});
});
```

- [ ] **Step 2: Tallis — verify RED**

```bash
pnpm test src/lib/components/landing/LandingHero.spec.ts 2>&1 | tail -10
```

Expected: FAIL.

- [ ] **Step 3: Byrd GREEN**

Mirror the brainstorm mockup `02-mobile-A.html` A1 composition. Wood-grain backdrop comes from a wrapping `DeskSurface` later (sections are composed inside `LandingMarketing` which provides the desk); this component renders the stack ON the desk.

```svelte
<!-- src/lib/components/landing/LandingHero.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	// mailto: subject pre-fill; body omitted by design
	const ctaHref = 'mailto:hello@mvox.eu?subject=Invite%20request%20%E2%80%94%20mvox';
</script>

<section
	data-testid="landing-hero"
	class="relative w-full min-h-[680px] pt-[78px] flex flex-col items-center"
>
	<div class="relative flex flex-col items-center">
		<!-- back: roster decorative card -->
		<div
			data-testid="hero-roster-card"
			class="relative bg-paper-2 rounded-sm border border-ink/10 shadow-md px-4 py-3.5 -mb-5 z-10"
			style="width: 300px; height: 64px; transform: rotate(-3deg);"
			aria-hidden="true"
		>
			<div class="h-1.5 bg-ink-4 opacity-50 rounded-sm mb-1.5" style="width: 60%"></div>
			<div class="h-1.5 bg-ink-4 opacity-40 rounded-sm mb-1.5" style="width: 80%"></div>
			<div class="h-1.5 bg-ink-4 opacity-40 rounded-sm" style="width: 50%"></div>
		</div>
		<!-- middle: library decorative card -->
		<div
			data-testid="hero-library-card"
			class="relative bg-paper rounded-sm border border-ink/10 shadow-md px-4 py-3.5 flex items-center gap-2.5 -mb-5 z-20"
			style="width: 310px; height: 60px; transform: rotate(2.5deg);"
			aria-hidden="true"
		>
			<span class="font-mono text-[10px] text-ink-3 tracking-widest uppercase">EFK ·</span>
			<span class="text-[13px] font-semibold text-ink-2">Library</span>
		</div>
		<!-- front: hero content card -->
		<div
			data-testid="hero-content-card"
			class="relative bg-paper rounded-sm border border-ink/10 shadow-md p-[30px_26px_28px] z-30"
			style="width: 340px; transform: rotate(-1deg);"
		>
			<span class="absolute left-0 top-0 bottom-0 w-[3px] bg-red opacity-70 rounded-l-sm" aria-hidden="true"></span>
			<span
				class="absolute top-3.5 right-3.5 border-2 border-red text-red rounded px-2 py-1 font-mono text-[9px] font-semibold tracking-widest bg-paper/50"
				style="transform: rotate(8deg);"
				aria-hidden="true"
			>{m.landing_hero_stamp()}</span>
			<div class="font-mono text-[10px] text-red tracking-widest uppercase mb-2.5 font-semibold">{m.landing_hero_eyebrow()}</div>
			<h1 class="text-[28px] font-bold tracking-tight leading-tight mb-3 text-ink">{m.landing_hero_headline()}</h1>
			<p class="text-sm text-ink-2 leading-relaxed mb-5">{m.landing_hero_sub()}</p>
			<a
				data-testid="hero-cta"
				href={ctaHref}
				class="flex items-center justify-center gap-2 bg-ink text-paper px-4 py-3.5 rounded-lg font-semibold text-[15px] no-underline w-full"
			>
				{m.landing_hero_cta()} <span class="font-display text-2xl leading-none -translate-y-px" aria-hidden="true">→</span>
			</a>
		</div>
	</div>
	<div
		class="absolute bottom-8 left-0 right-0 text-center font-display text-[19px] text-ink-2"
		style="transform: rotate(-2deg);"
	>
		{m.landing_hero_already_invited()}{' '}
		<a data-testid="hero-signin" href="/auth/login" class="border-b border-current">{m.landing_hero_sign_in()}</a>
		<span class="inline-block translate-y-0.5" aria-hidden="true">↗</span>
	</div>
</section>
```

- [ ] **Step 4: Byrd — verify GREEN + gates**

```bash
pnpm test src/lib/components/landing/LandingHero.spec.ts -- --run
pnpm check && pnpm lint
```

Expected: 4/4 pass; check + lint clean.

- [ ] **Step 5: Byrd — commit**

```bash
export MVOX_EXPECTED_BRANCH=chore/landing-redesign
git add src/lib/components/landing/LandingHero.svelte src/lib/components/landing/LandingHero.spec.ts
git commit -m "$(cat <<'EOF'
feat(#chore-72): LandingHero — A1 vertical paper stack hero

Three stacked papers (roster + library decorative + hero content
card) with INVITE ONLY stamp, headline, subhead, CTA, and Caveat
marginalia secondary link. Mirrors brainstorm 02-mobile-A.html.
mailto: target uses subject "Invite request — mvox".

Reviewed-by: Tallis (RED spec)
EOF
)"
git push
```

---

### Task 6: LandingPillarsSection (uses LandingPillarCard)

**Files:**
- Create: `src/lib/components/landing/LandingPillarsSection.svelte`
- Create: `src/lib/components/landing/LandingPillarsSection.spec.ts`

- [ ] **Step 1: Tallis RED**

```ts
// src/lib/components/landing/LandingPillarsSection.spec.ts
// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { describe, it, expect, afterEach } from 'vitest';
import LandingPillarsSection from './LandingPillarsSection.svelte';

afterEach(cleanup);

describe('LandingPillarsSection', () => {
	it('renders the section header (eyebrow + heading)', () => {
		const { container } = render(LandingPillarsSection);
		expect(container.textContent).toContain('Four parts of the back office');
		expect(container.textContent).toContain("What's inside");
	});

	it('renders all 4 pillar cards in correct order', () => {
		const { container } = render(LandingPillarsSection);
		const cards = container.querySelectorAll('[data-testid="landing-pillar-card"]');
		expect(cards.length).toBe(4);
		expect(cards[0].textContent).toContain('Library');
		expect(cards[1].textContent).toContain('Roster');
		expect(cards[2].textContent).toContain('Rehearsal notes');
		expect(cards[3].textContent).toContain('Repertoire');
	});

	it('Library card shows SHIPPED; others show IN DEV or COMING', () => {
		const { container } = render(LandingPillarsSection);
		const cards = container.querySelectorAll('[data-testid="landing-pillar-card"]');
		expect(cards[0].textContent).toContain('SHIPPED');
		expect(cards[1].textContent).toContain('IN DEV');
		expect(cards[2].textContent).toContain('COMING');
		expect(cards[3].textContent).toContain('COMING');
	});
});
```

- [ ] **Step 2: Tallis — verify RED**

```bash
pnpm test src/lib/components/landing/LandingPillarsSection.spec.ts 2>&1 | tail -10
```

Expected: FAIL.

- [ ] **Step 3: Byrd GREEN**

```svelte
<!-- src/lib/components/landing/LandingPillarsSection.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import LandingPillarCard from './LandingPillarCard.svelte';
</script>

<section data-testid="landing-pillars-section" class="relative w-full pt-[78px] pb-12 px-4">
	<header class="text-center mb-8 px-6">
		<div class="font-mono text-xs text-ink-3 tracking-widest uppercase font-semibold mb-2">{m.landing_pillars_eyebrow()}</div>
		<h2 class="text-2xl font-bold tracking-tight text-ink leading-tight">{m.landing_pillars_heading()}</h2>
	</header>
	<div class="grid grid-cols-2 gap-3.5">
		<LandingPillarCard variant="library" status="shipped" />
		<LandingPillarCard variant="roster" status="indev" />
		<LandingPillarCard variant="notes" status="coming" />
		<LandingPillarCard variant="repertoire" status="coming" />
	</div>
</section>
```

- [ ] **Step 4: Byrd — verify GREEN + gates**

```bash
pnpm test src/lib/components/landing/LandingPillarsSection.spec.ts -- --run
pnpm check && pnpm lint
```

Expected: 3/3 pass; check + lint clean.

- [ ] **Step 5: Byrd — commit**

```bash
export MVOX_EXPECTED_BRANCH=chore/landing-redesign
git add src/lib/components/landing/LandingPillarsSection.svelte src/lib/components/landing/LandingPillarsSection.spec.ts
git commit -m "$(cat <<'EOF'
feat(#chore-72): LandingPillarsSection — 2×2 grid of pillar cards

What's-inside section. Composes 4 LandingPillarCard primitives with
explicit status per pillar (library:shipped, roster:indev,
notes/repertoire:coming).

Reviewed-by: Tallis (RED spec)
EOF
)"
git push
```

---

### Task 7: LandingInvitesSection (wax-seal explainer)

**Files:**
- Create: `src/lib/components/landing/LandingInvitesSection.svelte`
- Create: `src/lib/components/landing/LandingInvitesSection.spec.ts`

- [ ] **Step 1: Tallis RED**

```ts
// src/lib/components/landing/LandingInvitesSection.spec.ts
// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { describe, it, expect, afterEach } from 'vitest';
import LandingInvitesSection from './LandingInvitesSection.svelte';

afterEach(cleanup);

describe('LandingInvitesSection', () => {
	it('renders the eyebrow, heading, and INVITE ONLY wax-seal', () => {
		const { container } = render(LandingInvitesSection);
		expect(container.textContent).toContain('Getting in');
		expect(container.textContent).toContain('mvox is invite-only.');
		expect(container.textContent).toContain('INVITE ONLY');
	});

	it('renders both body paragraphs', () => {
		const { container } = render(LandingInvitesSection);
		expect(container.textContent).toContain('Conductors and librarians');
		expect(container.textContent).toContain('write to us');
	});

	it('renders the scroll-down marginalia', () => {
		const { container } = render(LandingInvitesSection);
		expect(container.textContent).toContain('scroll for the address');
	});

	it('renders body_1 with <strong> tags preserved via @html', () => {
		const { container } = render(LandingInvitesSection);
		expect(container.innerHTML).toContain('<strong>Conductors and librarians</strong>');
	});
});
```

- [ ] **Step 2: Verify RED**

```bash
pnpm test src/lib/components/landing/LandingInvitesSection.spec.ts 2>&1 | tail -10
```

- [ ] **Step 3: Byrd GREEN**

```svelte
<!-- src/lib/components/landing/LandingInvitesSection.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
</script>

<section data-testid="landing-invites-section" class="relative w-full pt-[90px] pb-16 px-5 flex flex-col items-center">
	<div class="relative w-full max-w-[340px]">
		<span
			aria-hidden="true"
			class="absolute -top-7 right-6 border-[3px] border-red text-red rounded-full w-20 h-20 flex flex-col items-center justify-center text-center font-mono text-[9.5px] font-bold tracking-widest leading-tight bg-paper/85 z-10"
			style="transform: rotate(6deg);"
		>INVITE<br>ONLY</span>
		<div
			class="relative bg-paper rounded p-[34px_26px_28px] border border-ink/10 shadow-md"
			style="transform: rotate(-1deg);"
		>
			<span class="absolute left-0 top-0 bottom-0 w-[3px] bg-red opacity-60 rounded-l" aria-hidden="true"></span>
			<div class="font-mono text-xs text-red tracking-widest uppercase mb-3.5 font-semibold">{m.landing_invites_eyebrow()}</div>
			<h2 class="text-[22px] font-bold tracking-tight leading-tight mb-3.5 text-ink max-w-[240px]">{m.landing_invites_heading()}</h2>
			<p class="text-sm text-ink-2 leading-relaxed mb-2.5">{@html m.landing_invites_body_1_html()}</p>
			<p class="text-sm text-ink-2 leading-relaxed">{m.landing_invites_body_2()}</p>
		</div>
	</div>
	<div class="absolute bottom-9 left-0 right-0 text-center font-display text-[19px] text-ink-2" style="transform: rotate(-2deg);">
		{m.landing_invites_marginalia()}
	</div>
</section>
```

- [ ] **Step 4: Verify GREEN**

```bash
pnpm test src/lib/components/landing/LandingInvitesSection.spec.ts -- --run
pnpm check && pnpm lint
```

- [ ] **Step 5: Commit**

```bash
export MVOX_EXPECTED_BRANCH=chore/landing-redesign
git add src/lib/components/landing/LandingInvitesSection.svelte src/lib/components/landing/LandingInvitesSection.spec.ts
git commit -m "$(cat <<'EOF'
feat(#chore-72): LandingInvitesSection — wax-seal invite-only explainer

Single-card section with the wax-seal stamp positioned to overhang
the card edge. body_1 uses {@html} to preserve <strong> tags from the
_html-suffix i18n key (first instance of that pattern in mvox).

Reviewed-by: Tallis (RED spec)
EOF
)"
git push
```

---

### Task 8: LandingRequestSection (mailto: conversion)

**Files:**
- Create: `src/lib/components/landing/LandingRequestSection.svelte`
- Create: `src/lib/components/landing/LandingRequestSection.spec.ts`

- [ ] **Step 1: Tallis RED**

```ts
// src/lib/components/landing/LandingRequestSection.spec.ts
// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { describe, it, expect, afterEach } from 'vitest';
import LandingRequestSection from './LandingRequestSection.svelte';

afterEach(cleanup);

describe('LandingRequestSection', () => {
	it('renders eyebrow, heading, body, marginalia, RECEIVED stamp', () => {
		const { container } = render(LandingRequestSection);
		expect(container.textContent).toContain('Request access');
		expect(container.textContent).toContain('Write to us.');
		expect(container.textContent).toContain("Tell us your choir's name");
		expect(container.textContent).toContain('we read every one');
		expect(container.textContent).toContain('RECEIVED');
	});

	it('renders the hello@mvox.eu address inline', () => {
		const { container } = render(LandingRequestSection);
		expect(container.textContent).toContain('hello@mvox.eu');
	});

	it('CTA is a mailto: anchor with the encoded subject', () => {
		const { container } = render(LandingRequestSection);
		const cta = container.querySelector('a[data-testid="request-cta"]');
		expect(cta).not.toBeNull();
		expect(cta?.getAttribute('href')).toBe('mailto:hello@mvox.eu?subject=Invite%20request%20%E2%80%94%20mvox');
		expect(cta?.textContent).toContain('Open mail');
	});
});
```

- [ ] **Step 2: Verify RED**

```bash
pnpm test src/lib/components/landing/LandingRequestSection.spec.ts 2>&1 | tail -10
```

- [ ] **Step 3: Byrd GREEN**

```svelte
<!-- src/lib/components/landing/LandingRequestSection.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	const ctaHref = 'mailto:hello@mvox.eu?subject=Invite%20request%20%E2%80%94%20mvox';
</script>

<section data-testid="landing-request-section" class="relative w-full pt-[78px] pb-16 px-5 flex flex-col items-center">
	<div class="relative w-full max-w-[340px]">
		<span
			aria-hidden="true"
			class="absolute -top-3 right-4 bg-paper-3 border-2 border-ink-2 text-ink rounded px-2.5 py-1 font-mono text-[10px] font-bold tracking-widest z-10"
			style="transform: rotate(6deg);"
		>RECEIVED</span>
		<div class="relative bg-paper rounded p-[36px_28px_30px] border border-ink/10 shadow-md">
			<span class="absolute left-0 top-0 bottom-0 w-[3px] bg-ink opacity-85 rounded-l" aria-hidden="true"></span>
			<div class="font-mono text-xs text-ink-3 tracking-widest uppercase mb-3.5 font-semibold">{m.landing_request_eyebrow()}</div>
			<h2 class="text-2xl font-bold tracking-tight leading-tight mb-3.5 text-ink">{m.landing_request_heading()}</h2>
			<p class="text-sm text-ink-2 leading-relaxed mb-6">{m.landing_request_body()}</p>
			<div class="font-mono text-sm text-ink bg-paper-2 px-3.5 py-3 rounded border border-dashed border-ink-4 mb-3.5 text-center tracking-wide">hello@mvox.eu</div>
			<a
				data-testid="request-cta"
				href={ctaHref}
				class="flex items-center justify-center gap-2 bg-ink text-paper px-4 py-3.5 rounded-lg font-semibold text-[15px] no-underline w-full mb-3.5"
			>{m.landing_request_cta()} <span class="font-display text-2xl leading-none -translate-y-px" aria-hidden="true">→</span></a>
			<p class="text-center font-display text-lg text-ink-3" style="transform: rotate(-1.5deg);">{m.landing_request_marginalia()}</p>
		</div>
	</div>
</section>
```

- [ ] **Step 4: Verify GREEN**

```bash
pnpm test src/lib/components/landing/LandingRequestSection.spec.ts -- --run
pnpm check && pnpm lint
```

- [ ] **Step 5: Commit**

```bash
export MVOX_EXPECTED_BRANCH=chore/landing-redesign
git add src/lib/components/landing/LandingRequestSection.svelte src/lib/components/landing/LandingRequestSection.spec.ts
git commit -m "$(cat <<'EOF'
feat(#chore-72): LandingRequestSection — mailto: conversion card

Email-line block + ink-fill CTA with mailto:hello@mvox.eu and the
"Invite request — mvox" subject. RECEIVED stamp positioned to
overhang the card top-right.

Reviewed-by: Tallis (RED spec)
EOF
)"
git push
```

---

### Task 9: LandingFooter (ink slab)

**Files:**
- Create: `src/lib/components/landing/LandingFooter.svelte`
- Create: `src/lib/components/landing/LandingFooter.spec.ts`

- [ ] **Step 1: Tallis RED**

```ts
// src/lib/components/landing/LandingFooter.spec.ts
// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { describe, it, expect, afterEach, vi } from 'vitest';
import LandingFooter from './LandingFooter.svelte';

const setLocaleSpy = vi.fn();
vi.mock('$lib/paraglide/runtime.js', () => ({
	setLocale: setLocaleSpy,
	getLocale: () => 'en',
}));

afterEach(() => {
	cleanup();
	setLocaleSpy.mockClear();
});

describe('LandingFooter', () => {
	it('renders brand mark + tagline + 4 links + 4 locale chips + micro line', () => {
		const { container } = render(LandingFooter);
		expect(container.textContent).toContain('mvox');
		expect(container.textContent).toContain('back-of-house for your choir');
		expect(container.textContent).toContain('About mvox');
		expect(container.textContent).toContain('Open infrastructure');
		expect(container.textContent).toContain('Contact: hello@mvox.eu');
		expect(container.textContent).toContain('github.com/mvox-dev');
		expect(container.textContent).toContain('© 2026');
		expect(container.textContent).toContain('v4E · invite-only');
	});

	it('renders all 4 locale chips with EN marked active', () => {
		const { container } = render(LandingFooter);
		const chips = container.querySelectorAll('button[data-testid^="locale-chip-"]');
		expect(chips.length).toBe(4);
		const active = container.querySelector('button[data-testid="locale-chip-en"]');
		expect(active?.classList.contains('bg-paper')).toBe(true);
	});

	it('clicking a locale chip calls setLocale()', async () => {
		const { container } = render(LandingFooter);
		const etChip = container.querySelector('button[data-testid="locale-chip-et"]') as HTMLButtonElement;
		etChip.click();
		expect(setLocaleSpy).toHaveBeenCalledWith('et');
	});

	it('external links open in a new tab with rel=noopener noreferrer', () => {
		const { container } = render(LandingFooter);
		const sourceLink = container.querySelector('a[href^="https://github.com"]');
		expect(sourceLink?.getAttribute('target')).toBe('_blank');
		expect(sourceLink?.getAttribute('rel')).toContain('noopener');
	});
});
```

- [ ] **Step 2: Verify RED**

```bash
pnpm test src/lib/components/landing/LandingFooter.spec.ts 2>&1 | tail -10
```

- [ ] **Step 3: Byrd GREEN**

```svelte
<!-- src/lib/components/landing/LandingFooter.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { setLocale, getLocale } from '$lib/paraglide/runtime.js';

	const locales = ['en', 'et', 'lv', 'uk'] as const;
	type Locale = typeof locales[number];

	let currentLocale = $state<Locale>(getLocale() as Locale);

	function pick(locale: Locale) {
		setLocale(locale);
		currentLocale = locale;
	}
</script>

<footer data-testid="landing-footer" class="relative w-full bg-ink text-paper min-h-[360px]">
	<div class="px-6 py-10 pb-7 flex flex-col gap-6 h-full">
		<div class="flex items-center gap-2.5">
			<span aria-hidden="true" class="inline-flex items-center justify-center w-8 h-8 bg-paper text-ink rounded-md font-display font-bold text-2xl leading-none">m</span>
			<span class="font-bold text-lg text-paper">mvox</span>
		</div>
		<div class="text-sm text-ink-4 leading-relaxed">{m.landing_footer_tagline()}</div>
		<nav class="flex flex-col gap-2.5 pt-4 border-t border-paper/10">
			<a href="#" class="text-ink-5 text-[13px] no-underline hover:text-paper">{m.landing_footer_link_about()}</a>
			<a href="https://github.com/entu/research#v4e" target="_blank" rel="noopener noreferrer" class="text-ink-5 text-[13px] no-underline hover:text-paper">{m.landing_footer_link_openinfra()}</a>
			<a href="mailto:hello@mvox.eu" class="text-ink-5 text-[13px] no-underline hover:text-paper">{m.landing_footer_link_contact()}</a>
			<a href="https://github.com/mvox-dev/mvox_v4e_web" target="_blank" rel="noopener noreferrer" class="text-ink-5 text-[13px] no-underline hover:text-paper">{m.landing_footer_link_source()}</a>
		</nav>
		<div class="flex gap-3 flex-wrap pt-4 border-t border-paper/10">
			{#each locales as locale}
				<button
					type="button"
					data-testid="locale-chip-{locale}"
					onclick={() => pick(locale)}
					class="font-mono text-[11px] px-2 py-1 rounded uppercase tracking-wider border border-paper/15 text-ink-4 {currentLocale === locale ? 'bg-paper text-ink border-paper' : ''}"
				>{locale}</button>
			{/each}
		</div>
		<div class="mt-auto pt-4 border-t border-paper/10 font-mono text-[10.5px] text-ink-4 tracking-wide flex justify-between">
			<span>{m.landing_footer_micro_year()}</span><span>{m.landing_footer_micro_invite()}</span>
		</div>
	</div>
</footer>
```

- [ ] **Step 4: Verify GREEN**

```bash
pnpm test src/lib/components/landing/LandingFooter.spec.ts -- --run
pnpm check && pnpm lint
```

Expected: 4/4 pass. Note: `$lib/paraglide/runtime.js` must export `setLocale` + `getLocale`; Comenius's Task 2 included these already if the existing Paraglide setup ships them. If not, surface to team-lead before committing.

- [ ] **Step 5: Commit**

```bash
export MVOX_EXPECTED_BRANCH=chore/landing-redesign
git add src/lib/components/landing/LandingFooter.svelte src/lib/components/landing/LandingFooter.spec.ts
git commit -m "$(cat <<'EOF'
feat(#chore-72): LandingFooter — ink slab with brand, links, locales

Footer with brand mark, tagline, vertical link list (about, open
infra, contact, source), functional locale picker wired to Paraglide
setLocale(), and micro year/invite line. External links use
target=_blank + rel=noopener noreferrer.

Reviewed-by: Tallis (RED spec)
EOF
)"
git push
```

---

### Task 10: LandingDashboardGreet

**Files:**
- Create: `src/lib/components/landing/LandingDashboardGreet.svelte`
- Create: `src/lib/components/landing/LandingDashboardGreet.spec.ts`

- [ ] **Step 1: Tallis RED**

```ts
// src/lib/components/landing/LandingDashboardGreet.spec.ts
// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { describe, it, expect, afterEach } from 'vitest';
import LandingDashboardGreet from './LandingDashboardGreet.svelte';

afterEach(cleanup);

describe('LandingDashboardGreet', () => {
	it('renders eyebrow + parameterized greeting + parameterized marginalia', () => {
		const { container } = render(LandingDashboardGreet, { name: 'Mihkel', org: 'EFK' });
		expect(container.textContent).toContain('Welcome back');
		expect(container.textContent).toContain('Welcome back, Mihkel.');
		expect(container.textContent).toContain('EFK · the back office');
	});

	it('omits the org marginalia when org is null', () => {
		const { container } = render(LandingDashboardGreet, { name: 'Mihkel', org: null });
		expect(container.textContent).not.toContain('· the back office');
	});
});
```

- [ ] **Step 2: Verify RED**

```bash
pnpm test src/lib/components/landing/LandingDashboardGreet.spec.ts 2>&1 | tail -10
```

- [ ] **Step 3: Byrd GREEN**

```svelte
<!-- src/lib/components/landing/LandingDashboardGreet.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	type Props = {
		name: string;
		org: string | null;
	};

	let { name, org }: Props = $props();
</script>

<header data-testid="landing-dashboard-greet" class="absolute top-[76px] left-0 right-0 text-center px-6 z-20">
	<div class="font-mono text-[10px] text-ink-3 tracking-widest uppercase mb-1.5">{m.landing_dashboard_eyebrow()}</div>
	<h1 class="text-2xl font-bold tracking-tight text-ink leading-tight">{m.landing_dashboard_greeting({ name })}</h1>
	{#if org}
		<div class="mt-1.5 font-display text-lg text-ink-3 inline-block" style="transform: rotate(-1.5deg);">{m.landing_dashboard_marginalia({ org })}</div>
	{/if}
</header>
```

- [ ] **Step 4: Verify GREEN**

```bash
pnpm test src/lib/components/landing/LandingDashboardGreet.spec.ts -- --run
pnpm check && pnpm lint
```

- [ ] **Step 5: Commit**

```bash
export MVOX_EXPECTED_BRANCH=chore/landing-redesign
git add src/lib/components/landing/LandingDashboardGreet.svelte src/lib/components/landing/LandingDashboardGreet.spec.ts
git commit -m "$(cat <<'EOF'
feat(#chore-72): LandingDashboardGreet — greeting + org marginalia

Dashboard top header. Parameterized greeting ("Welcome back, {name}.")
and optional Caveat marginalia ("{org} · the back office") that
omits when org is null.

Reviewed-by: Tallis (RED spec)
EOF
)"
git push
```

---

### Task 11: LandingDashboardScatter (uses DashboardPillarCard + librarySectionStore)

**Files:**
- Create: `src/lib/components/landing/LandingDashboardScatter.svelte`
- Create: `src/lib/components/landing/LandingDashboardScatter.spec.ts`

This task wires the LIVE Library counts. The other 3 cards stay disabled with SOON.

- [ ] **Step 1: Tallis RED**

```ts
// src/lib/components/landing/LandingDashboardScatter.spec.ts
// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { describe, it, expect, afterEach } from 'vitest';
import { writable } from 'svelte/store';
import LandingDashboardScatter from './LandingDashboardScatter.svelte';

afterEach(cleanup);

vi.mock('$lib/library/libraryStore', async () => {
	const { writable } = await import('svelte/store');
	const store = writable({ status: 'loading' });
	return { librarySectionStore: store };
});

import { vi } from 'vitest';
import { librarySectionStore } from '$lib/library/libraryStore';

describe('LandingDashboardScatter', () => {
	it('renders 4 pillar cards', () => {
		const { container } = render(LandingDashboardScatter, { orgInitials: 'EFK' });
		const cards = container.querySelectorAll('[data-testid="dashboard-pillar-card"]');
		expect(cards.length).toBe(4);
	});

	it('Library card meta shows em-dash when librarySectionStore is loading', () => {
		librarySectionStore.set({ status: 'loading' });
		const { container } = render(LandingDashboardScatter, { orgInitials: 'EFK' });
		const libraryCard = container.querySelector('[data-testid="dashboard-pillar-card"]');
		expect(libraryCard?.textContent).toContain('—');
	});

	it('Library card meta shows "No catalogue yet" when status is empty', () => {
		librarySectionStore.set({ status: 'empty', library: { id: 'lib-1', name: 'EFK Library', orgId: 'org-1' } as any });
		const { container } = render(LandingDashboardScatter, { orgInitials: 'EFK' });
		const libraryCard = container.querySelector('[data-testid="dashboard-pillar-card"]');
		expect(libraryCard?.textContent).toContain('No catalogue yet');
	});

	it('Library card meta shows counts when status is ready', () => {
		librarySectionStore.set({
			status: 'ready',
			library: { id: 'lib-1' } as any,
			works: new Array(28).fill({}) as any,
			editionsByWork: new Map(),
		} as any);
		const { container } = render(LandingDashboardScatter, { orgInitials: 'EFK' });
		const libraryCard = container.querySelector('[data-testid="dashboard-pillar-card"]');
		expect(libraryCard?.textContent).toContain('28 works');
	});

	it('renders roster/notes/repertoire as disabled buttons with SOON', () => {
		librarySectionStore.set({ status: 'loading' });
		const { container } = render(LandingDashboardScatter, { orgInitials: 'EFK' });
		const cards = container.querySelectorAll('[data-testid="dashboard-pillar-card"]');
		// indexes 1, 2, 3 are roster, notes, repertoire
		for (let i = 1; i <= 3; i++) {
			expect(cards[i].tagName.toLowerCase()).toBe('button');
			expect(cards[i].hasAttribute('disabled')).toBe(true);
			expect(cards[i].textContent).toContain('SOON');
		}
	});
});
```

- [ ] **Step 2: Verify RED**

```bash
pnpm test src/lib/components/landing/LandingDashboardScatter.spec.ts 2>&1 | tail -15
```

- [ ] **Step 3: Byrd GREEN**

```svelte
<!-- src/lib/components/landing/LandingDashboardScatter.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { librarySectionStore } from '$lib/library/libraryStore';
	import DashboardPillarCard from './DashboardPillarCard.svelte';

	type Props = { orgInitials: string };
	let { orgInitials }: Props = $props();

	const libraryMeta = $derived.by(() => {
		const state = $librarySectionStore;
		if (state.status === 'loading' || state.status === 'no-rights' || state.status === 'error') {
			return m.landing_dashboard_library_meta_loading();
		}
		if (state.status === 'empty') {
			return m.landing_dashboard_library_meta_empty();
		}
		// status === 'ready'
		const worksCount = state.works.length;
		const copiesCount = Array.from(state.editionsByWork.values()).reduce((sum, eds) => sum + eds.length, 0);
		const overdueCount = 0; // TODO: source overdue count from copies once lending data is wired (out of scope for CHORE-72; spec line "overdue from copies" defers to future)
		// rendered meta — overdue highlighted in red+bold ONLY when > 0
		const overdueFragment = overdueCount > 0
			? `<span class="text-red font-semibold">${overdueCount} overdue</span>`
			: `${overdueCount} overdue`;
		return m.landing_dashboard_library_meta_ready({ worksCount, copiesCount, overdueCount })
			.replace(`${overdueCount} overdue`, overdueFragment);
	});

	const libraryLbl = $derived(m.landing_dashboard_library_lbl({ org: orgInitials }));
</script>

<div data-testid="landing-dashboard-scatter" class="absolute top-[182px] left-0 right-0 bottom-0 px-4">
	<div style="position: absolute; top: 0; left: 22px; width: 260px;">
		<DashboardPillarCard variant="library" status="shipped" href="/library" lbl={libraryLbl} meta={libraryMeta} />
	</div>
	<div style="position: absolute; top: 100px; right: 18px; width: 220px;">
		<DashboardPillarCard variant="roster" status="indev" lbl={m.landing_dashboard_roster_lbl()} meta={m.landing_dashboard_pillar_meta_indev()} />
	</div>
	<div style="position: absolute; top: 220px; left: 14px; width: 220px;">
		<DashboardPillarCard variant="notes" status="coming" lbl={m.landing_dashboard_notes_lbl()} meta={m.landing_dashboard_pillar_meta_coming()} />
	</div>
	<div style="position: absolute; top: 330px; right: 24px; width: 240px;">
		<DashboardPillarCard variant="repertoire" status="coming" lbl={m.landing_dashboard_repertoire_lbl()} meta={m.landing_dashboard_pillar_meta_coming()} />
	</div>
</div>
```

- [ ] **Step 4: Verify GREEN**

```bash
pnpm test src/lib/components/landing/LandingDashboardScatter.spec.ts -- --run
pnpm check && pnpm lint
```

Expected: 5/5 pass. NOTE: the `{@html}` substitution for the red `overdue` segment uses a `.replace()` against the Paraglide-rendered string. This is brittle if i18n translations restructure the count phrase (et/lv/uk may re-order). Document this as a deferred concern; Bentham may YELLOW.

- [ ] **Step 5: Commit**

```bash
export MVOX_EXPECTED_BRANCH=chore/landing-redesign
git add src/lib/components/landing/LandingDashboardScatter.svelte src/lib/components/landing/LandingDashboardScatter.spec.ts
git commit -m "$(cat <<'EOF'
feat(#chore-72): LandingDashboardScatter — D1 scattered pillar layout

4 absolutely-positioned DashboardPillarCard instances mirroring
brainstorm 04-signed-in-dashboard.html D1 composition. Library card
consumes librarySectionStore (loading → "—", empty → "No catalogue
yet", ready → works/copies counts). Overdue count placeholder at 0
pending lending data (deferred).

Reviewed-by: Tallis (RED spec)
EOF
)"
git push
```

---

### Task 12: LandingMarketing (composer wrapper for signed-out / loading / anonymous)

**Files:**
- Create: `src/lib/components/landing/LandingMarketing.svelte`
- Create: `src/lib/components/landing/LandingMarketing.spec.ts`

- [ ] **Step 1: Tallis RED**

```ts
// src/lib/components/landing/LandingMarketing.spec.ts
// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { describe, it, expect, afterEach } from 'vitest';
import LandingMarketing from './LandingMarketing.svelte';

afterEach(cleanup);

describe('LandingMarketing', () => {
	it('renders all 5 sections in order: hero, pillars, invites, request, footer', () => {
		const { container } = render(LandingMarketing);
		const hero = container.querySelector('[data-testid="landing-hero"]');
		const pillars = container.querySelector('[data-testid="landing-pillars-section"]');
		const invites = container.querySelector('[data-testid="landing-invites-section"]');
		const request = container.querySelector('[data-testid="landing-request-section"]');
		const footer = container.querySelector('[data-testid="landing-footer"]');

		expect(hero).not.toBeNull();
		expect(pillars).not.toBeNull();
		expect(invites).not.toBeNull();
		expect(request).not.toBeNull();
		expect(footer).not.toBeNull();

		// position check — pillars after hero, etc.
		expect(hero!.compareDocumentPosition(pillars!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(pillars!.compareDocumentPosition(invites!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(invites!.compareDocumentPosition(request!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(request!.compareDocumentPosition(footer!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});
});
```

- [ ] **Step 2: Verify RED**

```bash
pnpm test src/lib/components/landing/LandingMarketing.spec.ts 2>&1 | tail -10
```

- [ ] **Step 3: Byrd GREEN**

```svelte
<!-- src/lib/components/landing/LandingMarketing.svelte -->
<script lang="ts">
	import DeskSurface from '../DeskSurface.svelte';
	import LandingHero from './LandingHero.svelte';
	import LandingPillarsSection from './LandingPillarsSection.svelte';
	import LandingInvitesSection from './LandingInvitesSection.svelte';
	import LandingRequestSection from './LandingRequestSection.svelte';
	import LandingFooter from './LandingFooter.svelte';
</script>

<DeskSurface>
	<LandingHero />
	<LandingPillarsSection />
	<LandingInvitesSection />
	<LandingRequestSection />
</DeskSurface>
<LandingFooter />
```

- [ ] **Step 4: Verify GREEN**

```bash
pnpm test src/lib/components/landing/LandingMarketing.spec.ts -- --run
pnpm check && pnpm lint
```

- [ ] **Step 5: Commit**

```bash
export MVOX_EXPECTED_BRANCH=chore/landing-redesign
git add src/lib/components/landing/LandingMarketing.svelte src/lib/components/landing/LandingMarketing.spec.ts
git commit -m "$(cat <<'EOF'
feat(#chore-72): LandingMarketing — composer for 5-section signed-out flow

DeskSurface backdrop wraps hero/pillars/invites/request; footer
sits below as a flat ink slab.

Reviewed-by: Tallis (RED spec)
EOF
)"
git push
```

---

### Task 13: LandingDashboard (composer wrapper for signed-in)

**Files:**
- Create: `src/lib/components/landing/LandingDashboard.svelte`
- Create: `src/lib/components/landing/LandingDashboard.spec.ts`

- [ ] **Step 1: Tallis RED**

```ts
// src/lib/components/landing/LandingDashboard.spec.ts
// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { describe, it, expect, afterEach, vi } from 'vitest';
import LandingDashboard from './LandingDashboard.svelte';

vi.mock('$lib/auth/userStore', async () => {
	const { writable, derived } = await import('svelte/store');
	const user = writable({ status: 'ready', name: 'Mihkel', initial: 'M', personId: 'p1' });
	const sel = writable({ id: 'org-1', label: 'EFK', initials: 'EF' });
	return { userStore: user, selectedOrgStore: sel };
});

vi.mock('$lib/library/libraryStore', async () => {
	const { writable } = await import('svelte/store');
	const store = writable({ status: 'loading' });
	return { librarySectionStore: store };
});

afterEach(cleanup);

describe('LandingDashboard', () => {
	it('renders greet + scatter', () => {
		const { container } = render(LandingDashboard);
		expect(container.querySelector('[data-testid="landing-dashboard-greet"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="landing-dashboard-scatter"]')).not.toBeNull();
	});

	it('passes the user name + org label to the greet', () => {
		const { container } = render(LandingDashboard);
		expect(container.textContent).toContain('Welcome back, Mihkel.');
		expect(container.textContent).toContain('EFK · the back office');
	});
});
```

- [ ] **Step 2: Verify RED**

```bash
pnpm test src/lib/components/landing/LandingDashboard.spec.ts 2>&1 | tail -10
```

- [ ] **Step 3: Byrd GREEN**

```svelte
<!-- src/lib/components/landing/LandingDashboard.svelte -->
<script lang="ts">
	import DeskSurface from '../DeskSurface.svelte';
	import LandingDashboardGreet from './LandingDashboardGreet.svelte';
	import LandingDashboardScatter from './LandingDashboardScatter.svelte';
	import { userStore, selectedOrgStore } from '$lib/auth/userStore';

	const userName = $derived($userStore.status === 'ready' ? $userStore.name : '');
	const orgLabel = $derived($selectedOrgStore?.label ?? null);
	const orgInitials = $derived($selectedOrgStore?.initials ?? '');
</script>

<DeskSurface>
	<LandingDashboardGreet name={userName} org={orgLabel} />
	<LandingDashboardScatter orgInitials={orgInitials} />
</DeskSurface>
```

- [ ] **Step 4: Verify GREEN**

```bash
pnpm test src/lib/components/landing/LandingDashboard.spec.ts -- --run
pnpm check && pnpm lint
```

- [ ] **Step 5: Commit**

```bash
export MVOX_EXPECTED_BRANCH=chore/landing-redesign
git add src/lib/components/landing/LandingDashboard.svelte src/lib/components/landing/LandingDashboard.spec.ts
git commit -m "$(cat <<'EOF'
feat(#chore-72): LandingDashboard — composer for signed-in welcome-back

DeskSurface wraps greeting + scatter. Consumes userStore for {name}
and selectedOrgStore for {label} + {initials}.

Reviewed-by: Tallis (RED spec)
EOF
)"
git push
```

---

## Page integration

### Task 14: Rewrite `/+page.svelte` orchestrator + `/+page.spec.ts`

**Files:**
- Rewrite: `src/routes/+page.svelte`
- Rewrite: `src/routes/+page.spec.ts`

The orchestrator branches on `$userStore.status` and renders the appropriate wrapper. This is the deletion point for the old scaffold code.

- [ ] **Step 1: Tallis — rewrite the page spec**

```ts
// src/routes/+page.spec.ts (REPLACE existing contents)
// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { describe, it, expect, vi, afterEach } from 'vitest';
import Page from './+page.svelte';

afterEach(cleanup);

vi.mock('$lib/library/libraryStore', async () => {
	const { writable } = await import('svelte/store');
	return { librarySectionStore: writable({ status: 'loading' }) };
});

function mockAuth(status: 'loading' | 'anonymous' | 'ready') {
	vi.doMock('$lib/auth/userStore', async () => {
		const { writable } = await import('svelte/store');
		if (status === 'ready') {
			return {
				userStore: writable({ status: 'ready', name: 'Mihkel', initial: 'M', personId: 'p1' }),
				selectedOrgStore: writable({ id: 'org-1', label: 'EFK', initials: 'EF' }),
			};
		}
		return {
			userStore: writable({ status }),
			selectedOrgStore: writable(null),
		};
	});
}

describe('/+page.svelte (landing orchestrator)', () => {
	it('renders the marketing page when userStore is loading', async () => {
		mockAuth('loading');
		const PageMod = await import('./+page.svelte');
		const { container } = render(PageMod.default);
		expect(container.querySelector('[data-testid="landing-hero"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="landing-dashboard-greet"]')).toBeNull();
		vi.resetModules();
	});

	it('renders the marketing page when anonymous', async () => {
		mockAuth('anonymous');
		const PageMod = await import('./+page.svelte');
		const { container } = render(PageMod.default);
		expect(container.querySelector('[data-testid="landing-hero"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="landing-dashboard-greet"]')).toBeNull();
		vi.resetModules();
	});

	it('renders the dashboard when ready', async () => {
		mockAuth('ready');
		const PageMod = await import('./+page.svelte');
		const { container } = render(PageMod.default);
		expect(container.querySelector('[data-testid="landing-dashboard-greet"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="landing-hero"]')).toBeNull();
		vi.resetModules();
	});
});
```

- [ ] **Step 2: Tallis — verify RED**

```bash
pnpm test src/routes/+page.spec.ts 2>&1 | tail -15
```

Expected: FAIL — the old +page.svelte still has the scaffold code; the new components aren't wired yet. Spec assertions fail because no `[data-testid="landing-hero"]` exists in the rendered output.

- [ ] **Step 3: Byrd GREEN — rewrite the page**

```svelte
<!-- src/routes/+page.svelte (REPLACE existing contents) -->
<script lang="ts">
	import { userStore } from '$lib/auth/userStore';
	import LandingMarketing from '$lib/components/landing/LandingMarketing.svelte';
	import LandingDashboard from '$lib/components/landing/LandingDashboard.svelte';

	const isReady = $derived($userStore.status === 'ready');
</script>

{#if isReady}
	<LandingDashboard />
{:else}
	<LandingMarketing />
{/if}
```

- [ ] **Step 4: Byrd — full gate sweep**

```bash
pnpm build  # paraglide regen
pnpm check
pnpm test:unit
pnpm lint
pnpm build
```

Expected:
- `pnpm check`: 0 errors
- `pnpm test:unit`: all green; new page spec (3 cases) passes
- `pnpm lint`: clean
- `pnpm build`: clean Cloudflare adapter output

Surface any failure; do NOT commit if any gate is non-green.

- [ ] **Step 5: Byrd — commit**

```bash
export MVOX_EXPECTED_BRANCH=chore/landing-redesign
git add src/routes/+page.svelte src/routes/+page.spec.ts
git commit -m "$(cat <<'EOF'
feat(#chore-72): rewrite / orchestrator — branches on userStore.status

Replace scaffold landing with a two-branch orchestrator. signed-in
(status:ready) → LandingDashboard; signed-out / loading / anonymous
→ LandingMarketing. Page spec rewritten with 3 assertions per branch.

Closes the scaffold-era `landing_*` key usages (keys removed in
Task 2).

Reviewed-by: Tallis (RED spec)
EOF
)"
git push
```

- [ ] **Step 6: Byrd — handoff to Bentham**

SendMessage to team-lead: "GREEN at branch tip; full gate sweep clean; ready for Bentham review."

---

## Review

### Task 15: Bentham — branch review

**Owner:** Bentham (architecture reviewer; review-only, no source code).

**Files:** none (review comments only).

- [ ] **Step 1: Read the branch end-to-end**

```bash
git checkout chore/landing-redesign
git pull
git log --oneline main..HEAD
git diff --stat main...HEAD
```

Walk every commit. Each one should leave the branch GREEN per per-commit-GREEN.

- [ ] **Step 2: Run the calibration full-fresh-gate per CALIBRATION-PNPM-CHECK-FRESH-RUN**

Discrete bash calls (not chained — quoting the verbatim COMPLETED line):

```bash
pnpm check
```

Then separately:

```bash
pnpm test:unit
```

Then:

```bash
pnpm lint
```

Then:

```bash
pnpm build
```

Quote the verbatim COMPLETED / Tests passed / build OK lines in the review report.

- [ ] **Step 3: Spec-vs-impl audit**

Walk each spec acceptance criterion (15 in the spec). Confirm tasks landed for each. Tag any gaps as YELLOW or RED.

Particularly verify:
- AC 1, 2: marketing vs dashboard branching matches `$userStore.status`
- AC 3, 4: Library card meta sources from `librarySectionStore` (the `overdue` red-bold formatting may have the `.replace()` brittleness flagged at Task 11 — this is a known concern; YELLOW if Bentham wants Comenius to author a more robust render path; GREEN otherwise)
- AC 5: roster/notes/repertoire dashboard cards are `<button disabled>` with SOON badge — verify in code AND in rendered DOM at /+page test
- AC 6: hero CTA href is exactly `mailto:hello@mvox.eu?subject=Invite%20request%20%E2%80%94%20mvox`
- AC 7: hero secondary "sign in" link goes to `/auth/login`
- AC 8: footer locale chips render + click calls `setLocale()`
- AC 9, 10: i18n key delta correct in all 4 locale files
- AC 11-14: gates clean

- [ ] **Step 4: Vocabulary-neutrality audit (the new arch rule)**

Per `architecture-decisions.md` "Vertical-skin neutrality" rule landed in `3382a01` — RED any code that hardcodes vertical vocabulary outside i18n values. Grep:

```bash
grep -rn "choir\|sing\|orchestra\|ensemble" src/lib/components/landing/ src/routes/+page.svelte src/routes/+page.spec.ts
```

Expected: zero matches in `.svelte` and `.ts` files (all vocabulary is in i18n values via `m.*()`). Matches in spec files are acceptable IF they're inside test fixture strings, NOT inside template assertions. Bentham flags any hard-coded vertical word in user-facing templates.

- [ ] **Step 5: URL-overrides-persisted check**

This CHORE introduces no URL state on `/`; the rule doesn't directly apply. Confirm and note in the review report that the rule was checked and inapplicable.

- [ ] **Step 6: Write review report**

SendMessage to team-lead with verdict (GREEN / YELLOW + carry-forwards / RED + blockers). Use the CHORE-67 review report shape:

```
## Story Re-Review — CHORE-72 landing page redesign — tip <SHA>
- **Verdict:** GREEN / YELLOW-72.N / RED-72.N
- **Recommendation:** ship / fold-in fix / block

[per-AC + per-rule audit results, full check output]
```

---

## Merge

### Task 16: Josquin — merge + deploy + close GH issue + delete branch

**Owner:** Josquin (BFF / API + merge authority).

**Files:** none (git + deploy operations only).

This follows the Option-1 merge-main-first pattern from CHORE-67/CHORE-66.

- [ ] **Step 1: Merge main into chore branch**

```bash
git checkout chore/landing-redesign
git pull
git merge main  # expect clean — landing should not conflict with main
```

If conflict surfaces, surface-and-stop to team-lead.

- [ ] **Step 2: Re-run full gate on merged tip**

```bash
pnpm build
pnpm check
pnpm test:unit
pnpm lint
pnpm build
```

Quote verbatim COMPLETED / Tests passed lines in the merge report. If any non-green, surface-and-stop.

- [ ] **Step 3: Squash to main**

```bash
git checkout main && git pull
MVOX_EXPECTED_BRANCH=main git merge --squash chore/landing-redesign
MVOX_EXPECTED_BRANCH=main git commit -m "$(cat <<'EOF'
feat(#chore-72): landing page redesign — paper-and-ink doorway + dashboard

Replace the generic-Tailwind scaffold at `/` with a coherent
paper-and-ink landing page:

- Signed-out (curious-bystander doorway): 5-section marketing scroll
  with A1 vertical paper-stack hero, 2×2 pillars grid, wax-seal
  invites explainer, mailto: request card, ink-slab footer with
  functional locale picker.
- Signed-in (welcome-back dashboard): D1 scattered pillar
  composition. Library card pulls live meta (works/copies counts)
  from librarySectionStore (CHORE-67).

Architecture: orchestrator src/routes/+page.svelte branches on
$userStore.status. 9 new components under src/lib/components/landing/.
41 new i18n keys × 4 locales; 7 deprecated scaffold keys removed.
First exemplar of the "Vertical-skin neutrality" architectural
decision (3382a01) — all vocabulary lives in i18n values, no
hard-coded vertical words in templates / types / names.

mailto:hello@mvox.eu uses CF Email Routing (set up session 19),
forwards to mitselek+mvox@gmail.com.

No schema impact.

Reviewed-by: Bentham
Contributors: Tallis, Byrd, Comenius
EOF
)"
```

**L104 reminder:** NO `Co-authored-by:` lines in the body. The prepare-commit-msg hook adds the PO co-author trailer automatically. `Reviewed-by:` / `Contributors:` are safe alternatives.

- [ ] **Step 4: Push**

```bash
MVOX_EXPECTED_BRANCH=main git push
```

- [ ] **Step 5: Wrangler deploy**

```bash
source ~/.config/mvox/credentials.env
pnpm build
pnpm wrangler pages deploy .svelte-kit/cloudflare --project-name=multivox
```

Capture the per-build URL printed by wrangler.

- [ ] **Step 6: Probe production for chunk rotation**

```bash
curl -sI https://mvox.eu/ | head -6
curl -sI https://multivox.pages.dev/ | head -6
```

Expect 200 + `x-sveltekit-page: true`. Note the new `app.*.js` + `start.*.js` chunk hashes.

- [ ] **Step 7: Close GH issue**

This CHORE doesn't have a numbered GH issue (CHORE-72 is the project's internal label). If team-lead wants a GH issue retroactively created for audit fidelity, surface to team-lead. Otherwise skip this step — the squash commit message is the project record.

- [ ] **Step 8: Delete branch (local + remote)**

```bash
git branch -D chore/landing-redesign  # -D because squash-merge isn't recognized as fully-merged
git push origin --delete chore/landing-redesign
```

- [ ] **Step 9: Report to team-lead**

SendMessage to team-lead:

```
CHORE-72 shipped end-to-end.

## Chain SHAs
- Squash: <SHA> `feat(#chore-72): landing page redesign...`
- Pushed to origin/main at <timestamp>

## Production deploy
- Per-build URL: <wrangler URL>
- Production probe: https://mvox.eu/ → HTTP/2 200, x-sveltekit-page: true
- New chunks: app.<hash>.js / start.<hash>.js

## Branch cleanup
- chore/landing-redesign deleted local + remote

## Gates summary
- pnpm check: COMPLETED N FILES 0 ERRORS 0 WARNINGS
- pnpm test:unit: Test Files X passed | Tests Y passed
- pnpm lint: clean
- pnpm build: built in N.NNs

(*MVOX:Josquin*)
```

---

## Self-review checklist (run by team-lead after writing this plan)

- [x] **Spec coverage:** all 15 acceptance criteria + 9 component contracts have tasks. AC 4 (overdue red+bold) acknowledged as brittle in Task 11 step 4 — flagged for Bentham YELLOW.
- [x] **Placeholder scan:** no TBD / TODO / "implement later" tokens; one explicit in-code TODO for the overdue counter (deferred, documented in the spec under Open Questions).
- [x] **Type consistency:** `LibrarySectionState` shape matches what's used in Task 11 GREEN; `Props` typing on each component matches what the spec specifies; pillar variant union is consistent (`library | roster | notes | repertoire`) across LandingPillarCard, DashboardPillarCard, and LandingDashboardScatter.
- [x] **No placeholders in tests:** every test has executable assertions with code blocks.
- [x] **i18n key naming:** all keys vocabulary-neutral per the new arch rule (no `landing_choir_*` keys).
- [x] **Plan execution mode:** team-driven only, no fork offered per L113.

(*MVOX:Palestrina*)
