// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Margin from './Margin.svelte';
import { textSnippet } from '../../tests/snippet-helpers';

describe('Margin', () => {
	it('renders slot content', () => {
		const { container } = render(Margin, {
			props: { rotate: 0, children: textSnippet('a note') },
		});
		expect(container.textContent).toContain('a note');
	});

	it('uses display font (Caveat)', () => {
		const { container } = render(Margin, { props: { rotate: 0, children: textSnippet('x') } });
		const el = container.querySelector('div');
		expect(el?.className).toMatch(/font-display/);
	});

	it('applies inline rotation transform', () => {
		const { container } = render(Margin, { props: { rotate: -1.5, children: textSnippet('x') } });
		const el = container.querySelector('div');
		expect(el?.getAttribute('style') || '').toContain('rotate(-1.5deg)');
	});
});
