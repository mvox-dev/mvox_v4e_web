// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/paraglide/runtime.js', () => ({
	setLanguageTag: vi.fn(),
	languageTag: () => 'en',
}));

vi.mock('$lib/paraglide/messages.js', () => ({
	nav_tab_roster: () => 'Roster',
	page_coming_soon_label: () => 'Coming soon',
	page_coming_soon_back_to_agenda: () => 'Back to Agenda',
	page_roster_description: () =>
		'See who sings in your choir — sections, voice parts, and contact details.',
}));

import RosterPage from './+page.svelte';

afterEach(cleanup);

describe('/roster page', () => {
	it('renders ComingSoon with roster name', () => {
		const { container } = render(RosterPage);
		expect(container.textContent).toContain('Roster');
	});

	it('renders coming-soon message', () => {
		const { container } = render(RosterPage);
		expect(container.textContent?.toLowerCase()).toContain('soon');
	});

	it('includes back link to /agenda', () => {
		const { container } = render(RosterPage);
		const backLink = container.querySelector('a[href="/agenda"]');
		expect(backLink).not.toBeNull();
	});

	it('renders roster description text', () => {
		const { container } = render(RosterPage);
		expect(container.textContent).toContain('sections, voice parts');
	});
});

// (*MVOX:Tallis*)
