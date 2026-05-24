// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Stamp from './Stamp.svelte';

describe('Stamp', () => {
	it('renders the label', () => {
		const { container } = render(Stamp, { props: { label: 'ARRIVED', tone: 'green' } });
		expect(container.textContent).toContain('ARRIVED');
	});

	it('applies -3deg rotation by default', () => {
		const { container } = render(Stamp, { props: { label: 'X', tone: 'green' } });
		const el = container.querySelector('span');
		expect(el?.getAttribute('style') || '').toContain('rotate(-3deg)');
	});

	it('applies red tone classes', () => {
		const { container } = render(Stamp, { props: { label: 'OVERDUE', tone: 'red' } });
		const el = container.querySelector('span');
		expect(el?.className).toMatch(/bg-red-soft/);
		expect(el?.className).toMatch(/border-red/);
	});
});
