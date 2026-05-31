// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { describe, it, expect, afterEach } from 'vitest';
import LandingInvitesSection from './LandingInvitesSection.svelte';

afterEach(cleanup);

describe('LandingInvitesSection', () => {
	it('renders the eyebrow, heading, and INVITE ONLY wax-seal', () => {
		const { container } = render(LandingInvitesSection);
		expect(container.textContent).toContain('Getting in');
		expect(container.textContent).toContain('mvox is invite-only.');
		expect(container.textContent).toContain('INVITE ONLY');
	});

	it('renders both body paragraphs', () => {
		const { container } = render(LandingInvitesSection);
		expect(container.textContent).toContain('Conductors and librarians');
		expect(container.textContent).toContain('write to us');
	});

	it('renders the scroll-down marginalia', () => {
		const { container } = render(LandingInvitesSection);
		expect(container.textContent).toContain('scroll for the address');
	});

	it('renders body_1 with <strong> tags preserved via @html', () => {
		const { container } = render(LandingInvitesSection);
		expect(container.innerHTML).toContain('<strong>Conductors and librarians</strong>');
	});
});
