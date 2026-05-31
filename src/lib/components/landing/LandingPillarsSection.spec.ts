// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { describe, it, expect, afterEach } from 'vitest';
import LandingPillarsSection from './LandingPillarsSection.svelte';

afterEach(cleanup);

describe('LandingPillarsSection', () => {
	it('renders the section header (eyebrow + heading)', () => {
		const { container } = render(LandingPillarsSection);
		expect(container.textContent).toContain('Four parts of the back office');
		expect(container.textContent).toContain("What's inside");
	});

	it('renders all 4 pillar cards in correct order', () => {
		const { container } = render(LandingPillarsSection);
		const cards = container.querySelectorAll('[data-testid="landing-pillar-card"]');
		expect(cards.length).toBe(4);
		expect(cards[0].textContent).toContain('Library');
		expect(cards[1].textContent).toContain('Roster');
		expect(cards[2].textContent).toContain('Rehearsal notes');
		expect(cards[3].textContent).toContain('Repertoire');
	});

	it('Library card shows SHIPPED; others show IN DEV or COMING', () => {
		const { container } = render(LandingPillarsSection);
		const cards = container.querySelectorAll('[data-testid="landing-pillar-card"]');
		expect(cards[0].textContent).toContain('SHIPPED');
		expect(cards[1].textContent).toContain('IN DEV');
		expect(cards[2].textContent).toContain('COMING');
		expect(cards[3].textContent).toContain('COMING');
	});
});
