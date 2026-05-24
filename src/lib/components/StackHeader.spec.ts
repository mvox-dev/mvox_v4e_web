// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import StackHeader from './StackHeader.svelte';

describe('StackHeader', () => {
	it('renders rank, title, subtitle, and stamp', () => {
		const { container } = render(StackHeader, {
			props: {
				rank: 1,
				title: 'Returns',
				subtitle: 'back from December',
				tone: 'green',
				stamp: 'ARRIVED',
			},
		});
		expect(container.textContent).toContain('1');
		expect(container.textContent).toContain('Returns');
		expect(container.textContent).toContain('back from December');
		expect(container.textContent).toContain('ARRIVED');
	});
});
