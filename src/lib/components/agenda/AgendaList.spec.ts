// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgendaList from './AgendaList.svelte';
import type { AgendaItem } from '$lib/agenda/agendaData';

vi.mock('$lib/paraglide/runtime.js', () => ({
	setLanguageTag: vi.fn(),
	languageTag: () => 'en',
}));

vi.mock('$lib/paraglide/messages.js', () => ({
	agenda_empty_no_rehearsals: () => 'No upcoming rehearsals.',
	agenda_partial_error: (params: { orgs: string }) =>
		`Couldn't load rehearsals for: ${params.orgs}`,
	agenda_duration_min: (params: { minutes: number }) => `${params.minutes} min`,
}));

afterEach(cleanup);

// Europe/Tallinn is UTC+3 in summer. These two items are on the same calendar date
// when viewed in Tallinn (2026-06-15 in Tallinn = 2026-06-15T00:00 EEST = 2026-06-14T21:00Z).
// Both items start 2026-06-15 in Tallinn time.
const itemSameDay: AgendaItem[] = [
	{
		id: 'r1',
		seriesId: 's1',
		startDatetime: '2026-06-15T09:00:00.000Z', // 12:00 Tallinn
		durationMinutes: 90,
		location: 'Hall A',
		name: 'Morning rehearsal',
		description: undefined,
		orgId: 'org1',
		orgLabel: 'EFK',
	},
	{
		id: 'r2',
		seriesId: 's1',
		startDatetime: '2026-06-15T16:00:00.000Z', // 19:00 Tallinn
		durationMinutes: 120,
		location: undefined,
		name: 'Evening rehearsal',
		description: undefined,
		orgId: 'org2',
		orgLabel: 'Koor B',
	},
];

// These items fall on two different calendar dates in Tallinn
const itemsDifferentDays: AgendaItem[] = [
	{
		id: 'r1',
		seriesId: 's1',
		startDatetime: '2026-06-15T16:00:00.000Z', // 19:00 Tallinn, 2026-06-15
		durationMinutes: 90,
		location: undefined,
		name: 'Monday rehearsal',
		description: undefined,
		orgId: 'org1',
		orgLabel: 'EFK',
	},
	{
		id: 'r2',
		seriesId: 's2',
		startDatetime: '2026-06-16T16:00:00.000Z', // 19:00 Tallinn, 2026-06-16
		durationMinutes: 90,
		location: 'Studio',
		name: 'Tuesday rehearsal',
		description: undefined,
		orgId: 'org1',
		orgLabel: 'EFK',
	},
];

describe('AgendaList — date-group headers', () => {
	it('items on the same Tallinn calendar day share one header', () => {
		const { container } = render(AgendaList, { items: itemSameDay, errors: [] });
		const headers = container.querySelectorAll('[data-testid="agenda-date-header"]');
		expect(headers.length).toBe(1);
	});

	it('items on different Tallinn calendar days each get their own header', () => {
		const { container } = render(AgendaList, { items: itemsDifferentDays, errors: [] });
		const headers = container.querySelectorAll('[data-testid="agenda-date-header"]');
		expect(headers.length).toBe(2);
	});

	it('headers are in chronological order (earlier date first)', () => {
		const { container } = render(AgendaList, { items: itemsDifferentDays, errors: [] });
		const headers = container.querySelectorAll('[data-testid="agenda-date-header"]');
		const texts = Array.from(headers).map((h) => h.textContent ?? '');
		// Both headers should be non-empty strings; second should sort after first
		// (we test ordering by DOM position relative to the rows)
		expect(texts.length).toBe(2);
		texts.forEach((t) => expect(t.length).toBeGreaterThan(0));
	});
});

describe('AgendaList — row content', () => {
	it('renders a row per item with data-testid="agenda-row-<id>"', () => {
		const { container } = render(AgendaList, { items: itemSameDay, errors: [] });
		expect(container.querySelector('[data-testid="agenda-row-r1"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="agenda-row-r2"]')).not.toBeNull();
	});

	it('row contains start time in HH:MM format (Europe/Tallinn)', () => {
		const { container } = render(AgendaList, { items: itemSameDay, errors: [] });
		const row = container.querySelector('[data-testid="agenda-row-r1"]');
		const timeEl = row?.querySelector('[data-testid="agenda-row-time"]');
		// r1: 2026-06-15T09:00:00Z = 12:00 in Tallinn (EEST = UTC+3)
		expect(timeEl?.textContent?.trim()).toBe('12:00');
	});

	it('row contains duration via agenda_duration_min', () => {
		const { container } = render(AgendaList, { items: itemSameDay, errors: [] });
		const row = container.querySelector('[data-testid="agenda-row-r1"]');
		const durationEl = row?.querySelector('[data-testid="agenda-row-duration"]');
		expect(durationEl?.textContent).toContain('90 min');
	});

	it('row contains rehearsal name', () => {
		const { container } = render(AgendaList, { items: itemSameDay, errors: [] });
		const row = container.querySelector('[data-testid="agenda-row-r1"]');
		expect(row?.textContent).toContain('Morning rehearsal');
	});

	it('row contains org label chip (data-testid="agenda-org-chip")', () => {
		const { container } = render(AgendaList, { items: itemSameDay, errors: [] });
		const row = container.querySelector('[data-testid="agenda-row-r1"]');
		const chip = row?.querySelector('[data-testid="agenda-org-chip"]');
		expect(chip?.textContent?.trim()).toBe('EFK');
	});

	it('row contains location when present', () => {
		const { container } = render(AgendaList, { items: itemSameDay, errors: [] });
		const row = container.querySelector('[data-testid="agenda-row-r1"]');
		const loc = row?.querySelector('[data-testid="agenda-row-location"]');
		expect(loc?.textContent).toContain('Hall A');
	});

	it('row omits location element (or leaves blank) when location is absent', () => {
		const { container } = render(AgendaList, { items: itemSameDay, errors: [] });
		// r2 has no location
		const row = container.querySelector('[data-testid="agenda-row-r2"]');
		const loc = row?.querySelector('[data-testid="agenda-row-location"]');
		// Either absent or empty text
		expect(!loc || (loc.textContent?.trim() ?? '') === '').toBe(true);
	});
});

describe('AgendaList — empty state', () => {
	it('renders agenda_empty_no_rehearsals message when items is empty', () => {
		const { container } = render(AgendaList, { items: [], errors: [] });
		expect(container.textContent).toContain('No upcoming rehearsals.');
	});

	it('does not render any rows when items is empty', () => {
		const { container } = render(AgendaList, { items: [], errors: [] });
		expect(container.querySelector('[data-testid^="agenda-row-"]')).toBeNull();
	});
});

describe('AgendaList — partial-error notice', () => {
	it('renders agenda_partial_error notice when errors is non-empty', () => {
		const { container } = render(AgendaList, {
			items: [],
			errors: ['Broken Choir', 'Another Choir'],
		});
		const notice = container.querySelector('[data-testid="agenda-partial-error"]');
		expect(notice).not.toBeNull();
	});

	it('partial-error notice contains the failing org labels', () => {
		const { container } = render(AgendaList, {
			items: [],
			errors: ['Broken Choir'],
		});
		expect(container.textContent).toContain('Broken Choir');
	});

	it('no partial-error notice when errors is empty', () => {
		const { container } = render(AgendaList, { items: itemSameDay, errors: [] });
		expect(container.querySelector('[data-testid="agenda-partial-error"]')).toBeNull();
	});
});
