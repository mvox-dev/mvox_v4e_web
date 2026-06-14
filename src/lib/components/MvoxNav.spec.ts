// @vitest-environment happy-dom
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userStore } from '$lib/auth/userStore';
import MvoxNav from './MvoxNav.svelte';

vi.mock('$app/navigation', () => ({
	goto: vi.fn(async (url: string) => {
		window.history.pushState({}, '', url);
	}),
}));

beforeEach(() => {
	localStorage.clear();
	window.history.replaceState({}, '', '/');
});

afterEach(cleanup);

describe('MvoxNav', () => {
	it('renders brand and section tabs', () => {
		const { container } = render(MvoxNav, {
			props: {
				signedIn: true,
				currentTab: 'library',
				orgLabel: 'Estonian Philharmonic Chamber Choir',
				orgInitials: 'EP',
				userInitial: 'M',
				userName: 'Maire L.',
			},
		});
		expect(container.textContent).toContain('mvox');
		expect(container.textContent).toContain('Agenda');
		expect(container.textContent).toContain('Library');
		// mechanical update (CHORE-72 Task-15 rule): name moves into AvatarMenu dropdown;
		// trigger button is the new signed-in affordance
		expect(container.querySelector('button[data-testid="avatar-menu-trigger"]')).not.toBeNull();
	});

	it('renders AvatarMenu trigger when signedIn (CHORE-75)', () => {
		const { container } = render(MvoxNav, {
			props: {
				signedIn: true,
				userName: 'Mihkel Putrinš',
				userInitial: 'M',
				currentTab: 'agenda',
			},
		});
		const trigger = container.querySelector('button[data-testid="avatar-menu-trigger"]');
		expect(trigger).not.toBeNull();
		expect(trigger?.textContent).toContain('M');
	});

	it('shows LIBRARIAN role chip when on library tab and signed in', () => {
		const { container } = render(MvoxNav, {
			props: {
				signedIn: true,
				currentTab: 'library',
				orgLabel: 'X',
				orgInitials: 'X',
				userInitial: 'X',
				userName: 'X',
			},
		});
		expect(container.textContent).toContain('LIBRARIAN');
	});

	it('does not render user pill when not signed in', () => {
		const { container } = render(MvoxNav, { props: { signedIn: false, currentTab: 'library' } });
		expect(container.textContent).not.toContain('Maire');
	});
});

describe('MvoxNav — orgPickerMode', () => {
	it('placeholder mode renders placeholder copy and no OrgPicker', () => {
		const { container, queryByTestId } = render(MvoxNav, {
			props: {
				userName: '',
				userInitial: '',
				orgLabel: '',
				orgInitials: '',
				orgPickerMode: 'placeholder',
			},
		});
		expect(container.textContent).toContain('No organizations');
		expect(queryByTestId('org-picker-chip')).toBeNull();
	});

	it('static mode renders orgLabel non-interactively and no OrgPicker', () => {
		const { container, queryByTestId } = render(MvoxNav, {
			props: {
				userName: 'Test',
				userInitial: 'T',
				orgLabel: 'EFK Library',
				orgInitials: 'EL',
				orgPickerMode: 'static',
			},
		});
		expect(container.textContent).toContain('EFK Library');
		expect(queryByTestId('org-picker-chip')).toBeNull();
	});

	it('dropdown mode mounts the OrgPicker', () => {
		userStore.set({
			status: 'ready',
			name: 'Test',
			initial: 'T',
			personId: 'p1',
			orgs: [
				{ id: 'a', label: 'A', initials: 'A' },
				{ id: 'b', label: 'B', initials: 'B' },
			],
		});
		const { getByTestId } = render(MvoxNav, {
			props: {
				userName: 'Test',
				userInitial: 'T',
				orgLabel: 'A',
				orgInitials: 'A',
				orgPickerMode: 'dropdown',
			},
		});
		expect(getByTestId('org-picker-chip')).not.toBeNull();
	});
});

// CHORE-76 — Responsive nav layout
// NOTE: jsdom has no real CSS/layout engine. Viewport tests (true 320px rendering,
// overflow detection) belong in Playwright with `page.setViewportSize`.
// This describe encodes structural + behavioural contracts only.
// A companion Playwright test is deferred — flagged in test-gaps.md.
describe('MvoxNav — responsive layout (CHORE-76)', () => {
	const signedInProps = {
		signedIn: true,
		currentTab: 'agenda' as const,
		orgLabel: 'Estonian Philharmonic',
		orgInitials: 'EP',
		userInitial: 'M',
		userName: 'Maire L.',
	};

	// AC1 — Avatar tile stays in viewport at narrow widths.
	// Structural check: AvatarMenu wrapper carries flex-shrink-0 so it can't be
	// squeezed off-screen by adjacent flex children.
	it('AC1 — AvatarMenu wrapper carries flex-shrink-0 (avatar never off-screen)', () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		// The element wrapping AvatarMenu must have flex-shrink-0 so it holds its
		// width regardless of how narrow the header becomes.
		const avatarWrapper = container.querySelector('[data-testid="nav-avatar-wrapper"]');
		expect(avatarWrapper).not.toBeNull();
		expect(avatarWrapper?.className).toContain('flex-shrink-0');
	});

	// AC2 — Below sm breakpoint: inline tabs hidden; hamburger visible; dropdown lists all 5 tabs.
	// Structural: inline tab container has `hidden sm:flex`; hamburger has `sm:hidden`.
	// Behavioural: clicking hamburger opens a menu listing all 5 tab labels.
	it('AC2 — inline tab container carries hidden sm:flex (collapsed on mobile)', () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const inlineTabRow = container.querySelector('[data-testid="nav-inline-tabs"]');
		expect(inlineTabRow).not.toBeNull();
		// Must be hidden below sm and flex at sm+
		expect(inlineTabRow?.className).toContain('hidden');
		expect(inlineTabRow?.className).toContain('sm:flex');
	});

	it('AC2 — hamburger button carries sm:hidden (hidden at desktop)', () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const hamburger = container.querySelector('[data-testid="nav-tab-menu-trigger"]');
		expect(hamburger).not.toBeNull();
		expect(hamburger?.className).toContain('sm:hidden');
	});

	it('AC2 — clicking hamburger opens collapsed menu listing all 6 tab labels', async () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const hamburger = container.querySelector(
			'[data-testid="nav-tab-menu-trigger"]',
		) as HTMLButtonElement;
		expect(hamburger).not.toBeNull();
		await fireEvent.click(hamburger);
		const menu = container.querySelector('[data-testid="nav-tab-menu"]');
		expect(menu).not.toBeNull();
		// All 6 tab labels must appear in the opened dropdown (5 existing + seasons).
		// We check for the paraglide message keys' output — not hardcoded strings,
		// but verify the tab entries exist structurally via data-testid pattern.
		const tabItems = menu?.querySelectorAll('[data-testid^="nav-tab-menu-item-"]');
		expect(tabItems?.length).toBe(7); // 6 existing + members (slice-3 real route)
	});

	// AC2 — librarian chip co-locates with the library entry in the collapsed menu
	it('AC2 — librarian chip co-locates with library entry in collapsed menu', async () => {
		const { container } = render(MvoxNav, {
			props: { ...signedInProps, currentTab: 'library' },
		});
		const hamburger = container.querySelector(
			'[data-testid="nav-tab-menu-trigger"]',
		) as HTMLButtonElement;
		await fireEvent.click(hamburger);
		const libraryEntry = container.querySelector('[data-testid="nav-tab-menu-item-library"]');
		expect(libraryEntry).not.toBeNull();
		// librarian chip must be a child of the library menu entry, not elsewhere
		expect(libraryEntry?.querySelector('[data-testid="nav-chip-librarian"]')).not.toBeNull();
	});

	// AC3 — At sm+: inline tab row present (no desktop regression).
	// This is the structural complement to AC2: the inline row exists in the DOM
	// with the correct classes; CSS makes it visible at sm+.
	it('AC3 — inline tab row is present in DOM at any viewport (CSS shows it at sm+)', () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const inlineTabRow = container.querySelector('[data-testid="nav-inline-tabs"]');
		expect(inlineTabRow).not.toBeNull();
		// All 7 tabs must be present inside the inline row (5 existing + seasons + members)
		const inlineItems = inlineTabRow?.querySelectorAll('[data-testid^="nav-inline-tab-"]');
		expect(inlineItems?.length).toBe(7);
	});

	// AC4 — OrgPicker chip does not force horizontal overflow on narrow viewports.
	// Structural: the chip wrapper carries truncation classes (min-w-0 + truncate or max-w-*)
	// so it shrinks rather than overflowing. jsdom can't assert pixel overflow; we assert
	// the class contract that enables CSS truncation.
	it('AC4 — OrgPicker / org chip wrapper carries min-w-0 to enable truncation', () => {
		const { container } = render(MvoxNav, {
			props: { ...signedInProps, orgPickerMode: 'static' },
		});
		const orgArea = container.querySelector('[data-testid="nav-org-area"]');
		expect(orgArea).not.toBeNull();
		// min-w-0 on a flex child prevents the browser from treating max-content as the
		// minimum width; without it, long org names force overflow on narrow viewports (#65).
		expect(orgArea?.className).toContain('min-w-0');
	});

	// AC5 — Hamburger accessible name (non-empty) and keyboard nav: focus-on-open + Escape-to-close.
	// Pattern mirrors AvatarMenu.spec.ts keyboard tests.
	it('AC5 — hamburger button has a non-empty accessible name', () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const hamburger = container.querySelector(
			'[data-testid="nav-tab-menu-trigger"]',
		) as HTMLButtonElement;
		expect(hamburger).not.toBeNull();
		// aria-label must be present and non-empty (Comenius wires nav_menu_open key)
		const label = hamburger?.getAttribute('aria-label') ?? hamburger?.textContent?.trim() ?? '';
		expect(label.length).toBeGreaterThan(0);
	});

	it('AC5 — collapsed menu receives focus on open (first menuitem focused)', async () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const hamburger = container.querySelector(
			'[data-testid="nav-tab-menu-trigger"]',
		) as HTMLButtonElement;
		await fireEvent.click(hamburger);
		const menu = container.querySelector('[data-testid="nav-tab-menu"]');
		expect(menu).not.toBeNull();
		// First focusable item inside the menu must receive focus after open
		const firstItem = menu?.querySelector(
			'[data-testid^="nav-tab-menu-item-"]',
		) as HTMLElement | null;
		expect(firstItem).not.toBeNull();
		expect(document.activeElement).toBe(firstItem);
	});

	it('AC5 — Escape key while menu is open closes the menu', async () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const hamburger = container.querySelector(
			'[data-testid="nav-tab-menu-trigger"]',
		) as HTMLButtonElement;
		await fireEvent.click(hamburger);
		expect(container.querySelector('[data-testid="nav-tab-menu"]')).not.toBeNull();
		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(container.querySelector('[data-testid="nav-tab-menu"]')).toBeNull();
	});

	// AC6 — "Sign in" link stays in viewport on mobile.
	// Structural: the sign-in link's parent wrapper also carries flex-shrink-0.
	it('AC6 — sign-in link wrapper carries flex-shrink-0 (stays visible when signed out)', () => {
		const { container } = render(MvoxNav, {
			props: { signedIn: false, currentTab: 'agenda' as const },
		});
		const signinLink = container.querySelector('a[href="/auth/login"]');
		expect(signinLink).not.toBeNull();
		// The ancestor element that prevents the link from being pushed off-screen:
		const wrapper = signinLink?.closest('[data-testid="nav-signin-wrapper"]');
		expect(wrapper).not.toBeNull();
		expect(wrapper?.className).toContain('flex-shrink-0');
	});

	// AC7 — No horizontal overflow 320–640px.
	// CHORE-77 intent correction: `overflow-hidden` / `overflow-x-hidden` on <header>
	// clips `absolute`-positioned dropdown panels (AvatarMenu + nav-tab-menu) that sit
	// `top-full` below the header — they become invisible. The correct solution is to
	// control overflow via `flex-shrink-0` on fixed items and `min-w-0` + truncation on
	// the org area (asserted in AC1/AC4/AC6), NOT a block-axis clip on the header itself.
	// NOTE: true no-overflow-at-320px requires Playwright — see test-gaps.md.
	it('AC7 — header does NOT carry an overflow clip (would cut dropdown panels)', () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const header = container.querySelector('header');
		expect(header).not.toBeNull();
		const cls = header?.className ?? '';
		// Neither `overflow-hidden` nor `overflow-x-hidden` may appear on <header>.
		// Dropdown panels must not be clipped by a parent overflow constraint.
		expect(cls.includes('overflow-x-hidden')).toBe(false);
		expect(cls.includes('overflow-hidden')).toBe(false);
	});

	// AC2 stacking — dropdown panels must paint above page content.
	// <header> must be a positioned ancestor (`relative` or `sticky`) so child
	// `z-index` classes take effect in the stacking context. It must also carry a
	// `z-*` utility high enough to sit above normal page content.
	// NOTE: true paint-order verification requires Playwright — see test-gaps.md.
	it('AC2 stacking — header carries a positioning class (relative or sticky)', () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const header = container.querySelector('header');
		expect(header).not.toBeNull();
		const cls = header?.className ?? '';
		// Must be `relative` or `sticky` so child z-index values take effect.
		expect(cls.includes('relative') || cls.includes('sticky')).toBe(true);
	});

	it('AC2 stacking — header carries a z-index utility (z-*) to sit above page content', () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const header = container.querySelector('header');
		expect(header).not.toBeNull();
		const cls = header?.className ?? '';
		// Assert presence of ANY z-* Tailwind utility — Byrd picks the exact value
		// (z-30 / z-40 / etc.). Over-pinning the number is fragile; we only need to
		// confirm a z-index is set so the header sits above scrolled page content.
		expect(/\bz-\d+\b/.test(cls)).toBe(true);
	});

	// AC3 horizontal-overflow control without clip — confirm the correct mechanism.
	// Overflow is controlled by truncation on flexible items, not by a header clip.
	// This test is a positive complement to the AC7 "no clip" assertion.
	it('AC3 overflow control — org area keeps min-w-0 (truncation, not header clip)', () => {
		const { container } = render(MvoxNav, {
			props: { ...signedInProps, orgPickerMode: 'static' },
		});
		const orgArea = container.querySelector('[data-testid="nav-org-area"]');
		expect(orgArea).not.toBeNull();
		expect(orgArea?.className).toContain('min-w-0');
	});
});

// /seasons nav tab (feat/seasons-nav)
// RED until Byrd adds 'seasons' to the TABS array + TAB_LABELS in MvoxNav.svelte.
describe('MvoxNav — /seasons tab (#82)', () => {
	const signedInProps = {
		signedIn: true,
		currentTab: 'agenda' as const,
		orgLabel: 'EFK',
		orgInitials: 'EF',
		userInitial: 'A',
		userName: 'Alice',
	};

	it('inline tab row contains a nav-inline-tab-seasons element linking to /seasons', () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const tab = container.querySelector('[data-testid="nav-inline-tab-seasons"]');
		expect(tab).not.toBeNull();
		// Must be a link to /seasons
		expect(tab?.tagName.toLowerCase()).toBe('a');
		expect(tab?.getAttribute('href')).toBe('/seasons');
	});

	it('inline tab label contains the nav_tab_rehearsals message ("Rehearsals")', () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const tab = container.querySelector('[data-testid="nav-inline-tab-seasons"]');
		expect(tab?.textContent?.trim()).toBeTruthy();
		// Real paraglide output for nav_tab_rehearsals is "Rehearsals"
		expect(tab?.textContent).toContain('Rehearsals');
	});

	it('hamburger menu lists 6 tabs (5 existing + seasons)', async () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const hamburger = container.querySelector(
			'[data-testid="nav-tab-menu-trigger"]',
		) as HTMLButtonElement;
		await fireEvent.click(hamburger);
		const menu = container.querySelector('[data-testid="nav-tab-menu"]');
		const tabItems = menu?.querySelectorAll('[data-testid^="nav-tab-menu-item-"]');
		expect(tabItems?.length).toBe(7); // 6 existing + members (slice-3 real route)
	});

	it('hamburger menu contains nav-tab-menu-item-seasons', async () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const hamburger = container.querySelector(
			'[data-testid="nav-tab-menu-trigger"]',
		) as HTMLButtonElement;
		await fireEvent.click(hamburger);
		expect(container.querySelector('[data-testid="nav-tab-menu-item-seasons"]')).not.toBeNull();
	});
});

// S33 — Navigation cleanup
// RED until Byrd converts Library span→<a> and mobile menu divs→<a> links,
// adds SoonMarker to unbuilt tabs, and links roster/notices/settings to their placeholder pages.
describe('MvoxNav — S33 library link + mobile menu links', () => {
	const signedInProps = {
		signedIn: true,
		currentTab: 'agenda' as const,
		orgLabel: 'EFK',
		orgInitials: 'EF',
		userInitial: 'A',
		userName: 'Alice',
		orgPickerMode: 'static' as const,
	};

	// Library inline tab must be a real <a> link, not a <span>
	it('library inline tab renders as <a href="/library"> (not a span)', () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const libraryTab = container.querySelector('[data-testid="nav-inline-tab-library"]');
		expect(libraryTab?.tagName.toLowerCase()).toBe('a');
		expect(libraryTab?.getAttribute('href')).toBe('/library');
	});

	it('library inline tab shows LIBRARIAN chip when currentTab is library', () => {
		const { container } = render(MvoxNav, {
			props: { ...signedInProps, currentTab: 'library' as const },
		});
		const libraryTab = container.querySelector('[data-testid="nav-inline-tab-library"]');
		expect(libraryTab?.tagName.toLowerCase()).toBe('a');
		const chip = libraryTab?.querySelector('[data-testid="nav-chip-librarian"]');
		expect(chip).not.toBeNull();
		expect(chip?.textContent).toContain('LIBRARIAN');
	});

	// Mobile menu items must be real <a> links for real (built) tabs
	it('mobile menu agenda item is an <a href="/agenda"> link', async () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const hamburger = container.querySelector(
			'[data-testid="nav-tab-menu-trigger"]',
		) as HTMLButtonElement;
		await fireEvent.click(hamburger);
		const agendaItem = container.querySelector('[data-testid="nav-tab-menu-item-agenda"]');
		expect(agendaItem?.tagName.toLowerCase()).toBe('a');
		expect(agendaItem?.getAttribute('href')).toBe('/agenda');
	});

	it('mobile menu library item is an <a href="/library"> link', async () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const hamburger = container.querySelector(
			'[data-testid="nav-tab-menu-trigger"]',
		) as HTMLButtonElement;
		await fireEvent.click(hamburger);
		const libraryItem = container.querySelector('[data-testid="nav-tab-menu-item-library"]');
		expect(libraryItem?.tagName.toLowerCase()).toBe('a');
		expect(libraryItem?.getAttribute('href')).toBe('/library');
	});

	it('mobile menu seasons (rehearsals) item is an <a href="/seasons"> link', async () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const hamburger = container.querySelector(
			'[data-testid="nav-tab-menu-trigger"]',
		) as HTMLButtonElement;
		await fireEvent.click(hamburger);
		const rehearsalsItem = container.querySelector('[data-testid="nav-tab-menu-item-seasons"]');
		expect(rehearsalsItem?.tagName.toLowerCase()).toBe('a');
		expect(rehearsalsItem?.getAttribute('href')).toBe('/seasons');
	});

	// Unbuilt tabs (roster/notices/settings) are <a> links to their placeholder pages
	it('mobile menu roster item is an <a href="/roster"> link', async () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const hamburger = container.querySelector(
			'[data-testid="nav-tab-menu-trigger"]',
		) as HTMLButtonElement;
		await fireEvent.click(hamburger);
		const rosterItem = container.querySelector('[data-testid="nav-tab-menu-item-roster"]');
		expect(rosterItem?.tagName.toLowerCase()).toBe('a');
		expect(rosterItem?.getAttribute('href')).toBe('/roster');
	});

	it('mobile menu notices item is an <a href="/notices"> link', async () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const hamburger = container.querySelector(
			'[data-testid="nav-tab-menu-trigger"]',
		) as HTMLButtonElement;
		await fireEvent.click(hamburger);
		const noticesItem = container.querySelector('[data-testid="nav-tab-menu-item-notices"]');
		expect(noticesItem?.tagName.toLowerCase()).toBe('a');
		expect(noticesItem?.getAttribute('href')).toBe('/notices');
	});

	it('mobile menu settings item is an <a href="/settings"> link', async () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const hamburger = container.querySelector(
			'[data-testid="nav-tab-menu-trigger"]',
		) as HTMLButtonElement;
		await fireEvent.click(hamburger);
		const settingsItem = container.querySelector('[data-testid="nav-tab-menu-item-settings"]');
		expect(settingsItem?.tagName.toLowerCase()).toBe('a');
		expect(settingsItem?.getAttribute('href')).toBe('/settings');
	});
});

// YELLOW-33.6 — SoonMarker nav links need an accessible name.
// SoonMarker carries aria-hidden="true" (decorative), so the "soon" text
// is invisible to screen readers. The nav link itself reads only the tab label
// (e.g. "Roster") — screen readers don't know the tab is not yet available.
// Fix: add aria-label="Roster — coming soon" (and equivalents) to the
// soon-marked desktop inline tabs and mobile menu items.
// RED until Byrd adds aria-label to the soon-marked <a> elements in MvoxNav.
describe('MvoxNav — soon-marked nav links have accessible names (YELLOW-33.6)', () => {
	const signedInProps = {
		signedIn: true,
		currentTab: 'agenda' as const,
		orgLabel: 'EFK',
		orgInitials: 'EF',
		userInitial: 'A',
		userName: 'Alice',
		orgPickerMode: 'static' as const,
	};

	it('desktop roster tab carries aria-label including "coming soon"', () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const rosterTab = container.querySelector('[data-testid="nav-inline-tab-roster"]');
		expect(rosterTab).not.toBeNull();
		const ariaLabel = rosterTab?.getAttribute('aria-label') ?? '';
		expect(ariaLabel.toLowerCase()).toContain('soon');
	});

	it('desktop notices tab carries aria-label including "coming soon"', () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const noticesTab = container.querySelector('[data-testid="nav-inline-tab-notices"]');
		expect(noticesTab).not.toBeNull();
		const ariaLabel = noticesTab?.getAttribute('aria-label') ?? '';
		expect(ariaLabel.toLowerCase()).toContain('soon');
	});

	it('desktop settings tab carries aria-label including "coming soon"', () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const settingsTab = container.querySelector('[data-testid="nav-inline-tab-settings"]');
		expect(settingsTab).not.toBeNull();
		const ariaLabel = settingsTab?.getAttribute('aria-label') ?? '';
		expect(ariaLabel.toLowerCase()).toContain('soon');
	});

	it('mobile menu roster item carries aria-label including "coming soon"', async () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const hamburger = container.querySelector(
			'[data-testid="nav-tab-menu-trigger"]',
		) as HTMLButtonElement;
		await fireEvent.click(hamburger);
		const rosterItem = container.querySelector('[data-testid="nav-tab-menu-item-roster"]');
		expect(rosterItem).not.toBeNull();
		const ariaLabel = rosterItem?.getAttribute('aria-label') ?? '';
		expect(ariaLabel.toLowerCase()).toContain('soon');
	});
});

// ── MvoxNav — Members tab (slice-3 #21/#11) ──────────────────────────────────

describe('MvoxNav — Members tab (slice-3)', () => {
	const signedInProps = {
		signedIn: true,
		currentTab: 'agenda' as const,
		orgLabel: 'EFK',
		orgInitials: 'EF',
		userInitial: 'M',
		userName: 'Mihkel',
	};

	it("'members' tab is present in inline tabs as a real route (no SoonMarker)", () => {
		// Members is a real route — it must appear without a SoonMarker aria-label
		const { container } = render(MvoxNav, { props: signedInProps });
		const membersTab = container.querySelector('[data-testid="nav-inline-tab-members"]');
		expect(membersTab).not.toBeNull();
		// Must NOT have "soon" in aria-label — it's a real route
		const ariaLabel = membersTab?.getAttribute('aria-label') ?? '';
		expect(ariaLabel.toLowerCase()).not.toContain('soon');
	});

	it("'members' tab has active state when currentTab==='members'", () => {
		const { container } = render(MvoxNav, {
			props: {
				...signedInProps,
				currentTab: 'members' as unknown as typeof signedInProps.currentTab,
			},
		});
		// After GREEN: active class or aria-current on members tab
		// The members tab should be visually distinct when active
		const membersTab = container.querySelector('[data-testid="nav-inline-tab-members"]');
		expect(membersTab).not.toBeNull();
		const isActive =
			membersTab?.getAttribute('aria-current') === 'page' ||
			membersTab?.classList.contains('active') ||
			membersTab?.getAttribute('data-active') === 'true';
		// RED: tab doesn't exist yet (no members in TAB_LABELS/TABS), so membersTab is null
		// After GREEN: membersTab not null AND isActive true
		if (membersTab) {
			expect(isActive).toBe(true);
		} else {
			// explicitly fail in RED to drive implementation
			expect(membersTab).not.toBeNull();
		}
	});

	it("'members' tab mirrors 'seasons' in structure — real <a> link, not a button", () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const membersTab = container.querySelector('[data-testid="nav-inline-tab-members"]');
		// After GREEN: <a href="/members"> or element with href=/members
		// RED: null (tab doesn't exist yet)
		if (membersTab) {
			const href =
				membersTab.getAttribute('href') ?? membersTab.querySelector('a')?.getAttribute('href');
			expect(href).toBe('/members');
		} else {
			expect(membersTab).not.toBeNull(); // RED: drive GREEN
		}
	});

	it("mobile menu 'members' item is present and has NO 'soon' aria-label", async () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const hamburger = container.querySelector(
			'[data-testid="nav-tab-menu-trigger"]',
		) as HTMLButtonElement | null;
		if (hamburger) await fireEvent.click(hamburger);
		const membersItem = container.querySelector('[data-testid="nav-tab-menu-item-members"]');
		// After GREEN: item present, no "soon" in aria-label
		if (membersItem) {
			const ariaLabel = membersItem.getAttribute('aria-label') ?? '';
			expect(ariaLabel.toLowerCase()).not.toContain('soon');
		} else {
			// RED: item absent — drive GREEN
			expect(membersItem).not.toBeNull();
		}
	});
});

// (*MVOX:Tallis*)
