// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { describe, it, expect, afterEach } from 'vitest';
import LandingMarketing from './LandingMarketing.svelte';

afterEach(cleanup);

describe('LandingMarketing', () => {
	it('renders all 5 sections in order: hero, pillars, invites, request, footer', () => {
		const { container } = render(LandingMarketing);
		const hero = container.querySelector('[data-testid="landing-hero"]');
		const pillars = container.querySelector('[data-testid="landing-pillars-section"]');
		const invites = container.querySelector('[data-testid="landing-invites-section"]');
		const request = container.querySelector('[data-testid="landing-request-section"]');
		const footer = container.querySelector('[data-testid="landing-footer"]');

		expect(hero).not.toBeNull();
		expect(pillars).not.toBeNull();
		expect(invites).not.toBeNull();
		expect(request).not.toBeNull();
		expect(footer).not.toBeNull();

		// position check — pillars after hero, etc.
		expect(hero!.compareDocumentPosition(pillars!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(
			pillars!.compareDocumentPosition(invites!) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
		expect(
			invites!.compareDocumentPosition(request!) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
		expect(
			request!.compareDocumentPosition(footer!) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});
});
