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
	{ id: 'r1', seriesId: 'ser1', startDatetime: '2026-09-01T16:00:00.000Z', durationMinutes: 90 },
	{ id: 'r2', seriesId: 'ser1', startDatetime: '2026-09-08T16:00:00.000Z', durationMinutes: 90 },
	{ id: 'r3', seriesId: 'ser2', startDatetime: '2026-09-02T17:00:00.000Z', durationMinutes: 60 },
	{ id: 'r4', seriesId: 'ser2', startDatetime: '2026-09-09T17:00:00.000Z', durationMinutes: 60 },
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

	it('rehearsal-edit button is NOT rendered (deferred to #87)', () => {
		// Edit is deferred — the button must be absent to prevent no-op clicks.
		const rehearsals: Rehearsal[] = [
			{
				id: 'r1',
				seriesId: 'ser1',
				startDatetime: '2026-09-01T16:00:00.000Z',
				durationMinutes: 90,
			},
		];
		const { container } = render(RehearsalList, {
			rehearsals,
			seriesNames: new Map([['ser1', 'Tue']]),
			oncancel: vi.fn(),
			onedit: vi.fn(),
		});
		expect(container.querySelector('[data-testid="rehearsal-edit"]')).toBeNull();
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
		{ id: 'r1', seriesId: 'ser1', startDatetime: '2026-09-01T16:00:00.000Z', durationMinutes: 90 },
		{ id: 'r2', seriesId: 'ser1', startDatetime: '2026-09-08T16:00:00.000Z', durationMinutes: 90 },
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
