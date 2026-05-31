// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { describe, it, expect, afterEach, vi } from 'vitest';
import LandingDashboard from './LandingDashboard.svelte';

vi.mock('$lib/auth/userStore', async () => {
	const { writable, derived } = await import('svelte/store');
	const user = writable({ status: 'ready', name: 'Mihkel', initial: 'M', personId: 'p1' });
	const sel = writable({ id: 'org-1', label: 'EFK', initials: 'EF' });
	return { userStore: user, selectedOrgStore: sel };
});

vi.mock('$lib/library/libraryStore', async () => {
	const { writable } = await import('svelte/store');
	const store = writable({ status: 'loading' });
	return { librarySectionStore: store };
});

afterEach(cleanup);

describe('LandingDashboard', () => {
	it('renders greet + scatter', () => {
		const { container } = render(LandingDashboard);
		expect(container.querySelector('[data-testid="landing-dashboard-greet"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="landing-dashboard-scatter"]')).not.toBeNull();
	});

	it('passes the user name + org label to the greet', () => {
		const { container } = render(LandingDashboard);
		expect(container.textContent).toContain('Welcome back, Mihkel.');
		expect(container.textContent).toContain('EFK · the back office');
	});
});
