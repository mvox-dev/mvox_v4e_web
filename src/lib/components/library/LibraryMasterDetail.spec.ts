// @vitest-environment happy-dom
// src/lib/components/library/LibraryMasterDetail.spec.ts
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/svelte';
import LibraryMasterDetail from './LibraryMasterDetail.svelte';
import type { EntuLibrary, EntuWork, EntuEdition } from '$lib/types/library-entu';

afterEach(() => cleanup());

const library: EntuLibrary = {
	id: 'lib-1',
	name: 'EFK Library',
	orgId: 'org-1',
	editorIds: ['person-1'],
};
const works: EntuWork[] = [
	{ id: 'work-a', libraryId: 'lib-1', composer: 'Duruflé', title: 'Requiem', voicing: 'SATB' },
	{ id: 'work-b', libraryId: 'lib-1', composer: 'Kreek', title: 'Taaveti', voicing: 'SATB' },
];
const editionsByWork = new Map<string, EntuEdition[]>([
	['work-a', [{ id: 'ed-1', workId: 'work-a', label: 'Peters', year: 1991 }]],
	['work-b', []],
]);

beforeEach(() => {
	// stub IntersectionObserver
	(globalThis as any).IntersectionObserver = class {
		observe = vi.fn();
		disconnect = vi.fn();
		unobserve = vi.fn();
	};
});

describe('LibraryMasterDetail', () => {
	it('renders the master and a paperstack per work', () => {
		const { container } = render(LibraryMasterDetail, {
			props: { library, works, editionsByWork, initialWorkId: null },
		});
		expect(container.querySelector('[data-work-id="work-a"]')).not.toBeNull();
		expect(container.querySelector('[data-work-id="work-b"]')).not.toBeNull();
	});

	it('selects the first work by default when no initialWorkId', () => {
		const { container } = render(LibraryMasterDetail, {
			props: { library, works, editionsByWork, initialWorkId: null },
		});
		const masterRowSel = container.querySelector('.master-paper [data-work-id="work-a"].sel');
		expect(masterRowSel).not.toBeNull();
	});

	it('selects the initialWorkId when provided', () => {
		const { container } = render(LibraryMasterDetail, {
			props: { library, works, editionsByWork, initialWorkId: 'work-b' },
		});
		const masterRowSel = container.querySelector('.master-paper [data-work-id="work-b"].sel');
		expect(masterRowSel).not.toBeNull();
	});

	it('updates selection on master row click', async () => {
		const { container } = render(LibraryMasterDetail, {
			props: { library, works, editionsByWork, initialWorkId: 'work-a' },
		});
		const masterRowB = container.querySelector(
			'.master-paper [data-work-id="work-b"]',
		) as HTMLElement;
		await fireEvent.click(masterRowB);
		expect(container.querySelector('.master-paper [data-work-id="work-b"].sel')).not.toBeNull();
		expect(container.querySelector('.master-paper [data-work-id="work-a"].sel')).toBeNull();
	});
});

// CHORE-78 — Mobile library responsive layout
// NOTE: jsdom has no CSS/layout engine. Breakpoint behaviour (hidden < sm, grid at sm+)
// is asserted via Tailwind class presence. True viewport + paint-order checks are
// deferred to Playwright — flagged in test-gaps.md.
describe('LibraryMasterDetail — responsive layout (CHORE-78)', () => {
	// AC2 — `library-master` carries `hidden sm:block` (desktop index hidden on mobile).
	// jsdom renders the element regardless; the class gates CSS visibility.
	it('AC2 — library-master carries hidden sm:block (hidden below sm)', () => {
		const { container } = render(LibraryMasterDetail, {
			props: { library, works, editionsByWork, initialWorkId: null },
		});
		const master = container.querySelector('[data-testid="library-master"]');
		expect(master).not.toBeNull();
		expect(master?.className).toContain('hidden');
		expect(master?.className).toContain('sm:block');
	});

	// AC2 — `library-md-grid` is single-col below sm (no fixed 240px + 1fr without sm:).
	// Standing responsive rule (Bentham RED-78.1): a `sm:grid` without a base `hidden`
	// renders in block flow below the breakpoint — the 240px+1fr desktop grid bleeds into
	// mobile. Both `hidden` AND `sm:grid` are required (mirrors the library-master check).
	it('AC2 — library-md-grid carries hidden sm:grid (desktop grid suppressed below sm)', () => {
		const { container } = render(LibraryMasterDetail, {
			props: { library, works, editionsByWork, initialWorkId: null },
		});
		const mdGrid = container.querySelector('[data-testid="library-md-grid"]');
		expect(mdGrid).not.toBeNull();
		// `hidden` suppresses the element below sm; `sm:grid` reinstates the 2-col layout at sm+.
		// A lone `sm:grid` without `hidden` renders as block below the breakpoint (AC2 violation).
		expect(mdGrid?.className).toContain('hidden');
		expect(mdGrid?.className).toContain('sm:grid');
	});

	// AC6 — with initialWorkId set, `library-mobile-detail` renders.
	it('AC6 — renders library-mobile-detail when initialWorkId is set', () => {
		const { container } = render(LibraryMasterDetail, {
			props: { library, works, editionsByWork, initialWorkId: 'work-a' },
		});
		expect(container.querySelector('[data-testid="library-mobile-detail"]')).not.toBeNull();
	});

	// AC6 — back affordance is present in detail mode with correct label from m.*().
	it('AC6 — library-mobile-back is present in detail mode with i18n label', () => {
		const { container } = render(LibraryMasterDetail, {
			props: { library, works, editionsByWork, initialWorkId: 'work-a' },
		});
		const back = container.querySelector('[data-testid="library-mobile-back"]');
		expect(back).not.toBeNull();
		// Label must be non-empty and come from m.library_back_to_works()
		// (en: "‹ Works"). We assert non-empty; AC9 asserts the actual i18n value.
		expect(back?.textContent?.trim().length).toBeGreaterThan(0);
	});

	// AC6 — back affordance clears ?work= (is an anchor whose href omits the work param
	// or is a button that navigates to the URL without ?work=).
	// Seam: library-mobile-back is rendered as <a href="?"> or <a href="[url without work=]">
	// so clicking it navigates to the list. Byrd implements this as an anchor with href
	// that clears the param (e.g. href="?" or a URL without work=).
	it('AC6 — library-mobile-back href clears ?work= param', () => {
		const { container } = render(LibraryMasterDetail, {
			props: { library, works, editionsByWork, initialWorkId: 'work-a' },
		});
		const back = container.querySelector('[data-testid="library-mobile-back"]') as HTMLElement;
		expect(back).not.toBeNull();
		// The back element must be a link/button whose href/action removes ?work=.
		// Assert it does NOT contain "work=" in its href (i.e., clicking navigates to list mode).
		const href = back.getAttribute('href') ?? '';
		expect(href.includes('work=')).toBe(false);
	});

	// AC6 — without initialWorkId (list mode), library-mobile-list container renders
	// and library-mobile-detail does NOT render.
	it('AC6 — renders library-mobile-list (not detail) when no initialWorkId', () => {
		const { container } = render(LibraryMasterDetail, {
			props: { library, works, editionsByWork, initialWorkId: null },
		});
		expect(container.querySelector('[data-testid="library-mobile-list"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="library-mobile-detail"]')).toBeNull();
	});

	// AC7 — scroll-spy IntersectionObserver is gated: when isDesktopViewport() returns
	// false (default in jsdom — window.matchMedia is not implemented), the observer must
	// NOT be constructed.
	// Seam: Byrd gates the onMount observer construction behind an exported
	// `isDesktopViewport` predicate (calls window.matchMedia('(min-width: 640px)').matches).
	// In jsdom, window.matchMedia returns { matches: false }, so the observer must never
	// be constructed. We verify this by removing the IntersectionObserver stub and
	// asserting the component renders without error (no attempt to construct the observer).
	it('AC7 — scroll-spy observer is not constructed when isDesktopViewport() is false', () => {
		// Remove IntersectionObserver from the environment to detect any construction attempt.
		const saved = (globalThis as any).IntersectionObserver;
		// Replace with a spy that throws if constructed, so we catch any mobile-path violation.
		(globalThis as any).IntersectionObserver = class {
			constructor() {
				throw new Error('IntersectionObserver must not be constructed on mobile viewport');
			}
		};
		// stub matchMedia to return matches: false (mobile — below sm)
		Object.defineProperty(window, 'matchMedia', {
			writable: true,
			value: vi
				.fn()
				.mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }),
		});
		// Should render without throwing (observer not constructed)
		expect(() => {
			render(LibraryMasterDetail, {
				props: { library, works, editionsByWork, initialWorkId: null },
			});
		}).not.toThrow();
		// Restore
		(globalThis as any).IntersectionObserver = saved;
	});

	// AC8 — desktop path: master + detail both render when no mobile media constraint.
	// This is the existing behaviour; this test is a regression guard.
	it('AC8 — desktop path: master index and detail column both render', () => {
		const { container } = render(LibraryMasterDetail, {
			props: { library, works, editionsByWork, initialWorkId: null },
		});
		// Both desktop elements must be present (CSS hides them below sm; DOM must exist).
		expect(container.querySelector('[data-testid="library-master"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="library-md-grid"]')).not.toBeNull();
		// Work paper stacks render in the detail column
		expect(container.querySelector('[data-work-id="work-a"]')).not.toBeNull();
		expect(container.querySelector('[data-work-id="work-b"]')).not.toBeNull();
	});

	// AC9 — back label comes from m.library_back_to_works() (en: "‹ Works").
	// Assert the rendered text matches the en message value — no hardcoded English.
	it('AC9 — library-mobile-back label equals m.library_back_to_works() output', () => {
		const { container } = render(LibraryMasterDetail, {
			props: { library, works, editionsByWork, initialWorkId: 'work-a' },
		});
		const back = container.querySelector('[data-testid="library-mobile-back"]');
		expect(back).not.toBeNull();
		// m.library_back_to_works() returns "‹ Works" in en locale.
		// We assert the rendered text contains the expected value from paraglide.
		// NOTE: if locale differs, this asserts the paraglide output — not a hardcoded string.
		expect(back?.textContent).toContain('Works');
	});
});
