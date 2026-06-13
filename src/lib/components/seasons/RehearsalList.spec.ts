// @vitest-environment happy-dom
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RehearsalList from './RehearsalList.svelte';
import type { Rehearsal } from '$lib/seasons/types';

vi.mock('$lib/paraglide/runtime.js', () => ({
	setLanguageTag: vi.fn(),
	languageTag: () => 'en',
}));

vi.mock('$lib/paraglide/messages.js', () => ({
	seasons_actions_delete: () => 'Delete',
	seasons_actions_edit: () => 'Edit',
	seasons_empty_no_rehearsals: () => 'No rehearsals scheduled yet.',
	seasons_empty_no_rehearsals_cta: () => 'Create a rehearsal series',
	seasons_confirm_cancel_rehearsal: () => 'Cancel this rehearsal?',
	seasons_confirm_cancel_rehearsal_body: () =>
		'This rehearsal will be removed. Other rehearsals in the series are not affected.',
	seasons_confirm_delete_series: () => 'Delete this series?',
	seasons_confirm_delete_series_body: (params: { n: number }) =>
		`This will delete the series and its ${params.n} rehearsals.`,
}));

afterEach(cleanup);

// Two series, two rehearsals each
const rehearsalsMultiSeries: Rehearsal[] = [
	{ id: 'r1', seriesId: 'ser1', startDatetime: '2026-09-01T16:00:00.000Z', durationMinutes: 90, tally: { going: 0, not_going: 0, maybe: 0, late: 0 } },
	{ id: 'r2', seriesId: 'ser1', startDatetime: '2026-09-08T16:00:00.000Z', durationMinutes: 90, tally: { going: 0, not_going: 0, maybe: 0, late: 0 } },
	{ id: 'r3', seriesId: 'ser2', startDatetime: '2026-09-02T17:00:00.000Z', durationMinutes: 60, tally: { going: 0, not_going: 0, maybe: 0, late: 0 } },
	{ id: 'r4', seriesId: 'ser2', startDatetime: '2026-09-09T17:00:00.000Z', durationMinutes: 60, tally: { going: 0, not_going: 0, maybe: 0, late: 0 } },
];
const seriesNames = new Map([
	['ser1', 'Tuesday Evening'],
	['ser2', 'Wednesday Afternoon'],
]);

describe('RehearsalList', () => {
	it('groups rehearsals by series — renders per-series rehearsal-group-header', () => {
		const { container } = render(RehearsalList, {
			rehearsals: rehearsalsMultiSeries,
			seriesNames,
			oncancel: vi.fn(),
			onedit: vi.fn(),
		});
		const headers = container.querySelectorAll('[data-testid="rehearsal-group-header"]');
		// One header per series
		expect(headers.length).toBe(2);
		const headerTexts = Array.from(headers).map((h) => h.textContent);
		expect(headerTexts).toContain('Tuesday Evening');
		expect(headerTexts).toContain('Wednesday Afternoon');
	});

	it('renders "—" in rehearsal-location when location is absent', () => {
		const rehearsals: Rehearsal[] = [
			{
				id: 'r1',
				seriesId: 'ser1',
				startDatetime: '2026-09-01T16:00:00.000Z',
				durationMinutes: 90,
			tally: { going: 0, not_going: 0, maybe: 0, late: 0 },
			},
			// no location property
		];
		const { container } = render(RehearsalList, {
			rehearsals,
			seriesNames: new Map([['ser1', 'Tue']]),
			oncancel: vi.fn(),
			onedit: vi.fn(),
		});
		const loc = container.querySelector('[data-testid="rehearsal-location"]');
		expect(loc?.textContent?.trim()).toBe('—');
	});

	it('past rehearsal row carries muted CSS class (assert class presence, not display)', () => {
		// Use a startDatetime clearly in the past (2020)
		const rehearsals: Rehearsal[] = [
			{
				id: 'r-past',
				seriesId: 'ser1',
				startDatetime: '2020-01-01T10:00:00.000Z',
				durationMinutes: 60,
			tally: { going: 0, not_going: 0, maybe: 0, late: 0 },
			},
		];
		const { container } = render(RehearsalList, {
			rehearsals,
			seriesNames: new Map([['ser1', 'Tue']]),
			oncancel: vi.fn(),
			onedit: vi.fn(),
		});
		const row = container.querySelector('[data-rehearsal-id="r-past"]');
		// The row must have a class that signals muted/past state (class name may vary — match 'muted')
		expect(row?.className).toMatch(/muted/);
	});

	it('future rehearsal row does NOT carry muted class', () => {
		const rehearsals: Rehearsal[] = [
			{
				id: 'r-future',
				seriesId: 'ser1',
				startDatetime: '2099-01-01T10:00:00.000Z',
				durationMinutes: 60,
			tally: { going: 0, not_going: 0, maybe: 0, late: 0 },
			},
		];
		const { container } = render(RehearsalList, {
			rehearsals,
			seriesNames: new Map([['ser1', 'Tue']]),
			oncancel: vi.fn(),
			onedit: vi.fn(),
		});
		const row = container.querySelector('[data-rehearsal-id="r-future"]');
		expect(row?.className).not.toMatch(/muted/);
	});

	it('rehearsal-cancel: confirm=true → oncancel(rehearsalId) fired', async () => {
		vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
		const oncancel = vi.fn();
		const rehearsals: Rehearsal[] = [
			{
				id: 'r1',
				seriesId: 'ser1',
				startDatetime: '2026-09-01T16:00:00.000Z',
				durationMinutes: 90,
			tally: { going: 0, not_going: 0, maybe: 0, late: 0 },
			},
		];
		const { container } = render(RehearsalList, {
			rehearsals,
			seriesNames: new Map([['ser1', 'Tue']]),
			oncancel,
			onedit: vi.fn(),
		});
		await fireEvent.click(
			container.querySelector('[data-testid="rehearsal-cancel"]') as HTMLButtonElement,
		);
		expect(window.confirm).toHaveBeenCalled();
		expect(oncancel).toHaveBeenCalledOnce();
		expect(oncancel).toHaveBeenCalledWith('r1');
	});

	it('rehearsal-cancel: confirm=false → oncancel NOT fired', async () => {
		vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
		const oncancel = vi.fn();
		const rehearsals: Rehearsal[] = [
			{
				id: 'r1',
				seriesId: 'ser1',
				startDatetime: '2026-09-01T16:00:00.000Z',
				durationMinutes: 90,
			tally: { going: 0, not_going: 0, maybe: 0, late: 0 },
			},
		];
		const { container } = render(RehearsalList, {
			rehearsals,
			seriesNames: new Map([['ser1', 'Tue']]),
			oncancel,
			onedit: vi.fn(),
		});
		await fireEvent.click(
			container.querySelector('[data-testid="rehearsal-cancel"]') as HTMLButtonElement,
		);
		expect(window.confirm).toHaveBeenCalled();
		expect(oncancel).not.toHaveBeenCalled();
	});

	// ── #87: edit affordance ─────────────────────────────────────────────────────

	it('canManage=true: rehearsal-edit button present on each row', () => {
		// Owner-gated: edit control is present when canManage=true.
		const rehearsals: Rehearsal[] = [
			{ id: 'r1', seriesId: 'ser1', startDatetime: '2026-09-01T16:00:00.000Z', durationMinutes: 90, tally: { going: 0, not_going: 0, maybe: 0, late: 0 } },
			{ id: 'r2', seriesId: 'ser1', startDatetime: '2026-09-08T16:00:00.000Z', durationMinutes: 90, tally: { going: 0, not_going: 0, maybe: 0, late: 0 } },
		];
		const { container } = render(RehearsalList, {
			rehearsals,
			seriesNames: new Map([['ser1', 'Tue']]),
			oncancel: vi.fn(),
			onedit: vi.fn(),
			canManage: true,
			ondeleteseries: vi.fn(),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any);
		const editBtns = container.querySelectorAll('[data-testid="rehearsal-edit"]');
		// One edit button per rehearsal row
		expect(editBtns.length).toBe(2);
	});

	it('canManage=false (or absent): rehearsal-edit button NOT rendered', () => {
		// Non-owner: edit control must be absent (owner-gated).
		const rehearsals: Rehearsal[] = [
			{ id: 'r1', seriesId: 'ser1', startDatetime: '2026-09-01T16:00:00.000Z', durationMinutes: 90, tally: { going: 0, not_going: 0, maybe: 0, late: 0 } },
		];
		const { container } = render(RehearsalList, {
			rehearsals,
			seriesNames: new Map([['ser1', 'Tue']]),
			oncancel: vi.fn(),
			onedit: vi.fn(),
		});
		expect(container.querySelector('[data-testid="rehearsal-edit"]')).toBeNull();
	});

	it('rehearsal-edit click: onedit(rehearsalId) called with the correct rehearsal id', async () => {
		const onedit = vi.fn();
		const rehearsals: Rehearsal[] = [
			{ id: 'r-edit-1', seriesId: 'ser1', startDatetime: '2026-09-01T16:00:00.000Z', durationMinutes: 90, tally: { going: 0, not_going: 0, maybe: 0, late: 0 } },
		];
		const { container } = render(RehearsalList, {
			rehearsals,
			seriesNames: new Map([['ser1', 'Tue']]),
			oncancel: vi.fn(),
			onedit,
			canManage: true,
			ondeleteseries: vi.fn(),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any);
		await fireEvent.click(
			container.querySelector('[data-testid="rehearsal-edit"]') as HTMLButtonElement,
		);
		expect(onedit).toHaveBeenCalledOnce();
		expect(onedit).toHaveBeenCalledWith('r-edit-1');
	});

	it('empty rehearsals → rehearsal-empty + rehearsal-empty-cta rendered', () => {
		const { container } = render(RehearsalList, {
			rehearsals: [],
			seriesNames: new Map(),
			oncancel: vi.fn(),
			onedit: vi.fn(),
		});
		expect(container.querySelector('[data-testid="rehearsal-empty"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="rehearsal-empty-cta"]')).not.toBeNull();
	});
});

// T5: delete-series control (#86)
// RED until Byrd adds canManage prop + ondeleteseries prop + series-delete button
// in each group header.
describe('RehearsalList — delete-series control (T5, #86)', () => {
	const rehearsals: Rehearsal[] = [
		{ id: 'r1', seriesId: 'ser1', startDatetime: '2026-09-01T16:00:00.000Z', durationMinutes: 90, tally: { going: 0, not_going: 0, maybe: 0, late: 0 } },
		{ id: 'r2', seriesId: 'ser1', startDatetime: '2026-09-08T16:00:00.000Z', durationMinutes: 90, tally: { going: 0, not_going: 0, maybe: 0, late: 0 } },
	];
	const seriesNamesOne = new Map([['ser1', 'Tuesday Evening']]);

	it('canManage=true: series-delete button present in group header', () => {
		const { container } = render(RehearsalList, {
			rehearsals,
			seriesNames: seriesNamesOne,
			oncancel: vi.fn(),
			onedit: vi.fn(),
			canManage: true,
			ondeleteseries: vi.fn(),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any);
		expect(container.querySelector('[data-testid="series-delete"]')).not.toBeNull();
	});

	it('canManage=false (or absent): series-delete button NOT rendered', () => {
		const { container } = render(RehearsalList, {
			rehearsals,
			seriesNames: seriesNamesOne,
			oncancel: vi.fn(),
			onedit: vi.fn(),
		});
		expect(container.querySelector('[data-testid="series-delete"]')).toBeNull();
	});

	it('series-delete: confirm=true → ondeleteseries(seriesId) fired', async () => {
		vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
		const ondeleteseries = vi.fn();
		const { container } = render(RehearsalList, {
			rehearsals,
			seriesNames: seriesNamesOne,
			oncancel: vi.fn(),
			onedit: vi.fn(),
			canManage: true,
			ondeleteseries,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any);

		const btn = container.querySelector('[data-testid="series-delete"]') as HTMLButtonElement;
		expect(btn).not.toBeNull();
		await fireEvent.click(btn);

		expect(window.confirm).toHaveBeenCalled();
		expect(ondeleteseries).toHaveBeenCalledOnce();
		expect(ondeleteseries).toHaveBeenCalledWith('ser1');
	});

	it('series-delete: confirm=false → ondeleteseries NOT fired', async () => {
		vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
		const ondeleteseries = vi.fn();
		const { container } = render(RehearsalList, {
			rehearsals,
			seriesNames: seriesNamesOne,
			oncancel: vi.fn(),
			onedit: vi.fn(),
			canManage: true,
			ondeleteseries,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any);

		const btn = container.querySelector('[data-testid="series-delete"]') as HTMLButtonElement;
		expect(btn).not.toBeNull();
		await fireEvent.click(btn);

		expect(window.confirm).toHaveBeenCalled();
		expect(ondeleteseries).not.toHaveBeenCalled();
	});

	it('series-delete confirm message includes rehearsal count', async () => {
		vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
		const { container } = render(RehearsalList, {
			rehearsals, // 2 rehearsals in ser1
			seriesNames: seriesNamesOne,
			oncancel: vi.fn(),
			onedit: vi.fn(),
			canManage: true,
			ondeleteseries: vi.fn(),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any);

		const btn = container.querySelector('[data-testid="series-delete"]') as HTMLButtonElement;
		await fireEvent.click(btn);

		// Confirm message must include the rehearsal count for the series (2 rows)
		const confirmArg = (window.confirm as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
		expect(confirmArg).toContain('2');
	});

	it('series-delete label is seasons_actions_delete ("Delete")', () => {
		const { container } = render(RehearsalList, {
			rehearsals,
			seriesNames: seriesNamesOne,
			oncancel: vi.fn(),
			onedit: vi.fn(),
			canManage: true,
			ondeleteseries: vi.fn(),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any);
		const btn = container.querySelector('[data-testid="series-delete"]');
		expect(btn?.textContent?.trim()).toBeTruthy();
	});
});

// S33 sub-chain 3 — §2 readability conformance
// RehearsalList group headers and empty-text must sit on a colored-background ancestor.
// Currently: .group-header-row has background: none; .empty-text has background: none.
// RED until Byrd wraps the list groups in a panel container.
describe('RehearsalList — readability conformance (S33 §2)', () => {
	it('group header sits inside a colored-background container', () => {
		const { container } = render(RehearsalList, {
			rehearsals: rehearsalsMultiSeries,
			seriesNames,
			oncancel: vi.fn(),
			onedit: vi.fn(),
		});
		const header = container.querySelector('[data-testid="rehearsal-group-header"]');
		expect(header).not.toBeNull();
		// Walk ancestors for any bg class or style
		let el = header?.parentElement;
		let hasColoredBg = false;
		while (el && el !== container) {
			const cls = el.className ?? '';
			const style = el.getAttribute('style') ?? '';
			if (cls.includes('bg-') || style.includes('background') || cls.includes('panel')) {
				hasColoredBg = true;
				break;
			}
			el = el.parentElement;
		}
		expect(hasColoredBg).toBe(true);
	});

	it('empty-text sits inside a colored-background container', () => {
		const { container } = render(RehearsalList, {
			rehearsals: [],
			seriesNames: new Map(),
			oncancel: vi.fn(),
			onedit: vi.fn(),
		});
		const emptyText = container.querySelector('.empty-text');
		expect(emptyText).not.toBeNull();
		let el = emptyText?.parentElement;
		let hasColoredBg = false;
		while (el && el !== container) {
			const cls = el.className ?? '';
			const style = el.getAttribute('style') ?? '';
			if (cls.includes('bg-') || style.includes('background') || cls.includes('panel')) {
				hasColoredBg = true;
				break;
			}
			el = el.parentElement;
		}
		expect(hasColoredBg).toBe(true);
	});
});

// fix/s33-seasons-rehearsal-bg — PO live-check caught rehearsal rows bare on desk.
// .group-header-row has bg-paper-2 (header ok) but the {#each group.rows} items
// are siblings of .group-header-row with NO background — they render bare on the desk.
// RED until Byrd wraps each series group (header + rows) in a data-testid="rehearsal-series-card"
// container with a paper bg, mirroring the agenda per-day card pattern.
describe('RehearsalList — series card bg conformance (fix/s33-seasons-rehearsal-bg)', () => {
	// Inline fixtures: two series, two rehearsals each.
	// (Re-declared here so this describe block is self-contained.)
	const twoSeriesRehersals: Rehearsal[] = [
		{ id: 'c1', seriesId: 'sA', startDatetime: '2026-10-01T16:00:00.000Z', durationMinutes: 90, tally: { going: 0, not_going: 0, maybe: 0, late: 0 } },
		{ id: 'c2', seriesId: 'sA', startDatetime: '2026-10-08T16:00:00.000Z', durationMinutes: 90, tally: { going: 0, not_going: 0, maybe: 0, late: 0 } },
		{ id: 'c3', seriesId: 'sB', startDatetime: '2026-10-02T17:00:00.000Z', durationMinutes: 60, tally: { going: 0, not_going: 0, maybe: 0, late: 0 } },
		{ id: 'c4', seriesId: 'sB', startDatetime: '2026-10-09T17:00:00.000Z', durationMinutes: 60, tally: { going: 0, not_going: 0, maybe: 0, late: 0 } },
	];
	const twoSeriesNames = new Map([
		['sA', 'Thursday Morning'],
		['sB', 'Friday Evening'],
	]);

	it('each series group renders a rehearsal-series-card container', () => {
		const { container } = render(RehearsalList, {
			rehearsals: twoSeriesRehersals,
			seriesNames: twoSeriesNames,
			oncancel: vi.fn(),
			onedit: vi.fn(),
		});
		const cards = container.querySelectorAll('[data-testid="rehearsal-series-card"]');
		// Two series → two cards
		expect(cards.length).toBe(2);
	});

	it('rehearsal-series-card carries a paper background (bg- class or background-color style)', () => {
		const { container } = render(RehearsalList, {
			rehearsals: twoSeriesRehersals,
			seriesNames: twoSeriesNames,
			oncancel: vi.fn(),
			onedit: vi.fn(),
		});
		const card = container.querySelector('[data-testid="rehearsal-series-card"]');
		expect(card).not.toBeNull();
		const cls = card?.className ?? '';
		const style = card?.getAttribute('style') ?? '';
		const hasBackground = cls.includes('bg-') || style.includes('background');
		expect(hasBackground).toBe(true);
	});

	it('rehearsal rows sit INSIDE their series card (have a bg ancestor between row and list)', () => {
		const { container } = render(RehearsalList, {
			rehearsals: twoSeriesRehersals,
			seriesNames: twoSeriesNames,
			oncancel: vi.fn(),
			onedit: vi.fn(),
		});
		// Check every rehearsal row has a bg ancestor before reaching the list-wrap root
		const rows = container.querySelectorAll('[data-testid="rehearsal-row"]');
		expect(rows.length).toBe(4);
		for (const row of rows) {
			let el = row.parentElement;
			let hasColoredBg = false;
			while (el && el !== container) {
				const cls = el.className ?? '';
				const style = el.getAttribute('style') ?? '';
				if (cls.includes('bg-') || style.includes('background')) {
					hasColoredBg = true;
					break;
				}
				el = el.parentElement;
			}
			expect(hasColoredBg).toBe(true);
		}
	});

	it('group header sits inside its series card', () => {
		const { container } = render(RehearsalList, {
			rehearsals: twoSeriesRehersals,
			seriesNames: twoSeriesNames,
			oncancel: vi.fn(),
			onedit: vi.fn(),
		});
		// Each series card must contain a group header
		const cards = container.querySelectorAll('[data-testid="rehearsal-series-card"]');
		cards.forEach((card) => {
			const header = card.querySelector('[data-testid="rehearsal-group-header"]');
			expect(header).not.toBeNull();
		});
	});

	it('first series card contains exactly its two rows (no cross-contamination)', () => {
		const { container } = render(RehearsalList, {
			rehearsals: twoSeriesRehersals,
			seriesNames: twoSeriesNames,
			oncancel: vi.fn(),
			onedit: vi.fn(),
		});
		const cards = container.querySelectorAll('[data-testid="rehearsal-series-card"]');
		// First card = sA → rows c1, c2
		const cardARows = cards[0].querySelectorAll('[data-testid="rehearsal-row"]');
		expect(cardARows.length).toBe(2);
		// Second card = sB → rows c3, c4
		const cardBRows = cards[1].querySelectorAll('[data-testid="rehearsal-row"]');
		expect(cardBRows.length).toBe(2);
	});
});

// (*MVOX:Tallis*)
