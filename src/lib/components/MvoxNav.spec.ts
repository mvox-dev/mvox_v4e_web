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

	it('AC2 — clicking hamburger opens collapsed menu listing all 5 tab labels', async () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const hamburger = container.querySelector(
			'[data-testid="nav-tab-menu-trigger"]',
		) as HTMLButtonElement;
		expect(hamburger).not.toBeNull();
		await fireEvent.click(hamburger);
		const menu = container.querySelector('[data-testid="nav-tab-menu"]');
		expect(menu).not.toBeNull();
		// All 5 tab labels must appear in the opened dropdown.
		// We check for the paraglide message keys' output — not hardcoded strings,
		// but verify the tab entries exist structurally via data-testid pattern.
		const tabItems = menu?.querySelectorAll('[data-testid^="nav-tab-menu-item-"]');
		expect(tabItems?.length).toBe(5);
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
		// All 5 tabs must be present inside the inline row
		const inlineItems = inlineTabRow?.querySelectorAll('[data-testid^="nav-inline-tab-"]');
		expect(inlineItems?.length).toBe(5);
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
	// jsdom can't measure pixel overflow. Structural guard: the <header> must NOT
	// carry `overflow-x-visible` or have no overflow constraint at all —
	// it must carry `overflow-x-hidden` (or `overflow-hidden`) so any stray child
	// can't cause body scroll.
	// NOTE: a Playwright test at viewport 320px is the truer check — see test-gaps.md.
	it('AC7 — header carries overflow-x-hidden to prevent body horizontal scroll', () => {
		const { container } = render(MvoxNav, { props: signedInProps });
		const header = container.querySelector('header');
		expect(header).not.toBeNull();
		const cls = header?.className ?? '';
		// Accept either `overflow-hidden` (all axes) or `overflow-x-hidden`
		expect(cls.includes('overflow-x-hidden') || cls.includes('overflow-hidden')).toBe(true);
	});
});
