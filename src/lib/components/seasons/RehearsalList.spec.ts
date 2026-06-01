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

	it('rehearsal-cancel calls oncancel with rehearsalId', async () => {
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
		expect(oncancel).toHaveBeenCalledOnce();
		expect(oncancel).toHaveBeenCalledWith('r1');
	});

	it('rehearsal-edit calls onedit with rehearsalId', async () => {
		const onedit = vi.fn();
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
			onedit,
		});
		await fireEvent.click(
			container.querySelector('[data-testid="rehearsal-edit"]') as HTMLButtonElement,
		);
		expect(onedit).toHaveBeenCalledOnce();
		expect(onedit).toHaveBeenCalledWith('r1');
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
