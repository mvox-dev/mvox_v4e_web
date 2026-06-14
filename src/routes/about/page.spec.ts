// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AboutPage from './+page.svelte';

// Paraglide runtime (languageTag used by primitives imported into the page)
vi.mock('$lib/paraglide/runtime.js', () => ({
	setLanguageTag: vi.fn(),
	languageTag: () => 'en',
}));

// Paraglide messages — mocked to the real Carus-outreach target copy (Task 1 RED).
// 3 new keys added: about_intro_circle, about_values_offer, about_contact.
// 3 body keys rewritten to real copy; Lorem placeholders removed from mock.
vi.mock('$lib/paraglide/messages.js', () => ({
	about_page_title: () => 'About mvox',
	about_intro: () =>
		'mvox is the back-of-house for choral organisations. We build the quiet infrastructure that keeps a choir running: its library, its roster, its rehearsal record.',
	about_intro_circle: () =>
		'A choir sits inside a larger circle — singers, conductors, composers, and the publishers who carry their work into the world. mvox is built for that whole circle.',
	about_mission_heading: () => 'Our Mission',
	about_mission_body: () =>
		"Most music isn't copied out of disrespect. It's copied because, in the minutes before a rehearsal, the honest path is the hard one and the shortcut is right there. mvox exists to flip that — to make finding, holding, licensing, and sharing choral music simpler than not, so honouring the people who wrote and published it becomes the natural default.",
	about_story_heading: () => 'Our Story',
	about_story_body: () =>
		"We didn't start as a software company. We started as singers and organisers inside Estonia's choral world — and we've been on the wrong side of the line ourselves.",
	about_values_heading: () => 'What We Believe',
	about_values_body: () =>
		'Every copy should be accounted for. Licensing should be easy enough that no one is tempted to skip it. A publisher should see their work respected — not wonder where it went.',
	about_values_offer: () =>
		"To publishers: mvox is being built to be the easiest place for choirs to do right by you. We'd rather design that with you than for you.",
	about_contact: () => 'Publishers and rights-holders: write to',
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

	it('renders the intro "larger circle" lens line', () => {
		const { container } = render(AboutPage);
		const el = container.querySelector('[data-testid="about-intro-circle"]');
		expect(el).not.toBeNull();
		expect(el?.textContent).toContain('whole circle');
	});

	it('renders the honest-path mission body (no Lorem placeholder)', () => {
		const { container } = render(AboutPage);
		const text = container.querySelector('[data-testid="about-mission-body"]')?.textContent ?? '';
		expect(text).toContain('honest path');
		expect(text.toLowerCase()).not.toContain('lorem ipsum');
	});

	it('renders the own-a-misstep story body (no Lorem placeholder)', () => {
		const { container } = render(AboutPage);
		const text = container.querySelector('[data-testid="about-story-body"]')?.textContent ?? '';
		expect(text).toContain('wrong side of the line');
		expect(text.toLowerCase()).not.toContain('lorem ipsum');
	});

	it('renders the belief baseline body (no Lorem placeholder)', () => {
		const { container } = render(AboutPage);
		const text = container.querySelector('[data-testid="about-values-body"]')?.textContent ?? '';
		expect(text).toContain('Every copy should be accounted for');
		expect(text.toLowerCase()).not.toContain('lorem ipsum');
	});

	it('renders the publisher offer block', () => {
		const { container } = render(AboutPage);
		const el = container.querySelector('[data-testid="about-values-offer"]');
		expect(el).not.toBeNull();
		expect(el?.textContent).toContain('design that with you');
	});

	it('renders a mailto contact link for publishers', () => {
		const { container } = render(AboutPage);
		const link = container.querySelector(
			'[data-testid="about-contact"] a',
		) as HTMLAnchorElement | null;
		expect(link).not.toBeNull();
		expect(link?.getAttribute('href')).toBe('mailto:mihkel.putrinsh@gmail.com');
		expect(link?.textContent).toContain('mihkel.putrinsh@gmail.com');
	});
});

// (*MVOX:Tallis*)
