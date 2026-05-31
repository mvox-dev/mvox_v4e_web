# CHORE-75 — Avatar dropdown user menu — Implementation Plan

> **For team agents:** Team-driven plan; tasks owned by named roles (Comenius i18n → Tallis RED → Byrd GREEN → Bentham REVIEW → Josquin MERGE). Per `feedback_plan_execution_mode_baked_in`: do NOT offer a mode fork. Per `feedback_atomic_git_chaining`: chain commits inside single Bash calls. Per `feedback_no_parallel_branches` Level 1 + Level 2: strictly sequential.

> **SEQUENCING DISCIPLINE:** only `chore/avatar-menu` is active; only one task is dispatched at a time; each task fully closes before the next dispatches; team-lead is the serializer.

**Goal:** Add a logout affordance — turn the MvoxNav avatar tile into a button that toggles a small paper-card drop-down menu with "Signed in as {name}" + "Sign out".

**Architecture:** New self-contained `<AvatarMenu name initial />` component owning trigger button + menu panel + open/close state + Esc/outside-click handlers. MvoxNav replaces its inline avatar block with `<AvatarMenu>`. 2 new i18n keys.

**Tech Stack:** SvelteKit 2 · Svelte 5 (Runes) · TypeScript strict · Tailwind v4 · Vitest (happy-dom) · @testing-library/svelte · Paraglide.

**Spec:** `docs/superpowers/specs/2026-05-31-chore-75-avatar-menu-design.md` (committed at `70bba39`).

**Branch:** `chore/avatar-menu` (created in Task 1).

**Total tasks:** 6. Estimated wall-clock: ~2-3 hours.

---

## Branch + setup

### Task 1: Create feature branch

**Owner:** team-lead.

- [ ] **Step 1: Verify clean state on main**

```bash
cd /home/michelek/workspace
git checkout main
git pull --ff-only
git status --short
```

- [ ] **Step 2: Create + push branch**

```bash
git checkout -b chore/avatar-menu
git push -u origin chore/avatar-menu
git branch --show-current  # expect chore/avatar-menu
```

- [ ] **Step 3: Hand off to Comenius for Task 2.**

---

## i18n keys upfront (per L100)

### Task 2: Comenius — add `nav_signed_in_as` + `nav_user_menu_aria` × 4 locales

**Owner:** Comenius.

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/et.json`
- Modify: `messages/lv.json`
- Modify: `messages/uk.json`
- Modify: `teams/mvox-dev/memory/i18n-conventions.md` (translator notes)

- [ ] **Step 1: Add `nav_signed_in_as` + `nav_user_menu_aria` to `messages/en.json`** (alphabetical insertion order):

```jsonc
"nav_signed_in_as": "Signed in as",
"nav_user_menu_aria": "User menu",
```

- [ ] **Step 2: Translate both keys for et/lv/uk** per your stewardship rules. Both keys are utility/aria copy — neutral register, no brand voice.

Suggested approach (Comenius decides finally):

- `nav_signed_in_as`:
  - et: `Sisselogitud kasutaja` (or `Sisse logitud kui`) — depending on which reads naturally as a noun-phrase eyebrow
  - lv: `Pieslēdzies kā` — common Latvian UI phrasing
  - uk: `Увійшли як` — standard Ukrainian "signed in as" phrasing

- `nav_user_menu_aria`:
  - et: `Kasutaja menüü`
  - lv: `Lietotāja izvēlne`
  - uk: `Меню користувача`

- [ ] **Step 3: Append translator notes** to `teams/mvox-dev/memory/i18n-conventions.md` in the existing decision-log table format. Both keys are nav-prefix; document the eyebrow-vs-aria-label register distinction if any locale needs it.

- [ ] **Step 4: Gates** — `pnpm build` (paraglide regen) + `pnpm check` (0 errors) + `pnpm test:unit` (existing tests pass) + `pnpm lint`.

- [ ] **Step 5: Commit** (atomic chain):

```bash
git checkout chore/avatar-menu
export MVOX_EXPECTED_BRANCH=chore/avatar-menu
git add messages/en.json messages/et.json messages/lv.json messages/uk.json teams/mvox-dev/memory/i18n-conventions.md
git commit -m "$(cat <<'EOF'
i18n(#75): add nav_signed_in_as + nav_user_menu_aria × 4 locales

Lands the 2 new keys upfront per L100 (i18n keys precede consuming-
component tasks). Both are utility/a11y keys; neutral register.

(*MVOX:Comenius*)
EOF
)"
git push
```

- [ ] **Step 6: Report to team-lead** — SHA, key delta, gate confirmation.

---

## Components

### Task 3: AvatarMenu — trigger button + drop-down panel + Esc/outside-click

**Files:**
- Create: `src/lib/components/AvatarMenu.svelte`
- Create: `src/lib/components/AvatarMenu.spec.ts`

The whole component in one RED+GREEN task. Tallis writes the spec; Byrd implements; one commit ships both.

- [ ] **Step 1: Tallis RED** — write `src/lib/components/AvatarMenu.spec.ts`:

```ts
// @vitest-environment happy-dom
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, afterEach } from 'vitest';
import AvatarMenu from './AvatarMenu.svelte';

afterEach(cleanup);

describe('AvatarMenu', () => {
	it('renders the trigger button with the initial character + aria attributes', () => {
		const { container } = render(AvatarMenu, { name: 'Mihkel Putrinš', initial: 'M' });
		const btn = container.querySelector('button[data-testid="avatar-menu-trigger"]');
		expect(btn).not.toBeNull();
		expect(btn?.textContent).toContain('M');
		expect(btn?.getAttribute('aria-haspopup')).toBe('menu');
		expect(btn?.getAttribute('aria-expanded')).toBe('false');
		expect(btn?.getAttribute('aria-label')).toBe('User menu');
	});

	it('does not render the menu panel initially', () => {
		const { container } = render(AvatarMenu, { name: 'Mihkel Putrinš', initial: 'M' });
		expect(container.querySelector('[data-testid="avatar-menu-panel"]')).toBeNull();
	});

	it('clicking trigger opens the menu panel with name + sign out link', async () => {
		const { container } = render(AvatarMenu, { name: 'Mihkel Putrinš', initial: 'M' });
		const btn = container.querySelector('button[data-testid="avatar-menu-trigger"]') as HTMLButtonElement;
		await fireEvent.click(btn);
		const panel = container.querySelector('[data-testid="avatar-menu-panel"]');
		expect(panel).not.toBeNull();
		expect(panel?.textContent).toContain('Signed in as');
		expect(panel?.textContent).toContain('Mihkel Putrinš');
		expect(panel?.textContent).toContain('Sign out');
		expect(btn.getAttribute('aria-expanded')).toBe('true');
	});

	it('sign out link points to /auth/logout', async () => {
		const { container } = render(AvatarMenu, { name: 'Mihkel Putrinš', initial: 'M' });
		const btn = container.querySelector('button[data-testid="avatar-menu-trigger"]') as HTMLButtonElement;
		await fireEvent.click(btn);
		const link = container.querySelector('a[data-testid="avatar-menu-signout"]');
		expect(link?.getAttribute('href')).toBe('/auth/logout');
	});

	it('clicking trigger again closes the menu', async () => {
		const { container } = render(AvatarMenu, { name: 'Mihkel Putrinš', initial: 'M' });
		const btn = container.querySelector('button[data-testid="avatar-menu-trigger"]') as HTMLButtonElement;
		await fireEvent.click(btn);
		await fireEvent.click(btn);
		expect(container.querySelector('[data-testid="avatar-menu-panel"]')).toBeNull();
		expect(btn.getAttribute('aria-expanded')).toBe('false');
	});

	it('Escape key while open closes the menu', async () => {
		const { container } = render(AvatarMenu, { name: 'Mihkel Putrinš', initial: 'M' });
		const btn = container.querySelector('button[data-testid="avatar-menu-trigger"]') as HTMLButtonElement;
		await fireEvent.click(btn);
		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(container.querySelector('[data-testid="avatar-menu-panel"]')).toBeNull();
	});

	it('outside click closes the menu', async () => {
		const { container } = render(AvatarMenu, { name: 'Mihkel Putrinš', initial: 'M' });
		const btn = container.querySelector('button[data-testid="avatar-menu-trigger"]') as HTMLButtonElement;
		await fireEvent.click(btn);
		// click on document.body (outside the component)
		await fireEvent.mouseDown(document.body);
		expect(container.querySelector('[data-testid="avatar-menu-panel"]')).toBeNull();
	});
});
```

Pre-format with `pnpm biome format --write`.

- [ ] **Step 2: Tallis — verify RED**

```bash
pnpm test src/lib/components/AvatarMenu.spec.ts 2>&1 | tail -15
```

Expect: module-not-found. Hand off — no commit.

- [ ] **Step 3: Byrd GREEN — implement `src/lib/components/AvatarMenu.svelte`**:

```svelte
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	type Props = {
		name: string;
		initial: string;
	};

	let { name, initial }: Props = $props();

	let open = $state(false);
	let triggerEl: HTMLButtonElement | undefined = $state();
	let panelEl: HTMLDivElement | undefined = $state();

	function toggle() {
		open = !open;
	}

	function close() {
		open = false;
	}

	$effect(() => {
		if (!open) return;

		function onKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				close();
				triggerEl?.focus();
			}
		}

		function onMouseDown(e: MouseEvent) {
			const target = e.target as Node;
			if (triggerEl?.contains(target)) return;
			if (panelEl?.contains(target)) return;
			close();
		}

		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('mousedown', onMouseDown);

		return () => {
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('mousedown', onMouseDown);
		};
	});
</script>

<div class="relative inline-flex">
	<button
		bind:this={triggerEl}
		data-testid="avatar-menu-trigger"
		type="button"
		onclick={toggle}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label={m.nav_user_menu_aria()}
		class="inline-flex items-center justify-center w-[30px] h-[30px] bg-paper-3 text-ink rounded-full font-bold text-xs border border-ink-5"
	>
		{initial}
	</button>

	{#if open}
		<div
			bind:this={panelEl}
			data-testid="avatar-menu-panel"
			role="menu"
			class="absolute top-full right-0 mt-1.5 min-w-[200px] bg-paper border border-ink/10 rounded shadow-lg p-3 z-50"
		>
			<div class="font-mono text-[10px] text-ink-3 tracking-widest uppercase mb-0.5">
				{m.nav_signed_in_as()}
			</div>
			<div class="text-sm font-semibold text-ink mb-2">{name}</div>
			<div class="h-px bg-ink-5 -mx-3 mb-1"></div>
			<a
				data-testid="avatar-menu-signout"
				role="menuitem"
				href="/auth/logout"
				class="flex items-center justify-between text-sm text-ink hover:bg-paper-2 -mx-3 px-3 py-1.5 no-underline"
			>
				<span>{m.nav_sign_out()}</span>
				<span class="font-display text-base text-ink-3" aria-hidden="true">→</span>
			</a>
		</div>
	{/if}
</div>
```

- [ ] **Step 4: Byrd — gates**

```bash
pnpm test src/lib/components/AvatarMenu.spec.ts -- --run
pnpm check && pnpm lint
```

Expect: 7/7 pass; check 0 errors; lint clean.

- [ ] **Step 5: Byrd — commit RED+GREEN**

```bash
export MVOX_EXPECTED_BRANCH=chore/avatar-menu
git add src/lib/components/AvatarMenu.svelte src/lib/components/AvatarMenu.spec.ts
git commit -m "$(cat <<'EOF'
feat(#75): AvatarMenu — trigger button + drop-down panel

Self-contained avatar menu component: avatar tile becomes a button
that toggles a paper-card drop-down with "Signed in as {name}" +
"Sign out" → /auth/logout. Esc closes + returns focus to trigger.
Outside-click closes. ARIA: aria-haspopup="menu", aria-expanded,
aria-label "User menu". Pure Svelte 5; no headless library.

Reviewed-by: Tallis (RED spec)
EOF
)"
git push
```

---

### Task 4: MvoxNav — wire AvatarMenu in

**Files:**
- Modify: `src/lib/components/MvoxNav.svelte`
- Modify: `src/lib/components/MvoxNav.spec.ts`

Replace the inline avatar+name block in the signed-in branch with `<AvatarMenu>`.

- [ ] **Step 1: Tallis RED** — read existing `src/lib/components/MvoxNav.spec.ts`. Add a new test asserting MvoxNav renders the AvatarMenu trigger when signedIn:

```ts
// Add inside the existing describe block:

it('renders AvatarMenu trigger when signedIn (CHORE-75)', () => {
	const { container } = render(MvoxNav, {
		signedIn: true,
		userName: 'Mihkel Putrinš',
		userInitial: 'M',
		currentTab: 'agenda',
	});
	const trigger = container.querySelector('button[data-testid="avatar-menu-trigger"]');
	expect(trigger).not.toBeNull();
	expect(trigger?.textContent).toContain('M');
});
```

If existing tests assert the inline-avatar text shape (`<span>{userName}</span>` next to a tile), update those assertions to expect the new AvatarMenu trigger shape — invoke the Bentham CHORE-72-Task-15 mechanical-update rule + flag in commit body. Spec intent (shows the user name to the signed-in user) is preserved — name now lives in the dropdown panel.

Pre-format. Hand off — no commit.

- [ ] **Step 2: Tallis — verify RED**

```bash
pnpm test src/lib/components/MvoxNav.spec.ts 2>&1 | tail -15
```

- [ ] **Step 3: Byrd GREEN — modify MvoxNav.svelte**

Read existing file. Locate the signed-in branch's avatar+name block (roughly the `<span class="inline-flex items-center gap-1.5 font-sans text-[11.5px]">` containing the initial tile + name). Replace with:

```svelte
<AvatarMenu name={userName} initial={userInitial} />
```

Add to the imports:

```ts
import AvatarMenu from './AvatarMenu.svelte';
```

- [ ] **Step 4: Byrd — gates**

```bash
pnpm test:unit -- --run
pnpm check && pnpm lint
```

Expect: all green. New test passes; existing tests pass (with mechanical updates if needed).

- [ ] **Step 5: Byrd — commit**

```bash
export MVOX_EXPECTED_BRANCH=chore/avatar-menu
git add src/lib/components/MvoxNav.svelte src/lib/components/MvoxNav.spec.ts
git commit -m "$(cat <<'EOF'
feat(#75): MvoxNav wires AvatarMenu — avatar becomes menu trigger

Replace the inline avatar+name block with <AvatarMenu>. User name now
lives inside the dropdown panel (under "Signed in as"); only the
initial tile shows in the navbar.

[mechanical test updates per CHORE-72 Task-15 rule if any]

Reviewed-by: Tallis (RED spec)
EOF
)"
git push
```

---

## Review

### Task 5: Bentham — branch review

**Owner:** Bentham.

- [ ] **Step 1: Read every commit** — `git log --oneline main..HEAD`.

- [ ] **Step 2: Discrete gates per CALIBRATION-PNPM-CHECK-FRESH-RUN:**
   - `pnpm check`
   - `pnpm test:unit`
   - `pnpm lint`
   - `pnpm build`

- [ ] **Step 3: Spec-vs-impl audit** on the 11 ACs from #75.

- [ ] **Step 4: A11y spot-check** — ARIA wiring matches the spec (aria-haspopup, aria-expanded toggles correctly, aria-label, role=menu, role=menuitem). Focus return to trigger on Esc.

- [ ] **Step 5: Vocabulary-neutrality grep** — confirm no "choir"/"orchestra"/"sing" tokens in `AvatarMenu.svelte` / `MvoxNav.svelte` outside i18n consumption.

- [ ] **Step 6: PO-name-in-navbar question** — spec defaulted to hide-name-in-navbar (move into dropdown). If Bentham feels this is a UX regression, YELLOW with a recommendation to keep the name inline AND in the dropdown.

- [ ] **Step 7: Write review report** — verdict + per-AC + ARIA + grep results. SendMessage to team-lead.

---

## Merge

### Task 6: Josquin — merge + deploy + close #75 + delete branch

**Owner:** Josquin.

- [ ] **Step 1: Check merge-shape** — `git log --oneline HEAD..main`. If empty, no merge-main-first needed (branch was created from current main). If non-empty, do the merge-main-first dance per CHORE-72 lesson.

- [ ] **Step 2: Re-run full gate on tip** (discrete calls).

- [ ] **Step 3: Squash to main:**

```bash
git checkout main && git pull
MVOX_EXPECTED_BRANCH=main git merge --squash chore/avatar-menu
MVOX_EXPECTED_BRANCH=main git commit -m "$(cat <<'EOF'
feat(#75): avatar dropdown user menu — sign out from UI

Add a logout affordance: the MvoxNav avatar tile becomes a button
that toggles a small paper-card drop-down menu. Menu shows:
- "Signed in as {name}" eyebrow + user name
- "Sign out" item → /auth/logout

Component: AvatarMenu (src/lib/components/AvatarMenu.svelte).
Pure Svelte 5; no headless library. Self-contained
open/close + Esc + outside-click + ARIA wiring (aria-haspopup,
aria-expanded, aria-label, role=menu, role=menuitem).

MvoxNav.svelte replaces its inline avatar block with <AvatarMenu>;
user name moves into the dropdown so only the initial tile shows
in the navbar.

2 new i18n keys × 4 locales: nav_signed_in_as, nav_user_menu_aria.
nav_sign_out (existing) consumed.

Unblocks PO's ability to test login/logout cycles end-to-end (the
CHORE-74 state-propagation fix needed a UI logout to be testable
in the wild).

No schema impact.

Closes #75

Reviewed-by: Bentham
Contributors: Tallis, Byrd, Comenius
EOF
)"
```

(L104: no `Co-authored-by:` in body.)

- [ ] **Step 4: Push.**

- [ ] **Step 5: Wrangler deploy** + probe production.

- [ ] **Step 6: Close GH #75** with the squash SHA + per-build URL.

- [ ] **Step 7: Delete branch local + remote.**

- [ ] **Step 8: Report.**

---

## Self-review checklist (team-lead)

- [x] **Spec coverage:** all 11 ACs from #75 → task coverage. AC1-2-3-4-5-6 = Tasks 3+4; AC7 = Task 2; AC8-9-10 = gates; AC11 = Task 5.
- [x] **No placeholders.** Every step has executable content.
- [x] **Type consistency:** `AvatarMenuProps = { name: string; initial: string }` consistent across spec + component + MvoxNav call site.
- [x] **Plan execution mode:** team-driven only.
- [x] **Sequencing discipline:** explicit at top.

(*MVOX:Palestrina*)
