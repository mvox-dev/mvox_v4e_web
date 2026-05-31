// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { describe, it, expect, afterEach } from 'vitest';
import LandingDashboardGreet from './LandingDashboardGreet.svelte';

afterEach(cleanup);

describe('LandingDashboardGreet', () => {
	it('renders eyebrow + parameterized greeting + parameterized marginalia', () => {
		const { container } = render(LandingDashboardGreet, { name: 'Mihkel', org: 'EFK' });
		expect(container.textContent).toContain('Welcome back');
		expect(container.textContent).toContain('Welcome back, Mihkel.');
		expect(container.textContent).toContain('EFK · the back office');
	});

	it('omits the org marginalia when org is null', () => {
		const { container } = render(LandingDashboardGreet, { name: 'Mihkel', org: null });
		expect(container.textContent).not.toContain('· the back office');
	});
});
