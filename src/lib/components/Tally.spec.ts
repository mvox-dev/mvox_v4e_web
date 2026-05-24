// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Tally from './Tally.svelte';

describe('Tally', () => {
	it('renders the numeral and label', () => {
		const { container } = render(Tally, { props: { n: 8, label: 'TICKED' } });
		expect(container.textContent).toContain('8');
		expect(container.textContent).toContain('TICKED');
	});

	it('numeral uses display font (Caveat)', () => {
		const { container } = render(Tally, { props: { n: 12, label: 'X' } });
		const num = container.querySelector('[data-tally-num]');
		expect(num?.className).toMatch(/font-display/);
	});

	it('applies red tone for negative state', () => {
		const { container } = render(Tally, { props: { n: 4, label: 'OVERDUE', tone: 'red' } });
		const num = container.querySelector('[data-tally-num]');
		expect(num?.className).toMatch(/text-red/);
	});
});
