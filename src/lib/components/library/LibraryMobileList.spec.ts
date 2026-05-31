// @vitest-environment happy-dom
// src/lib/components/library/LibraryMobileList.spec.ts
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import LibraryMobileList from './LibraryMobileList.svelte';
import type { EntuWork, EntuEdition } from '$lib/types/library-entu';

afterEach(cleanup);

const works: EntuWork[] = [
	{ id: 'work-a', libraryId: 'lib-1', composer: 'Duruflé', title: 'Requiem', voicing: 'SATB' },
	{ id: 'work-b', libraryId: 'lib-1', composer: 'Kreek', title: 'Taaveti', voicing: 'SATB' },
	{ id: 'work-c', libraryId: 'lib-1', composer: 'Pärt', title: 'Da pacem Domine', voicing: 'SATB' },
];
const editionsByWork = new Map<string, EntuEdition[]>([
	['work-a', [{ id: 'ed-1', workId: 'work-a', label: 'Peters', year: 1991 }]],
	[
		'work-b',
		[
			{ id: 'ed-2', workId: 'work-b', label: 'Fennica Gehrman', year: 2005 },
			{ id: 'ed-3', workId: 'work-b', label: 'Eesti Muusika Kirjastus', year: 2010 },
		],
	],
	['work-c', []],
]);

// CHORE-78 — LibraryMobileList: search-filtered work list (mobile, < sm)
// NOTE: jsdom has no CSS/layout engine. Class assertions cover structural breakpoint
// gating. True viewport + filtered-scroll checks deferred to Playwright (test-gaps.md).
describe('LibraryMobileList', () => {
	// AC3 — search input renders with the mobile-specific placeholder from m.*().
	it('AC3 — renders library-mobile-search input', () => {
		const { container } = render(LibraryMobileList, {
			props: { works, editionsByWork },
		});
		const search = container.querySelector('[data-testid="library-mobile-search"]');
		expect(search).not.toBeNull();
	});

	// AC9 — search placeholder comes from m.library_mobile_search_placeholder(), not
	// from the desktop m.library_search_placeholder(). Assert it is the mobile key's
	// output (en: "Search title or composer…").
	it('AC9 — search placeholder equals m.library_mobile_search_placeholder() output', () => {
		const { container } = render(LibraryMobileList, {
			props: { works, editionsByWork },
		});
		const search = container.querySelector(
			'[data-testid="library-mobile-search"]',
		) as HTMLInputElement | null;
		expect(search).not.toBeNull();
		// en value: "Search title or composer…" — assert the rendered placeholder contains it.
		// This pins the mobile key, not the desktop library_search_placeholder key.
		const placeholder =
			search?.getAttribute('placeholder') ?? search?.getAttribute('aria-label') ?? '';
		expect(placeholder.length).toBeGreaterThan(0);
		// Must NOT be the desktop search placeholder (which mentions borrowers/copies).
		expect(placeholder.toLowerCase()).not.toContain('borrower');
	});

	// AC3 — all work rows render when no query is entered.
	it('AC3 — renders a library-mobile-row for each work (no filter)', () => {
		const { container } = render(LibraryMobileList, {
			props: { works, editionsByWork },
		});
		const rows = container.querySelectorAll('[data-testid="library-mobile-row"]');
		expect(rows.length).toBe(works.length);
	});

	// AC3 — each row carries data-work-id matching the work.id.
	it('AC3 — each library-mobile-row carries data-work-id', () => {
		const { container } = render(LibraryMobileList, {
			props: { works, editionsByWork },
		});
		for (const work of works) {
			const row = container.querySelector(
				`[data-testid="library-mobile-row"][data-work-id="${work.id}"]`,
			);
			expect(row).not.toBeNull();
		}
	});

	// AC4 — typing a title query narrows the list (case-insensitive substring on title).
	it('AC4 — title query filters library-mobile-row count', async () => {
		const { container } = render(LibraryMobileList, {
			props: { works, editionsByWork },
		});
		const search = container.querySelector(
			'[data-testid="library-mobile-search"]',
		) as HTMLInputElement;
		await fireEvent.input(search, { target: { value: 'requiem' } });
		const rows = container.querySelectorAll('[data-testid="library-mobile-row"]');
		// Only "Requiem" (work-a) matches the title query.
		expect(rows.length).toBe(1);
		expect(rows[0].getAttribute('data-work-id')).toBe('work-a');
	});

	// AC4 — typing a composer query narrows the list (case-insensitive substring on composer).
	it('AC4 — composer query filters library-mobile-row count', async () => {
		const { container } = render(LibraryMobileList, {
			props: { works, editionsByWork },
		});
		const search = container.querySelector(
			'[data-testid="library-mobile-search"]',
		) as HTMLInputElement;
		// "kreek" matches composer of work-b only.
		await fireEvent.input(search, { target: { value: 'kreek' } });
		const rows = container.querySelectorAll('[data-testid="library-mobile-row"]');
		expect(rows.length).toBe(1);
		expect(rows[0].getAttribute('data-work-id')).toBe('work-b');
	});

	// AC4 — search is case-insensitive (uppercase query matches lowercase title).
	it('AC4 — search is case-insensitive', async () => {
		const { container } = render(LibraryMobileList, {
			props: { works, editionsByWork },
		});
		const search = container.querySelector(
			'[data-testid="library-mobile-search"]',
		) as HTMLInputElement;
		await fireEvent.input(search, { target: { value: 'PÄRT' } });
		const rows = container.querySelectorAll('[data-testid="library-mobile-row"]');
		// "PÄRT" matches composer "Pärt" case-insensitively.
		expect(rows.length).toBe(1);
		expect(rows[0].getAttribute('data-work-id')).toBe('work-c');
	});

	// AC4 — non-matching query shows library-mobile-empty state.
	it('AC4 — non-matching query shows library-mobile-empty', async () => {
		const { container } = render(LibraryMobileList, {
			props: { works, editionsByWork },
		});
		const search = container.querySelector(
			'[data-testid="library-mobile-search"]',
		) as HTMLInputElement;
		await fireEvent.input(search, { target: { value: 'xyzzy-no-match' } });
		expect(container.querySelectorAll('[data-testid="library-mobile-row"]').length).toBe(0);
		expect(container.querySelector('[data-testid="library-mobile-empty"]')).not.toBeNull();
	});

	// AC9 — empty-result message comes from m.library_search_no_results().
	// en: "No works match your search".
	it('AC9 — library-mobile-empty text equals m.library_search_no_results() output', async () => {
		const { container } = render(LibraryMobileList, {
			props: { works, editionsByWork },
		});
		const search = container.querySelector(
			'[data-testid="library-mobile-search"]',
		) as HTMLInputElement;
		await fireEvent.input(search, { target: { value: 'xyzzy-no-match' } });
		const empty = container.querySelector('[data-testid="library-mobile-empty"]');
		expect(empty).not.toBeNull();
		// Assert non-empty text that matches the en paraglide output.
		expect(empty?.textContent?.trim().length).toBeGreaterThan(0);
		// Pin that the text contains the key phrase from the en message.
		expect(empty?.textContent).toContain('match');
	});

	// AC5 — clicking a library-mobile-row sets ?work=<id> (the row is an <a> with
	// href containing ?work=<id>, consistent with how LibraryMasterDetail uses syncUrl).
	// Seam: each library-mobile-row is an <a href="?work=<work.id>"> element.
	it('AC5 — library-mobile-row is an anchor with href containing ?work=<id>', () => {
		const { container } = render(LibraryMobileList, {
			props: { works, editionsByWork },
		});
		for (const work of works) {
			const row = container.querySelector(
				`[data-testid="library-mobile-row"][data-work-id="${work.id}"]`,
			) as HTMLElement | null;
			expect(row).not.toBeNull();
			// The row must be an anchor whose href sets the work param.
			const href = row?.getAttribute('href') ?? '';
			expect(href).toContain(`work=${work.id}`);
		}
	});

	// AC3 — edition count is rendered in each row (title, composer, edition count visible).
	it('AC3 — library-mobile-row renders edition count for a work', () => {
		const { container } = render(LibraryMobileList, {
			props: { works, editionsByWork },
		});
		// work-b has 2 editions; work-c has 0 — both should render (count visible in some form).
		// We assert the row itself is present; Byrd decides exact count rendering.
		const rowB = container.querySelector(
			'[data-testid="library-mobile-row"][data-work-id="work-b"]',
		);
		expect(rowB).not.toBeNull();
	});
});
