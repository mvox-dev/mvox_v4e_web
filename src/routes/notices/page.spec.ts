// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/paraglide/runtime.js', () => ({
	setLanguageTag: vi.fn(),
	languageTag: () => 'en',
}));

vi.mock('$lib/paraglide/messages.js', () => ({
	nav_tab_notices: () => 'Notices',
	page_coming_soon_label: () => 'Coming soon',
	page_coming_soon_back_to_agenda: () => 'Back to Agenda',
	page_notices_description: () => 'Announcements and messages for your choir.',
	// Stub for YELLOW-33.1: Comenius adds real value; mock enables unit tests to pass.
	page_notices_label: () => 'Communications',
}));

import NoticesPage from './+page.svelte';

afterEach(cleanup);

describe('/notices page', () => {
	it('renders ComingSoon with notices name', () => {
		const { container } = render(NoticesPage);
		expect(container.textContent).toContain('Notices');
	});

	it('renders coming-soon message', () => {
		const { container } = render(NoticesPage);
		expect(container.textContent?.toLowerCase()).toContain('soon');
	});

	it('includes back link to /agenda', () => {
		const { container } = render(NoticesPage);
		const backLink = container.querySelector('a[href="/agenda"]');
		expect(backLink).not.toBeNull();
	});

	it('renders notices description text', () => {
		const { container } = render(NoticesPage);
		expect(container.textContent).toContain('Announcements and messages');
	});
});

// (*MVOX:Tallis*)
