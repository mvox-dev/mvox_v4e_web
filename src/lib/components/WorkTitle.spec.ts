// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import WorkTitle from './WorkTitle.svelte';

describe('WorkTitle', () => {
	it('renders composer and title with em-dash separator', () => {
		const work = { composer: 'Arvo Pärt', title: 'Magnificat' };
		const { container } = render(WorkTitle, { props: { work } });
		expect(container.textContent).toContain('Arvo Pärt');
		expect(container.textContent).toContain('Magnificat');
		expect(container.textContent).toMatch(/—/);
	});

	it('renders title in italics when italic prop is true (default)', () => {
		const work = { composer: 'X', title: 'Y' };
		const { container } = render(WorkTitle, { props: { work } });
		const titleEl = container.querySelector('[data-title]');
		expect(titleEl?.className).toMatch(/italic/);
	});

	it('respects size variants (s|m|l|xl)', () => {
		const work = { composer: 'X', title: 'Y' };
		const { container } = render(WorkTitle, { props: { work, size: 'xl' } });
		const outer = container.querySelector('[data-worktitle]');
		expect(outer?.className).toMatch(/text-\[24px\]/);
	});
});
