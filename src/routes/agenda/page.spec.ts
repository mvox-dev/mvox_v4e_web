// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/agenda') },
}));
vi.mock('$app/navigation', () => ({
	goto: vi.fn(),
}));
vi.mock('$env/static/public', () => ({ PUBLIC_ENTU_DB: 'testdb' }));
vi.mock('$lib/auth/storage', () => ({ getToken: () => 'mock-jwt' }));

vi.mock('$lib/paraglide/runtime.js', () => ({
	setLanguageTag: vi.fn(),
	languageTag: () => 'en',
}));

vi.mock('$lib/paraglide/messages.js', () => ({
	agenda_title: () => 'Agenda',
	agenda_empty_no_orgs: () => "You're not in any choir yet. Ask your choir admin for an invite.",
	agenda_empty_no_rehearsals: () => 'No upcoming rehearsals.',
	agenda_partial_error: (params: { orgs: string }) =>
		`Couldn't load rehearsals for: ${params.orgs}`,
	agenda_duration_min: (params: { minutes: number }) => `${params.minutes} min`,
}));

// userStore mock — writable so tests can push different states before render
vi.mock('$lib/auth/userStore', async () => {
	const { writable } = await import('svelte/store');
	const userStore = writable<unknown>({ status: 'loading' });
	return {
		userStore,
		decodeJwt: () => null,
	};
});

// agendaData mock — vi.fn() so tests can control what listAgenda returns
vi.mock('$lib/agenda/agendaData', () => ({
	listAgenda: vi.fn(),
}));

import { userStore } from '$lib/auth/userStore';
import { listAgenda } from '$lib/agenda/agendaData';
import type { Writable } from 'svelte/store';
import Page from './+page.svelte';

const mockListAgenda = vi.mocked(listAgenda);

const orgEfk = { id: 'org1', label: 'EFK', initials: 'EF' };
const sampleItem = {
	id: 'r1',
	seriesId: 's1',
	startDatetime: '2026-06-15T16:00:00.000Z',
	durationMinutes: 90,
	location: undefined,
	name: 'Monday rehearsal',
	description: undefined,
	orgId: 'org1',
	orgLabel: 'EFK',
};

beforeEach(() => {
	vi.restoreAllMocks();
	(userStore as Writable<unknown>).set({ status: 'loading' });
});

afterEach(cleanup);

describe('/agenda page', () => {
	it('ready user with orgs → listAgenda called with those orgs', async () => {
		mockListAgenda.mockResolvedValue({ items: [sampleItem], errors: [] });
		(userStore as Writable<unknown>).set({
			status: 'ready',
			name: 'Test User',
			initial: 'T',
			orgs: [orgEfk],
		});
		render(Page);
		// listAgenda should be called with the user's orgs
		expect(mockListAgenda).toHaveBeenCalledWith(
			expect.objectContaining({ db: 'testdb' }),
			[orgEfk],
			expect.any(Date),
		);
	});

	it('ready user with orgs → renders the agenda list (no empty-no-orgs message)', async () => {
		mockListAgenda.mockResolvedValue({ items: [sampleItem], errors: [] });
		(userStore as Writable<unknown>).set({
			status: 'ready',
			name: 'Test User',
			initial: 'T',
			orgs: [orgEfk],
		});
		const { container } = render(Page);
		// Agenda list container present; no empty-no-orgs message
		expect(container.textContent).not.toContain(
			"You're not in any choir yet. Ask your choir admin for an invite.",
		);
	});

	it('ready user with zero orgs → agenda_empty_no_orgs rendered, listAgenda not called', () => {
		(userStore as Writable<unknown>).set({
			status: 'ready',
			name: 'Test User',
			initial: 'T',
			orgs: [],
		});
		const { container } = render(Page);
		expect(container.textContent).toContain(
			"You're not in any choir yet. Ask your choir admin for an invite.",
		);
		expect(mockListAgenda).not.toHaveBeenCalled();
	});

	it('loading state shows skeleton (data-testid="agenda-loading")', () => {
		(userStore as Writable<unknown>).set({ status: 'loading' });
		const { container } = render(Page);
		expect(container.querySelector('[data-testid="agenda-loading"]')).not.toBeNull();
	});
});
