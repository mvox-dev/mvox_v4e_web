// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { describe, it, expect, afterEach } from 'vitest';
import LandingPillarCard from './LandingPillarCard.svelte';

afterEach(cleanup);

describe('LandingPillarCard', () => {
	it('renders the library variant with SHIPPED badge', () => {
		const { container } = render(LandingPillarCard, { variant: 'library', status: 'shipped' });
		expect(container.textContent).toContain('Library');
		expect(container.textContent).toContain('Catalogue, copies, lending');
		expect(container.textContent).toContain('SHIPPED');
	});

	it('renders the roster variant with IN DEV badge', () => {
		const { container } = render(LandingPillarCard, { variant: 'roster', status: 'indev' });
		expect(container.textContent).toContain('Roster');
		expect(container.textContent).toContain('Members, sections');
		expect(container.textContent).toContain('IN DEV');
	});

	it('renders the notes variant with COMING badge', () => {
		const { container } = render(LandingPillarCard, { variant: 'notes', status: 'coming' });
		expect(container.textContent).toContain('Rehearsal notes');
		expect(container.textContent).toContain('Notes, attendance, schedule');
		expect(container.textContent).toContain('COMING');
	});

	it('renders the repertoire variant with COMING badge', () => {
		const { container } = render(LandingPillarCard, { variant: 'repertoire', status: 'coming' });
		expect(container.textContent).toContain('Repertoire');
		expect(container.textContent).toContain('Programs, seasons');
		expect(container.textContent).toContain('COMING');
	});

	it('applies a deterministic rotation class per variant', () => {
		const { container: a } = render(LandingPillarCard, { variant: 'library', status: 'shipped' });
		const pillarA = a.querySelector('[data-testid="landing-pillar-card"]');
		expect(pillarA?.getAttribute('style') || '').toMatch(/rotate\(-1\.2deg\)/);
		cleanup();
		const { container: b } = render(LandingPillarCard, { variant: 'roster', status: 'indev' });
		const pillarB = b.querySelector('[data-testid="landing-pillar-card"]');
		expect(pillarB?.getAttribute('style') || '').toMatch(/rotate\(0\.8deg\)/);
	});
});
