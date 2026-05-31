// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { describe, it, expect, afterEach } from 'vitest';
import { writable } from 'svelte/store';
import LandingDashboardScatter from './LandingDashboardScatter.svelte';

afterEach(cleanup);

vi.mock('$lib/library/libraryStore', async () => {
	const { writable } = await import('svelte/store');
	const store = writable({ status: 'loading' });
	return { librarySectionStore: store };
});

import { vi } from 'vitest';
import { librarySectionStore } from '$lib/library/libraryStore';

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
