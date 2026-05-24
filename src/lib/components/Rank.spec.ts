// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Rank from './Rank.svelte';

describe('Rank', () => {
	it('renders the numeral', () => {
		const { container } = render(Rank, { props: { n: 1 } });
		expect(container.textContent).toContain('1');
	});

	it('applies green tone classes', () => {
		const { container } = render(Rank, { props: { n: 1, tone: 'green' } });
		const el = container.querySelector('span');
		expect(el?.className).toMatch(/bg-green-soft/);
		expect(el?.className).toMatch(/border-green/);
	});

	it('applies red tone classes', () => {
		const { container } = render(Rank, { props: { n: 2, tone: 'red' } });
		const el = container.querySelector('span');
		expect(el?.className).toMatch(/bg-red-soft/);
	});

	it('applies indigo tone classes', () => {
		const { container } = render(Rank, { props: { n: 3, tone: 'indigo' } });
		const el = container.querySelector('span');
		expect(el?.className).toMatch(/bg-indigo-soft/);
	});
});
