// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { describe, it, expect, afterEach } from 'vitest';
import DashboardPillarCard from './DashboardPillarCard.svelte';

afterEach(cleanup);

describe('DashboardPillarCard', () => {
	it('renders as an anchor when href is provided', () => {
		const { container } = render(DashboardPillarCard, {
			variant: 'library',
			status: 'shipped',
			href: '/library',
			meta: '28 works · 552 copies · 2 overdue',
		});
		const anchor = container.querySelector('a[data-testid="dashboard-pillar-card"]');
		expect(anchor).not.toBeNull();
		expect(anchor?.getAttribute('href')).toBe('/library');
		expect(anchor?.textContent).toContain('Library');
		expect(anchor?.textContent).toContain('28 works');
	});

	it('renders as a disabled button when href is omitted', () => {
		const { container } = render(DashboardPillarCard, {
			variant: 'roster',
			status: 'indev',
			meta: 'In development',
		});
		const btn = container.querySelector('button[data-testid="dashboard-pillar-card"]');
		expect(btn).not.toBeNull();
		expect(btn?.hasAttribute('disabled')).toBe(true);
	});

	it('renders the SOON badge for non-shipped variants', () => {
		const { container } = render(DashboardPillarCard, {
			variant: 'roster',
			status: 'indev',
			meta: 'In development',
		});
		expect(container.textContent).toContain('SOON');
	});

	it('omits the SOON badge for shipped variants', () => {
		const { container } = render(DashboardPillarCard, {
			variant: 'library',
			status: 'shipped',
			href: '/library',
			meta: '28 works',
		});
		expect(container.textContent).not.toContain('SOON');
	});

	it('renders the lbl prop in the small-caps line above the title', () => {
		const { container } = render(DashboardPillarCard, {
			variant: 'library',
			status: 'shipped',
			href: '/library',
			meta: 'metadata',
			lbl: 'EFK · catalogue',
		});
		expect(container.textContent).toContain('EFK · catalogue');
	});
});
