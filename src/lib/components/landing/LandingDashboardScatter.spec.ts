// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { writable, type Writable } from 'svelte/store';
import type { Org } from '$lib/auth/types';
import LandingDashboardScatter from './LandingDashboardScatter.svelte';

afterEach(cleanup);

const hydrateLibrarySectionSpy = vi.hoisted(() => vi.fn(async () => {}));

vi.mock('$lib/library/libraryStore', async () => {
	const { writable } = await import('svelte/store');
	const store = writable({ status: 'loading' });
	return { librarySectionStore: store, hydrateLibrarySection: hydrateLibrarySectionSpy };
});

vi.mock('$lib/auth/storage', () => ({
	getToken: () => 'fake.jwt.token',
}));

vi.mock('$lib/auth/userStore', async () => {
	const { writable } = await import('svelte/store');
	const userStore = writable({ status: 'ready', name: 'Test', initial: 'T', orgs: [] });
	const selectedOrgStore = writable({ id: 'org-a', label: 'A', initials: 'A' });
	return {
		userStore,
		selectedOrgStore,
		decodeJwt: () => ({ accounts: { 'test-db': 'person-id' } }),
	};
});

vi.mock('$env/static/public', () => ({ PUBLIC_ENTU_DB: 'test-db' }));

import { librarySectionStore } from '$lib/library/libraryStore';
import { selectedOrgStore as _selectedOrgStore } from '$lib/auth/userStore';
const selectedOrgStore = _selectedOrgStore as unknown as Writable<Org | null>;

describe('LandingDashboardScatter', () => {
	it('renders 4 pillar cards', () => {
		const { container } = render(LandingDashboardScatter, { orgInitials: 'EFK' });
		const cards = container.querySelectorAll('[data-testid="dashboard-pillar-card"]');
		expect(cards.length).toBe(4);
	});

	it('Library card meta shows em-dash when librarySectionStore is loading', () => {
		librarySectionStore.set({ status: 'loading' });
		const { container } = render(LandingDashboardScatter, { orgInitials: 'EFK' });
		const libraryCard = container.querySelector('[data-testid="dashboard-pillar-card"]');
		expect(libraryCard?.textContent).toContain('—');
	});

	it('Library card meta shows "No catalogue yet" when status is empty', () => {
		librarySectionStore.set({
			status: 'empty',
			library: { id: 'lib-1', name: 'EFK Library', orgId: 'org-1' } as any,
		});
		const { container } = render(LandingDashboardScatter, { orgInitials: 'EFK' });
		const libraryCard = container.querySelector('[data-testid="dashboard-pillar-card"]');
		expect(libraryCard?.textContent).toContain('No catalogue yet');
	});

	it('Library card meta shows counts when status is ready', () => {
		librarySectionStore.set({
			status: 'ready',
			library: { id: 'lib-1' } as any,
			works: new Array(28).fill({}) as any,
			editionsByWork: new Map(),
		} as any);
		const { container } = render(LandingDashboardScatter, { orgInitials: 'EFK' });
		const libraryCard = container.querySelector('[data-testid="dashboard-pillar-card"]');
		expect(libraryCard?.textContent).toContain('28 works');
	});

	it('renders roster/notes/repertoire as disabled buttons with SOON', () => {
		librarySectionStore.set({ status: 'loading' });
		const { container } = render(LandingDashboardScatter, { orgInitials: 'EFK' });
		const cards = container.querySelectorAll('[data-testid="dashboard-pillar-card"]');
		// indexes 1, 2, 3 are roster, notes, repertoire
		for (let i = 1; i <= 3; i++) {
			expect(cards[i].tagName.toLowerCase()).toBe('button');
			expect(cards[i].hasAttribute('disabled')).toBe(true);
			expect(cards[i].textContent).toContain('SOON');
		}
	});
});

// === CHORE-74 — re-hydrates librarySectionStore on selectedOrgStore change ===

describe('LandingDashboardScatter — selectedOrgStore re-hydration (CHORE-74)', () => {
	it('re-hydrates librarySectionStore when selectedOrgStore changes', async () => {
		hydrateLibrarySectionSpy.mockClear();
		selectedOrgStore.set({ id: 'org-a', label: 'A', initials: 'A' });

		render(LandingDashboardScatter, { orgInitials: 'A' });

		// $effect fires asynchronously — flush microtask queue
		await new Promise((r) => setTimeout(r, 0));
		expect(hydrateLibrarySectionSpy).toHaveBeenCalledWith({
			orgId: 'org-a',
			personId: 'person-id',
		});

		// Switch org — effect should re-fire
		hydrateLibrarySectionSpy.mockClear();
		selectedOrgStore.set({ id: 'org-b', label: 'B', initials: 'B' });
		await new Promise((r) => setTimeout(r, 0));
		expect(hydrateLibrarySectionSpy).toHaveBeenCalledWith({
			orgId: 'org-b',
			personId: 'person-id',
		});
	});
});
