// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

describe('/library +page', () => {
	it('renders the three task stacks (Returns / Overdue / Pull for tonight)', () => {
		const { container } = render(Page);
		expect(container.textContent).toContain('Returns');
		expect(container.textContent).toContain('Overdue');
		expect(container.textContent).toContain('Pull for tonight');
		expect(container.textContent).toContain('ARRIVED');
		expect(container.textContent).toContain('OVERDUE');
		expect(container.textContent).toContain('TONIGHT');
	});

	it('renders the top strip with "On the desk today"', () => {
		const { container } = render(Page);
		expect(container.textContent).toContain('On the desk today');
		expect(container.textContent).toContain("librarian's desk");
	});

	it('renders the ambient catalog strip with stats', () => {
		const { container } = render(Page);
		expect(container.textContent).toContain('Catalog \xb7 13 works');
		expect(container.textContent).toContain('Open full catalog');
	});

	it('renders specific bundle content (Tallis, Part, Tormis)', () => {
		const { container } = render(Page);
		expect(container.textContent).toContain('Thomas Tallis');
		expect(container.textContent).toContain('Arvo P\xe4rt');
		expect(container.textContent).toContain('Veljo Tormis');
	});
});
