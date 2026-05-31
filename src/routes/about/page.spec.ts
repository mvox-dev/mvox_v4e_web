// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AboutPage from './+page.svelte';

// Paraglide runtime (languageTag used by primitives imported into the page)
vi.mock('$lib/paraglide/runtime.js', () => ({
	setLanguageTag: vi.fn(),
	languageTag: () => 'en',
}));

// Paraglide messages — mocked to match the deduped about_* keys (Comenius Task 3 dedupe).
// about_tagline removed (dropped in dedupe); about_intro replaces it.
// Heading values align to PO-picked structure: Our Mission / Our Story / What We Believe.
vi.mock('$lib/paraglide/messages.js', () => ({
	about_page_title: () => 'About mvox',
	about_intro: () =>
		'mvox is the back-of-house for choral organisations. We build the quiet infrastructure that keeps a choir running: its library, its roster, its rehearsal record.',
	about_mission_heading: () => 'Our Mission',
	about_mission_body: () => 'Lorem ipsum mission.',
	about_story_heading: () => 'Our Story',
	about_story_body: () => 'Lorem ipsum story.',
	about_values_heading: () => 'What We Believe',
	about_values_body: () => 'Lorem ipsum values.',
	about_marginalia: () => '~ the mvox team',
}));

afterEach(cleanup);

describe('/about page', () => {
	it('AC2: renders page title', () => {
		const { container } = render(AboutPage);
		expect(container.querySelector('[data-testid="about-page-title"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="about-page-title"]')?.textContent).toContain(
			'About mvox',
		);
	});

	it('AC2: renders mission section heading', () => {
		const { container } = render(AboutPage);
		expect(container.querySelector('[data-testid="about-mission-heading"]')?.textContent).toContain(
			'Our Mission',
		);
	});

	it('AC2: renders story section heading', () => {
		const { container } = render(AboutPage);
		expect(container.querySelector('[data-testid="about-story-heading"]')?.textContent).toContain(
			'Our Story',
		);
	});

	it('AC2: renders values section heading', () => {
		const { container } = render(AboutPage);
		expect(container.querySelector('[data-testid="about-values-heading"]')?.textContent).toContain(
			'What We Believe',
		);
	});

	it('AC2: renders hero intro paragraph', () => {
		const { container } = render(AboutPage);
		expect(container.querySelector('[data-testid="about-intro"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="about-intro"]')?.textContent).toContain(
			'back-of-house for choral organisations',
		);
	});
});

// (*MVOX:Tallis*)
