// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { describe, it, expect, afterEach } from 'vitest';
import LandingRequestSection from './LandingRequestSection.svelte';

afterEach(cleanup);

describe('LandingRequestSection', () => {
	it('renders eyebrow, heading, body, marginalia, RECEIVED stamp', () => {
		const { container } = render(LandingRequestSection);
		expect(container.textContent).toContain('Request access');
		expect(container.textContent).toContain('Write to us.');
		expect(container.textContent).toContain("Tell us your choir's name");
		expect(container.textContent).toContain('we read every one');
		expect(container.textContent).toContain('RECEIVED');
	});

	it('renders the hello@mvox.eu address inline', () => {
		const { container } = render(LandingRequestSection);
		expect(container.textContent).toContain('hello@mvox.eu');
	});

	it('CTA is a mailto: anchor with the encoded subject', () => {
		const { container } = render(LandingRequestSection);
		const cta = container.querySelector('a[data-testid="request-cta"]');
		expect(cta).not.toBeNull();
		expect(cta?.getAttribute('href')).toBe(
			'mailto:hello@mvox.eu?subject=Invite%20request%20%E2%80%94%20mvox',
		);
		expect(cta?.textContent).toContain('Open mail');
	});
});
