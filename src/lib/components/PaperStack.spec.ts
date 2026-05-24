// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import PaperStack from './PaperStack.svelte';
import { textSnippet } from '../../tests/snippet-helpers';

describe('PaperStack', () => {
	it('renders slot content', () => {
		const { container } = render(PaperStack, {
			props: { rotate: 0, children: textSnippet('stack body') },
		});
		expect(container.textContent).toContain('stack body');
	});

	it('applies inline rotation', () => {
		const { container } = render(PaperStack, {
			props: { rotate: -0.8, children: textSnippet('x') },
		});
		const el = container.querySelector('[data-stack]');
		expect(el?.getAttribute('style') || '').toContain('rotate(-0.8deg)');
	});

	it('applies red border when tone="red"', () => {
		const { container } = render(PaperStack, {
			props: { rotate: 0, tone: 'red', children: textSnippet('x') },
		});
		const el = container.querySelector('[data-stack]');
		expect(el?.className).toMatch(/border-red/);
	});

	it('STRETCH INVARIANT: does not declare fixed height (children determine size)', () => {
		const { container } = render(PaperStack, {
			props: { rotate: 0, children: textSnippet('x') },
		});
		const el = container.querySelector('[data-stack]') as HTMLElement;
		expect(el.style.height).toBe('');
		expect(el.style.minHeight).toBe('');
		expect(el.style.maxHeight).toBe('');
	});
});
