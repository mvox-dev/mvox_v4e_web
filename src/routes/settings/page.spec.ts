// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/paraglide/runtime.js', () => ({
	setLanguageTag: vi.fn(),
	languageTag: () => 'en',
}));

vi.mock('$lib/paraglide/messages.js', () => ({
	nav_tab_settings: () => 'Settings',
	page_coming_soon_label: () => 'Coming soon',
	page_coming_soon_back_to_agenda: () => 'Back to Agenda',
	page_settings_description: () => 'Your account and preferences.',
	// Stub for YELLOW-33.1: Comenius adds real value; mock enables unit tests to pass.
	page_settings_label: () => 'Account',
}));

import SettingsPage from './+page.svelte';

afterEach(cleanup);

describe('/settings page', () => {
	it('renders ComingSoon with settings name', () => {
		const { container } = render(SettingsPage);
		expect(container.textContent).toContain('Settings');
	});

	it('renders coming-soon message', () => {
		const { container } = render(SettingsPage);
		expect(container.textContent?.toLowerCase()).toContain('soon');
	});

	it('includes back link to /agenda', () => {
		const { container } = render(SettingsPage);
		const backLink = container.querySelector('a[href="/agenda"]');
		expect(backLink).not.toBeNull();
	});

	it('renders settings description text', () => {
		const { container } = render(SettingsPage);
		expect(container.textContent).toContain('account and preferences');
	});
});

// (*MVOX:Tallis*)
