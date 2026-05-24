// @vitest-environment happy-dom
import { render, fireEvent } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import PencilCheckbox from './PencilCheckbox.svelte';

describe('PencilCheckbox', () => {
	it('renders unchecked by default', () => {
		const { container } = render(PencilCheckbox, { props: {} });
		const el = container.querySelector('span');
		expect(el?.getAttribute('data-checked')).toBe('false');
	});

	it('renders checked when prop is true', () => {
		const { container } = render(PencilCheckbox, { props: { checked: true } });
		const el = container.querySelector('span');
		expect(el?.getAttribute('data-checked')).toBe('true');
	});

	it('fires onclick when clicked', async () => {
		const onclick = vi.fn();
		const { container } = render(PencilCheckbox, { props: { onclick } });
		const el = container.querySelector('span')!;
		await fireEvent.click(el);
		expect(onclick).toHaveBeenCalledOnce();
	});
});
