// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

afterEach(cleanup);

const userStoreWritable = vi.hoisted(() => {
	const { writable } = require('svelte/store');
	return writable({ status: 'loading' });
});
const selectedOrgStoreWritable = vi.hoisted(() => {
	const { writable } = require('svelte/store');
	return writable(null);
});

vi.mock('$lib/auth/userStore', () => ({
	userStore: userStoreWritable,
	selectedOrgStore: selectedOrgStoreWritable,
}));

vi.mock('$lib/library/libraryStore', async () => {
	const { writable } = await import('svelte/store');
	return { librarySectionStore: writable({ status: 'loading' }) };
});

import Page from '../../../routes/+page.svelte';

beforeEach(() => {
	userStoreWritable.set({ status: 'loading' });
	selectedOrgStoreWritable.set(null);
});

describe('/+page.svelte (landing orchestrator)', () => {
	it('renders the marketing page when userStore is loading', () => {
		userStoreWritable.set({ status: 'loading' });
		const { container } = render(Page);
		expect(container.querySelector('[data-testid="landing-hero"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="landing-dashboard-greet"]')).toBeNull();
	});

	it('renders the marketing page when anonymous', () => {
		userStoreWritable.set({ status: 'anonymous' });
		const { container } = render(Page);
		expect(container.querySelector('[data-testid="landing-hero"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="landing-dashboard-greet"]')).toBeNull();
	});

	it('renders the dashboard when ready', () => {
		userStoreWritable.set({ status: 'ready', name: 'Mihkel', initial: 'M', personId: 'p1' });
		selectedOrgStoreWritable.set({ id: 'org-1', label: 'EFK', initials: 'EF' });
		const { container } = render(Page);
		expect(container.querySelector('[data-testid="landing-dashboard-greet"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="landing-hero"]')).toBeNull();
	});
});
