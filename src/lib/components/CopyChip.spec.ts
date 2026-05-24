// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import CopyChip from './CopyChip.svelte';

describe('CopyChip', () => {
	it('renders the copy number', () => {
		const { container } = render(CopyChip, { props: { n: '01', checked: false } });
		expect(container.textContent).toContain('01');
	});

	it('applies checked background and strike when checked', () => {
		const { container } = render(CopyChip, { props: { n: '01', checked: true } });
		const cell = container.querySelector('[data-cell]');
		expect(cell?.className).toMatch(/bg-green-soft\/40|bg-\[rgba\(95,122,59/);
		const num = container.querySelector('[data-num]');
		expect(num?.className).toMatch(/line-through|strike/);
	});
});
