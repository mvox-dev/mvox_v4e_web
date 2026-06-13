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
	// Stub for YELLOW-33.1: Comenius adds real value; mock enables unit tests to pass.
	page_roster_label: () => 'Choir management',
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

// YELLOW-33.1 — ComingSoon `label` prop is a hardcoded English string ("Choir management").
// It should come from a Paraglide key so all four locales render correctly.
// New key: page_roster_label (to be added to all 4 locale files by Comenius).
// RED until Byrd passes m.page_roster_label() as the label prop + Comenius adds the key.
describe('/roster page — label i18n (YELLOW-33.1)', () => {
	it('renders label from page_roster_label() i18n key, not hardcoded English', () => {
		// The mock already provides nav_tab_roster → 'Roster'.
		// We need page_roster_label — add it to the mock for this test.
		// If the route passes a hardcoded string ("Choir management"), this will
		// fail once page_roster_label is mocked to return a different value.
		// For now: assert that the coming-soon-label element does NOT contain the
		// hardcoded "Choir management" literal when the i18n key is defined.
		// Once the key exists and the route uses it, this passes with the mock's value.
		vi.mock('$lib/paraglide/messages.js', () => ({
			nav_tab_roster: () => 'Roster',
			page_coming_soon_label: () => 'Coming soon',
			page_coming_soon_back_to_agenda: () => 'Back to Agenda',
			page_roster_description: () =>
				'See who sings in your choir — sections, voice parts, and contact details.',
			page_roster_label: () => 'Choir roles',
		}));
		const { container } = render(RosterPage);
		const labelEl = container.querySelector('[data-testid="coming-soon-label"]');
		expect(labelEl).not.toBeNull();
		// If the label is hardcoded, it shows "Choir management" regardless of the mock.
		// If it uses m.page_roster_label(), it shows "Choir roles" (the mock value).
		// RED: currently shows hardcoded "Choir management", not the mock's "Choir roles".
		expect(labelEl?.textContent?.trim()).not.toBe('Choir management');
	});
});

// (*MVOX:Tallis*)
