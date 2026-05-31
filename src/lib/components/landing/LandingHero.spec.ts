// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { describe, it, expect, afterEach } from 'vitest';
import LandingHero from './LandingHero.svelte';

afterEach(cleanup);

describe('LandingHero', () => {
	it('renders the headline + subhead + CTA + INVITE ONLY stamp', () => {
		const { container } = render(LandingHero);
		expect(container.textContent).toContain('The back-of-house for your choir.');
		expect(container.textContent).toContain('Library, roster, rehearsal notes');
		expect(container.textContent).toContain('Request an invite');
		expect(container.textContent).toContain('INVITE ONLY');
		expect(container.textContent).toContain('For choirs · by invite');
	});

	it('hero CTA links to the mailto: address with correct subject', () => {
		const { container } = render(LandingHero);
		const cta = container.querySelector('a[data-testid="hero-cta"]');
		expect(cta).not.toBeNull();
		expect(cta?.getAttribute('href')).toBe(
			'mailto:hello@mvox.eu?subject=Invite%20request%20%E2%80%94%20mvox',
		);
	});

	it('renders the secondary "already invited? sign in" marginalia link', () => {
		const { container } = render(LandingHero);
		const signIn = container.querySelector('a[data-testid="hero-signin"]');
		expect(signIn).not.toBeNull();
		expect(signIn?.getAttribute('href')).toBe('/auth/login');
		expect(container.textContent).toContain('already invited?');
		expect(container.textContent).toContain('sign in');
	});

	it('renders three stacked papers (roster decorative, library decorative, hero content)', () => {
		const { container } = render(LandingHero);
		expect(container.querySelector('[data-testid="hero-roster-card"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="hero-library-card"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="hero-content-card"]')).not.toBeNull();
	});
});
