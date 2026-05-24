// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import PaperCard from './PaperCard.svelte';
import { textSnippet } from '../../tests/snippet-helpers';

describe('PaperCard', () => {
	it('renders slot content', () => {
		const { container } = render(PaperCard, {
			props: { rotate: 0, children: textSnippet('card body') },
		});
		expect(container.textContent).toContain('card body');
	});

	it('applies inline rotation', () => {
		const { container } = render(PaperCard, {
			props: { rotate: -0.6, children: textSnippet('x') },
		});
		const el = container.querySelector('[data-card]');
		expect(el?.getAttribute('style') || '').toContain('rotate(-0.6deg)');
	});

	it('STRETCH INVARIANT: no fixed height in primitive', () => {
		const { container } = render(PaperCard, {
			props: { rotate: 0, children: textSnippet('x') },
		});
		const el = container.querySelector('[data-card]') as HTMLElement;
		expect(el.style.height).toBe('');
		expect(el.style.minHeight).toBe('');
	});
});
